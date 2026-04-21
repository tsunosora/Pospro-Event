import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ClickPaperSize, ClickColorMode, ClickSideMode, RejectType } from '@prisma/client';

// Default click rates sesuai spreadsheet
const DEFAULT_CLICK_RATES = [
  { name: 'A3+ WARNA', paperSize: ClickPaperSize.A3_PLUS, colorMode: ClickColorMode.COLOR, sideMode: ClickSideMode.SIMPLEX, pricePerClick: 1000 },
  { name: 'A3+ BW', paperSize: ClickPaperSize.A3_PLUS, colorMode: ClickColorMode.BW, sideMode: ClickSideMode.SIMPLEX, pricePerClick: 300 },
  { name: 'A4 WARNA', paperSize: ClickPaperSize.A4, colorMode: ClickColorMode.COLOR, sideMode: ClickSideMode.SIMPLEX, pricePerClick: 500 },
  { name: 'A4 BW', paperSize: ClickPaperSize.A4, colorMode: ClickColorMode.BW, sideMode: ClickSideMode.SIMPLEX, pricePerClick: 150 },
  { name: 'A3+ 2MUKA WARNA', paperSize: ClickPaperSize.A3_PLUS, colorMode: ClickColorMode.COLOR, sideMode: ClickSideMode.DUPLEX, pricePerClick: 2000 },
  { name: 'A3+ 2MUKA BW', paperSize: ClickPaperSize.A3_PLUS, colorMode: ClickColorMode.BW, sideMode: ClickSideMode.DUPLEX, pricePerClick: 600 },
  { name: 'A4 2MUKA WARNA', paperSize: ClickPaperSize.A4, colorMode: ClickColorMode.COLOR, sideMode: ClickSideMode.DUPLEX, pricePerClick: 1000 },
  { name: 'A4 2MUKA BW', paperSize: ClickPaperSize.A4, colorMode: ClickColorMode.BW, sideMode: ClickSideMode.DUPLEX, pricePerClick: 300 },
];

const DEFAULT_REJECT_PRICE = 1000;

// Helper: map CounterType ke ClickColorMode untuk ambil tarif dari ClickRate
function counterTypeToColorMode(counterType: string): ClickColorMode | null {
  if (counterType === 'FULL_COLOR' || counterType === 'SINGLE_COLOR') return ClickColorMode.COLOR;
  if (counterType === 'BLACK') return ClickColorMode.BW;
  return null;
}

@Injectable()
export class ClickCountingService {
  constructor(private prisma: PrismaService) {}

  // ─── Click Rates ────────────────────────────────────────────────────────────

  async getRates() {
    return (this.prisma as any).clickRate.findMany({ orderBy: [{ paperSize: 'asc' }, { sideMode: 'asc' }, { colorMode: 'asc' }] });
  }

  async createRate(data: { name: string; paperSize: string; colorMode: string; sideMode: string; pricePerClick: number }) {
    return (this.prisma as any).clickRate.create({ data });
  }

  async updateRate(id: number, data: { name?: string; pricePerClick?: number; isActive?: boolean }) {
    await (this.prisma as any).clickRate.findUniqueOrThrow({ where: { id } });
    return (this.prisma as any).clickRate.update({ where: { id }, data });
  }

  async deleteRate(id: number) {
    await (this.prisma as any).clickRate.findUniqueOrThrow({ where: { id } });
    return (this.prisma as any).clickRate.delete({ where: { id } });
  }

  async seedRates() {
    let created = 0;
    let skipped = 0;
    for (const rate of DEFAULT_CLICK_RATES) {
      const existing = await (this.prisma as any).clickRate.findUnique({
        where: { paperSize_colorMode_sideMode: { paperSize: rate.paperSize, colorMode: rate.colorMode, sideMode: rate.sideMode } },
      });
      if (!existing) {
        await (this.prisma as any).clickRate.create({ data: rate });
        created++;
      } else {
        skipped++;
      }
    }
    return { created, skipped, message: `${created} rate dibuat, ${skipped} sudah ada` };
  }

  // ─── Click Logs ─────────────────────────────────────────────────────────────

