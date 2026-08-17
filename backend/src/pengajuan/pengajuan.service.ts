import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentNumberService } from '../document-numbers/document-number.service';
import { canConvert } from './pengajuan.logic';
import type {
  CreatePengajuanDto,
  CreatePengajuanItemDto,
  UpdatePengajuanItemDto,
} from './dto/pengajuan.dto';

const ITEM_INCLUDE: Prisma.PengajuanItemInclude = {
  category: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
};

const DETAIL_INCLUDE: Prisma.PengajuanInclude = {
  event: { select: { id: true, code: true, name: true, rabPlanId: true } },
  createdBy: { select: { id: true, name: true } },
  items: {
    include: ITEM_INCLUDE,
    orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
  },
};

@Injectable()
export class PengajuanService {
  constructor(
    private prisma: PrismaService,
    private docNumber: DocumentNumberService,
  ) {}

  list(eventId?: number) {
    return this.prisma.pengajuan.findMany({
      where: eventId ? { eventId } : undefined,
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        event: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    });
  }

  async findOne(id: number) {
    const row = await this.prisma.pengajuan.findUnique({
      where: { id },
      include: DETAIL_INCLUDE,
    });
    if (!row) throw new NotFoundException('Pengajuan tidak ditemukan');
    return row;
  }

  async create(dto: CreatePengajuanDto, userId: number) {
    const title = dto.title?.trim() || null;
    // Event opsional: bila tanpa event, judul wajib (dipakai jadi nama RAB baru saat convert).
    if (!dto.eventId && !title) {
      throw new BadRequestException('Pilih event atau isi judul pengajuan');
    }
    if (dto.eventId) {
      const ev = await this.prisma.event.findUnique({
        where: { id: dto.eventId },
        select: { id: true },
      });
      if (!ev) throw new NotFoundException('Event tidak ditemukan');
    }
    return this.prisma.pengajuan.create({
      data: {
        eventId: dto.eventId ?? null,
        title,
        createdById: userId,
        items: dto.items?.length
          ? { create: dto.items.map((it, idx) => this.buildItemData(it, idx)) }
          : undefined,
      },
      include: DETAIL_INCLUDE,
    });
  }

  private buildItemData(it: CreatePengajuanItemDto, idx: number) {
    if (!it.description?.trim()) throw new BadRequestException('Deskripsi item wajib diisi');
    if (!it.categoryId) throw new BadRequestException('Pos anggaran wajib dipilih');
    if (!(Number(it.quantity) > 0)) throw new BadRequestException('Jumlah harus > 0');
    if (!(Number(it.price) >= 0)) throw new BadRequestException('Harga tidak valid');
    return {
      categoryId: it.categoryId,
      description: it.description.trim(),
      unit: it.unit?.trim() || null,
      quantity: String(it.quantity),
      price: String(it.price),
      orderIndex: idx,
    };
  }

  async addItem(pengajuanId: number, dto: CreatePengajuanItemDto) {
    await this.assertExists(pengajuanId);
    const count = await this.prisma.pengajuanItem.count({ where: { pengajuanId } });
    return this.prisma.pengajuanItem.create({
      data: { pengajuanId, ...this.buildItemData(dto, count) },
      include: ITEM_INCLUDE,
    });
  }

