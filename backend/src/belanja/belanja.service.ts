import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateBelanjaDto {
  amount: number;
  quantity?: number | null;
  unit?: string | null;
  description: string;
  spentAt?: string;
  eventId?: number | null;
  rabPlanId?: number | null; // RAB terpilih (eksplisit) — override tautan event.rabPlanId
  rabCategoryId?: number | null;
  rabItemId?: number | null; // item RAB terpilih (opsional)
  category?: string | null;
  menuPlanId?: number | null; // tag ke rencana menu makan (real cost)
  attributeToUserId?: number | null; // opsi: atribusikan ke admin lain (default = user token)
}

export interface BelanjaBatchItemDto {
  amount: number;
  quantity?: number | null;
  unit?: string | null;
  description: string;
  eventId?: number | null;
  rabPlanId?: number | null;
  rabCategoryId?: number | null;
  rabItemId?: number | null;
  category?: string | null;
  menuPlanId?: number | null;
}

export interface CreateBelanjaBatchDto {
  spentAt?: string;
  attributeToUserId?: number | null;
  items: BelanjaBatchItemDto[];
}

const INCLUDE = {
  event: { select: { id: true, code: true, name: true } },
  rabPlan: { select: { id: true, code: true, title: true } },
  rabCategory: { select: { id: true, name: true } },
  rabItem: { select: { id: true, description: true } },
  menuPlan: { select: { id: true, planDate: true, menu: { select: { id: true, name: true } } } },
  createdBy: { select: { id: true, name: true } },
} as const;

@Injectable()
export class BelanjaService {
  constructor(private prisma: PrismaService) {}

