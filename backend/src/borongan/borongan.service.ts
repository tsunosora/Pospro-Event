import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { mondayOf, sundayOf, eventRefDate } from './week.util';
import { BoronganClass } from '@prisma/client';

const CREW_INCLUDE = {
  worker: { select: { id: true, name: true, boronganClass: true } },
  event: { select: { id: true, code: true, name: true } },
} as const;

const SLIP_INCLUDE = {
  worker: { select: { id: true, name: true } },
  paidBy: { select: { id: true, name: true } },
  entries: { include: { event: { select: { id: true, code: true, name: true } } } },
} as const;

export interface UpsertBoronganCrewDto {
  workerId: number;
  boronganClass?: BoronganClass | null; // default: worker.boronganClass ?? KELAS_B
  amount?: number | string | null; // default: tarif kelas event
  notes?: string | null;
}

@Injectable()
export class BoronganService {
  constructor(private prisma: PrismaService) {}

  private async loadEvent(eventId: number) {
    const ev = await this.prisma.event.findUnique({
      where: { id: eventId },
      select: {
        id: true,
        boronganRateA: true,
        boronganRateB: true,
        eventStart: true,
        setupStart: true,
        loadingStart: true,
        departureStart: true,
        createdAt: true,
      },
    });
    if (!ev) throw new NotFoundException('Event tidak ditemukan');
    return ev;
  }

  private rateForClass(ev: { boronganRateA: any; boronganRateB: any }, kelas: BoronganClass): number {
    const r = kelas === 'KELAS_A' ? ev.boronganRateA : ev.boronganRateB;
    return r != null ? Number(r) : 0;
  }

  /** Set tarif borongan per kelas untuk sebuah event. */
  async setRates(eventId: number, dto: { rateA?: number | string | null; rateB?: number | string | null }) {
    await this.loadEvent(eventId);
    return this.prisma.event.update({
      where: { id: eventId },
      data: {
        boronganRateA: dto.rateA != null && dto.rateA !== '' ? (dto.rateA as any) : null,
        boronganRateB: dto.rateB != null && dto.rateB !== '' ? (dto.rateB as any) : null,
      },
      select: { id: true, boronganRateA: true, boronganRateB: true },
    });
  }

  /** Daftar entri borongan sebuah event + tarif event. */
  async listByEvent(eventId: number) {
    const ev = await this.loadEvent(eventId);
    const crew = await this.prisma.eventBoronganCrew.findMany({
      where: { eventId },
      orderBy: [{ boronganClass: 'asc' }, { id: 'asc' }],
      include: CREW_INCLUDE,
    });
    return { rateA: ev.boronganRateA, rateB: ev.boronganRateB, crew };
  }

  /** Assign tukang ke event (nominal default dari tarif kelas event, bisa override). */
  async addCrew(eventId: number, dto: UpsertBoronganCrewDto) {
    const ev = await this.loadEvent(eventId);
    if (!dto.workerId) throw new BadRequestException('Tukang wajib dipilih');
    const worker = await this.prisma.worker.findUnique({
      where: { id: dto.workerId },
      select: { id: true, boronganClass: true },
    });
    if (!worker) throw new NotFoundException('Tukang tidak ditemukan');

    const dup = await this.prisma.eventBoronganCrew.findUnique({
      where: { eventId_workerId: { eventId, workerId: dto.workerId } },
      select: { id: true },
    });
    if (dup) throw new BadRequestException('Tukang ini sudah ada di daftar borongan event');

    const kelas: BoronganClass = dto.boronganClass ?? worker.boronganClass ?? 'KELAS_B';
    const amount =
      dto.amount != null && dto.amount !== '' ? Number(dto.amount) : this.rateForClass(ev, kelas);
    if (!(amount >= 0)) throw new BadRequestException('Nominal borongan tidak valid');

    const week = mondayOf(eventRefDate(ev));
    return this.prisma.eventBoronganCrew.create({
      data: {
        eventId,
        workerId: dto.workerId,
        boronganClass: kelas,
        amount: amount as any,
        weekStart: week,
        notes: dto.notes?.trim() || null,
      },
      include: CREW_INCLUDE,
    });
  }

