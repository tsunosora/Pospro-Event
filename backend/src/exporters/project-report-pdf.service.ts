import { Injectable, OnModuleDestroy, NotFoundException } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import type { Browser } from 'puppeteer';
import { PrismaService } from '../prisma/prisma.service';
import { CashflowService } from '../cashflow/cashflow.service';
import { EventCrewService } from '../events/event-crew.service';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require('archiver');

const fmtRp = (n: number) => `Rp ${Math.round(n).toLocaleString('id-ID')}`;
const fmtRpOrDash = (n: number) => (n > 0 ? `Rp ${Math.round(n).toLocaleString('id-ID')}` : '—');

const STATUS_LABEL: Record<string, string> = {
    DRAFT: 'Draft',
    SCHEDULED: 'Terjadwal',
    IN_PROGRESS: 'Berlangsung',
    COMPLETED: 'Selesai',
    CANCELLED: 'Batal',
};

@Injectable()
export class ProjectReportPdfService implements OnModuleDestroy {
    private compiled: Handlebars.TemplateDelegate | null = null;
    private browser: Browser | null = null;

    constructor(
        private prisma: PrismaService,
        private cashflowService: CashflowService,
        private eventCrewService: EventCrewService,
    ) { }

    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    private getTemplatesDir(): string {
        const candidates = [
            path.resolve(__dirname, '..', '..', 'templates', 'project-report'),
            path.resolve(__dirname, '..', '..', '..', 'templates', 'project-report'),
            path.resolve(process.cwd(), 'templates', 'project-report'),
        ];
        for (const c of candidates) if (fs.existsSync(c)) return c;
        throw new Error(`Templates folder tidak ditemukan: ${candidates.join(', ')}`);
    }

    private loadTemplate(): Handlebars.TemplateDelegate {
        if (this.compiled) return this.compiled;
        const file = path.join(this.getTemplatesDir(), 'project-report.hbs');
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

    private fmtDateTime(d: Date | null | undefined): string {
        if (!d) return '—';
        const dd = new Date(d);
        return dd.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
            + ' ' + dd.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    }

    private fmtDateOnly(d: Date | null | undefined): string {
        if (!d) return '—';
        return new Date(d).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    }

    private fmtPhaseRange(start: Date | null | undefined, end: Date | null | undefined): string | null {
        if (!start && !end) return null;
        if (start && end) return `${this.fmtDateOnly(start)} → ${this.fmtDateOnly(end)}`;
        return this.fmtDateOnly(start ?? end);
    }

    private fmtDurationMinutes(min: number): string {
        if (min <= 0) return '—';
        if (min < 60) return `${min} menit`;
        const h = Math.floor(min / 60);
        const m = min % 60;
        return `${h} jam ${m} menit`;
    }

    async render(eventId: number, generatedBy = 'System'): Promise<{ buffer: Buffer; filename: string }> {
        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            include: {
                customer: { select: { name: true, companyName: true } },
                picWorker: { select: { name: true, position: true } },
            },
        });
        if (!event) throw new NotFoundException('Event tidak ditemukan');

        const profit = await this.cashflowService.getEventProfit(eventId);
        const cashflowEntries = await this.prisma.cashflow.findMany({
            where: { eventId },
            orderBy: { date: 'desc' },
            select: { date: true, type: true, category: true, amount: true, note: true },
        });
        const crew = await this.eventCrewService.listByEvent(eventId);

        // Map breakdown with percentages
        const maxIncome = Math.max(0, ...profit.byCategory.map((c) => c.income));
        const maxExpense = Math.max(0, ...profit.byCategory.map((c) => c.expense));
        const incomeCategories = profit.byCategory
            .filter((c) => c.income > 0)
            .sort((a, b) => b.income - a.income)
            .map((c) => ({
                category: c.category,
                amountFmt: fmtRp(c.income),
                pct: maxIncome > 0 ? Math.max(2, (c.income / maxIncome) * 100) : 0,
            }));
        const expenseCategories = profit.byCategory
            .filter((c) => c.expense > 0)
            .sort((a, b) => b.expense - a.expense)
            .map((c) => ({
                category: c.category,
                amountFmt: fmtRp(c.expense),
                pct: maxExpense > 0 ? Math.max(2, (c.expense / maxExpense) * 100) : 0,
            }));

        // Map cashflow entries for table
        const cashflowEntriesMapped = cashflowEntries.map((cf) => {
            const amount = parseFloat(cf.amount.toString());
            const isIncome = cf.type === 'INCOME';
            return {
                dateFmt: this.fmtDateOnly(cf.date),
                typeLabel: isIncome ? '↗ Income' : '↘ Expense',
                category: cf.category,
                note: cf.note ?? '',
                incomeFmt: isIncome ? fmtRp(amount) : '—',
                expenseFmt: !isIncome ? fmtRp(amount) : '—',
            };
        });

