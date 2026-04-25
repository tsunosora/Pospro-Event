/**
 * Seed kategori RAB default (11 kategori bawaan).
 * Aman dijalankan ulang — pakai upsert by `key`.
 *
 * Jalankan: npx ts-node --project tsconfig.seed.json prisma/seed-rab-categories.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULTS: { key: string; name: string }[] = [
    { key: 'MATERIAL', name: 'Material' },
    { key: 'FINISHING', name: 'Finishing' },
    { key: 'PERLENGKAPAN', name: 'Perlengkapan' },
    { key: 'AKSESORIS', name: 'Aksesoris' },
    { key: 'OP_PASANG', name: 'Operasional Pasang' },
    { key: 'OP_BONGKAR', name: 'Operasional Bongkar' },
    { key: 'GAJI', name: 'Gaji' },
    { key: 'SEWA', name: 'Biaya Sewa' },
    { key: 'SUPLYER', name: 'Suplyer' },
    { key: 'DARURAT', name: 'Darurat' },
    { key: 'LAIN_LAIN', name: 'Biaya Lain-lain' },
];

async function main() {
    let created = 0;
    let updated = 0;
    for (let i = 0; i < DEFAULTS.length; i++) {
        const d = DEFAULTS[i];
        const existing = await prisma.rabCategory.findUnique({ where: { key: d.key } });
        if (existing) {
            await prisma.rabCategory.update({
                where: { id: existing.id },
                data: { orderIndex: i, isActive: true },
            });
            updated++;
        } else {
            await prisma.rabCategory.create({
                data: { key: d.key, name: d.name, orderIndex: i, isActive: true },
            });
            created++;
        }
    }
    console.log(`✓ Seed kategori RAB selesai. created=${created} updated=${updated}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
