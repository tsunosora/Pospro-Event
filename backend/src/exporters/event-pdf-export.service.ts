import { Injectable, OnModuleDestroy, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import type { Browser } from 'puppeteer';
import { PrismaService } from '../prisma/prisma.service';

const ROMAN = [null, 'I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'] as const;

@Injectable()
export class EventPdfExportService implements OnModuleDestroy {
    private compiled: Handlebars.TemplateDelegate | null = null;
    private browser: Browser | null = null;

    constructor(private prisma: PrismaService) { }

    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    private getTemplatesDir(): string {
        const candidates = [
            path.resolve(__dirname, '..', '..', 'templates', 'event'),
            path.resolve(__dirname, '..', '..', '..', 'templates', 'event'),
            path.resolve(process.cwd(), 'templates', 'event'),
        ];
        for (const c of candidates) if (fs.existsSync(c)) return c;
        throw new Error(`Templates folder tidak ditemukan. Sudah coba: ${candidates.join(', ')}`);
    }

    private loadTemplate(): Handlebars.TemplateDelegate {
        if (this.compiled) return this.compiled;
        const file = path.join(this.getTemplatesDir(), 'rundown.hbs');
        const source = fs.readFileSync(file, 'utf-8');
        this.compiled = Handlebars.compile(source);
        return this.compiled;
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

    private fmt(d: Date | null | undefined): string {
        if (!d) return '—';
        const dd = new Date(d);
        const dateStr = dd.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        const timeStr = dd.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
        return `${dateStr}, ${timeStr}`;
    }

    async render(eventId: number): Promise<{ buffer: Buffer; filename: string }> {
        const ev = await this.prisma.event.findUnique({
            where: { id: eventId },
            include: {
                customer: { select: { name: true, companyName: true } },
                picWorker: { select: { name: true, position: true } },
                withdrawals: {
                    orderBy: { createdAt: 'desc' },
                    include: {
                        worker: { select: { name: true } },
                        items: {
                            include: {
                                productVariant: {
                                    select: { sku: true, variantName: true, product: { select: { name: true } } },
                                },
                            },
                        },
                    },
                },
            },
        });
        if (!ev) throw new NotFoundException(`Event id=${eventId} tidak ditemukan`);

        const itemMap = new Map<string, { productName: string; sku: string; variantName: string | null; qty: number }>();
        for (const w of ev.withdrawals) {
            for (const it of w.items) {
                const v = it.productVariant;
                const key = `${v.sku}`;
                const qty = Number(it.quantity);
                const prev = itemMap.get(key);
                if (prev) prev.qty += qty;
                else itemMap.set(key, { productName: v.product.name, sku: v.sku, variantName: v.variantName, qty });
            }
        }
        const items = Array.from(itemMap.values()).sort((a, b) => b.qty - a.qty);

        const brandLabel = ev.brand === 'EXINDO' ? 'CV. Exindo' : ev.brand === 'XPOSER' ? 'CV. Xposer' : 'Lain';
        const statusLabel: Record<string, string> = {
            DRAFT: 'Draft', SCHEDULED: 'Terjadwal', IN_PROGRESS: 'Berlangsung',
            COMPLETED: 'Selesai', CANCELLED: 'Dibatalkan',
        };

        const ctx = {
            ev,
            brandLabel,
            statusLabel: statusLabel[ev.status] ?? ev.status,
            klien: ev.customer?.name ?? ev.customerName ?? '—',
            klienCompany: ev.customer?.companyName ?? '',
            pic: ev.picWorker?.name ?? ev.picName ?? '—',
            picPosition: ev.picWorker?.position ?? '',
            phases: [
                { label: 'Berangkat', color: '#fef08a', start: this.fmt(ev.departureStart), end: this.fmt(ev.departureEnd) },
                { label: 'Pasang', color: '#fed7aa', start: this.fmt(ev.setupStart), end: this.fmt(ev.setupEnd) },
                { label: 'Loading Peserta', color: '#bae6fd', start: this.fmt(ev.loadingStart), end: this.fmt(ev.loadingEnd) },
                { label: 'Event', color: '#a7f3d0', start: this.fmt(ev.eventStart), end: this.fmt(ev.eventEnd) },
            ],
            items,
            totalQty: items.reduce((s, x) => s + x.qty, 0),
            generatedAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
        };

        const html = this.loadTemplate()(ctx);

        const browser = await this.getBrowser();
        const page = await browser.newPage();
        try {
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '12mm', right: '14mm', bottom: '14mm', left: '14mm' },
            });
            return {
                buffer: Buffer.from(pdf),
                filename: `rundown-${ev.code}.pdf`,
            };
        } finally {
            await page.close();
        }
    }
}
