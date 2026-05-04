import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as fs from 'fs';
import * as path from 'path';

// Gunakan require() agar tidak butuh @types/archiver & @types/adm-zip
// eslint-disable-next-line @typescript-eslint/no-require-imports
const archiver = require('archiver');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const AdmZip = require('adm-zip');

// ─── Grup filter yang bisa dipilih user ────────────────────────────────────
// PENTING: nama harus sesuai Prisma accessor (singular camelCase)
//
// CHANGELOG:
// v2.12 (current) — Quotation customization extensive + Multi-language (ID/EN):
//   - Invoice.language ('id' | 'en') — bahasa surat per quotation
//   - Invoice custom text fields: customOpeningText, customDisclaimer, customPaymentTerms, customClosing
//   - Invoice prepend/append: disclaimerPrepend/Append, paymentTermsPrepend/Append, closingPrepend/Append
//   - Invoice attachmentCount + customAttachmentText (lampiran custom)
//   - BrandSettings.themeColor (hex untuk PDF accent color per brand)
//   - BrandSettings.openingTemplate + 5 English versions (quotationDisclaimerEn, paymentTermsEn, closingEn, invoiceClosingTextEn, openingTemplateEn)
//   - Event.dailyWageRate, overtimeRatePerHour, dailyWageRatePic, overtimeRatePerHourPic — wage override per event (PIC tier vs Member)
//   - Worker.defaultCityKey, defaultDivisionKey — preset wage matrix di PIC dropdown
//   - WageRate (city + division → daily/overtime rate) — master tarif kota+divisi
// v2.11 — Approval flow + Adjustments (tunjangan/potongan) + Audit log:
//   - Attendance.approvalStatus, approvedAt, approvedById, rejectionReason — workflow PENDING/APPROVED/REJECTED
//   - New table: PayrollAdjustment (BONUS/ALLOWANCE/DEDUCTION/ADVANCE per worker per tanggal)
//   - New table: AttendanceAuditLog (history CREATE/UPDATE/DELETE/APPROVE/REJECT dengan oldData/newData snapshot)
//   - Worker.defaultCityKey, defaultDivisionKey — auto-prefill di PIC dropdown
// v2.10 — Payroll matrix Kota+Divisi + Event wage override:
//   - New table: WageRate (city + division → dailyWageRate + overtimeRatePerHour)
//   - Attendance.eventId, cityKey, divisionKey — wage context per row
//   - Event.dailyWageRate, overtimeRatePerHour — project-level override
//   - Wage resolution priority: Event > Matrix > Worker default
// v2.9 — Payroll harian + absensi via PIC link + tim crew:
//   - Worker.dailyWageRate, overtimeRatePerHour (Decimal) — gaji harian + tarif lembur per jam
//   - Worker.isPic, picAccessToken, picPin — flag PIC + token unik + PIN security tambahan
//   - Worker.teamId — link ke CrewTeam (member tim untuk filter PIC absensi)
//   - Lead.status diperluas (WAITING_DECISION, PROPOSAL_SENT, NEGOTIATION, ON_HOLD)
//   - Lead.source diperluas (INSTAGRAM_ADS, FACEBOOK_ADS, TIKTOK, LINKEDIN, EXHIBITION)
//   - New table: Attendance (1 row per worker per tanggal, status FULL_DAY/HALF_DAY/ABSENT + overtimeHours)
//   - Cashflow.bankAccountId, etc. — sudah include di v2.7, no perubahan baru
// v2.8 — CRM Pipeline enhancements:
//   - Lead.imageUrl (foto referensi/sketsa project per-lead, ditampilkan di drawer detail)
//   - CRM pipeline card sekarang display date (leadCameAt + followUpDate + eventDate)
//     → semua field tersebut sudah ada, cuma perlu dipastikan ikut backup (sudah ✓)
//   - Lead edit form lengkap di drawer (semua field editable kecuali stage/status/worker)
// v2.7 — Fitur RAB → Cashflow auto-sync & laporan lengkap:
//   - RabPlan.imageUrl (foto sketsa/desain project)
//   - RabPlan.reportCompletedAt, reportCompletedBy (status laporan lengkap admin)
//   - RabPlan.customerId (link ke pelanggan untuk reuse data)
//   - Cashflow.rabPlanId, eventId, excludeFromShift (auto-sync dari RAB + isolate dari shift POS)
//   - Cashflow auto-generated entries di-tag rabPlanId — saat restore, link tetap utuh
//   - Hidden preset tags (localStorage browser, TIDAK ikut backup karena per-device)
// v2.6 — Field-level additions:
//   - Worker.fullName (nama lengkap untuk audit)
//   - ProductVariant.description, notes (keterangan & catatan varian)
//   - ProductVariant.defaultWarehouseId (lokasi gudang utama varian)
//   - RabPlan.tags (multi-tag untuk filter)
//   - Lead.assignedWorkerId (marketing handler)
// v2.5 — Tambah brandSettings, quotationVariantConfig, inventoryAcquisition
// v2.4 — Initial multi-brand support
export const BACKUP_GROUPS = {
    master: {
        label: 'Master Data',
        // brandSettings (multi-brand: Exindo, Xposer, dll) — branding & nomor seri per brand
        tables: ['role', 'category', 'unit', 'storeSettings', 'bankAccount', 'branch', 'brandSettings'],
    },
    users: {
        label: 'Pengguna',
        tables: ['user'],
    },
    products: {
        label: 'Produk & Inventori',
        tables: ['product', 'productVariant', 'ingredient', 'variantIngredient', 'variantPriceTier', 'batch', 'stockMovement', 'stockPurchase', 'stockPurchaseItem'],
    },
    suppliers: {
        label: 'Supplier',
        tables: ['supplier', 'supplierItem'],
    },
    customers: {
        label: 'Pelanggan',
        tables: ['customer'],
    },
    hpp: {
        label: 'HPP & Costing',
        tables: ['hppWorksheet', 'hppVariableCost', 'hppFixedCost'],
    },
    transactions: {
        label: 'Transaksi & Penjualan',
        // cashflow: include field rabPlanId/eventId/excludeFromShift (auto-sync dari RAB)
        tables: ['transaction', 'transactionItem', 'cashflow', 'cashflowChangeRequest', 'transactionEditRequest'],
    },
    invoices: {
        label: 'Invoice & Penawaran',
        // quotationVariantConfig: konfigurasi varian penawaran (SEWA, PENGADAAN_BOOTH, dll yang user-defined)
        tables: ['quotationVariantConfig', 'invoice', 'invoiceItem'],
    },
    production: {
        label: 'Produksi',
        tables: ['productionBatch', 'productionJob'],
    },
    opname: {
        label: 'Stok Opname',
        tables: ['stockOpnameSession', 'stockOpnameItem'],
    },
    reports: {
        label: 'Laporan Shift',
        tables: ['shiftReport', 'competitor'],
    },
    workers: {
        label: 'Petugas / Worker',
        // worker: include payroll fields (dailyWageRate, overtimeRatePerHour, isPic, picAccessToken, teamId, defaultCityKey, defaultDivisionKey)
        // attendance: data absensi (eventId, cityKey, divisionKey, approvalStatus untuk wage + approval flow)
        // wageRate: master tarif kota+divisi
        // payrollAdjustment: tunjangan/potongan/bonus/kasbon per worker
        // attendanceAuditLog: history change attendance (CREATE/UPDATE/DELETE/APPROVE/REJECT)
        tables: ['worker', 'attendance', 'wageRate', 'payrollAdjustment', 'attendanceAuditLog'],
    },
    warehouse: {
        label: 'Gudang & Lokasi',
        tables: ['warehouse', 'storageLocation'],
    },
    events: {
        label: 'Event & Packing',
        tables: ['event', 'eventPackingItem', 'withdrawal', 'withdrawalItem'],
    },
    eventCrew: {
        label: 'Crew Lapangan & Team',
        tables: ['crewTeam', 'eventCrewAssignment'],
    },
    rab: {
        label: 'RAB & Penomoran',
        // rabPlan: include imageUrl, tags, reportCompletedAt/By, customerId (link CRM)
        // inventoryAcquisition: tracking item RAB ber-tag inventaris (snapshot saat dibeli)
        tables: ['rabCategory', 'rabPlan', 'rabItem', 'rabLooseItem', 'inventoryAcquisition', 'documentNumberCounter'],
    },
    crm: {
        label: 'CRM / Pipeline Lead',
        // lead: include imageUrl (foto referensi project), eventDate, followUpDate, projectValueEst, dll
        tables: ['leadStage', 'leadLabel', 'lead', 'leadLabelOnLead', 'leadActivity'],
    },
    printing: {
        label: 'Printing & Antrian',
        tables: ['printJob'],
    },
    salesOrders: {
        label: 'Sales Order & Designer',
        tables: ['designer', 'salesOrder', 'salesOrderItem', 'salesOrderProof'],
    },
} as const;

