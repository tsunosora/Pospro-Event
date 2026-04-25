import { Injectable, OnModuleDestroy } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as Handlebars from 'handlebars';
import type { Browser } from 'puppeteer';
import { QuotationContextBuilder } from './quotation-context.builder';

type TemplateKey = 'sewa' | 'pengadaan-booth';

@Injectable()
export class PdfExportService implements OnModuleDestroy {
    private compiledTemplates: Partial<Record<TemplateKey, Handlebars.TemplateDelegate>> = {};
    private browser: Browser | null = null;

    constructor(private contextBuilder: QuotationContextBuilder) { }

    async onModuleDestroy() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }

    private getTemplatesDir(): string {
        // dev: running from `src/` via ts-node -> __dirname = .../src/exporters
        // build: running from `dist/src/exporters` -> templates sit at app/backend/templates
        const candidates = [
            path.resolve(__dirname, '..', '..', 'templates', 'quotation'),
            path.resolve(__dirname, '..', '..', '..', 'templates', 'quotation'),
            path.resolve(process.cwd(), 'templates', 'quotation'),
        ];
        for (const c of candidates) if (fs.existsSync(c)) return c;
        throw new Error(`Templates folder tidak ditemukan. Sudah coba: ${candidates.join(', ')}`);
    }

    private loadTemplate(key: TemplateKey): Handlebars.TemplateDelegate {
        if (this.compiledTemplates[key]) return this.compiledTemplates[key]!;
        const file = path.join(this.getTemplatesDir(), `${key}.hbs`);
        const source = fs.readFileSync(file, 'utf-8');
        const compiled = Handlebars.compile(source);
        this.compiledTemplates[key] = compiled;
        return compiled;
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

    async renderQuotationPdf(quotationId: number): Promise<Buffer> {
        const ctx = await this.contextBuilder.build(quotationId);
        const key: TemplateKey = ctx.doc.variant === 'PENGADAAN_BOOTH' ? 'pengadaan-booth' : 'sewa';
        const template = this.loadTemplate(key);
        const html = template(ctx);

        const browser = await this.getBrowser();
        const page = await browser.newPage();
        try {
            await page.setContent(html, { waitUntil: 'networkidle0' });
            const pdf = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '15mm', right: '18mm', bottom: '18mm', left: '18mm' },
            });
            return Buffer.from(pdf);
        } finally {
            await page.close();
        }
    }
}
