import { BadRequestException } from '@nestjs/common';
import { LeadsService } from './leads.service';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Regression: tanggal closing (closedDealAt) yang menggerakkan leaderboard closing
 * tidak boleh di masa depan. User pernah menggeser lead ke closing di Juli lalu
 * meng-edit bulannya ke Agustus, sehingga leaderboard menghitung bulan yang belum
 * dilalui. Guard di update() harus menolak forward-date, tapi tetap izinkan backdate.
 */
describe('LeadsService.update — closedDealAt tidak boleh di masa depan', () => {
    const existingLead = { id: 1, status: 'IN_PROGRESS' };

    function makeService() {
        const prisma = {
            lead: {
                findUnique: jest.fn().mockResolvedValue(existingLead),
                update: jest.fn().mockResolvedValue({ id: 1 }),
            },
        } as unknown as PrismaService;
        return { service: new LeadsService(prisma), prisma };
    }

    function futureIso(): string {
        const d = new Date();
        d.setMonth(d.getMonth() + 1); // bulan depan — belum dilalui
        return d.toISOString();
    }

    function pastIso(): string {
        const d = new Date();
        d.setMonth(d.getMonth() - 1); // bulan lalu — backdate sah
        return d.toISOString();
    }

    it('menolak edit closedDealAt ke bulan depan', async () => {
        const { service, prisma } = makeService();
        await expect(service.update(1, { closedDealAt: futureIso() })).rejects.toBeInstanceOf(
            BadRequestException,
        );
        expect((prisma as any).lead.update).not.toHaveBeenCalled();
    });

    it('menolak transisi ke CLOSED_DEAL dengan closedDealAt bulan depan', async () => {
        const { service, prisma } = makeService();
        await expect(
            service.update(1, { status: 'CLOSED_DEAL' as any, closedDealAt: futureIso() }),
        ).rejects.toBeInstanceOf(BadRequestException);
        expect((prisma as any).lead.update).not.toHaveBeenCalled();
    });

    it('mengizinkan backdate closedDealAt ke bulan lalu', async () => {
        const { service, prisma } = makeService();
        await service.update(1, { closedDealAt: pastIso() });
        expect((prisma as any).lead.update).toHaveBeenCalled();
    });
});
