/**
 * Backfill kolom Lead.closedDealAt untuk data lama yang sudah CLOSED_DEAL
 * tapi belum punya tanggal closing.
 *
 * Prioritas sumber tanggal (paling akurat -> fallback):
 *   1. createdAt aktivitas STAGE_CHANGED terakhir yang menuju stage menang (isWinStage)
 *      -> ini tanggal closing sebenarnya
 *   2. convertedAt (saat lead di-convert jadi customer)
 *   3. updatedAt (fallback terakhir)
 *
 * Aman dijalankan ulang (idempoten) — hanya MENGISI lead CLOSED_DEAL yang
 * closedDealAt-nya masih null. Yang sudah terisi tidak disentuh (mencegah
 * pergeseran tanggal: menulis kolom akan mem-bump updatedAt).
 *
 * Jalankan: npx ts-node --project tsconfig.seed.json prisma/backfill-closed-deal-at.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const winStages = await prisma.leadStage.findMany({
        where: { isWinStage: true },
        select: { id: true, name: true },
    });
    const winIds = new Set(winStages.map((s) => s.id));
    console.log(
        'Win stage:',
        winStages.map((s) => `${s.id}:${s.name}`).join(', ') || '(tidak ada win stage!)',
    );

    // Hanya proses yang belum punya tanggal closing — idempoten & anti-drift.
    const totalClosedDeal = await prisma.lead.count({ where: { status: 'CLOSED_DEAL' } });
    const leads = await prisma.lead.findMany({
        where: { status: 'CLOSED_DEAL', closedDealAt: null },
        select: { id: true, convertedAt: true, updatedAt: true, closedDealAt: true },
    });
    if (leads.length === 0) {
        console.log(`Total CLOSED_DEAL: ${totalClosedDeal}. Semua sudah punya closedDealAt. Tidak ada yang perlu di-backfill.`);
        return;
    }

    // Tanggal aktivitas terakhir menuju win stage, per lead.
    const acts = await prisma.leadActivity.findMany({
        where: { leadId: { in: leads.map((l) => l.id) }, kind: 'STAGE_CHANGED' },
        select: { leadId: true, createdAt: true, meta: true },
        orderBy: { createdAt: 'desc' },
    });
    const winDate = new Map<number, Date>();
    for (const a of acts) {
        const meta = a.meta as { toStageId?: number; to_stage_id?: number } | null;
        const to = meta?.toStageId ?? meta?.to_stage_id;
        if (to != null && winIds.has(Number(to)) && !winDate.has(a.leadId)) {
            winDate.set(a.leadId, a.createdAt);
        }
    }

    const bySrc = { activity: 0, convertedAt: 0, updatedAt: 0 };

    for (const l of leads) {
        let best: Date;
        if (winDate.has(l.id)) {
            best = winDate.get(l.id)!;
            bySrc.activity++;
        } else if (l.convertedAt) {
            best = l.convertedAt;
            bySrc.convertedAt++;
        } else {
            best = l.updatedAt;
            bySrc.updatedAt++;
        }
        await prisma.lead.update({ where: { id: l.id }, data: { closedDealAt: best } });
    }

    const stillNull = await prisma.lead.count({
        where: { status: 'CLOSED_DEAL', closedDealAt: null },
    });

    console.log('Total CLOSED_DEAL      :', totalClosedDeal);
    console.log('Di-backfill (tadinya null):', leads.length);
    console.log('Sumber tanggal          :', JSON.stringify(bySrc));
    console.log('Sisa null (harus 0)     :', stillNull);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