        // Map crew assignments
        const crewMapped = crew.map((a) => {
            const status = a.finishedAt ? 'DONE' : a.startedAt ? 'ON_SITE' : 'ASSIGNED';
            const statusLabel = status === 'DONE' ? 'Selesai' : status === 'ON_SITE' ? 'On-Site' : 'Belum Check-in';
            const durationMs = (a.startedAt && a.finishedAt) ? a.finishedAt.getTime() - a.startedAt.getTime() : 0;
            const durationMin = Math.round(durationMs / 60000);
            return {
                workerName: a.worker.name,
                team: a.team ? { name: a.team.name, color: a.team.color } : null,
                role: a.role ?? '—',
                startedAtFmt: this.fmtDateTime(a.startedAt),
                finishedAtFmt: this.fmtDateTime(a.finishedAt),
                durationFmt: this.fmtDurationMinutes(durationMin),
                statusKey: status,
                statusLabel,
            };
        });

        // Monthly trend with bar heights (CSS chart)
        const trendValues = profit.monthlyTrend.flatMap((m) => [m.income, m.expense]);
        const maxTrend = Math.max(1, ...trendValues);
        const monthlyTrend = profit.monthlyTrend.map((m) => {
            const incomeH = (m.income / maxTrend) * 100;
            const expenseH = (m.expense / maxTrend) * 100;
            const profitClass = m.profit >= 0 ? 'profit-positive' : 'profit-negative';
            return {
                month: m.month,
                incomeFmt: m.income > 0 ? fmtRp(m.income) : '',
                expenseFmt: m.expense > 0 ? fmtRp(m.expense) : '',
                profitFmt: m.profit !== 0 ? fmtRp(m.profit) : '—',
                incomeHeight: incomeH.toFixed(1),
                expenseHeight: expenseH.toFixed(1),
                profitClass,
                hasData: m.income > 0 || m.expense > 0,
            };
        });
        const hasMonthlyTrend = monthlyTrend.some((m) => m.hasData);

        const data = {
            event: {
                ...event,
                notes: event.notes,
                brand: event.brand,
            },
            customerLine: event.customer
                ? `${event.customer.name}${event.customer.companyName ? ` (${event.customer.companyName})` : ''}`
                : event.customerName ?? '—',
            picLine: event.picWorker
                ? `${event.picWorker.name}${event.picWorker.position ? ` — ${event.picWorker.position}` : ''}`
                : event.picName ?? '—',
            departureLine: this.fmtPhaseRange(event.departureStart, event.departureEnd),
            setupLine: this.fmtPhaseRange(event.setupStart, event.setupEnd),
            eventDateLine: this.fmtPhaseRange(event.eventStart, event.eventEnd),
            loadingLine: this.fmtPhaseRange(event.loadingStart, event.loadingEnd),
            statusLabel: STATUS_LABEL[event.status] ?? event.status,
            financial: {
                totalIncomeFmt: fmtRpOrDash(profit.totalIncome),
                totalExpenseFmt: fmtRpOrDash(profit.totalExpense),
                grossProfitFmt: fmtRp(profit.grossProfit),
                marginPctFmt: profit.marginPct.toFixed(1),
            },
            profitClass: profit.grossProfit >= 0 ? 'stat-profit-positive' : 'stat-profit-negative',
            hasCashflowEntries: profit.entryCount > 0,
            incomeCategories,
            expenseCategories,
            cashflowEntries: cashflowEntriesMapped,
            crew: crewMapped,
            monthlyTrend,
            hasMonthlyTrend,
            generatedAt: new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
                + ' ' + new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
            generatedBy,
        };

        const html = this.loadTemplate()(data);

        const browser = await this.getBrowser();
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'networkidle0' });
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: { top: '12mm', right: '12mm', bottom: '12mm', left: '12mm' },
        });
        await page.close();

        const safeCode = (event.code || `event-${eventId}`).replace(/[^A-Za-z0-9_-]/g, '-');
        return {
            buffer: Buffer.from(pdfBuffer),
            filename: `Project-Report-${safeCode}.pdf`,
        };
    }

    /** Bulk render: gabungkan PDF dari banyak event jadi 1 ZIP file */
    async renderBulkZip(eventIds: number[], generatedBy = 'System'): Promise<{ buffer: Buffer; filename: string; count: number; failed: number[] }> {
        if (!eventIds.length) throw new NotFoundException('Tidak ada event yang dipilih');

        const archive = archiver('zip', { zlib: { level: 6 } });
        const chunks: Buffer[] = [];
        archive.on('data', (chunk: Buffer) => chunks.push(chunk));

        const failed: number[] = [];
        let count = 0;

        for (const eventId of eventIds) {
            try {
                const { buffer, filename } = await this.render(eventId, generatedBy);
                archive.append(buffer, { name: filename });
                count++;
            } catch (err) {
                failed.push(eventId);
                console.error(`Failed to render PDF for event ${eventId}:`, err);
            }
        }

        await archive.finalize();
        const buffer = Buffer.concat(chunks);

        const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
        return {
            buffer,
            filename: `project-reports-${count}events-${ts}.zip`,
            count,
            failed,
        };
    }
}
