import {
    BadRequestException,
    Body,
    Controller,
    Get,
    Param,
    ParseIntPipe,
    Post,
    Query,
    UploadedFile,
    UploadedFiles,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { AnyFilesInterceptor, FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { PrismaService } from '../prisma/prisma.service';
import { WithdrawalsService } from '../withdrawals/withdrawals.service';
import type { CheckoutInput, ReturnInput } from '../withdrawals/withdrawals.service';
import { WarehousePinGuard } from '../warehouse-pin/warehouse-pin.guard';

const photoStorage = diskStorage({
    destination: './public/uploads',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname) || '.jpg';
        cb(null, `withdrawal-${uniqueSuffix}${ext}`);
    },
});

const workerPhotoStorage = diskStorage({
    destination: './public/uploads',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname) || '.jpg';
        cb(null, `worker-${uniqueSuffix}${ext}`);
    },
});

const stockPhotoStorage = diskStorage({
    destination: './public/uploads',
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname) || '.jpg';
        cb(null, `stockphoto-${uniqueSuffix}${ext}`);
    },
});

const photoFilter = (req: any, file: any, cb: any) => {
    if (!file.originalname.toLowerCase().match(/\.(jpg|jpeg|jfif|png|gif|webp)$/)) {
        return cb(new BadRequestException('Hanya file gambar yang diijinkan'), false);
    }
    cb(null, true);
};

@Controller('public/gudang')
@UseGuards(WarehousePinGuard)
export class PublicGudangController {
    constructor(
        private prisma: PrismaService,
        private withdrawals: WithdrawalsService,
    ) { }

