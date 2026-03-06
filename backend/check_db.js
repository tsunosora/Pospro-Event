const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const ings = await prisma.ingredient.findMany({
        orderBy: { id: 'desc' },
        take: 5
    });
    console.log("Recent Ingredients:", ings);
}

main().finally(() => prisma.$disconnect());
