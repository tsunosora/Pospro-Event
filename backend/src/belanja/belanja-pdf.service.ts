import { Injectable, OnModuleDestroy } from '@nestjs/common';
import type { Browser } from 'puppeteer';
import { PrismaService } from '../prisma/prisma.service';
import { BelanjaService } from './belanja.service';

const fmtRp = (n: number) => `Rp ${Math.round(Number(n) || 0).toLocaleString('id-ID')}`;
const esc = (s: any) =>
  String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function tanggalPanjang(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export interface BelanjaPdfOpts {
  from?: string;
  to?: string;
  eventId?: number;
  rabPlanId?: number;
}

/** Render laporan belanja (per event/RAB atau per periode) ke PDF via puppeteer. */
@Injectable()
export class BelanjaPdfService implements OnModuleDestroy {
  private browser: Browser | null = null;

  constructor(
    private prisma: PrismaService,
    private belanja: BelanjaService,
  ) {}

  async onModuleDestroy() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }

  private async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) return this.browser;
    const puppeteer = await import('puppeteer');
    this.browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    return this.browser;
  }

  async render(opts: BelanjaPdfOpts): Promise<{ buffer: Buffer; filename: string }> {
    const rows = await this.belanja.list({
      from: opts.from,
      to: opts.to,
      eventId: opts.eventId,
      rabPlanId: opts.rabPlanId,
    });

    // Judul & scope
    let scope = 'Semua Event';
    let fileScope = 'periode';
    if (opts.eventId) {
      const ev = await this.prisma.event.findUnique({ where: { id: opts.eventId }, select: { code: true, name: true } });
      if (ev) {
        scope = `${ev.code} — ${ev.name}`;
        fileScope = ev.code;
      }
    } else if (opts.rabPlanId) {
      const rab = await this.prisma.rabPlan.findUnique({ where: { id: opts.rabPlanId }, select: { code: true, title: true } });
      if (rab) {
        scope = `${rab.code} — ${rab.title}`;
        fileScope = rab.code;
      }
    }

    // Kelompokkan per hari
    const byDay = new Map<string, { tanggal: string; total: number; items: typeof rows }>();
    for (const r of rows) {
      const key = r.spentAt.toISOString().slice(0, 10);
      if (!byDay.has(key)) byDay.set(key, { tanggal: key, total: 0, items: [] as any });
      const g = byDay.get(key)!;
      g.total += Number(r.amount);
      g.items.push(r);
    }
    const hari = Array.from(byDay.values()).sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
    const grandTotal = rows.reduce((a, r) => a + Number(r.amount), 0);

    const periodeLabel =
      opts.from || opts.to
        ? `${opts.from ? new Date(opts.from).toLocaleDateString('id-ID') : '…'} – ${opts.to ? new Date(opts.to).toLocaleDateString('id-ID') : '…'}`
        : 'Semua tanggal';
    const dicetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });

    const bodyRows = hari
      .map((h) => {
        const items = (h.items as any[])
          .map((b) => {
            const tag = b.event ? esc(b.event.code) : esc(b.category || 'Lainnya');
            const pos = b.rabItem?.description || b.rabCategory?.name || '—';
            return `<tr>
              <td>${esc(b.description)}</td>
              <td>${esc(tag)}</td>
              <td>${esc(pos)}</td>
              <td>${esc(b.createdBy?.name ?? '')}</td>
              <td class="num">${fmtRp(b.amount)}</td>
            </tr>`;
          })
          .join('');
        return `<tr class="day"><td colspan="4">${tanggalPanjang(h.tanggal)}</td><td class="num">${fmtRp(h.total)}</td></tr>${items}`;
      })
      .join('');

    const html = `<!doctype html><html lang="id"><head><meta charset="utf-8"><style>
      * { font-family: -apple-system, 'Segoe UI', Roboto, Arial, sans-serif; box-sizing: border-box; }
      body { margin: 0; color: #1f2937; font-size: 12px; }
      .wrap { padding: 28px 32px; }
      h1 { font-size: 18px; margin: 0 0 2px; }
      .meta { color: #6b7280; font-size: 11px; margin-bottom: 2px; }
      .summary { margin: 14px 0; padding: 10px 14px; background: #f3f4f6; border-radius: 8px; display: flex; justify-content: space-between; align-items: center; }
      .summary .lbl { color: #6b7280; font-size: 11px; }
      .summary .val { font-size: 18px; font-weight: 700; }
      table { width: 100%; border-collapse: collapse; margin-top: 6px; }
      th, td { text-align: left; padding: 6px 8px; border-bottom: 1px solid #e5e7eb; vertical-align: top; }
      th { background: #111827; color: #fff; font-size: 11px; }
      td.num, th.num { text-align: right; white-space: nowrap; }
      tr.day td { background: #eef2ff; font-weight: 700; font-size: 11px; }
      .empty { text-align: center; color: #9ca3af; padding: 30px; }
      .foot { margin-top: 18px; text-align: right; font-size: 14px; font-weight: 700; }
    </style></head><body><div class="wrap">
      <h1>Laporan Belanja Harian</h1>
      <div class="meta">Cakupan: ${esc(scope)}</div>
      <div class="meta">Periode: ${esc(periodeLabel)} · Dicetak: ${esc(dicetak)}</div>
      <div class="summary"><span class="lbl">Total Belanja</span><span class="val">${fmtRp(grandTotal)}</span></div>
      ${
        rows.length === 0
          ? '<div class="empty">Tidak ada belanja pada cakupan ini.</div>'
          : `<table><thead><tr><th>Untuk apa</th><th>Tag</th><th>Pos / Item RAB</th><th>Admin</th><th class="num">Nominal</th></tr></thead><tbody>${bodyRows}</tbody></table>
             <div class="foot">Total: ${fmtRp(grandTotal)}</div>`
      }
    </div></body></html>`;

    const browser = await this.getBrowser();
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'networkidle0' });
      const pdf = await page.pdf({ format: 'A4', printBackground: true, margin: { top: '12mm', bottom: '12mm', left: '10mm', right: '10mm' } });
      const fromStr = opts.from ? opts.from.slice(0, 10) : 'awal';
      const toStr = opts.to ? opts.to.slice(0, 10) : 'kini';
      return { buffer: Buffer.from(pdf), filename: `belanja-${fileScope}-${fromStr}-${toStr}.pdf` };
    } finally {
      await page.close();
    }
  }
}