  async getLogs(month?: number, year?: number) {
    const where: any = {};
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    }
    return (this.prisma as any).clickLog.findMany({
      where,
      include: {
        clickRate: true,
        transactionItem: {
          select: {
            id: true,
            transaction: {
              select: { id: true, invoiceNumber: true, customerName: true },
            },
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  async createLog(data: { clickRateId: number; quantity: number; date?: string; transactionItemId?: number }) {
    const rate = await (this.prisma as any).clickRate.findUniqueOrThrow({ where: { id: data.clickRateId } });
    const pricePerClick = Number(rate.pricePerClick);
    const totalCost = pricePerClick * data.quantity;
    return (this.prisma as any).clickLog.create({
      data: {
        clickRateId: data.clickRateId,
        quantity: data.quantity,
        pricePerClick,
        totalCost,
        date: data.date ? new Date(data.date) : new Date(),
        transactionItemId: data.transactionItemId ?? null,
      },
      include: { clickRate: true },
    });
  }

  async deleteLog(id: number) {
    await (this.prisma as any).clickLog.findUniqueOrThrow({ where: { id } });
    return (this.prisma as any).clickLog.delete({ where: { id } });
  }

  // ─── Machine Rejects ────────────────────────────────────────────────────────

  async getRejects(month?: number, year?: number) {
    const where: any = {};
    if (month && year) {
      const start = new Date(year, month - 1, 1);
      const end = new Date(year, month, 0, 23, 59, 59, 999);
      where.date = { gte: start, lte: end };
    }
    return (this.prisma as any).machineReject.findMany({
      where,
      orderBy: { date: 'desc' },
    });
  }

  async createReject(data: {
    rejectType: string;
    cause?: string;
    counterType?: string;
    quantity: number;
    pricePerClick?: number;
    notes?: string;
    photoUrl?: string;
    date?: string;
  }) {
    const cause = data.cause ?? 'MACHINE';
    const counterType = data.counterType ?? 'FULL_COLOR';

    // Auto-compute pricePerClick dari ClickRate(A3_PLUS, colorMode) kalau tidak disediakan
    let pricePerClick = data.pricePerClick;
    if (pricePerClick === undefined || pricePerClick === null) {
      const colorMode = counterTypeToColorMode(counterType);
      if (colorMode) {
        const rate = await (this.prisma as any).clickRate.findFirst({
          where: { paperSize: 'A3_PLUS', colorMode, sideMode: 'SIMPLEX', isActive: true },
        });
        pricePerClick = rate ? Number(rate.pricePerClick) : DEFAULT_REJECT_PRICE;
      } else {
        pricePerClick = DEFAULT_REJECT_PRICE;
      }
    }
    const totalCost = pricePerClick * data.quantity;

    return (this.prisma as any).machineReject.create({
      data: {
        rejectType: data.rejectType as RejectType,
        cause,
        counterType,
        quantity: data.quantity,
        pricePerClick,
        totalCost,
        photoUrl: data.photoUrl ?? null,
        notes: data.notes ?? null,
        date: data.date ? new Date(data.date) : new Date(),
      },
    });
  }

  async deleteReject(id: number) {
    await (this.prisma as any).machineReject.findUniqueOrThrow({ where: { id } });
    return (this.prisma as any).machineReject.delete({ where: { id } });
  }

  // ─── Meter Readings (harian, per readingDate) ───────────────────────────────

  async getMeterReadings(startDate?: string, endDate?: string) {
    const where: any = {};
    if (startDate || endDate) {
      where.readingDate = {};
      if (startDate) where.readingDate.gte = new Date(startDate);
      if (endDate) where.readingDate.lte = new Date(endDate);
    }
    return (this.prisma as any).meterReading.findMany({
      where,
      orderBy: { readingDate: 'desc' },
    });
  }

  async getMeterReadingByDate(date: string) {
    return (this.prisma as any).meterReading.findUnique({
      where: { readingDate: new Date(date) },
    });
  }

  async upsertMeterReading(data: {
    readingDate: string;
    totalCount: number;
    fullColorCount: number;
    blackCount: number;
    singleColorCount?: number;
    photoUrl?: string;
    notes?: string;
  }) {
    const readingDate = new Date(data.readingDate);
    const payload = {
      readingDate,
      totalCount: data.totalCount,
      fullColorCount: data.fullColorCount,
      blackCount: data.blackCount,
      singleColorCount: data.singleColorCount ?? 0,
      photoUrl: data.photoUrl ?? null,
      notes: data.notes ?? null,
    };

    // Soft warn (tidak block) — sanity check di response
    const expectedTotal = payload.fullColorCount + payload.blackCount + payload.singleColorCount;
    // Biarkan user simpan meskipun mismatch — tampilkan warning di frontend

    return (this.prisma as any).meterReading.upsert({
      where: { readingDate },
      create: payload,
      update: payload,
    });
  }

  async deleteMeterReading(id: number) {
    await (this.prisma as any).meterReading.findUniqueOrThrow({ where: { id } });
    return (this.prisma as any).meterReading.delete({ where: { id } });
  }

  // ─── Vendor Bill (rekonsiliasi per range tanggal) ───────────────────────────

  async getVendorBill(startDate: string, endDate: string) {
    const start = new Date(startDate);
    const end = new Date(endDate);
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw new BadRequestException('Tanggal tidak valid');
    }

    // Ambil pembacaan meter terdekat ≤ startDate (sebagai meterStart)
    const meterStart = await (this.prisma as any).meterReading.findFirst({
      where: { readingDate: { lte: start } },
      orderBy: { readingDate: 'desc' },
    });
    // Ambil pembacaan meter terdekat ≤ endDate (sebagai meterEnd)
    const meterEnd = await (this.prisma as any).meterReading.findFirst({
      where: { readingDate: { lte: end } },
      orderBy: { readingDate: 'desc' },
    });

    if (!meterStart || !meterEnd) {
      throw new NotFoundException('Pembacaan meter belum lengkap untuk periode ini. Input meter di tanggal awal dan akhir terlebih dahulu.');
    }
    if (meterStart.id === meterEnd.id) {
      throw new BadRequestException('Perlu minimal 2 pembacaan meter berbeda dalam range periode. Saat ini hanya 1 pembacaan ditemukan.');
    }

    // Reject dalam range periode (meterStart.readingDate → meterEnd.readingDate)
    const rejects = await (this.prisma as any).machineReject.findMany({
      where: {
        date: {
          gte: new Date(meterStart.readingDate),
          lte: new Date(meterEnd.readingDate),
        },
      },
    });

    const rejectSum = (cause: string, type: string) =>
      rejects
        .filter((r: any) => r.cause === cause && r.counterType === type)
        .reduce((s: number, r: any) => s + r.quantity, 0);

    // Ambil tarif A3_PLUS (vendor A3 mesin)
    const rates = await (this.prisma as any).clickRate.findMany({
      where: { paperSize: 'A3_PLUS', sideMode: 'SIMPLEX', isActive: true },
    });
    const rateFC = rates.find((r: any) => r.colorMode === 'COLOR');
    const rateBW = rates.find((r: any) => r.colorMode === 'BW');
    const priceFC = rateFC ? Number(rateFC.pricePerClick) : 0;
    const priceBW = rateBW ? Number(rateBW.pricePerClick) : 0;

    const deltaFC = meterEnd.fullColorCount - meterStart.fullColorCount;
    const deltaB = meterEnd.blackCount - meterStart.blackCount;
    const deltaSC = meterEnd.singleColorCount - meterStart.singleColorCount;
    const deltaTotal = meterEnd.totalCount - meterStart.totalCount;

    const rejectMachineFC = rejectSum('MACHINE', 'FULL_COLOR');
    const rejectMachineB = rejectSum('MACHINE', 'BLACK');
    const rejectMachineSC = rejectSum('MACHINE', 'SINGLE_COLOR');
    const rejectHumanFC = rejectSum('HUMAN', 'FULL_COLOR');
    const rejectHumanB = rejectSum('HUMAN', 'BLACK');
    const rejectHumanSC = rejectSum('HUMAN', 'SINGLE_COLOR');

    const billableFC = Math.max(0, deltaFC - rejectMachineFC);
    const billableB = Math.max(0, deltaB - rejectMachineB);

    const costFC = billableFC * priceFC;
    const costB = billableB * priceBW;

    return {
      period: {
        requestedStart: startDate,
        requestedEnd: endDate,
        actualStart: meterStart.readingDate,
        actualEnd: meterEnd.readingDate,
      },
      meterStart,
      meterEnd,
      deltas: {
        total: deltaTotal,
        fullColor: deltaFC,
        black: deltaB,
        singleColor: deltaSC,
      },
      machineRejects: {
        fullColor: rejectMachineFC,
        black: rejectMachineB,
        singleColor: rejectMachineSC,
      },
      humanRejects: {
        fullColor: rejectHumanFC,
        black: rejectHumanB,
        singleColor: rejectHumanSC,
      },
      billableClicks: {
        fullColor: billableFC,
        black: billableB,
      },
      rates: {
        fullColor: priceFC,
        black: priceBW,
      },
      costs: {
        fullColor: costFC,
        black: costB,
        grandTotal: costFC + costB,
      },
      sanityCheck: {
        expected: deltaFC + deltaB + deltaSC,
        actual: deltaTotal,
        mismatch: deltaTotal !== deltaFC + deltaB + deltaSC,
      },
      rejectDetails: rejects,
    };
  }

  // ─── Reconciliation (LEGACY — per bulan, pakai Δ total saja) ────────────────

  async getReconciliation(month: number, year: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    // Ambil pembacaan meter terdekat ≤ start (meter awal bulan)
    const meterStart = await (this.prisma as any).meterReading.findFirst({
      where: { readingDate: { lte: start } },
      orderBy: { readingDate: 'desc' },
    });
    // Ambil pembacaan meter terdekat ≤ end (meter akhir bulan)
    const meterEnd = await (this.prisma as any).meterReading.findFirst({
      where: { readingDate: { lte: end } },
      orderBy: { readingDate: 'desc' },
    });

    const [clickLogs, machineRejects] = await Promise.all([
      (this.prisma as any).clickLog.findMany({
        where: { date: { gte: start, lte: end } },
        include: { clickRate: true },
      }),
      (this.prisma as any).machineReject.findMany({
        where: { date: { gte: start, lte: end } },
      }),
    ]);

    const totalLoggedClicks: number = clickLogs.reduce((s: number, l: any) => s + l.quantity, 0);
    const totalLoggedCost: number = clickLogs.reduce((s: number, l: any) => s + Number(l.totalCost), 0);
    const totalRejectClicks: number = machineRejects.reduce((s: number, r: any) => s + r.quantity, 0);
    const totalRejectCost: number = machineRejects.reduce((s: number, r: any) => s + Number(r.totalCost), 0);

    const totalMachineClicks =
      meterStart && meterEnd && meterStart.id !== meterEnd.id
        ? meterEnd.totalCount - meterStart.totalCount
        : null;
    const unrecordedClicks = totalMachineClicks !== null ? totalMachineClicks - totalLoggedClicks : null;
    const amountToPay = totalLoggedCost - totalRejectCost;

    const byRate: Record<string, { name: string; quantity: number; totalCost: number }> = {};
    for (const log of clickLogs) {
      const key = log.clickRate.name;
      if (!byRate[key]) byRate[key] = { name: key, quantity: 0, totalCost: 0 };
      byRate[key].quantity += log.quantity;
      byRate[key].totalCost += Number(log.totalCost);
    }

    return {
      month,
      year,
      meterStart,
      meterEnd,
      totalMachineClicks,
      totalLoggedClicks,
      totalRejectClicks,
      totalLoggedCost,
      totalRejectCost,
      unrecordedClicks,
      amountToPay,
      byRate: Object.values(byRate),
      clickLogs,
      machineRejects,
    };
  }

  // ─── Dashboard Summary ───────────────────────────────────────────────────────

  async getDashboard(month: number, year: number) {
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const meterLatest = await (this.prisma as any).meterReading.findFirst({
      where: { readingDate: { lte: end } },
      orderBy: { readingDate: 'desc' },
    });

    const [logs, rejects] = await Promise.all([
      (this.prisma as any).clickLog.findMany({
        where: { date: { gte: start, lte: end } },
        include: { clickRate: true },
      }),
      (this.prisma as any).machineReject.findMany({
        where: { date: { gte: start, lte: end } },
      }),
    ]);

    const totalClicks: number = logs.reduce((s: number, l: any) => s + l.quantity, 0);
    const totalCost: number = logs.reduce((s: number, l: any) => s + Number(l.totalCost), 0);
    const totalRejects: number = rejects.reduce((s: number, r: any) => s + r.quantity, 0);
    const totalRejectCost: number = rejects.reduce((s: number, r: any) => s + Number(r.totalCost), 0);

    const byRate: Record<string, { name: string; quantity: number; totalCost: number }> = {};
    for (const log of logs) {
      const key = log.clickRate.name;
      if (!byRate[key]) byRate[key] = { name: key, quantity: 0, totalCost: 0 };
      byRate[key].quantity += log.quantity;
      byRate[key].totalCost += Number(log.totalCost);
    }

    return {
      month,
      year,
      totalClicks,
      totalCost,
      totalRejects,
      totalRejectCost,
      meterReading: meterLatest,
      byRate: Object.values(byRate),
    };
  }
}