  async updateItem(itemId: number, dto: UpdatePengajuanItemDto) {
    const item = await this.prisma.pengajuanItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item tidak ditemukan');
    if (item.convertedRabItemId)
      throw new BadRequestException('Item sudah ter-convert ke RAB, tidak bisa diubah');
    const data: {
      categoryId?: number;
      description?: string;
      unit?: string | null;
      quantity?: string;
      price?: string;
    } = {};
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.description !== undefined) data.description = dto.description.trim();
    if (dto.unit !== undefined) data.unit = dto.unit?.trim() || null;
    if (dto.quantity !== undefined) {
      if (!(Number(dto.quantity) > 0)) throw new BadRequestException('Jumlah harus > 0');
      data.quantity = String(dto.quantity);
    }
    if (dto.price !== undefined) {
      if (!(Number(dto.price) >= 0)) throw new BadRequestException('Harga tidak valid');
      data.price = String(dto.price);
    }
    return this.prisma.pengajuanItem.update({
      where: { id: itemId },
      data,
      include: ITEM_INCLUDE,
    });
  }

  async removeItem(itemId: number) {
    const item = await this.prisma.pengajuanItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item tidak ditemukan');
    if (item.convertedRabItemId)
      throw new BadRequestException('Item sudah ter-convert, tidak bisa dihapus');
    await this.prisma.pengajuanItem.delete({ where: { id: itemId } });
    return { ok: true };
  }

  async remove(id: number) {
    await this.assertExists(id);
    await this.prisma.pengajuan.delete({ where: { id } }); // cascade item
    return { ok: true };
  }

  private async assertExists(id: number) {
    const row = await this.prisma.pengajuan.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!row) throw new NotFoundException('Pengajuan tidak ditemukan');
  }

  // ── Approval per-item (gating owner dilakukan di controller via ManagerGuard) ──

  async approveItem(itemId: number, ownerUserId: number) {
    const item = await this.prisma.pengajuanItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item tidak ditemukan');
    return this.prisma.pengajuanItem.update({
      where: { id: itemId },
      data: { status: 'APPROVED', approvedById: ownerUserId, approvedAt: new Date() },
      include: ITEM_INCLUDE,
    });
  }

  /** Inbox persetujuan: semua item PENDING (belum ter-convert), dikelompokkan per pengajuan. */
  async pendingGroups() {
    const items = await this.prisma.pengajuanItem.findMany({
      where: { status: 'PENDING', convertedRabItemId: null },
      orderBy: [{ pengajuanId: 'asc' }, { orderIndex: 'asc' }, { id: 'asc' }],
      include: {
        category: { select: { id: true, name: true } },
        pengajuan: {
          select: {
            id: true,
            title: true,
            event: { select: { id: true, code: true, name: true } },
          },
        },
      },
    });
    const map = new Map<
      number,
      {
        pengajuanId: number;
        title: string | null;
        event: { id: number; code: string; name: string } | null;
        items: {
          id: number;
          description: string;
          unit: string | null;
          quantity: unknown;
          price: unknown;
          category: { id: number; name: string } | null;
        }[];
      }
    >();
    for (const it of items) {
      const p = it.pengajuan;
      if (!map.has(p.id)) {
        map.set(p.id, { pengajuanId: p.id, title: p.title, event: p.event, items: [] });
      }
      map.get(p.id)!.items.push({
        id: it.id,
        description: it.description,
        unit: it.unit,
        quantity: it.quantity,
        price: it.price,
        category: it.category,
      });
    }
    return Array.from(map.values());
  }

  /** Jumlah item menunggu approval (untuk badge). */
  async pendingCount() {
    const count = await this.prisma.pengajuanItem.count({
      where: { status: 'PENDING', convertedRabItemId: null },
    });
    return { count };
  }

  /** Setujui banyak item sekaligus (grup / semua). */
  async approveItems(itemIds: number[], ownerUserId: number) {
    const ids = (itemIds ?? []).map(Number).filter((n) => Number.isFinite(n));
    if (!ids.length) throw new BadRequestException('Tidak ada item dipilih');
    const res = await this.prisma.pengajuanItem.updateMany({
      where: { id: { in: ids }, status: 'PENDING', convertedRabItemId: null },
      data: { status: 'APPROVED', approvedById: ownerUserId, approvedAt: new Date() },
    });
    return { approved: res.count };
  }

  async unapproveItem(itemId: number) {
    const item = await this.prisma.pengajuanItem.findUnique({ where: { id: itemId } });
    if (!item) throw new NotFoundException('Item tidak ditemukan');
    if (item.convertedRabItemId)
      throw new BadRequestException('Item sudah ter-convert, tidak bisa dibatalkan approval');
    return this.prisma.pengajuanItem.update({
      where: { id: itemId },
      data: { status: 'PENDING', approvedById: null, approvedAt: null },
      include: ITEM_INCLUDE,
    });
  }

  // ── Convert ke RAB (append; auto-buat RAB bila event belum punya) ──

  /** Convert item ter-approve → RabItem (append). Auto-buat RAB bila event belum punya. */
  async convertToRab(pengajuanId: number) {
    const pengajuan = await this.prisma.pengajuan.findUnique({
      where: { id: pengajuanId },
      include: {
        event: {
          select: { id: true, name: true, code: true, rabPlanId: true },
        },
        items: true,
      },
    });
    if (!pengajuan) throw new NotFoundException('Pengajuan tidak ditemukan');

    const toConvert = pengajuan.items.filter(
      (it) => it.status === 'APPROVED' && it.convertedRabItemId == null,
    );
    if (!canConvert(pengajuan.items)) {
      throw new BadRequestException('Belum ada item ter-approve yang bisa di-convert');
    }

    // 1) Tentukan RAB target: rabPlanId pengajuan → RAB event → buat RAB baru (standalone/create new).
    let rabPlanId = pengajuan.rabPlanId ?? pengajuan.event?.rabPlanId ?? null;
    if (!rabPlanId) {
      const year = new Date().getFullYear();
      const seq = await this.docNumber.nextSequence('RAB', 'RAB', year);
      const code = `RAB-${year}-${seq.toString().padStart(4, '0')}`;
      const rabTitle =
        pengajuan.event?.name || pengajuan.title || pengajuan.event?.code || `RAB ${code}`;
      const rab = await this.prisma.rabPlan.create({
        data: {
          code,
          title: rabTitle,
          projectName: pengajuan.event?.name ?? pengajuan.title ?? null,
        },
        select: { id: true },
      });
      rabPlanId = rab.id;
      // tautkan RAB baru ke event (bila ada event)
      if (pengajuan.eventId) {
        await this.prisma.event.update({
          where: { id: pengajuan.eventId },
          data: { rabPlanId },
        });
      }
    }
    // Simpan RAB target di pengajuan (agar convert bertahap menyasar RAB yang sama).
    if (pengajuan.rabPlanId !== rabPlanId) {
      await this.prisma.pengajuan.update({
        where: { id: pengajuanId },
        data: { rabPlanId },
      });
    }

    // 2) orderIndex awal = max existing +1 (append, bukan replace)
    const maxOrder = await this.prisma.rabItem.aggregate({
      where: { rabPlanId },
      _max: { orderIndex: true },
    });
    let idx = (maxOrder._max.orderIndex ?? -1) + 1;

    // 3) Append item + tandai ter-convert (transaksi)
    const rabPlanIdFinal = rabPlanId;
    await this.prisma.$transaction(async (tx) => {
      for (const it of toConvert) {
        const rabItem = await tx.rabItem.create({
          data: {
            rabPlanId: rabPlanIdFinal,
            categoryId: it.categoryId,
            description: it.description,
            unit: it.unit,
            quantity: it.quantity, // JUMLAH → qty RAB
            quantityCost: it.quantity, // qty cost = jumlah
            priceRab: '0', // KEPUTUSAN: harga jual diisi terpisah di RAB
            priceCost: it.price, // KEPUTUSAN: harga pengajuan = cost
            orderIndex: idx++,
          },
        });
        await tx.pengajuanItem.update({
          where: { id: it.id },
          data: { convertedRabItemId: rabItem.id },
        });
      }
      // 4) status pengajuan: DONE bila semua item sudah ter-convert
      const remaining = await tx.pengajuanItem.count({
        where: { pengajuanId, convertedRabItemId: null },
      });
      await tx.pengajuan.update({
        where: { id: pengajuanId },
        data: { status: remaining === 0 ? 'DONE' : 'OPEN' },
      });
    });

    return { ok: true, rabPlanId: rabPlanIdFinal, convertedCount: toConvert.length };
  }
}