export type BackupGroupKey = keyof typeof BACKUP_GROUPS;

// Urutan restore — penting untuk FK integrity
const RESTORE_ORDER = [
    'role', 'storeSettings', 'bankAccount', 'category', 'unit', 'branch', 'competitor',
    'brandSettings',                            // multi-brand config (independent, no FK ke tabel lain)
    'quotationVariantConfig',                   // varian penawaran (SEWA/PENGADAAN_BOOTH dll) — sebelum invoice
    'user', 'customer', 'supplier',
    'worker', 'designer',                       // entitas orang yang dipakai di banyak tempat
    'warehouse', 'storageLocation',             // gudang sebelum lokasi penyimpanan
    'rabCategory', 'documentNumberCounter',     // master RAB & counter penomoran
    'leadStage', 'leadLabel',                   // master CRM (independent, sebelum lead)
    'product', 'productVariant',                // productVariant.defaultWarehouseId → setelah warehouse (✓)
    'rabLooseItem',                             // → setelah productVariant (FK promotedVariantId)
    'ingredient', 'variantIngredient', 'variantPriceTier',
    'batch', 'stockMovement', 'supplierItem',
    'stockPurchase', 'stockPurchaseItem',       // pembelian stok → setelah supplier & variant
    'hppWorksheet', 'hppVariableCost', 'hppFixedCost',
    'transaction', 'transactionItem',
    'printJob',                                 // → setelah transaction
    'shiftReport',                              // sebelum cashflow karena cashflow punya FK ke shiftReport
    'cashflow', 'cashflowChangeRequest',        // cashflowChangeRequest → setelah cashflow & user
    'transactionEditRequest',                   // → setelah transaction & user
    'rabPlan',                                  // → setelah customer
    'invoice', 'invoiceItem',                   // → setelah quotationVariantConfig (FK variantCode)
    'event',                                    // → setelah customer & rabPlan
    'crewTeam',                                 // → setelah worker (FK leaderWorkerId optional)
    'eventCrewAssignment',                      // → setelah event, worker, crewTeam
    'eventPackingItem',                         // → setelah event, productVariant, storageLocation, worker
    'withdrawal', 'withdrawalItem',             // → setelah event, worker, warehouse, productVariant
    'rabItem',                                  // → setelah rabPlan, rabCategory, productVariant, eventPackingItem
    'inventoryAcquisition',                     // → setelah rabPlan, rabItem, productVariant, warehouse
    'salesOrder', 'salesOrderItem', 'salesOrderProof',
    'productionBatch', 'productionJob',
    'stockOpnameSession', 'stockOpnameItem',
    'lead',                                     // → setelah leadStage, customer, worker
    'leadLabelOnLead', 'leadActivity',          // → setelah lead, leadLabel, worker
    'wageRate',                                 // master tarif (no FK, restore kapan saja)
    'attendance',                               // → setelah worker (FK ke worker via workerId & recordedByPicId, optional eventId)
    'payrollAdjustment',                        // → setelah worker (FK ke worker)
    'attendanceAuditLog',                       // → setelah attendance (FK optional ke attendance)
];

