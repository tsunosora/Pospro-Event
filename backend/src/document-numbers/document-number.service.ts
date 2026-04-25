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
     * Counter unik per (docType, kode, year). Tiap call akan increment atomik
     * lewat upsert + `increment`. Reset otomatis di awal tahun baru karena
     * tahun masuk ke unique key.
     */
    async assignForQuotation(kode: string, date: Date = new Date()): Promise<string> {
        const year = date.getFullYear();
        const counter = await this.prisma.documentNumberCounter.upsert({
            where: { docType_kode_year: { docType: 'Pnwr', kode, year } },
            create: { docType: 'Pnwr', kode, year, lastSeq: 1 },
            update: { lastSeq: { increment: 1 } },
        });

        const yy = String(year).slice(-2);
        const mm = ROMAN_MONTH[date.getMonth() + 1];
        return `${counter.lastSeq}/${kode}/Pnwr/${mm}/${yy}`;
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
}