  /** Update entri (kelas/nominal/catatan). Ditolak bila slip sudah PAID. */
  async updateCrew(id: number, dto: Partial<UpsertBoronganCrewDto>) {
    const row = await this.prisma.eventBoronganCrew.findUnique({
      where: { id },
      include: { slip: { select: { status: true } } },
    });
    if (!row) throw new NotFoundException('Entri borongan tidak ditemukan');
    if (row.slip?.status === 'PAID')
      throw new BadRequestException('Slip sudah dibayar — batalkan pembayaran dulu');

    const data: any = {};
    if (dto.boronganClass) data.boronganClass = dto.boronganClass;
    if (dto.amount != null && dto.amount !== '') data.amount = Number(dto.amount) as any;
    if (dto.notes !== undefined) data.notes = dto.notes?.trim() || null;
    return this.prisma.eventBoronganCrew.update({ where: { id }, data, include: CREW_INCLUDE });
  }

  /** Hapus entri. Ditolak bila slip sudah PAID. */
  async removeCrew(id: number) {
    const row = await this.prisma.eventBoronganCrew.findUnique({
      where: { id },
      include: { slip: { select: { status: true } } },
    });
    if (!row) throw new NotFoundException('Entri borongan tidak ditemukan');
    if (row.slip?.status === 'PAID')
      throw new BadRequestException('Slip sudah dibayar — batalkan pembayaran dulu');
    await this.prisma.eventBoronganCrew.delete({ where: { id } });
    return { ok: true };
  }

  // ─── Slip mingguan ──────────────────────────────────────────────────────

  /** Parse "YYYY-MM-DD" → Date lokal (dinormalkan ke Senin); lempar bila invalid. */
  private parseWeekStart(weekStart: string): Date {
    const d = weekStart ? new Date(weekStart + 'T00:00:00') : new Date(NaN);
    if (isNaN(d.getTime())) throw new BadRequestException('Parameter minggu (weekStart) tidak valid');
    return mondayOf(d);
  }

  /**
   * Generate/refresh slip DRAFT untuk satu minggu:
   * - kumpulkan semua EventBoronganCrew dg weekStart = Senin minggu itu
   * - group per worker → upsert BoronganSlip (DRAFT), link entri ke slip, set total
   * Slip PAID di minggu itu TIDAK diubah (entri-nya di-skip).
   */
  async generateWeek(weekStart: string) {
    const monday = this.parseWeekStart(weekStart);
    const sunday = sundayOf(monday);

    return this.prisma.$transaction(async (tx) => {
      const entries = await tx.eventBoronganCrew.findMany({
        where: { weekStart: monday },
        include: { slip: { select: { status: true } } },
      });
      // group per worker (skip entri yg sudah nempel slip PAID)
      const byWorker = new Map<number, typeof entries>();
      for (const e of entries) {
        if (e.slip?.status === 'PAID') continue;
        const arr = byWorker.get(e.workerId) ?? [];
        arr.push(e);
        byWorker.set(e.workerId, arr);
      }

      let generated = 0;
      for (const [workerId, list] of byWorker) {
        const total = list.reduce((a, e) => a + Number(e.amount), 0);
        const slip = await tx.boronganSlip.upsert({
          where: { weekStart_workerId: { weekStart: monday, workerId } },
          create: { weekStart: monday, weekEnd: sunday, workerId, totalAmount: total as any, status: 'DRAFT' },
          update: { weekEnd: sunday, totalAmount: total as any }, // hanya DRAFT yg sampai sini
        });
        await tx.eventBoronganCrew.updateMany({
          where: { id: { in: list.map((e) => e.id) } },
          data: { slipId: slip.id },
        });
        generated += 1;
      }
      return { weekStart: monday, weekEnd: sunday, generated };
    });
  }