// Path folder uploads gambar (3x up = backend root ketika dikompilasi ke dist/backup/)
const UPLOADS_DIR = path.join(__dirname, '..', '..', '..', 'public', 'uploads');
// Path config WhatsApp bot
const WA_CONFIG_PATH = path.join(__dirname, '..', '..', '..', 'whatsapp_bot_config.json');

@Injectable()
export class BackupService {
    constructor(private prisma: PrismaService) {}

    // ── Export / Backup — stream ZIP langsung ke response ──────────────────

    async streamBackupZip(
        selectedGroups: BackupGroupKey[] | 'all',
        outputStream: any,
        includeImages = true,
    ): Promise<void> {
        // ── 1. Kumpulkan data DB secara PARALLEL ──────────────────────────
        let tablesToExport: string[];
        if (selectedGroups === 'all') {
            tablesToExport = Object.values(BACKUP_GROUPS).flatMap(g => [...g.tables]);
        } else {
            tablesToExport = selectedGroups.flatMap(g => [...(BACKUP_GROUPS[g]?.tables ?? [])]);
        }
        tablesToExport = [...new Set(tablesToExport)];

        // Query semua tabel secara paralel — jauh lebih cepat dari sequential loop
        const results = await Promise.all(
            tablesToExport.map(async (table) => {
                try {
                    const rows = await (this.prisma as any)[table].findMany();
                    return { table, rows };
                } catch {
                    return { table, rows: [] };
                }
            })
        );

        const data: Record<string, any[]> = {};
        const counts: Record<string, number> = {};
        for (const { table, rows } of results) {
            data[table] = rows;
            counts[table] = rows.length;
        }

        const hasWaConfig = fs.existsSync(WA_CONFIG_PATH);

        const backupJson = {
            meta: {
                version: '2.12',
                createdAt: new Date().toISOString(),
                app: 'PosPro',
                tables: tablesToExport,
                groups: selectedGroups === 'all' ? Object.keys(BACKUP_GROUPS) : selectedGroups,
                rowCounts: counts,
                includesImages: includeImages,
                includesWaConfig: hasWaConfig,
            },
            data,
        };

        // ── 2. Stream ZIP langsung ke response ────────────────────────────
        return new Promise<void>((resolve, reject) => {
            // Kompresi level 1 untuk data.json, store mode (level 0) untuk gambar
            const archive = archiver('zip', { zlib: { level: 1 } });

            archive.on('error', reject);
            archive.on('finish', resolve);

            // Pipe langsung ke response — tidak buffer di RAM
            archive.pipe(outputStream);

            // Tambahkan data.json
            archive.append(JSON.stringify(backupJson, null, 2), { name: 'data.json' });

            // Tambahkan folder uploads tanpa kompresi ulang (gambar sudah terkompresi)
            if (includeImages && fs.existsSync(UPLOADS_DIR)) {
                archive.directory(UPLOADS_DIR, 'uploads', { store: true } as any);
            }

            // Tambahkan konfigurasi WhatsApp bot jika ada
            if (hasWaConfig) {
                archive.file(WA_CONFIG_PATH, { name: 'whatsapp_bot_config.json' });
            }

            archive.finalize();
        });
    }

