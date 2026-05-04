import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EventBrand, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/** Default text disclaimer untuk surat penawaran (boleh override per brand). */
export const DEFAULT_DISCLAIMER = `# Harga belum termasuk : managemen fee official contractor, deposit ke penyelenggara atau Gedung, asuransi, sambungan listrik & titik daya, instalasi air dan suplai air, dan biaya lainnya dalam acara ini.
# Harga untuk pembelian satu set booth, barang tidak bisa di beli secara terpisah`;

export const DEFAULT_PAYMENT_TERMS = `Sedangkan system pembayaran 50% dari nilai nominal kontrak yang harus telah kami terima pada saat penandatangan kontrak, dan sisanya di bayarkan pada saat booth siap dikirim. Penambahan fasilitas diluar spesifikasi di atas akan dikenakan biaya sesuai dengan Harga kami.
Harga di atas sudah termasuk di dalam nya biaya pasang dan bongkar event pertama, untuk event selanjutnya akan kami kenakan biaya pasang dan bongkar serta biaya simpan apabila di perlukan.`;

export const DEFAULT_CLOSING = `Demikian penawaran Kerjasama kami. Semoga terjalin Kerjasama yang baik. Atas perhatian dan kerjasamanya kami ucapkan terima kasih.`;

/** Default text bawah Invoice (Nb pembatalan dll) — dipakai sebagai placeholder & default seed. */
export const DEFAULT_INVOICE_CLOSING = `# Jika terjadi pembatalan pemesanan, maka DP yang sudah dibayarkan tidak dapat dikembalikan.`;

export interface UpsertBrandInput {
    brand: EventBrand;
    companyName: string;
    companyCode: string;
    directorName?: string | null;
    address?: string | null;
    phone?: string | null;
    email?: string | null;
    npwp?: string | null;
    bankAccountIds?: string | null;
    letterheadFooter?: string | null;
    quotationDisclaimer?: string | null;
    quotationPaymentTerms?: string | null;
    quotationClosing?: string | null;
    invoiceClosingText?: string | null;
    openingTemplate?: string | null;
    themeColor?: string | null;
    isActive?: boolean;
    logoImageUrl?: string | null;
    letterheadImageUrl?: string | null;
    stampImageUrl?: string | null;
}

@Injectable()
export class BrandsService {
    constructor(private prisma: PrismaService) { }

    /** List semua brand. Auto-seed kalau belum ada (default 2 brand placeholder). */
    async findAll() {
        const list = await this.prisma.brandSettings.findMany({
            orderBy: { brand: 'asc' },
        });
        if (list.length === 0) {
            // Auto-seed dengan placeholder + default text — user lengkapi via UI
            await this.prisma.brandSettings.createMany({
                data: [
                    {
                        brand: 'EXINDO',
                        companyName: 'CV. Exindo Pratama',
                        companyCode: 'Ep',
                        quotationDisclaimer: DEFAULT_DISCLAIMER,
                        quotationPaymentTerms: DEFAULT_PAYMENT_TERMS,
                        quotationClosing: DEFAULT_CLOSING,
                        invoiceClosingText: DEFAULT_INVOICE_CLOSING,
                        isActive: true,
                    },
                    {
                        brand: 'XPOSER',
                        companyName: 'CV. Xposer Event',
                        companyCode: 'Xp',
                        quotationDisclaimer: DEFAULT_DISCLAIMER,
                        quotationPaymentTerms: DEFAULT_PAYMENT_TERMS,
                        quotationClosing: DEFAULT_CLOSING,
                        invoiceClosingText: DEFAULT_INVOICE_CLOSING,
                        isActive: true,
                    },
                ],
            });
            return this.prisma.brandSettings.findMany({ orderBy: { brand: 'asc' } });
        }
        return list;
    }

    async findByBrand(brand: EventBrand) {
        const row = await this.prisma.brandSettings.findUnique({ where: { brand } });
        if (!row) throw new NotFoundException(`Brand ${brand} tidak ditemukan`);
        return row;
    }

    /**
     * Upsert by brand. Validasi:
     * - companyCode tidak bisa diubah kalau sudah ada quotation pakai kode lama.
     */
    async upsert(input: UpsertBrandInput) {
        if (!input.companyName?.trim()) throw new BadRequestException('Nama perusahaan wajib diisi');
        if (!input.companyCode?.trim()) throw new BadRequestException('Kode perusahaan wajib diisi');

        const existing = await this.prisma.brandSettings.findUnique({ where: { brand: input.brand } });
        const newCode = input.companyCode.trim();

        if (existing && existing.companyCode !== newCode) {
            // Cek apakah sudah ada quotation untuk brand ini
            const usedCount = await this.prisma.invoice.count({ where: { brand: input.brand } });
            if (usedCount > 0) {
                throw new BadRequestException(
                    `Kode perusahaan tidak bisa diubah karena sudah ada ${usedCount} quotation pakai kode lama "${existing.companyCode}"`,
                );
            }
        }

        const data: Prisma.BrandSettingsUncheckedCreateInput = {
            brand: input.brand,
            companyName: input.companyName.trim(),
            companyCode: newCode,
            directorName: input.directorName?.trim() || null,
            address: input.address?.trim() || null,
            phone: input.phone?.trim() || null,
            email: input.email?.trim() || null,
            npwp: input.npwp?.trim() || null,
            bankAccountIds: input.bankAccountIds?.trim() || null,
            letterheadFooter: input.letterheadFooter?.trim() || null,
            quotationDisclaimer: input.quotationDisclaimer ?? null,
            quotationPaymentTerms: input.quotationPaymentTerms ?? null,
            quotationClosing: input.quotationClosing ?? null,
            invoiceClosingText: input.invoiceClosingText ?? null,
            openingTemplate: input.openingTemplate?.trim() || null,
            themeColor: input.themeColor?.trim() || null,
            isActive: input.isActive ?? true,
            ...(input.logoImageUrl !== undefined ? { logoImageUrl: input.logoImageUrl } : {}),
            ...(input.letterheadImageUrl !== undefined ? { letterheadImageUrl: input.letterheadImageUrl } : {}),
            ...(input.stampImageUrl !== undefined ? { stampImageUrl: input.stampImageUrl } : {}),
        };

        return this.prisma.brandSettings.upsert({
            where: { brand: input.brand },
            create: data,
            update: data,
        });
    }

    async setLogo(brand: EventBrand, logoImageUrl: string | null) {
        await this.findByBrand(brand);
        return this.prisma.brandSettings.update({
            where: { brand },
            data: { logoImageUrl },
        });
    }

    async setLetterhead(brand: EventBrand, letterheadImageUrl: string | null) {
        await this.findByBrand(brand);
        return this.prisma.brandSettings.update({
            where: { brand },
            data: { letterheadImageUrl },
        });
    }

    async setStamp(brand: EventBrand, stampImageUrl: string | null) {
        await this.findByBrand(brand);
        return this.prisma.brandSettings.update({
            where: { brand },
            data: { stampImageUrl },
        });
    }

    /** Statistik berapa quotation/RAB/lead yang sudah pakai brand ini — untuk display di settings */
    async stats(brand: EventBrand) {
        const [leadCount, rabCount, quotationCount] = await Promise.all([
            this.prisma.lead.count({ where: { brand } }),
            this.prisma.rabPlan.count({ where: { brand } }),
            this.prisma.invoice.count({ where: { brand, type: 'QUOTATION' } }),
        ]);
        return { leadCount, rabCount, quotationCount };
    }
}
