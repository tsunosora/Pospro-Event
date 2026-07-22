import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import type { Browser } from 'puppeteer';
import { BastContextBuilder } from './bast-context.builder';

@Injectable()
export class BastPdfExportService implements OnModuleDestroy {
    private compiled: Handlebars.TemplateDelegate | null = null;
    private browser: Browser | null = null;

    constructor(private contextBuilder: BastContextBuilder) { }

    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    private templateFile(): string {
        const candidates = [
            path.resolve(__dirname, '..', '..', 'templates', 'bast', 'bast.hbs'),
            path.resolve(__dirname, '..', '..', '..', 'templates', 'bast', 'bast.hbs'),
            path.resolve(process.cwd(), 'templates', 'bast', 'bast.hbs'),
        ];
        for (const c of candidates) if (fs.existsSync(c)) return c;
        throw new Error(`Template bast.hbs tidak ditemukan. Dicoba: ${candidates.join(', ')}`);
    }

    private load(): Handlebars.TemplateDelegate {
        if (this.compiled) return this.compiled;
        this.compiled = Handlebars.compile(fs.readFileSync(this.templateFile(), 'utf-8'));
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

    async render(eventId: number): Promise<{ buffer: Buffer; filename: string }> {
        const ctx = await this.contextBuilder.build(eventId);
        const html = this.load()(ctx);
        const browser = await this.getBrowser();
        const page = await browser.newPage();
        try {
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '0mm', right: '0mm', bottom: '0mm', left: '0mm' },
            });
            const safe = String(ctx.doc.number).replace(/[^A-Za-z0-9_-]/g, '-');
            const filename = /^bast[-_]/i.test(safe) ? `${safe}.pdf` : `BAST-${safe}.pdf`;
            return { buffer: Buffer.from(pdf), filename };
        } finally {
            await page.close();
        }
    }
}