  /** Daftar slip suatu minggu (default) atau rentang. */
  async listSlips(params: { weekStart?: string; from?: string; to?: string; status?: string }) {
    const where: any = {};
    if (params.weekStart) where.weekStart = this.parseWeekStart(params.weekStart);
    if (params.status) where.status = params.status;
    if (params.from || params.to) {
      const range: any = {};
      if (params.from) range.gte = mondayOf(new Date(params.from + 'T00:00:00'));
      if (params.to) range.lte = mondayOf(new Date(params.to + 'T00:00:00'));
      where.weekStart = range;
    }
    return this.prisma.boronganSlip.findMany({
      where,
      orderBy: [{ weekStart: 'desc' }, { workerId: 'asc' }],
      include: SLIP_INCLUDE,
    });
  }

  /** Ringkasan per minggu (jumlah slip, total, berapa sudah dibayar). */
  async weekSummary() {
    const rows = await this.prisma.boronganSlip.groupBy({
      by: ['weekStart', 'status'],
      _count: { _all: true },
      _sum: { totalAmount: true },
      orderBy: { weekStart: 'desc' },
    });
    const map = new Map<string, any>();
    for (const r of rows) {
      const key = r.weekStart.toISOString().slice(0, 10);
      const g = map.get(key) ?? { weekStart: key, total: 0, paid: 0, draft: 0, slips: 0 };
      const sum = Number(r._sum.totalAmount ?? 0);
      g.total += sum;
      g.slips += r._count._all;
      if (r.status === 'PAID') g.paid += sum;
      else g.draft += sum;
      map.set(key, g);
    }
    return Array.from(map.values());
  }

  /**
   * Bayar slip: untuk tiap entri buat Cashflow EXPENSE (tag eventId → laba event akurat),
   * simpan cashflowId, tandai slip PAID. `paidById` = user token.
   */
  async paySlip(slipId: number, paidById: number) {
    return this.prisma.$transaction(async (tx) => {
      const slip = await tx.boronganSlip.findUnique({
        where: { id: slipId },
        include: { worker: { select: { name: true } }, entries: true },
      });
      if (!slip) throw new NotFoundException('Slip tidak ditemukan');
      if (slip.status === 'PAID') throw new BadRequestException('Slip sudah dibayar');
      if (!slip.entries.length) throw new BadRequestException('Slip tidak punya entri untuk dibayar');

      const wk = slip.weekStart.toISOString().slice(0, 10);
      let total = 0;
      for (const e of slip.entries) {
        const amt = Number(e.amount);
        total += amt;
        const cf = await tx.cashflow.create({
          data: {
            type: 'EXPENSE',
            category: 'Gaji Borongan',
            amount: amt as any,
            note: `Borongan ${slip.worker.name} — minggu ${wk} (${e.boronganClass})`,
            userId: paidById,
            date: new Date(),
            eventId: e.eventId, // tag ke event → laba per event akurat
            excludeFromShift: true,
          },
        });
        await tx.eventBoronganCrew.update({ where: { id: e.id }, data: { cashflowId: cf.id } });
      }
      return tx.boronganSlip.update({
        where: { id: slipId },
        data: { status: 'PAID', paidAt: new Date(), paidById, totalAmount: total as any },
        include: SLIP_INCLUDE,
      });
    });
  }

  /** Batalkan pembayaran: hapus Cashflow terkait, kembalikan slip ke DRAFT. */
  async unpaySlip(slipId: number) {
    return this.prisma.$transaction(async (tx) => {
      const slip = await tx.boronganSlip.findUnique({ where: { id: slipId }, include: { entries: true } });
      if (!slip) throw new NotFoundException('Slip tidak ditemukan');
      if (slip.status !== 'PAID') throw new BadRequestException('Slip belum dibayar');
      const cfIds = slip.entries.map((e) => e.cashflowId).filter((x): x is number => x != null);
      await tx.eventBoronganCrew.updateMany({ where: { slipId }, data: { cashflowId: null } });
      if (cfIds.length) await tx.cashflow.deleteMany({ where: { id: { in: cfIds } } });
      return tx.boronganSlip.update({
        where: { id: slipId },
        data: { status: 'DRAFT', paidAt: null, paidById: null },
        include: SLIP_INCLUDE,
      });
    });
  }
}