    // ── Preview Backup File JSON ─────────────────────────────────────────────

    parseBackupFile(content: string) {
        let parsed: any;
        try {
            parsed = JSON.parse(content);
        } catch {
            throw new BadRequestException('File backup tidak valid atau rusak (bukan JSON).');
        }

        if (!parsed.meta || !parsed.data) {
            throw new BadRequestException('Format file backup tidak dikenali. Pastikan file berasal dari sistem PosPro.');
        }

        return {
            meta: parsed.meta,
            preview: Object.entries(parsed.data as Record<string, any[]>).map(([table, rows]) => ({
                table,
                count: rows.length,
            })),
            imageCount: 0,
            hasWaConfig: false,
        };
    }

    // ── Preview Backup ZIP ───────────────────────────────────────────────────

    parseBackupZip(fileBuffer: Buffer): { meta: any; preview: { table: string; count: number }[]; imageCount: number; hasWaConfig: boolean } {
        let zip: any;
        try {
            zip = new AdmZip(fileBuffer);
        } catch {
            throw new BadRequestException('File ZIP tidak valid atau rusak.');
        }

        const dataEntry = zip.getEntry('data.json');
        if (!dataEntry) {
            throw new BadRequestException('File ZIP tidak mengandung data.json. Pastikan file berasal dari sistem PosPro.');
        }

        let parsed: any;
        try {
            parsed = JSON.parse(dataEntry.getData().toString('utf-8'));
        } catch {
            throw new BadRequestException('data.json di dalam ZIP tidak valid.');
        }

        if (!parsed.meta || !parsed.data) {
            throw new BadRequestException('Format data.json tidak dikenali.');
        }

        const imageEntries: any[] = zip.getEntries().filter(
            (e: any) => e.entryName.startsWith('uploads/') && !e.isDirectory
        );

        const hasWaConfig = !!zip.getEntry('whatsapp_bot_config.json');

        return {
            meta: parsed.meta,
            preview: Object.entries(parsed.data as Record<string, any[]>).map(([table, rows]) => ({
                table,
                count: rows.length,
            })),
            imageCount: imageEntries.length,
            hasWaConfig,
        };
    }