  async list(params: { from?: string; to?: string; eventId?: number; rabPlanId?: number; rabItemId?: number; menuPlanId?: number; untagged?: boolean }) {
    const where: any = {};
    if (params.eventId) where.eventId = params.eventId;
    if (params.rabPlanId) where.rabPlanId = params.rabPlanId;
    if (params.rabItemId) where.rabItemId = params.rabItemId;
    if (params.menuPlanId) where.menuPlanId = params.menuPlanId;
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

  /** Resolusi tag belanja (RAB/event/pos/item/kategori) + nama kategori untuk Cashflow. Dipakai create & update. */
  private async resolveFields(dto: CreateBelanjaDto) {
    // RAB untuk real cost: pakai pilihan eksplisit dulu, fallback ke tautan event.rabPlanId
    let rabPlanId: number | null = null;
    if (dto.eventId) {
      const ev = await this.prisma.event.findUnique({ where: { id: dto.eventId }, select: { id: true, rabPlanId: true } });
      if (!ev) throw new NotFoundException('Event tidak ditemukan');
      rabPlanId = ev.rabPlanId ?? null;
    }
    if (dto.rabPlanId) {
      const rab = await this.prisma.rabPlan.findUnique({ where: { id: dto.rabPlanId }, select: { id: true } });
      if (rab) rabPlanId = rab.id;
    }
    const eventId = dto.eventId ?? null;
    // "Proyek" = terkait event/RAB. "Keperluan Lain" = tanpa keduanya (pakai label kategori bebas).
    const isProject = !!(eventId || rabPlanId);
    let rabItemId: number | null = null;
    let rabCategoryId = isProject ? (dto.rabCategoryId ?? null) : null;
    // Item RAB terpilih: validasi milik RAB terpilih, lalu isi pos dari kategori item bila belum diisi
    if (rabPlanId && dto.rabItemId) {
      const item = await this.prisma.rabItem.findUnique({
        where: { id: dto.rabItemId },
        select: { id: true, rabPlanId: true, categoryId: true },
      });
      if (item && item.rabPlanId === rabPlanId) {
        rabItemId = item.id;
        if (!rabCategoryId) rabCategoryId = item.categoryId;
      }
    }
    // Tag ke rencana menu makan (real cost). Validasi ada; bila tidak, abaikan.
    let menuPlanId: number | null = null;
    if (dto.menuPlanId) {
      const plan = await this.prisma.menuMakanPlan.findUnique({ where: { id: dto.menuPlanId }, select: { id: true } });
      menuPlanId = plan?.id ?? null;
    }
    // Label kategori non-proyek: belanja menu → "Konsumsi", selain itu label bebas / "Keperluan Lain"
    const category = isProject ? null : (dto.category?.trim() || (menuPlanId ? 'Konsumsi' : 'Keperluan Lain'));
    // Kategori Cashflow (String wajib): pos RAB > label keperluan lain > default proyek
    let cashflowCategory = category ?? (rabPlanId ? 'Belanja Proyek' : 'Belanja');
    if (rabCategoryId) {
      const cat = await this.prisma.rabCategory.findUnique({ where: { id: rabCategoryId }, select: { name: true } });
      if (cat) cashflowCategory = cat.name;
    }
    return { eventId, rabPlanId, rabItemId, rabCategoryId, category, menuPlanId, cashflowCategory };
  }

  async create(dto: CreateBelanjaDto, tokenUserId: number) {
    if (!dto.description?.trim()) throw new BadRequestException('Deskripsi belanja wajib diisi');
    if (!(Number(dto.amount) > 0)) throw new BadRequestException('Nominal harus > 0');
    const f = await this.resolveFields(dto);
    const userId = dto.attributeToUserId || tokenUserId;
    const spentAt = dto.spentAt ? new Date(dto.spentAt) : new Date();
    const description = dto.description.trim();

    // Transaksi: buat Cashflow EXPENSE dulu, lalu Belanja yang me-link ke sana
    return this.prisma.$transaction(async (tx) => {
      const cf = await tx.cashflow.create({
        data: {
          type: 'EXPENSE',
          category: f.cashflowCategory,
          amount: dto.amount,
          note: description,
          userId,
          date: spentAt,
          eventId: f.eventId,
          rabPlanId: f.rabPlanId,
          excludeFromShift: true, // isolasi dari laporan shift POS
        },
      });
      return tx.belanja.create({
        data: {
          amount: dto.amount,
          quantity: dto.quantity ?? null,
          unit: dto.unit?.trim() || null,
          description,
          spentAt,
          eventId: f.eventId,
          rabPlanId: f.rabPlanId,
          rabCategoryId: f.rabCategoryId,
          rabItemId: f.rabItemId,
          category: f.category,
          menuPlanId: f.menuPlanId,
          cashflowId: cf.id,
          createdById: userId,
        },
        include: INCLUDE,
      });
    });
  }

  /** Satu nota banyak item: buat N Belanja berbagi notaGroupId (nota sama), tiap baris punya tag/real-cost sendiri. */
  async createBatch(dto: CreateBelanjaBatchDto, tokenUserId: number) {
    if (!dto.items?.length) throw new BadRequestException('Minimal satu item belanja');
    const userId = dto.attributeToUserId || tokenUserId;
    const spentAt = dto.spentAt ? new Date(dto.spentAt) : new Date();
    const notaGroupId = `nota-${Date.now()}-${Math.round(Math.random() * 1e9)}`;

    // Validasi + resolve tag tiap baris (di luar transaksi)
    const resolved: { amount: number; quantity: number | null; unit: string | null; description: string; f: Awaited<ReturnType<BelanjaService['resolveFields']>> }[] = [];
    for (const it of dto.items) {
      if (!it.description?.trim()) throw new BadRequestException('Deskripsi tiap item wajib diisi');
      if (!(Number(it.amount) > 0)) throw new BadRequestException('Nominal tiap item harus > 0');
      const f = await this.resolveFields(it as CreateBelanjaDto);
      resolved.push({
        amount: it.amount,
        quantity: it.quantity ?? null,
        unit: it.unit?.trim() || null,
        description: it.description.trim(),
        f,
      });
    }

    return this.prisma.$transaction(async (tx) => {
      const belanja = [] as any[];
      for (const r of resolved) {
        const cf = await tx.cashflow.create({
          data: {
            type: 'EXPENSE',
            category: r.f.cashflowCategory,
            amount: r.amount,
            note: r.description,
            userId,
            date: spentAt,
            eventId: r.f.eventId,
            rabPlanId: r.f.rabPlanId,
            excludeFromShift: true,
          },
        });
        const b = await tx.belanja.create({
          data: {
            amount: r.amount,
            quantity: r.quantity,
            unit: r.unit,
            description: r.description,
            spentAt,
            eventId: r.f.eventId,
            rabPlanId: r.f.rabPlanId,
            rabCategoryId: r.f.rabCategoryId,
            rabItemId: r.f.rabItemId,
            category: r.f.category,
            menuPlanId: r.f.menuPlanId,
            cashflowId: cf.id,
            notaGroupId,
            createdById: userId,
          },
          include: INCLUDE,
        });
        belanja.push(b);
      }
      return { notaGroupId, belanja };
    });
  }

  /** Lampirkan 1 nota ke semua baris dalam grup (nota sama untuk banyak item). */
  async attachNotaGroup(notaGroupId: string, filename: string) {
    const url = `/uploads/belanja/${filename}`;
    const res = await this.prisma.belanja.updateMany({ where: { notaGroupId }, data: { notaUrl: url } });
    if (res.count === 0) throw new NotFoundException('Grup belanja tidak ditemukan');
    return { ok: true, updated: res.count, notaUrl: url };
  }

  async update(id: number, dto: CreateBelanjaDto, tokenUserId: number) {
    const existing = await this.prisma.belanja.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Belanja tidak ditemukan');
    if (!dto.description?.trim()) throw new BadRequestException('Deskripsi belanja wajib diisi');
    if (!(Number(dto.amount) > 0)) throw new BadRequestException('Nominal harus > 0');
    const f = await this.resolveFields(dto);
    // createdBy tetap pemilik lama kecuali di-override eksplisit
    const userId = dto.attributeToUserId || existing.createdById || tokenUserId;
    const spentAt = dto.spentAt ? new Date(dto.spentAt) : existing.spentAt;
    const description = dto.description.trim();

    // Transaksi: update Belanja + Cashflow terkait supaya konsisten (event-profit akurat)
    return this.prisma.$transaction(async (tx) => {
      if (existing.cashflowId) {
        await tx.cashflow.update({
          where: { id: existing.cashflowId },
          data: {
            category: f.cashflowCategory,
            amount: dto.amount,
            note: description,
            userId,
            date: spentAt,
            eventId: f.eventId,
            rabPlanId: f.rabPlanId,
          },
        });
      }
      return tx.belanja.update({
        where: { id },
        data: {
          amount: dto.amount,
          quantity: dto.quantity ?? null,
          unit: dto.unit?.trim() || null,
          description,
          spentAt,
          eventId: f.eventId,
          rabPlanId: f.rabPlanId,
          rabCategoryId: f.rabCategoryId,
          rabItemId: f.rabItemId,
          category: f.category,
          menuPlanId: f.menuPlanId,
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

  /**
   * Realisasi RAB: Modal/Rencana (RabItem quantityCost×priceCost, dari pengajuan) vs
   * Real (belanja harian ber-rabPlanId). `priceCost` = MODAL/RENCANA; real cost = belanja.
   * - `perItem`: SEMUA item modal (termasuk yang belum dibeli, real=0) + status hemat/boros/belum.
   * - `extra`: belanja "di luar modal" (rabItemId null) — item tambahan saat belanja.
   * - `pos`: agregasi per kategori (kompat lama, dipakai dropdown pos).
   */
  async realisasiRab(rabPlanId: number) {
    const items = await this.prisma.rabItem.findMany({
      where: { rabPlanId },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!items.length) {
      const exists = await this.prisma.rabPlan.findUnique({ where: { id: rabPlanId }, select: { id: true } });
      if (!exists) throw new NotFoundException('RAB tidak ditemukan');
    }

    // ── Per kategori (pos) — dipertahankan untuk dropdown & kompat ──
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
    const tanpaPos = realByCat.get(null) ?? 0;

    // ── Real per item modal (rabItemId) ──
    const realByItemRows = await this.prisma.belanja.groupBy({
      by: ['rabItemId'],
      where: { rabPlanId, rabItemId: { not: null } },
      _sum: { amount: true },
    });
    const realByItem = new Map<number, number>();
    for (const r of realByItemRows) realByItem.set(r.rabItemId as number, Number(r._sum.amount ?? 0));

    // Semua item modal (termasuk yang belum dibeli). status: belum | hemat | boros | pas
    const perItem = items
      .map((it) => {
        const modal = Number(it.quantityCost) * Number(it.priceCost);
        const real = realByItem.get(it.id) ?? 0;
        const selisih = modal - real;
        const status = real === 0 ? 'belum' : real < modal ? 'hemat' : real > modal ? 'boros' : 'pas';
        return {
          rabItemId: it.id,
          description: it.description,
          categoryName: it.category.name,
          modal,
          rencana: modal, // alias kompat
          real,
          selisih,
          overspend: real > modal,
          status,
        };
      })
      .sort((a, b) => b.modal - a.modal);

    // ── Belanja di luar modal (rabItemId null) — item tambahan saat belanja ──
    const extraRows = await this.prisma.belanja.findMany({
      where: { rabPlanId, rabItemId: null },
      select: { description: true, amount: true, rabCategory: { select: { name: true } } },
    });
    const extraMap = new Map<string, { description: string; categoryName: string | null; real: number; count: number }>();
    for (const b of extraRows) {
      const desc = (b.description || 'Lainnya').trim();
      const key = desc.toLowerCase();
      const cur = extraMap.get(key) ?? { description: desc, categoryName: b.rabCategory?.name ?? null, real: 0, count: 0 };
      cur.real += Number(b.amount);
      cur.count += 1;
      extraMap.set(key, cur);
    }
    const extra = Array.from(extraMap.values()).sort((a, b) => b.real - a.real);

    // ── Total ──
    const totalModal = perItem.reduce((a, p) => a + p.modal, 0);
    const totalRealMatched = perItem.reduce((a, p) => a + p.real, 0);
    const totalExtra = extra.reduce((a, e) => a + e.real, 0);
    const totalReal = totalRealMatched + totalExtra;

    return {
      pos,
      perItem,
      extra,
      tanpaPos,
      totalModal,
      totalExtra,
      totalRealMatched,
      totalRencana: totalModal, // alias kompat
      totalReal,
      selisih: totalModal - totalReal,
    };
  }
}
