import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const existing = await prisma.warehouse.findFirst();
    if (existing) {
        console.log('Warehouse sudah ada, skip seed.');
        return;
    }

    const wh = await prisma.warehouse.create({
        data: {
            name: 'Gudang Utama',
            address: null,
            notes: 'Gudang default — dibuat otomatis oleh seed.',
        },
    });
    console.log(`Gudang default "${wh.name}" (id=${wh.id}) berhasil dibuat.`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