    // ── Import / Restore ────────────────────────────────────────────────────

    async importBackup(
        fileBuffer: Buffer,
        isZip: boolean,
        mode: 'skip' | 'overwrite' = 'skip',
        selectedTables?: string[],
    ) {
        let jsonContent: string;
        let zip: any = null;

        if (isZip) {
            try {
                zip = new AdmZip(fileBuffer);
            } catch {
                throw new BadRequestException('File ZIP tidak valid atau rusak.');
            }
            const dataEntry = zip.getEntry('data.json');
            if (!dataEntry) throw new BadRequestException('File ZIP tidak mengandung data.json.');
            jsonContent = dataEntry.getData().toString('utf-8');
        } else {
            jsonContent = fileBuffer.toString('utf-8');
        }

        let parsed: any;
        try {
            parsed = JSON.parse(jsonContent);
        } catch {
            throw new BadRequestException('File backup tidak valid atau rusak (bukan JSON).');
        }

        if (!parsed.meta || !parsed.data) {
            throw new BadRequestException('Format file backup tidak dikenali.');
        }

        const backupData: Record<string, any[]> = parsed.data;

        const tablesToRestore = selectedTables
            ? selectedTables.filter(t => backupData[t])
            : RESTORE_ORDER.filter(t => backupData[t] !== undefined);

        const ordered = RESTORE_ORDER.filter(t => tablesToRestore.includes(t));
        const result: Record<string, { success: number; skipped: number; error: string | null }> = {};

        // ── Restore database ──────────────────────────────────────────────
        await this.prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 0`;

        try {
            for (const table of ordered) {
                const rows: any[] = backupData[table] || [];
                if (!rows.length) {
                    result[table] = { success: 0, skipped: 0, error: null };
                    continue;
                }

                result[table] = { success: 0, skipped: 0, error: null };

                if (mode === 'overwrite') {
                    try {
                        await (this.prisma as any)[table].deleteMany({});
                        const cleaned = rows.map(r => this.cleanRow(r));
                        await (this.prisma as any)[table].createMany({ data: cleaned, skipDuplicates: true });
                        result[table].success = cleaned.length;
                    } catch (e: any) {
                        result[table].error = e.message?.substring(0, 200) ?? 'Unknown error';
                    }
                } else {
                    let success = 0;
                    let skipped = 0;
                    // Composite-PK tables (no single `id` field) — pakai createMany skipDuplicates
                    const cleanedRows = rows.map(r => this.cleanRow(r));
                    const hasIdPk = cleanedRows.length > 0 && 'id' in cleanedRows[0];
                    if (!hasIdPk) {
                        try {
                            const res = await (this.prisma as any)[table].createMany({
                                data: cleanedRows,
                                skipDuplicates: true,
                            });
                            success = res.count ?? 0;
                            skipped = cleanedRows.length - success;
                        } catch (e: any) {
                            result[table].error = e.message?.substring(0, 200) ?? 'Unknown error';
                        }
                    } else {
                        for (const cleaned of cleanedRows) {
                            try {
                                await (this.prisma as any)[table].upsert({
                                    where: { id: cleaned.id },
                                    create: cleaned,
                                    update: {},
                                });
                                success++;
                            } catch {
                                skipped++;
                            }
                        }
                    }
                    result[table].success = success;
                    result[table].skipped = skipped;
                }
            }
        } finally {
            await this.prisma.$executeRaw`SET FOREIGN_KEY_CHECKS = 1`;
        }

        // ── Restore gambar dari ZIP ───────────────────────────────────────
        let imagesRestored = 0;
        if (zip) {
            const imageEntries: any[] = zip.getEntries().filter(
                (e: any) => e.entryName.startsWith('uploads/') && !e.isDirectory
            );
            if (imageEntries.length > 0) {
                if (!fs.existsSync(UPLOADS_DIR)) {
                    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
                }
                for (const entry of imageEntries) {
                    const filename = path.basename(entry.entryName);
                    if (!filename) continue;
                    const destPath = path.join(UPLOADS_DIR, filename);
                    if (mode === 'skip' && fs.existsSync(destPath)) continue;
                    fs.writeFileSync(destPath, entry.getData());
                    imagesRestored++;
                }
            }
        }

        // ── Restore konfigurasi WhatsApp dari ZIP ─────────────────────────
        let waConfigRestored = false;
        if (zip) {
            const waConfigEntry = zip.getEntry('whatsapp_bot_config.json');
            if (waConfigEntry) {
                // Pada mode skip, jangan timpa config yang sudah ada
                if (mode === 'overwrite' || !fs.existsSync(WA_CONFIG_PATH)) {
                    try {
                        fs.writeFileSync(WA_CONFIG_PATH, waConfigEntry.getData());
                        waConfigRestored = true;
                    } catch {
                        // Gagal tulis config — tidak fatal
                    }
                }
            }
        }

        const totalRestored = Object.values(result).reduce((s, r) => s + r.success, 0);
        const totalSkipped = Object.values(result).reduce((s, r) => s + r.skipped, 0);
        const errors = Object.entries(result)
            .filter(([, r]) => r.error)
            .map(([t, r]) => `${t}: ${r.error}`);

        const parts = [`${totalRestored} baris data berhasil`, `${totalSkipped} dilewati`, `${imagesRestored} foto dipulihkan`];
        if (waConfigRestored) parts.push('konfigurasi WhatsApp dipulihkan');

        return {
            message: `Restore selesai. ${parts.join(', ')}.`,
            totalRestored,
            totalSkipped,
            imagesRestored,
            waConfigRestored,
            errors,
            detail: result,
        };
    }

    // Bersihkan fields relasi nested sebelum insert.
    // Data dari JSON.parse tidak mengandung Prisma-specific types (Date/Decimal objects),
    // hanya primitives, JSON objects, dan JSON arrays — semua harus dipertahankan.
    private cleanRow(row: any): any {
        const cleaned: any = {};
        for (const [key, val] of Object.entries(row)) {
            // Lewati nested Prisma relation objects (ditandai dengan field 'id' sendiri)
            // Dalam praktiknya ini tidak muncul karena kita pakai findMany() tanpa include,
            // tapi sebagai precaution tetap kita filter.
            if (
                val !== null &&
                typeof val === 'object' &&
                !Array.isArray(val) &&
                !(val instanceof Date) &&
                'id' in (val as any) &&
                ('createdAt' in (val as any) || 'updatedAt' in (val as any))
            ) {
                continue; // Nested Prisma model — lewati
            }
            // Lewati array of nested Prisma objects (relation lists)
            if (
                Array.isArray(val) &&
                val.length > 0 &&
                typeof val[0] === 'object' &&
                val[0] !== null &&
                'id' in val[0] &&
                ('createdAt' in val[0] || 'updatedAt' in val[0])
            ) {
                continue; // Nested relation array — lewati
            }
            // Pertahankan semua nilai lainnya termasuk JSON fields (objects/arrays biasa)
            cleaned[key] = val;
        }
        return cleaned;
    }

    private isDateString(val: string): boolean {
        return typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val);
    }

    // ── Info Grup ───────────────────────────────────────────────────────────

    getGroups() {
        return Object.entries(BACKUP_GROUPS).map(([key, group]) => ({
            key,
            label: group.label,
            tables: group.tables,
        }));
    }

    // ── Write backup ZIP langsung ke file (untuk rclone) ───────────────────
    async writeBackupToFile(filePath: string): Promise<void> {
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

        const writeStream = fs.createWriteStream(filePath);
        await new Promise<void>((resolve, reject) => {
            writeStream.on('finish', resolve);
            writeStream.on('error', reject);
            this.streamBackupZip('all', writeStream, true).catch(reject);
        });
    }
}
