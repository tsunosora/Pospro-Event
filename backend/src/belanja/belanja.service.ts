import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateBelanjaDto {
  amount: number;
  description: string;
  spentAt?: string;
  eventId?: number | null;
  rabCategoryId?: number | null;
  rabItemId?: number | null; // item RAB terpilih (opsional)
  category?: string | null;
  attributeToUserId?: number | null; // opsi: atribusikan ke admin lain (default = user token)
}

const INCLUDE = {
  event: { select: { id: true, code: true, name: true } },
  rabCategory: { select: { id: true, name: true } },
  rabItem: { select: { id: true, description: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

@Injectable()
export class BelanjaService {
  constructor(private prisma: PrismaService) {}

  async list(params: { from?: string; to?: string; eventId?: number; rabPlanId?: number; untagged?: boolean }) {
    const where: any = {};
    if (params.eventId) where.eventId = params.eventId;
    if (params.rabPlanId) where.rabPlanId = params.rabPlanId;
    if (params.untagged) {
      where.eventId = null;
      where.category = null;
    }
    if (params.from || params.to) {
      where.spentAt = {};
      if (params.from) where.spentAt.gte = new Date(params.from);
      if (params.to) where.spentAt.lte = new Date(params.to);
    }
    return this.prisma.belanja.findMany({ where, orderBy: [{ spentAt: 'desc' }, { id: 'desc' }], include: INCLUDE });
  }

  async create(dto: CreateBelanjaDto, tokenUserId: number) {
    if (!dto.description?.trim()) throw new BadRequestException('Deskripsi belanja wajib diisi');
    if (!(Number(dto.amount) > 0)) throw new BadRequestException('Nominal harus > 0');

    // Auto-resolve rabPlanId dari event (bila event punya RAB) → jadi real cost RAB
    let rabPlanId: number | null = null;
    if (dto.eventId) {
      const ev = await this.prisma.event.findUnique({ where: { id: dto.eventId }, select: { id: true, rabPlanId: true } });
      if (!ev) throw new NotFoundException('Event tidak ditemukan');
      rabPlanId = ev.rabPlanId ?? null;
    }
    const userId = dto.attributeToUserId || tokenUserId;
    const eventId = dto.eventId ?? null;
    let rabItemId: number | null = null;
    let rabCategoryId = eventId ? (dto.rabCategoryId ?? null) : null;
    // Item RAB terpilih: validasi milik RAB event ini, lalu isi pos dari kategori item bila belum diisi
    if (eventId && rabPlanId && dto.rabItemId) {
      const item = await this.prisma.rabItem.findUnique({
        where: { id: dto.rabItemId },
        select: { id: true, rabPlanId: true, categoryId: true },
      });
      if (item && item.rabPlanId === rabPlanId) {
        rabItemId = item.id;
        if (!rabCategoryId) rabCategoryId = item.categoryId;
      }
    }
    const category = eventId ? null : (dto.category?.trim() || 'Keperluan Lain');
    const spentAt = dto.spentAt ? new Date(dto.spentAt) : new Date();
    const description = dto.description.trim();

    // Kategori Cashflow (String wajib): pos RAB > kategori keperluan lain > default
    let cashflowCategory = category ?? 'Belanja Event';
    if (rabCategoryId) {
      const cat = await this.prisma.rabCategory.findUnique({ where: { id: rabCategoryId }, select: { name: true } });
      if (cat) cashflowCategory = cat.name;
    }

    // Transaksi: buat Cashflow EXPENSE dulu, lalu Belanja yang me-link ke sana
    return this.prisma.$transaction(async (tx) => {
      const cf = await tx.cashflow.create({
        data: {
          type: 'EXPENSE',
          category: cashflowCategory,
          amount: dto.amount,
          note: description,
          userId,
          date: spentAt,
          eventId,
          rabPlanId,
          excludeFromShift: true, // isolasi dari laporan shift POS
        },
      });
      return tx.belanja.create({
        data: {
          amount: dto.amount,
          description,
          spentAt,
          eventId,
          rabPlanId,
          rabCategoryId,
          rabItemId,
          category,
          cashflowId: cf.id,
          createdById: userId,
        },
        include: INCLUDE,
      });
    });
  }

  async attachNota(id: number, filename: string) {
    const row = await this.prisma.belanja.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Belanja tidak ditemukan');
    return this.prisma.belanja.update({ where: { id }, data: { notaUrl: `/uploads/belanja/${filename}` } });
  }

  async remove(id: number) {
    const row = await this.prisma.belanja.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Belanja tidak ditemukan');
    // Hapus belanja + entri Cashflow yang ter-link (transaksi)
    await this.prisma.$transaction(async (tx) => {
      await tx.belanja.delete({ where: { id } });
      if (row.cashflowId) await tx.cashflow.delete({ where: { id: row.cashflowId } }).catch(() => {});
    });
    return { ok: true };
  }

  /** Rekap belanja per hari (opsional filter periode). */
  async rekapHarian(params: { from?: string; to?: string }) {
    const rows = await this.list({ ...params });
    const byDay = new Map<string, { tanggal: string; total: number; items: typeof rows }>();
    for (const r of rows) {
      const key = r.spentAt.toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, { tanggal: key, total: 0, items: [] as any });
      const g = byDay.get(key)!;
      g.total += Number(r.amount);
      g.items.push(r);
    }
    return Array.from(byDay.values());
  }

  /** Realisasi RAB: rencana (RabItem quantityCost×priceCost) vs real (belanja ber-rabPlanId) per pos kategori. */
  async realisasiRab(rabPlanId: number) {
    const items = await this.prisma.rabItem.findMany({
      where: { rabPlanId },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!items.length) {
      const exists = await this.prisma.rabPlan.findUnique({ where: { id: rabPlanId }, select: { id: true } });
      if (!exists) throw new NotFoundException('RAB tidak ditemukan');
    }
    const planByCat = new Map<number, { categoryId: number; name: string; rencana: number }>();
    for (const it of items) {
      const cost = Number(it.quantityCost) * Number(it.priceCost);
      const cur = planByCat.get(it.categoryId) ?? { categoryId: it.categoryId, name: it.category.name, rencana: 0 };
      cur.rencana += cost;
      planByCat.set(it.categoryId, cur);
    }
    const realRows = await this.prisma.belanja.groupBy({ by: ['rabCategoryId'], where: { rabPlanId }, _sum: { amount: true } });
    const realByCat = new Map<number | null, number>();
    for (const r of realRows) realByCat.set(r.rabCategoryId, Number(r._sum.amount ?? 0));

    const pos = Array.from(planByCat.values()).map((p) => {
      const real = realByCat.get(p.categoryId) ?? 0;
      return { ...p, real, selisih: p.rencana - real, overspend: real > p.rencana };
    });
    const tanpaPos = realByCat.get(null) ?? 0; // belanja RAB ini tanpa pilih pos
    const totalRencana = pos.reduce((a, p) => a + p.rencana, 0);
    const totalReal = Array.from(realByCat.values()).reduce((a, v) => a + v, 0);
    return { pos, tanpaPos, totalRencana, totalReal, selisih: totalRencana - totalReal };
  }
}