    @Get('bootstrap')
    async bootstrap() {
        const [workers, warehouses, products, events, categories, units] = await Promise.all([
            this.prisma.worker.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
                select: { id: true, name: true, fullName: true, phone: true, position: true, photoUrl: true },
            }),
            this.prisma.warehouse.findMany({
                where: { isActive: true },
                orderBy: { name: 'asc' },
                select: { id: true, name: true, address: true },
            }),
            this.prisma.product.findMany({
                orderBy: { name: 'asc' },
                select: {
                    id: true,
                    name: true,
                    imageUrl: true,
                    unit: { select: { name: true } },
                    category: { select: { id: true, name: true } },
                    variants: {
                        select: {
                            id: true,
                            sku: true,
                            variantName: true,
                            stock: true,
                            variantImageUrl: true,
                            defaultWarehouseId: true,
                            defaultWarehouse: { select: { id: true, name: true } },
                        },
                    },
                },
            }),
            this.prisma.event.findMany({
                where: { status: { in: ['SCHEDULED', 'IN_PROGRESS'] } },
                orderBy: [{ eventStart: 'asc' }, { createdAt: 'desc' }],
                select: {
                    id: true, code: true, name: true, brand: true, venue: true,
                    eventStart: true, eventEnd: true, status: true,
                },
            }),
            this.prisma.category.findMany({
                orderBy: { name: 'asc' },
                select: { id: true, name: true },
            }),
            this.prisma.unit.findMany({
                orderBy: { name: 'asc' },
                select: { id: true, name: true },
            }),
        ]);
        return { workers, warehouses, products, events, categories, units };
    }

    @Get('active-borrows')
    activeBorrows(@Query('workerId') workerIdStr?: string) {
        const workerId = workerIdStr ? Number(workerIdStr) : undefined;
        return this.prisma.withdrawal.findMany({
            where: {
                type: 'BORROW',
                status: { in: ['CHECKED_OUT', 'PARTIAL_RETURNED', 'OVERDUE'] },
                ...(workerId ? { workerId } : {}),
            },
            orderBy: { createdAt: 'desc' },
            include: {
                worker: { select: { id: true, name: true, photoUrl: true, position: true } },
                warehouse: { select: { id: true, name: true } },
                items: {
                    include: {
                        productVariant: {
                            select: {
                                id: true, sku: true, variantName: true, variantImageUrl: true,
                                product: { select: { id: true, name: true, imageUrl: true } },
                            },
                        },
                    },
                },
            },
        });
    }

    @Post('return/:id')
    @UseInterceptors(FileInterceptor('photo', {
        storage: photoStorage,
        fileFilter: photoFilter,
        limits: { fileSize: 8 * 1024 * 1024 },
    }))
    async returnItems(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: any,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        let items: any[] = [];
        if (typeof body.items === 'string') {
            try { items = JSON.parse(body.items); }
            catch { throw new BadRequestException('items tidak valid (harus JSON array)'); }
        } else if (Array.isArray(body.items)) {
            items = body.items;
        }

        const input: ReturnInput = {
            items,
            notes: body.notes,
            returnPhotoUrl: file ? `/uploads/${file.filename}` : undefined,
        };
        return this.withdrawals.returnItems(id, input);
    }

    @Post('register-worker')
    @UseInterceptors(FileInterceptor('photo', {
        storage: workerPhotoStorage,
        fileFilter: photoFilter,
        limits: { fileSize: 8 * 1024 * 1024 },
    }))
    async registerWorker(
        @Body() body: any,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        const name = String(body.name ?? '').trim();
        if (!name) throw new BadRequestException('Nama panggilan wajib diisi');
        if (name.length > 100) throw new BadRequestException('Nama panggilan maksimal 100 karakter');

        const fullName = body.fullName ? String(body.fullName).trim().slice(0, 150) : null;
        const position = body.position ? String(body.position).trim().slice(0, 100) : null;
        const phone = body.phone ? String(body.phone).trim().slice(0, 50) : null;

        // Cek duplikasi nama panggilan (case-insensitive) supaya tidak bikin worker ganda
        const existing = await this.prisma.worker.findFirst({
            where: { name: { equals: name } },
        });
        if (existing) {
            throw new BadRequestException(
                `Nama panggilan "${name}" sudah terdaftar. Silakan pilih nama Anda dari daftar yang sudah ada, atau pakai panggilan unik lain.`,
            );
        }

        const worker = await this.prisma.worker.create({
            data: {
                name,
                fullName,
                position,
                phone,
                photoUrl: file ? `/uploads/${file.filename}` : null,
                isActive: true,
            },
            select: { id: true, name: true, fullName: true, position: true, photoUrl: true, phone: true },
        });
        return worker;
    }

    @Post('checkout')
    @UseInterceptors(FileInterceptor('photo', {
        storage: photoStorage,
        fileFilter: photoFilter,
        limits: { fileSize: 8 * 1024 * 1024 },
    }))
    async checkout(
        @Body() body: any,
        @UploadedFile() file: Express.Multer.File | undefined,
    ) {
        let items: any[] = [];
        if (typeof body.items === 'string') {
            try {
                items = JSON.parse(body.items);
            } catch {
                throw new BadRequestException('items tidak valid (harus JSON array)');
            }
        } else if (Array.isArray(body.items)) {
            items = body.items;
        }

        const input: CheckoutInput = {
            workerId: Number(body.workerId),
            warehouseId: Number(body.warehouseId),
            eventId: body.eventId ? Number(body.eventId) : null,
            type: body.type,
            purpose: body.purpose,
            scheduledReturnAt: body.scheduledReturnAt || null,
            notes: body.notes,
            items,
            checkoutPhotoUrl: file ? `/uploads/${file.filename}` : undefined,
        };

        return this.withdrawals.checkout(input);
    }

    // ─── STOK LAPANGAN: Tambah / Edit / Barang Baru ─────────────────────────

    /**
     * Tambah stok (restok dari lapangan).
     * Increment stock variant + log StockMovement type=IN.
     * Pakai ParseFloat untuk handle decimal qty (mis. 0.5 m).
     */
    @Post('restock')
    @UseInterceptors(FileInterceptor('photo', {
        storage: stockPhotoStorage,
        fileFilter: photoFilter,
        limits: { fileSize: 8 * 1024 * 1024 },
    }))
    async restock(
        @Body() body: any,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        const workerId = Number(body.workerId);
        const productVariantId = Number(body.productVariantId);
        const warehouseId = body.warehouseId ? Number(body.warehouseId) : null;
        const quantity = Number(body.quantity);
        const reason = body.reason ? String(body.reason).trim().slice(0, 200) : '';

        if (!Number.isFinite(workerId) || workerId <= 0) {
            throw new BadRequestException('workerId wajib');
        }
        if (!Number.isFinite(productVariantId) || productVariantId <= 0) {
            throw new BadRequestException('productVariantId wajib');
        }
        if (!Number.isFinite(quantity) || quantity <= 0) {
            throw new BadRequestException('Quantity harus lebih dari 0');
        }

        const photoUrl = file ? `/uploads/${file.filename}` : null;
        const refId = `RESTOCK-${Date.now()}`;

        return this.prisma.$transaction(async (tx) => {
            const worker = await tx.worker.findUnique({
                where: { id: workerId },
                select: { id: true, name: true, isActive: true },
            });
            if (!worker || !worker.isActive) {
                throw new BadRequestException('Worker tidak ditemukan / nonaktif');
            }

            const variant = await tx.productVariant.findUnique({
                where: { id: productVariantId },
                select: { id: true, stock: true, sku: true, variantName: true, defaultWarehouseId: true, product: { select: { name: true } } },
            });
            if (!variant) throw new BadRequestException('Item tidak ditemukan');

            // Kalau variant belum punya defaultWarehouse & user kasih warehouseId → set sekalian
            const updateData: { stock: { increment: number }; defaultWarehouseId?: number } = {
                stock: { increment: Math.round(quantity) },
            };
            if (warehouseId && !variant.defaultWarehouseId) {
                updateData.defaultWarehouseId = warehouseId;
            }
            const updated = await tx.productVariant.update({
                where: { id: productVariantId },
                data: updateData,
            });

            const reasonText = `Restok lapangan oleh ${worker.name}${reason ? `: ${reason}` : ''}${photoUrl ? ' [foto]' : ''}${warehouseId ? ` [WH#${warehouseId}]` : ''}`;
            const movement = await tx.stockMovement.create({
                data: {
                    productVariantId,
                    type: 'IN',
                    quantity,
                    reason: reasonText.slice(0, 255),
                    balanceAfter: updated.stock,
                    referenceId: refId,
                },
            });

            return {
                ok: true,
                variant: {
                    id: updated.id,
                    sku: variant.sku,
                    variantName: variant.variantName,
                    productName: variant.product.name,
                    stockBefore: variant.stock,
                    stockAfter: updated.stock,
                },
                movement: {
                    id: movement.id,
                    referenceId: refId,
                    photoUrl,
                },
            };
        });
    }

    /**
     * Adjust stok ke jumlah absolut (setelah cek fisik).
     * Set stock variant ke nilai baru + log StockMovement type=ADJUST dengan diff di reason.
     */
    @Post('adjust-stock')
    @UseInterceptors(FileInterceptor('photo', {
        storage: stockPhotoStorage,
        fileFilter: photoFilter,
        limits: { fileSize: 8 * 1024 * 1024 },
    }))
    async adjustStock(
        @Body() body: any,
        @UploadedFile() file?: Express.Multer.File,
    ) {
        const workerId = Number(body.workerId);
        const productVariantId = Number(body.productVariantId);
        const warehouseId = body.warehouseId ? Number(body.warehouseId) : null;
        const newStock = Number(body.newStock);
        const reason = body.reason ? String(body.reason).trim().slice(0, 200) : '';

        if (!Number.isFinite(workerId) || workerId <= 0) {
            throw new BadRequestException('workerId wajib');
        }
        if (!Number.isFinite(productVariantId) || productVariantId <= 0) {
            throw new BadRequestException('productVariantId wajib');
        }
        if (!Number.isFinite(newStock) || newStock < 0) {
            throw new BadRequestException('newStock tidak valid (harus >= 0)');
        }
        if (!reason) {
            throw new BadRequestException('Reason wajib untuk adjust stok (audit trail)');
        }

        const photoUrl = file ? `/uploads/${file.filename}` : null;
        const refId = `ADJUST-${Date.now()}`;
        const newStockInt = Math.round(newStock);

        return this.prisma.$transaction(async (tx) => {
            const worker = await tx.worker.findUnique({
                where: { id: workerId },
                select: { id: true, name: true, isActive: true },
            });
            if (!worker || !worker.isActive) {
                throw new BadRequestException('Worker tidak ditemukan / nonaktif');
            }

            const variant = await tx.productVariant.findUnique({
                where: { id: productVariantId },
                select: { id: true, stock: true, sku: true, variantName: true, defaultWarehouseId: true, product: { select: { name: true } } },
            });
            if (!variant) throw new BadRequestException('Item tidak ditemukan');

            const stockBefore = variant.stock;
            const diff = newStockInt - stockBefore;
            if (diff === 0) {
                throw new BadRequestException(`Stok sudah sama (${stockBefore}). Tidak ada yang perlu di-adjust.`);
            }

            const updateData: { stock: number; defaultWarehouseId?: number } = { stock: newStockInt };
            if (warehouseId && !variant.defaultWarehouseId) {
                updateData.defaultWarehouseId = warehouseId;
            }
            const updated = await tx.productVariant.update({
                where: { id: productVariantId },
                data: updateData,
            });

            const reasonText = `Adjust lapangan oleh ${worker.name}: ${stockBefore}→${newStockInt} (${diff > 0 ? '+' : ''}${diff}) — ${reason}${photoUrl ? ' [foto]' : ''}${warehouseId ? ` [WH#${warehouseId}]` : ''}`;
            const movement = await tx.stockMovement.create({
                data: {
                    productVariantId,
                    type: 'ADJUST',
                    quantity: Math.abs(diff),
                    reason: reasonText.slice(0, 255),
                    balanceAfter: updated.stock,
                    referenceId: refId,
                },
            });

            return {
                ok: true,
                variant: {
                    id: updated.id,
                    sku: variant.sku,
                    variantName: variant.variantName,
                    productName: variant.product.name,
                    stockBefore,
                    stockAfter: updated.stock,
                    diff,
                },
                movement: {
                    id: movement.id,
                    referenceId: refId,
                    photoUrl,
                },
            };
        });
    }

    /**
     * Tambah barang baru dari lapangan — support multi-varian dengan per-variant detail.
     * Multipart files (semua opsional):
     *   - photo               → foto utama produk (fallback semua varian)
     *   - variantPhoto_{idx}  → foto per varian (override foto utama)
     * Body fields:
     *   - variants: JSON array `[{variantName, sku?, initialStock, description?, notes?}, ...]`
     *   - atau field lama: `initialStock` (fallback single varian "Default")
     * Buat Product + multiple ProductVariant + StockMovement IN initial per varian.
     * SKU auto-generate per varian kalau tidak diisi: KIOSK-{timestamp}-{rand}.
     */
    @Post('new-item')
    @UseInterceptors(AnyFilesInterceptor({
        storage: stockPhotoStorage,
        fileFilter: photoFilter,
        limits: { fileSize: 8 * 1024 * 1024, files: 12 }, // max 12 files (1 product + 11 varian)
    }))
    async newItem(
        @Body() body: any,
        @UploadedFiles() files?: Express.Multer.File[],
    ) {
        // Pisah foto utama vs per-variant photos
        const fileMap = new Map<string, Express.Multer.File>();
        for (const f of files ?? []) {
            fileMap.set(f.fieldname, f);
        }
        const file = fileMap.get('photo'); // foto utama produk
        const workerId = Number(body.workerId);
        const name = String(body.name ?? '').trim();
        const categoryId = Number(body.categoryId);
        const unitId = Number(body.unitId);
        const notes = body.notes ? String(body.notes).trim().slice(0, 200) : '';
        const warehouseId = body.warehouseId ? Number(body.warehouseId) : null;

        if (!Number.isFinite(workerId) || workerId <= 0) {
            throw new BadRequestException('workerId wajib');
        }
        if (!name) throw new BadRequestException('Nama barang wajib diisi');
        if (name.length > 200) throw new BadRequestException('Nama maksimal 200 karakter');
        if (!Number.isFinite(categoryId) || categoryId <= 0) {
            throw new BadRequestException('Kategori wajib dipilih');
        }
        if (!Number.isFinite(unitId) || unitId <= 0) {
            throw new BadRequestException('Satuan wajib dipilih');
        }

        // Parse variants array (kalau dikirim) atau fallback single varian
        type VariantInput = {
            variantName: string;
            sku: string;
            initialStock: number;
            description: string | null;
            notes: string | null;
        };
        let variantInputs: VariantInput[] = [];

        if (body.variants) {
            // Multi-variant mode
            let raw: any;
            try {
                raw = typeof body.variants === 'string' ? JSON.parse(body.variants) : body.variants;
            } catch {
                throw new BadRequestException('Field variants tidak valid (harus JSON array)');
            }
            if (!Array.isArray(raw) || raw.length === 0) {
                throw new BadRequestException('Minimal 1 varian wajib');
            }
            for (let i = 0; i < raw.length; i++) {
                const v = raw[i];
                const vName = String(v?.variantName ?? '').trim().slice(0, 100) || 'Default';
                const vSku = v?.sku ? String(v.sku).trim().slice(0, 100) : '';
                const vStockNum = Number(v?.initialStock ?? 0);
                if (!Number.isFinite(vStockNum) || vStockNum < 0) {
                    throw new BadRequestException(`Stok varian #${i + 1} tidak valid`);
                }
                const vDesc = v?.description ? String(v.description).trim().slice(0, 1000) : null;
                const vNotes = v?.notes ? String(v.notes).trim().slice(0, 1000) : null;
                variantInputs.push({
                    variantName: vName,
                    sku: vSku,
                    initialStock: Math.round(vStockNum),
                    description: vDesc || null,
                    notes: vNotes || null,
                });
            }
            // Cek varian name duplicate dalam 1 product
            const seenNames = new Set<string>();
            for (const v of variantInputs) {
                const k = v.variantName.toLowerCase();
                if (seenNames.has(k)) {
                    throw new BadRequestException(`Nama varian "${v.variantName}" duplikat. Pakai nama unik per varian.`);
                }
                seenNames.add(k);
            }
        } else {
            // Fallback single varian (backward compat dengan call lama)
            const initialStock = Number(body.initialStock ?? 0);
            const sku = body.sku ? String(body.sku).trim().slice(0, 100) : '';
            if (!Number.isFinite(initialStock) || initialStock < 0) {
                throw new BadRequestException('Stok awal tidak valid');
            }
            variantInputs = [{
                variantName: 'Default',
                sku,
                initialStock: Math.round(initialStock),
                description: null,
                notes: null,
            }];
        }

        const photoUrl = file ? `/uploads/${file.filename}` : null;
        const baseRef = `KIOSK-NEW-${Date.now()}`;

        return this.prisma.$transaction(async (tx) => {
            const worker = await tx.worker.findUnique({
                where: { id: workerId },
                select: { id: true, name: true, isActive: true },
            });
            if (!worker || !worker.isActive) {
                throw new BadRequestException('Worker tidak ditemukan / nonaktif');
            }

            // Cek kategori & unit valid
            const [cat, unit] = await Promise.all([
                tx.category.findUnique({ where: { id: categoryId } }),
                tx.unit.findUnique({ where: { id: unitId } }),
            ]);
            if (!cat) throw new BadRequestException('Kategori tidak ditemukan');
            if (!unit) throw new BadRequestException('Satuan tidak ditemukan');

            // Cek SKU duplicate (kalau user input manual SKU)
            for (const v of variantInputs) {
                if (v.sku) {
                    const existing = await tx.productVariant.findUnique({ where: { sku: v.sku } });
                    if (existing) {
                        throw new BadRequestException(`SKU "${v.sku}" sudah dipakai. Pilih SKU lain atau biarkan kosong (auto-generate).`);
                    }
                }
            }

            const product = await tx.product.create({
                data: {
                    name,
                    description: `Ditambah dari gudang lapangan oleh ${worker.name}${notes ? ` — ${notes}` : ''}`,
                    categoryId,
                    unitId,
                    imageUrl: photoUrl,
                },
            });

            // Buat varian satu per satu (sequential biar SKU auto-generate aman dari collision)
            const createdVariants: Array<{
                id: number; sku: string; variantName: string | null; stock: number;
                description: string | null; notes: string | null;
                variantImageUrl: string | null; movementId: number | null;
            }> = [];
            for (let i = 0; i < variantInputs.length; i++) {
                const v = variantInputs[i];
                const finalSku = v.sku || `KIOSK-${Date.now()}-${i}-${Math.round(Math.random() * 999)}`;

                // Per-variant photo (fallback ke product photo)
                const perVariantFile = fileMap.get(`variantPhoto_${i}`);
                const variantPhotoUrl = perVariantFile
                    ? `/uploads/${perVariantFile.filename}`
                    : photoUrl;

                const variant = await tx.productVariant.create({
                    data: {
                        productId: product.id,
                        sku: finalSku,
                        variantName: v.variantName,
                        price: 0,
                        hpp: 0,
                        stock: v.initialStock,
                        variantImageUrl: variantPhotoUrl,
                        description: v.description,
                        notes: v.notes,
                        defaultWarehouseId: warehouseId, // 🆕 lokasi gudang utama varian
                    },
                });

                let movementId: number | null = null;
                if (v.initialStock > 0) {
                    const reasonText = `Item baru "${name}" varian "${v.variantName}" oleh ${worker.name}${notes ? `: ${notes}` : ''}${warehouseId ? ` [WH#${warehouseId}]` : ''}`;
                    const movement = await tx.stockMovement.create({
                        data: {
                            productVariantId: variant.id,
                            type: 'IN',
                            quantity: v.initialStock,
                            reason: reasonText.slice(0, 255),
                            balanceAfter: v.initialStock,
                            referenceId: `${baseRef}-${i}`,
                        },
                    });
                    movementId = movement.id;
                }

                createdVariants.push({
                    id: variant.id,
                    sku: variant.sku,
                    variantName: variant.variantName,
                    stock: variant.stock,
                    description: variant.description,
                    notes: variant.notes,
                    variantImageUrl: variant.variantImageUrl,
                    movementId,
                });
            }

            return {
                ok: true,
                product: { id: product.id, name: product.name },
                variants: createdVariants,
                photoUrl,
            };
        });
    }
}
