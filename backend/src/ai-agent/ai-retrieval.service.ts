import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CashflowService } from '../cashflow/cashflow.service';
import { LeadsService } from '../crm/leads/leads.service';

export interface RetrievedEntity {
  kind: 'quotation' | 'event' | 'rab' | 'customer';
  id: number;
  label: string;
  sublabel?: string;
  href: string; // deep-link route FE
}

const rp = (n: any): string =>
  n == null ? '-' : 'Rp' + Number(n).toLocaleString('id-ID');

const dt = (x: any): string =>
  x == null ? '-' : new Date(x).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

const FINANCIAL_KW = [
  'keuangan', 'laporan', 'cashflow', 'kas', 'laba', 'untung', 'rugi', 'profit',
  'margin', 'pemasukan', 'pengeluaran', 'omset', 'omzet', 'saldo', 'biaya', 'modal',
];
const MARKETING_KW = [
  'marketing', 'kinerja', 'performa', 'performance', 'closing', 'konversi',
  'conversion', 'leaderboard', 'sales', 'follow up', 'stuck',
];

@Injectable()
export class AiRetrievalService {
  constructor(
    private prisma: PrismaService,
    private cashflow: CashflowService,
    private leads: LeadsService,
  ) {}

  private terms(msg: string): string[] {
    return msg
      .toLowerCase()
      .split(/[^a-z0-9]+/i)
      .filter((w) => w.length >= 3)
      .slice(0, 6);
  }

  private hasAny(msg: string, kws: string[]): boolean {
    const m = msg.toLowerCase();
    return kws.some((k) => m.includes(k));
  }

  async retrieve(
    message: string,
    isManager: boolean,
  ): Promise<{ context: string; entities: RetrievedEntity[] }> {
    const words = this.terms(message);
    const financialIntent = this.hasAny(message, FINANCIAL_KW);
    const marketingIntent = this.hasAny(message, MARKETING_KW);

    const blocks: string[] = [];
    const entities: RetrievedEntity[] = [];

    // ─── 1. Pencarian entitas by keyword ────────────────────────────────────
    if (words.length) {
      const orLike = (fields: string[]) =>
        words.flatMap((w) => fields.map((f) => ({ [f]: { contains: w } })));

      const [invoices, events, rabs, customers, variants, leadRows] = await Promise.all([
        this.prisma.invoice.findMany({
          where: { OR: orLike(['invoiceNumber', 'clientName', 'clientCompany', 'projectName', 'eventLocation']) },
          take: 5, orderBy: { date: 'desc' },
        }),
        this.prisma.event.findMany({
          where: { OR: orLike(['code', 'name', 'venue', 'customerName']) },
          take: 5, orderBy: { eventStart: 'desc' },
          include: { rabPlan: { select: { code: true } }, _count: { select: { crewAssignments: true } } },
        }),
        this.prisma.rabPlan.findMany({
          where: { OR: orLike(['code', 'title', 'projectName', 'location']) },
          take: 5, orderBy: { createdAt: 'desc' },
        }),
        this.prisma.customer.findMany({
          where: { OR: orLike(['name', 'companyName', 'companyPIC', 'phone']) },
          take: 5, orderBy: { name: 'asc' },
        }),
        this.prisma.productVariant.findMany({
          where: { OR: orLike(['sku', 'variantName', 'size']) },
          take: 5,
        }),
        this.prisma.lead.findMany({
          where: { OR: orLike(['name', 'organization', 'phone', 'productCategory', 'orderDescription', 'eventLocation']) },
          take: 5, orderBy: { leadCameAt: 'desc' },
          include: { stage: { select: { name: true } }, assignedWorker: { select: { name: true } } },
        }),
      ]);

      if (invoices.length) {
        blocks.push('## Penawaran/Invoice terkait\n' + (invoices as any[]).map((q) => {
          entities.push({ kind: 'quotation', id: q.id, label: q.invoiceNumber, sublabel: q.clientName ?? undefined, href: `/penawaran/${q.id}` });
          return `- ${q.invoiceNumber} | ${q.clientName ?? '-'} | ${q.projectName ?? '-'} | total ${rp(q.total)} | status ${q.status}`;
        }).join('\n'));
      }

      if (events.length) {
        blocks.push('## Event terkait (jadwal detail)\n' + (events as any[]).map((e) => {
          entities.push({ kind: 'event', id: e.id, label: e.name, sublabel: e.venue ?? undefined, href: `/events/${e.id}` });
          return (
            `- ${e.code} | ${e.name} | ${e.venue ?? '-'} | status ${e.status}\n` +
            `  jadwal: berangkat ${dt(e.departureStart)} · setup ${dt(e.setupStart)} · loading ${dt(e.loadingStart)} · acara ${dt(e.eventStart)}–${dt(e.eventEnd)} | PIC ${e.picName ?? '-'} | crew ${e._count?.crewAssignments ?? 0} | RAB ${e.rabPlan?.code ?? '-'}`
          );
        }).join('\n'));
      }

      if (rabs.length) {
        blocks.push('## RAB terkait\n' + (rabs as any[]).map((r) => {
          entities.push({ kind: 'rab', id: r.id, label: r.code, sublabel: r.title ?? undefined, href: `/rab/${r.id}` });
          const money = isManager ? ` | DP ${rp(r.dpAmount)} | pelunasan ${rp(r.pelunasan)}` : '';
          return `- ${r.code} | ${r.title ?? r.projectName ?? '-'}${money}`;
        }).join('\n'));
      }

      if (customers.length) {
        blocks.push('## Customer terkait\n' + (customers as any[]).map((c) => {
          entities.push({ kind: 'customer', id: c.id, label: c.name, sublabel: c.companyName ?? undefined, href: `/customers/${c.id}` });
          return `- ${c.name} | ${c.companyName ?? '-'} | ${c.phone ?? '-'}`;
        }).join('\n'));
      }

      if (leadRows.length) {
        blocks.push('## Leads/CRM terkait\n' + (leadRows as any[]).map((l) => {
          const est = isManager ? ` | est ${rp(l.projectValueEst)}` : '';
          return `- ${l.name ?? '-'} | ${l.organization ?? '-'} | ${l.phone ?? '-'} | status ${l.status} | stage ${l.stage?.name ?? '-'} | ${l.productCategory ?? '-'}${est} | marketing ${l.assignedWorker?.name ?? '-'}`;
        }).join('\n'));
      }

      if (variants.length) {
        blocks.push('## Produk/Material terkait\n' + (variants as any[]).map((v) => {
          const cost = isManager ? ` | HPP ${rp(v.hpp)}` : '';
          return `- ${v.sku} | ${v.variantName ?? '-'} | harga ${rp(v.price)}${cost} | stok ${v.stock ?? '-'}`;
        }).join('\n'));
      }
    }

    // ─── 2. Blok agregat (owner-only): keuangan & kinerja marketing ─────────
    if (financialIntent || marketingIntent) {
      if (!isManager) {
        blocks.push('_(Data laporan keuangan & kinerja marketing hanya tersedia untuk owner/admin.)_');
      } else {
        const extra = await Promise.all([
          financialIntent ? this.financialBlock() : Promise.resolve(null),
          marketingIntent ? this.marketingBlock() : Promise.resolve(null),
        ]);
        for (const b of extra) if (b) blocks.push(b);
      }
    }

    return {
      context: blocks.join('\n\n') || '(tidak ada data internal yang cocok)',
      entities,
    };
  }

