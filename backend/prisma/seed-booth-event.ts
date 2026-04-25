/**
 * Seed item master untuk booth & event (pospenawaran).
 *
 * Menyiapkan 10 Product + ProductVariant sebagai master data item penawaran.
 * Dua kelompok:
 *   - SEWA: stand kayu, booth R8, tenda plafon, photo booth LED, lampu, meja, kursi
 *   - PENGADAAN: booth custom special design, replika display, 3D logo lighted
 *
 * Jalankan: npx ts-node --compiler-options "{\"module\":\"CommonJS\"}" prisma/seed-booth-event.ts
 */

import { PrismaClient, BoothProductType } from '@prisma/client';

const prisma = new PrismaClient();

type SeedItem = {
  productName: string;
  description: string;
  sku: string;
  variantName: string;
  size?: string;
  price: number;
  boothProductType: BoothProductType;
  defaultRentalUnit: string;
  unitName: string;
};

const ITEMS: SeedItem[] = [
  {
    productName: 'Stand Kayu Standar',
    description: 'Stand booth pameran berbahan kayu dengan ukuran standar, cocok untuk pameran UMKM/produk.',
    sku: 'STD-KAYU-3X3',
    variantName: 'Standar 3x3 m',
    size: '3x3 m',
    price: 1_000_000,
    boothProductType: 'SEWA',
    defaultRentalUnit: 'unit/hari',
    unitName: 'unit',
  },
  {
    productName: 'Booth Standar R8',
    description: 'Booth standar tipe R8 untuk pameran dalam ruangan.',
    sku: 'BOOTH-R8-3X2',
    variantName: 'R8 3x2 m',
    size: '3x2 m',
    price: 500_000,
    boothProductType: 'SEWA',
    defaultRentalUnit: 'unit/hari',
    unitName: 'unit',
  },
  {
    productName: 'Tenda Plafon',
    description: 'Tenda plafon besar untuk area pengunjung / area makan event outdoor.',
    sku: 'TENDA-PLAFON-20X70',
    variantName: 'Plafon 20x70 m',
    size: '20x70 m',
    price: 550_000,
    boothProductType: 'SEWA',
    defaultRentalUnit: 'unit/hari',
    unitName: 'unit',
  },
  {
    productName: 'Photo Booth LED',
    description: 'Photo booth dengan latar LED, disewakan per m² per hari.',
    sku: 'PHOTO-LED-6X3',
    variantName: 'LED 6x3 m',
    size: '6x3 m',
    price: 750_000,
    boothProductType: 'SEWA',
    defaultRentalUnit: 'm²/hari',
    unitName: 'm²',
  },
  {
    productName: 'Lampu TL',
    description: 'Lampu TL 20W untuk penerangan booth/tenda.',
    sku: 'LAMPU-TL-20W',
    variantName: 'TL 20W',
    price: 25_000,
    boothProductType: 'SEWA',
    defaultRentalUnit: 'unit/hari',
    unitName: 'unit',
  },
  {
    productName: 'Meja Bulat + Taplak',
    description: 'Meja bulat standar event lengkap dengan taplak kain.',
    sku: 'MEJA-BULAT',
    variantName: 'Bulat 80 cm',
    size: '80 cm',
    price: 50_000,
    boothProductType: 'SEWA',
    defaultRentalUnit: 'unit/hari',
    unitName: 'unit',
  },
  {
    productName: 'Kursi Lipat',
    description: 'Kursi lipat untuk audience/pengunjung event.',
    sku: 'KURSI-LIPAT',
    variantName: 'Lipat Standar',
    price: 15_000,
    boothProductType: 'SEWA',
    defaultRentalUnit: 'unit/hari',
    unitName: 'unit',
  },
  {
    productName: 'Booth Custom Special Design',
    description: 'Booth custom special design, ukuran 4x4m, multipleks finishing wallpaint, 1 set tidak terpisah.',
    sku: 'BOOTH-CUSTOM-4X4',
    variantName: 'Custom 4x4 m',
    size: '4x4 m',
    price: 35_000_000,
    boothProductType: 'PENGADAAN',
    defaultRentalUnit: 'set',
    unitName: 'set',
  },
  {
    productName: 'Replika Display',
    description: 'Replika display berbahan styrofoam finishing fiber untuk booth special design.',
    sku: 'REPLIKA-STYRO',
    variantName: 'Styrofoam Fiber',
    price: 5_000_000,
    boothProductType: 'PENGADAAN',
    defaultRentalUnit: 'unit',
    unitName: 'unit',
  },
  {
    productName: '3D Logo Lighted',
    description: '3D Logo dengan lighting, berbahan acrylic + LED.',
    sku: 'LOGO-3D-LED',
    variantName: 'Acrylic + LED',
    price: 3_500_000,
    boothProductType: 'PENGADAAN',
    defaultRentalUnit: 'unit',
    unitName: 'unit',
  },
];

async function ensureCategory(name: string): Promise<number> {
  const existing = await prisma.category.findFirst({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.category.create({ data: { name } });
  return created.id;
}

async function ensureUnit(name: string): Promise<number> {
  const existing = await prisma.unit.findUnique({ where: { name } });
  if (existing) return existing.id;
  const created = await prisma.unit.create({ data: { name } });
  return created.id;
}

async function main() {
  console.log('Seed master item booth & event (pospenawaran)...');

  const categoryId = await ensureCategory('Booth & Event');
  console.log(`  Category "Booth & Event" id=${categoryId}`);

  let createdCount = 0;
  let skippedCount = 0;

  for (const item of ITEMS) {
    const existingVariant = await prisma.productVariant.findUnique({ where: { sku: item.sku } });
    if (existingVariant) {
      skippedCount++;
      continue;
    }

    const unitId = await ensureUnit(item.unitName);

    const product = await prisma.product.create({
      data: {
        name: item.productName,
        description: item.description,
        categoryId,
        unitId,
        pricingMode: item.defaultRentalUnit.startsWith('m²') ? 'AREA_BASED' : 'UNIT',
        productType: 'SELLABLE',
        pricePerUnit: item.price,
        requiresProduction: item.boothProductType === 'PENGADAAN',
        trackStock: false,
      },
    });

    await prisma.productVariant.create({
      data: {
        productId: product.id,
        sku: item.sku,
        variantName: item.variantName,
        size: item.size,
        price: item.price,
        hpp: 0,
        stock: 0,
        boothProductType: item.boothProductType,
        defaultRentalUnit: item.defaultRentalUnit,
      },
    });

    createdCount++;
    console.log(
      `  [${item.boothProductType}] ${item.productName} (${item.variantName}) @ Rp ${item.price.toLocaleString('id-ID')} / ${item.defaultRentalUnit}`,
    );
  }

  console.log(`\nSelesai. Dibuat: ${createdCount} item, dilewati (sudah ada): ${skippedCount}.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (err) => {
    console.error(err);
    await prisma.$disconnect();
    process.exit(1);
  });
