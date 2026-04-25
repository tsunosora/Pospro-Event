/**
 * Seed default LeadStage + LeadLabel untuk module CRM.
 * Aman dijalankan ulang — upsert by name (label) / orderIndex (stage).
 *
 * Jalankan: npx ts-node --project tsconfig.seed.json prisma/seed-crm.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const STAGES: {
    name: string;
    color: string;
    isTerminal: boolean;
    isWinStage: boolean;
}[] = [
    { name: 'Lead Masuk', color: '#3b82f6', isTerminal: false, isWinStage: false },
    { name: 'Follow Up', color: '#06b6d4', isTerminal: false, isWinStage: false },
    { name: 'Penawaran', color: '#f59e0b', isTerminal: false, isWinStage: false },
    { name: 'Negosiasi', color: '#a855f7', isTerminal: false, isWinStage: false },
    { name: 'Closed Deal', color: '#10b981', isTerminal: true, isWinStage: true },
    { name: 'Lost', color: '#94a3b8', isTerminal: true, isWinStage: false },
];

const LABELS: { name: string; color: string }[] = [
    { name: 'Hot', color: '#ef4444' },
    { name: 'Warm', color: '#f97316' },
    { name: 'Cold', color: '#0ea5e9' },
    { name: 'Tidak Merespon', color: '#94a3b8' },
];

async function main() {
    let stageCreated = 0;
    let stageUpdated = 0;
    for (let i = 0; i < STAGES.length; i++) {
        const s = STAGES[i];
        const existing = await prisma.leadStage.findFirst({ where: { name: s.name } });
        if (existing) {
            await prisma.leadStage.update({
                where: { id: existing.id },
                data: { color: s.color, orderIndex: i, isTerminal: s.isTerminal, isWinStage: s.isWinStage },
            });
            stageUpdated++;
        } else {
            await prisma.leadStage.create({
                data: { name: s.name, color: s.color, orderIndex: i, isTerminal: s.isTerminal, isWinStage: s.isWinStage },
            });
            stageCreated++;
        }
    }

    let labelCreated = 0;
    let labelUpdated = 0;
    for (const l of LABELS) {
        const existing = await prisma.leadLabel.findUnique({ where: { name: l.name } });
        if (existing) {
            await prisma.leadLabel.update({ where: { id: existing.id }, data: { color: l.color } });
            labelUpdated++;
        } else {
            await prisma.leadLabel.create({ data: l });
            labelCreated++;
        }
    }

    console.log(
        `✓ Seed CRM selesai. stages: created=${stageCreated} updated=${stageUpdated}, labels: created=${labelCreated} updated=${labelUpdated}`,
    );
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
