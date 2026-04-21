/**
 * Prisma Seed — Contoh Produk: Cetak HVS
 *
 * Menambahkan produk "Cetak HVS" dengan 2 varian (1 Sisi & 2 Sisi),
 * masing-masing memiliki 3 tier harga berdasarkan jumlah lembar.
 *
 * Jalankan dengan:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed.ts
 * Atau tambahkan ke package.json:
 *   "prisma": { "seed": "ts-node prisma/seed.ts" }
 * Lalu jalankan: npx prisma db seed
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // 1. Upsert Category: "Cetak"
  // findFirst karena name sudah tidak @unique (mendukung sub-kategori)
  let category = await prisma.category.findFirst({ where: { name: 'Cetak' } } as any);
  if (!category) category = await (prisma as any).category.create({ data: { name: 'Cetak' } });
  if (!category) throw new Error('Gagal membuat kategori');

  // 2. Upsert Unit: "Lembar"
  const unit = await prisma.unit.upsert({
    where: { name: 'Lembar' },
    update: {},
    create: { name: 'Lembar' },
  });

  // 3. Buat Product: Cetak HVS
  //    - pricingMode: UNIT (dihitung per lembar, bukan per m²)
  //    - trackStock: false (jasa cetak, stok tidak dilacak)
  //    - pricePerUnit: harga default (dipakai jika tidak ada tier yang cocok)
  const product = await prisma.product.create({
    data: {
      name: 'Cetak HVS',
      description:
        'Layanan cetak dokumen di atas kertas HVS 70 gsm / 80 gsm. ' +
        'Tersedia cetak 1 sisi dan 2 sisi. ' +
        'Harga otomatis menyesuaikan jumlah lembar (tier harga).',
      categoryId: category.id,
      unitId: unit.id,
      pricingMode: 'UNIT',
      productType: 'SELLABLE',
      pricePerUnit: 1500, // harga fallback (tidak dipakai jika tier aktif)
      requiresProduction: false,
      trackStock: false,
    },
  });

  console.log(`✓ Produk dibuat: ${product.name} (id: ${product.id})`);

  // ──────────────────────────────────────────────
  // 4. Varian 1: Cetak HVS 1 Sisi
  // ──────────────────────────────────────────────
  const variant1Sisi = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: 'HVS-1SISI',
      variantName: '1 Sisi',
      price: 1500, // harga satuan default (dipakai saat checkout jika tier tidak aktif)
      hpp: 300,    // estimasi biaya tinta + listrik per lembar
      stock: 0,
      priceTiers: {
        create: [
          {
            // Tier 1: Eceran (1–10 lembar) — harga normal
            tierName: 'Eceran',
            minQty: 1,
            maxQty: 10,
            price: 1500,
          },
          {
            // Tier 2: Semi-grosir (11–50 lembar) — harga lebih murah
            tierName: 'Semi-Grosir',
            minQty: 11,
            maxQty: 50,
            price: 1000,
          },
          {
            // Tier 3: Grosir (>50 lembar) — harga termurah
            // maxQty: null = tidak ada batas atas
            tierName: 'Grosir',
            minQty: 51,
            maxQty: null,
            price: 750,
          },
        ],
      },
    },
    include: { priceTiers: true },
  });

  console.log(
    `✓ Varian dibuat: ${variant1Sisi.variantName} (sku: ${variant1Sisi.sku}) ` +
    `— ${variant1Sisi.priceTiers.length} tier harga`,
  );

  // ──────────────────────────────────────────────
  // 5. Varian 2: Cetak HVS 2 Sisi
  // ──────────────────────────────────────────────
  const variant2Sisi = await prisma.productVariant.create({
    data: {
      productId: product.id,
      sku: 'HVS-2SISI',
      variantName: '2 Sisi',
      price: 2000, // harga satuan default
      hpp: 500,    // estimasi HPP lebih tinggi karena 2x cetak
      stock: 0,
      priceTiers: {
        create: [
          {
            tierName: 'Eceran',
            minQty: 1,
            maxQty: 10,
            price: 2000,
          },
          {
            tierName: 'Semi-Grosir',
            minQty: 11,
            maxQty: 50,
            price: 1500,
          },
          {
            tierName: 'Grosir',
            minQty: 51,
            maxQty: null,
            price: 1200,
          },
        ],
      },
    },
    include: { priceTiers: true },
  });

  console.log(
    `✓ Varian dibuat: ${variant2Sisi.variantName} (sku: ${variant2Sisi.sku}) ` +
    `— ${variant2Sisi.priceTiers.length} tier harga`,
  );

  // ──────────────────────────────────────────────
  // Ringkasan
  // ──────────────────────────────────────────────
  console.log('\n─────────────────────────────────────────');
  console.log('Seed selesai. Ringkasan tier harga:\n');

  console.log('Cetak HVS — 1 Sisi');
  console.log('  1–10 lembar   : Rp 1.500 / lembar  (Eceran)');
  console.log('  11–50 lembar  : Rp 1.000 / lembar  (Semi-Grosir)');
  console.log('  >50 lembar    : Rp   750 / lembar  (Grosir)');

  console.log('\nCetak HVS — 2 Sisi');
  console.log('  1–10 lembar   : Rp 2.000 / lembar  (Eceran)');
  console.log('  11–50 lembar  : Rp 1.500 / lembar  (Semi-Grosir)');
  console.log('  >50 lembar    : Rp 1.200 / lembar  (Grosir)');
  console.log('─────────────────────────────────────────\n');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
