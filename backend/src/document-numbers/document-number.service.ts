import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const ROMAN_MONTH = [
    null,
    'I', 'II', 'III', 'IV', 'V', 'VI',
    'VII', 'VIII', 'IX', 'X', 'XI', 'XII',
];

@Injectable()
export class DocumentNumberService {
    constructor(private prisma: PrismaService) { }

    /**
     * Reserve nomor urut untuk penawaran — format:
     *   `${seq}/${kode}/Pnwr/${roman}/${yy}`   contoh `4022/Xp/Pnwr/II/23`
     *
     * Untuk versi English, prefix "Pnwr" diganti "Quot" (mis. `5264/Xp/Quot/V/26`).
     *
     * Counter unik per (docType, kode, year) — Indonesian dan English share counter
     * yang sama (docType='Pnwr') supaya nomor urut tidak conflict / double-assign
     * lintas bahasa.
     */
    async assignForQuotation(kode: string, date: Date = new Date(), lang: 'id' | 'en' = 'id'): Promise<string> {
        const year = date.getFullYear();
        // docType di counter tetap 'Pnwr' supaya nomor urut shared antar bahasa.
        const counter = await this.prisma.documentNumberCounter.upsert({
            where: { docType_kode_year: { docType: 'Pnwr', kode, year } },
            create: { docType: 'Pnwr', kode, year, lastSeq: 1 },
            update: { lastSeq: { increment: 1 } },
        });

        const yy = String(year).slice(-2);
        const mm = ROMAN_MONTH[date.getMonth() + 1];
        const prefix = lang === 'en' ? 'Quot' : 'Pnwr';
        return `${counter.lastSeq}/${kode}/${prefix}/${mm}/${yy}`;
    }

    /**
     * Sisipkan suffix `rev{n}` tepat setelah angka urut pertama.
     *   `4022/Xp/Pnwr/II/23` + rev=1  ->  `4022rev1/Xp/Pnwr/II/23`
     *   rev=0 tidak mengubah nomor.
     */
    formatWithRevision(baseNumber: string, revision: number): string {
        if (!revision || revision <= 0) return baseNumber;
        return baseNumber.replace(/^(\d+)/, `$1rev${revision}`);
    }

    /**
     * Expose romawi helper untuk konsumer lain (misal preview di FE via API).
     */
    static romanMonth(monthIndex1Based: number): string | null {
        return ROMAN_MONTH[monthIndex1Based] ?? null;
    }

    /**
     * Increment & return next sequence integer untuk (docType, kode, year).
     * Dipakai non-penawaran: mis. Invoice `INV-YYYYMMDD-seq` pakai docType=INV, kode=INV.
     */
    async nextSequence(docType: string, kode: string, year: number): Promise<number> {
        const counter = await this.prisma.documentNumberCounter.upsert({
            where: { docType_kode_year: { docType, kode, year } },
            create: { docType, kode, year, lastSeq: 1 },
            update: { lastSeq: { increment: 1 } },
        });
        return counter.lastSeq;
    }

    /** List semua counter (untuk display & manual edit di settings UI). */
    async listCounters(filter: { docType?: string; year?: number } = {}) {
        return this.prisma.documentNumberCounter.findMany({
            where: {
                ...(filter.docType ? { docType: filter.docType } : {}),
                ...(filter.year ? { year: filter.year } : {}),
            },
            orderBy: [{ year: 'desc' }, { docType: 'asc' }, { kode: 'asc' }],
        });
    }

    /**
     * Set / reset value lastSeq counter manual.
     * Berguna untuk:
     * - Reset ke 0 di awal tahun (sudah otomatis sebenarnya, tapi kalau perlu)
     * - Skip ke nomor tertentu (mis. mau mulai dari 100 setelah migrasi)
     * - Koreksi kalau ada salah hitung
     */
    async setCounter(docType: string, kode: string, year: number, lastSeq: number) {
        if (lastSeq < 0) throw new Error('lastSeq tidak boleh negatif');
        return this.prisma.documentNumberCounter.upsert({
            where: { docType_kode_year: { docType, kode, year } },
            create: { docType, kode, year, lastSeq },
            update: { lastSeq },
        });
    }
}
