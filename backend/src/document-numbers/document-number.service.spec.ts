import { Test, TestingModule } from '@nestjs/testing';
import { DocumentNumberService } from './document-number.service';
import { PrismaService } from '../prisma/prisma.service';

describe('DocumentNumberService', () => {
    let service: DocumentNumberService;
    let prismaMock: { documentNumberCounter: { upsert: jest.Mock } };

    beforeEach(async () => {
        prismaMock = { documentNumberCounter: { upsert: jest.fn() } };
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                DocumentNumberService,
                { provide: PrismaService, useValue: prismaMock },
            ],
        }).compile();
        service = module.get(DocumentNumberService);
    });

    describe('assignForQuotation', () => {
        it('format nomor penawaran dengan bulan romawi + 2-digit year', async () => {
            prismaMock.documentNumberCounter.upsert.mockResolvedValue({ lastSeq: 4022 });
            const date = new Date(2023, 1, 15); // Februari 2023
            const result = await service.assignForQuotation('Xp', date);
            expect(result).toBe('4022/Xp/Pnwr/II/23');
        });

        it('seq pertama tahun baru menghasilkan 1', async () => {
            prismaMock.documentNumberCounter.upsert.mockResolvedValue({ lastSeq: 1 });
            const date = new Date(2026, 3, 10); // April 2026
            const result = await service.assignForQuotation('Ep', date);
            expect(result).toBe('1/Ep/Pnwr/IV/26');
        });

        it('memanggil upsert dengan kunci unik docType+kode+year yang benar', async () => {
            prismaMock.documentNumberCounter.upsert.mockResolvedValue({ lastSeq: 10 });
            const date = new Date(2026, 0, 1);
            await service.assignForQuotation('Ep', date);
            const args = prismaMock.documentNumberCounter.upsert.mock.calls[0][0];
            expect(args.where).toEqual({ docType_kode_year: { docType: 'Pnwr', kode: 'Ep', year: 2026 } });
            expect(args.create).toEqual({ docType: 'Pnwr', kode: 'Ep', year: 2026, lastSeq: 1 });
            expect(args.update).toEqual({ lastSeq: { increment: 1 } });
        });

        it('merender bulan Desember sebagai XII', async () => {
            prismaMock.documentNumberCounter.upsert.mockResolvedValue({ lastSeq: 99 });
            const date = new Date(2025, 11, 31);
            const result = await service.assignForQuotation('Xp', date);
            expect(result).toBe('99/Xp/Pnwr/XII/25');
        });
    });

    describe('formatWithRevision', () => {
        it('menyisipkan rev{n} tepat setelah seq awal', () => {
            expect(service.formatWithRevision('4022/Xp/Pnwr/II/23', 1)).toBe('4022rev1/Xp/Pnwr/II/23');
        });

        it('mendukung revisi >= 2', () => {
            expect(service.formatWithRevision('9698/Ep/Pnwr/II/26', 2)).toBe('9698rev2/Ep/Pnwr/II/26');
        });

        it('revisi 0 tidak mengubah nomor', () => {
            expect(service.formatWithRevision('4022/Xp/Pnwr/II/23', 0)).toBe('4022/Xp/Pnwr/II/23');
        });

        it('revisi negatif diperlakukan sebagai 0', () => {
            expect(service.formatWithRevision('4022/Xp/Pnwr/II/23', -1)).toBe('4022/Xp/Pnwr/II/23');
        });
    });
});
