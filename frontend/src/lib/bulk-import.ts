import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';

export interface BulkVariantInput {
    variantName?: string;
    sku: string;
    price: number;
    hpp?: number;
    stock?: number;
    size?: string;
    color?: string;
}

export interface BulkHppVariableCost {
    customMaterialName: string;
    customPrice: number;
    usageAmount: number;
    usageUnit: string;
}

export interface BulkHppFixedCost {
    name: string;
    amount: number;
}

export interface BulkHppWorksheet {
    variantSku: string;
    targetVolume: number;
    targetMargin: number;
    variableCosts: BulkHppVariableCost[];
    fixedCosts: BulkHppFixedCost[];
}

export interface BulkProductInput {
    name: string;
    category: string;
    unit: string;
    pricingMode: 'UNIT' | 'AREA_BASED';
    productType: 'SELLABLE' | 'RAW_MATERIAL' | 'SERVICE';
    description?: string;
    requiresProduction: boolean;
    variants: BulkVariantInput[];
    hppWorksheets: BulkHppWorksheet[];
}

// ── Template generation ──────────────────────────────────────────────────────

export function downloadBulkTemplate(): void {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Produk & Varian
    const sheet1Data = [
        [
            'nama_produk', 'kategori', 'satuan', 'mode_harga', 'tipe_produk',
            'deskripsi', 'perlu_produksi', 'nama_varian', 'sku',
            'harga_jual', 'hpp', 'stok_awal', 'ukuran', 'warna'
        ],
        [
            '(Instruksi) Satu baris = satu varian. Jika produk punya banyak varian, ulangi kolom A–G dengan nilai yang sama.',
            'Kategori otomatis dibuat jika belum ada.',
            'pcs / m² / kg / dll',
            'UNIT atau AREA_BASED',
            'SELLABLE / RAW_MATERIAL / SERVICE',
            'Opsional',
            'TRUE / FALSE',
            'Opsional (mis: Glossy, A4)',
            'Opsional — kosong = auto-generate',
            'Wajib diisi',
            'Modal per unit (default 0)',
            'Default 0',
            'Opsional',
            'Opsional',
        ],
        [
            'Spanduk Outdoor', 'Cetak Digital', 'm²', 'AREA_BASED', 'SELLABLE',
            'Banner outdoor vinyl', 'TRUE', 'Laminasi Glossy', 'SPD-SPDR-001',
            '85000', '40000', '0', '', ''
        ],
        [
            'Spanduk Outdoor', 'Cetak Digital', 'm²', 'AREA_BASED', 'SELLABLE',
            'Banner outdoor vinyl', 'TRUE', 'Laminasi Doff', 'SPD-SPDR-002',
            '90000', '45000', '0', '', ''
        ],
        [
            'Stiker Vinyl', 'Cetak Digital', 'm²', 'AREA_BASED', 'SELLABLE',
            '', 'FALSE', '', 'SPD-STKVNL-001',
            '75000', '30000', '0', '', ''
        ],
        [
            'Beras Premium', 'Sembako', 'kg', 'UNIT', 'SELLABLE',
            'Beras organik kualitas premium', 'FALSE', '5kg', 'BRS-5KG-001',
            '85000', '68000', '50', '5kg', ''
        ],
        [
            'Beras Premium', 'Sembako', 'kg', 'UNIT', 'SELLABLE',
            'Beras organik kualitas premium', 'FALSE', '10kg', 'BRS-10KG-001',
            '160000', '130000', '30', '10kg', ''
        ],
    ];

    const ws1 = XLSX.utils.aoa_to_sheet(sheet1Data);

    // Column widths
    ws1['!cols'] = [
        { wch: 20 }, { wch: 15 }, { wch: 8 }, { wch: 14 }, { wch: 14 },
        { wch: 25 }, { wch: 14 }, { wch: 16 }, { wch: 18 },
        { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 10 },
    ];

    XLSX.utils.book_append_sheet(wb, ws1, 'Produk & Varian');

    // Sheet 2: HPP
    const sheet2Data = [
        [
            'sku', 'volume_target', 'margin_target_persen',
            'bahan1_nama', 'bahan1_harga', 'bahan1_jumlah', 'bahan1_satuan',
            'bahan2_nama', 'bahan2_harga', 'bahan2_jumlah', 'bahan2_satuan',
            'bahan3_nama', 'bahan3_harga', 'bahan3_jumlah', 'bahan3_satuan',
            'biaya_tetap1_nama', 'biaya_tetap1_jumlah',
            'biaya_tetap2_nama', 'biaya_tetap2_jumlah',
        ],
        [
            '(Instruksi) Isi SKU sesuai kolom I di sheet Produk & Varian. Boleh kosong jika tidak ingin membuat HPP worksheet.',
            'Jumlah unit yang diproduksi per batch',
            'Target margin keuntungan (%)',
            'Nama bahan baku 1', 'Harga bahan 1', 'Jumlah pemakaian 1', 'Satuan 1',
            'Nama bahan baku 2 (opsional)', 'Harga bahan 2', 'Jumlah 2', 'Satuan 2',
            'Nama bahan baku 3 (opsional)', 'Harga bahan 3', 'Jumlah 3', 'Satuan 3',
            'Nama biaya tetap 1 (opsional)', 'Jumlah biaya tetap 1',
            'Nama biaya tetap 2 (opsional)', 'Jumlah biaya tetap 2',
        ],
        [
            'SPD-SPDR-001', '100', '50',
            'Bahan Vinyl', '20000', '1', 'm²',
            'Tinta Solvent', '5000', '0.1', 'liter',
            'Laminasi Glossy', '15000', '1', 'm²',
            'Sewa Mesin', '500000',
            'Listrik', '200000',
        ],
    ];

    const ws2 = XLSX.utils.aoa_to_sheet(sheet2Data);
    ws2['!cols'] = [
        { wch: 18 }, { wch: 14 }, { wch: 20 },
        { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
        { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
        { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
        { wch: 18 }, { wch: 18 },
        { wch: 18 }, { wch: 18 },
    ];

    XLSX.utils.book_append_sheet(wb, ws2, 'HPP');

    const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    saveAs(new Blob([wbOut], { type: 'application/octet-stream' }), 'template-import-produk.xlsx');
}

// ── Parsing ──────────────────────────────────────────────────────────────────

function generateSku(productName: string): string {
    const initials = productName
        .split(/\s+/)
        .slice(0, 3)
        .map(w => w.slice(0, 3).toUpperCase())
        .join('-');
    const rand = Math.floor(1000 + Math.random() * 9000);
    const ts = Date.now().toString().slice(-4);
    return `SKU-${initials}-${rand}${ts}`;
}

function cellStr(val: any): string {
    if (val === null || val === undefined) return '';
    return String(val).trim();
}

function cellNum(val: any): number {
    const n = parseFloat(String(val));
    return isNaN(n) ? 0 : n;
}

export async function parseBulkExcel(file: File): Promise<{
    products: BulkProductInput[];
    errors: string[];
}> {
    const errors: string[] = [];

    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: 'array' });

    // ── Parse Sheet 2: HPP ───────────────────────────────────────────────────
    const hppMap: Record<string, BulkHppWorksheet> = {};
    const ws2 = wb.Sheets['HPP'];
    if (ws2) {
        const rows: any[][] = XLSX.utils.sheet_to_json(ws2, { header: 1, defval: '' });
        // Skip header (row 0) and instruction row (row 1)
        for (let i = 2; i < rows.length; i++) {
            const r = rows[i];
            const sku = cellStr(r[0]);
            if (!sku) continue;
            // Skip instruction rows
            if (sku.startsWith('(')) continue;

            const variableCosts: BulkHppVariableCost[] = [];
            // Columns D–G = indices 3–6, H–K = 7–10, L–O = 11–14
            for (let b = 0; b < 3; b++) {
                const base = 3 + b * 4;
                const name = cellStr(r[base]);
                if (name) {
                    variableCosts.push({
                        customMaterialName: name,
                        customPrice: cellNum(r[base + 1]),
                        usageAmount: cellNum(r[base + 2]),
                        usageUnit: cellStr(r[base + 3]) || 'pcs',
                    });
                }
            }

            const fixedCosts: BulkHppFixedCost[] = [];
            // P–Q = indices 15–16, R–S = 17–18
            for (let f = 0; f < 2; f++) {
                const base = 15 + f * 2;
                const name = cellStr(r[base]);
                if (name) {
                    fixedCosts.push({ name, amount: cellNum(r[base + 1]) });
                }
            }

            hppMap[sku] = {
                variantSku: sku,
                targetVolume: cellNum(r[1]) || 1,
                targetMargin: cellNum(r[2]) || 50,
                variableCosts,
                fixedCosts,
            };
        }
    }

    // ── Parse Sheet 1: Produk & Varian ───────────────────────────────────────
    const ws1 = wb.Sheets['Produk & Varian'];
    if (!ws1) {
        errors.push('Sheet "Produk & Varian" tidak ditemukan. Pastikan menggunakan template yang benar.');
        return { products: [], errors };
    }

    const rows: any[][] = XLSX.utils.sheet_to_json(ws1, { header: 1, defval: '' });

    // Row 0 = header, Row 1 = instruction, data starts at Row 2
    const dataRows = rows.slice(2).filter(r => {
        const name = cellStr(r[0]);
        const price = cellStr(r[9]);
        return name && price && !name.startsWith('(');
    });

    // Group by product name
    const productMap = new Map<string, BulkProductInput>();

    for (let i = 0; i < dataRows.length; i++) {
        const r = dataRows[i];

        const productName = cellStr(r[0]);
        const category = cellStr(r[1]);
        const unit = cellStr(r[2]);
        const modeRaw = cellStr(r[3]).toUpperCase();
        const pricingMode: 'UNIT' | 'AREA_BASED' = modeRaw === 'AREA_BASED' ? 'AREA_BASED' : 'UNIT';
        const typeRaw = cellStr(r[4]).toUpperCase();
        const productType: 'SELLABLE' | 'RAW_MATERIAL' | 'SERVICE' =
            typeRaw === 'RAW_MATERIAL' ? 'RAW_MATERIAL' : typeRaw === 'SERVICE' ? 'SERVICE' : 'SELLABLE';
        const description = cellStr(r[5]) || undefined;
        const requiresProduction = cellStr(r[6]).toUpperCase() === 'TRUE';
        const variantName = cellStr(r[7]) || undefined;
        let sku = cellStr(r[8]);
        const price = cellNum(r[9]);
        const hpp = cellNum(r[10]);
        const stock = cellNum(r[11]);
        const size = cellStr(r[12]) || undefined;
        const color = cellStr(r[13]) || undefined;

        // Validate required fields
        if (!productName) { errors.push(`Baris ${i + 3}: nama_produk kosong, dilewati.`); continue; }
        if (!category) { errors.push(`Baris ${i + 3} (${productName}): kategori kosong, dilewati.`); continue; }
        if (!unit) { errors.push(`Baris ${i + 3} (${productName}): satuan kosong, dilewati.`); continue; }
        if (!price) { errors.push(`Baris ${i + 3} (${productName}): harga_jual kosong atau 0, dilewati.`); continue; }

        if (!sku) sku = generateSku(productName);

        const variant: BulkVariantInput = {
            variantName,
            sku,
            price,
            hpp,
            stock,
            size,
            color,
        };

        if (productMap.has(productName)) {
            const existing = productMap.get(productName)!;
            existing.variants.push(variant);
        } else {
            productMap.set(productName, {
                name: productName,
                category,
                unit,
                pricingMode,
                productType,
                description,
                requiresProduction,
                variants: [variant],
                hppWorksheets: [],
            });
        }

        // Attach HPP worksheet if matched by SKU
        if (hppMap[sku]) {
            const product = productMap.get(productName)!;
            // Avoid duplicates
            if (!product.hppWorksheets.find(ws => ws.variantSku === sku)) {
                product.hppWorksheets.push(hppMap[sku]);
            }
        }
    }

    return { products: Array.from(productMap.values()), errors };
}