  /** Ringkasan keuangan: tren bulanan, breakdown kategori, laba per event. */
  private async financialBlock(): Promise<string> {
    const [trend, cats, evProfit] = await Promise.all([
      this.cashflow.getMonthlyTrend(),
      this.cashflow.getCategoryBreakdown(),
      this.cashflow.getAllEventsProfit(),
    ]);

    const lines: string[] = ['## Laporan Keuangan (ringkas)'];

    const cur = trend[trend.length - 1];
    if (cur) {
      lines.push(`Bulan ${cur.month}: pemasukan ${rp(cur.income)}, pengeluaran ${rp(cur.expense)}, selisih ${rp(cur.income - cur.expense)}.`);
    }
    lines.push('Tren 6 bulan (pemasukan/pengeluaran): ' + trend.map((t) => `${t.month} ${rp(t.income)}/${rp(t.expense)}`).join(' · '));

    if (cats.expense.length) {
      lines.push('Top pengeluaran per kategori: ' + cats.expense.slice(0, 5).map((c) => `${c.category} ${rp(c.total)}`).join(', '));
    }
    if (cats.income.length) {
      lines.push('Top pemasukan per kategori: ' + cats.income.slice(0, 5).map((c) => `${c.category} ${rp(c.total)}`).join(', '));
    }

    const s = evProfit.summary;
    lines.push(`Total ${s.eventCount} event bercashflow: pemasukan ${rp(s.totalIncome)}, pengeluaran ${rp(s.totalExpense)}, laba kotor ${rp(s.grossProfit)} (margin ${Math.round(s.marginPct)}%).`);
    if (evProfit.rows.length) {
      lines.push('Laba per event (teratas):');
      for (const r of evProfit.rows.slice(0, 5)) {
        lines.push(`- ${r.eventName} (${r.eventCode}) | laba ${rp(r.grossProfit)} (margin ${Math.round(r.marginPct)}%) | masuk ${rp(r.totalIncome)} keluar ${rp(r.totalExpense)}`);
      }
    }
    return lines.join('\n');
  }

  /** Kinerja marketing: statistik lead + leaderboard per marketing. */
  private async marketingBlock(): Promise<string> {
    const [stats, perf] = await Promise.all([
      this.leads.stats(),
      this.leads.performanceByMarketer({}),
    ]);

    const lines: string[] = ['## Kinerja Marketing (ringkas)'];
    lines.push(`Lead: hari ini ${stats.today}, minggu ini ${stats.week}, bulan ini ${stats.month}, total ${stats.total}. Converted ${stats.converted} (konversi ${stats.conversionRate}%).`);

    if (perf.length) {
      lines.push('Peringkat marketing (nilai closing):');
      for (const m of perf.slice(0, 5)) {
        lines.push(`- ${m.name} (${m.position ?? '-'}) | lead ${m.totalLeads} | closing ${m.convertedLeads} (${m.conversionRate}%) | nilai closing ${rp(m.totalValueClosed)} | stuck ${m.stuckLeads} | lost ${m.lostLeads}`);
      }
    } else {
      lines.push('(Belum ada data marketing.)');
    }
    return lines.join('\n');
  }
}
