import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface StoreAcquisitionInput {
    warehouseId: number;
    photoUrl?: string | null;
    notes?: string | null;
    // Pilih existing variant ATAU buat baru
    productVariantId?: number;
    // ATAU create variant baru:
    newVariant?: {
        productId?: number;          // kalau add variant ke product existing
        productName?: string;        // kalau create product baru
        categoryId?: number;
        unitId?: number;
        sku?: string;
        variantName?: string;
    };
}

@Injectable()
export class InventoryAcquisitionsService {
    constructor(private prisma: PrismaService) { }

    async list(filter: { rabPlanId?: number; status?: string } = {}) {
        return this.prisma.inventoryAcquisition.findMany({
            where: {
                ...(filter.rabPlanId ? { rabPlanId: filter.rabPlanId } : {}),
                ...(filter.status ? { status: filter.status } : {}),
            },
            orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
            include: {
                rabPlan: { select: { id: true, code: true, title: true } },
                productVariant: {
                    select: {
                        id: true, sku: true, variantName: true, stock: true,
                        product: { select: { id: true, name: true } },
                    },
                },
                warehouse: { select: { id: true, name: true } },
            },
        });
    }

    async findOne(id: number) {
        const acq = await this.prisma.inventoryAcquisition.findUnique({
            where: { id },
            include: {
                rabPlan: true,
                rabItem: true,
                productVariant: { include: { product: true } },
                warehouse: true,
            },
        });
        if (!acq) throw new NotFoundException(`Acquisition id=${id} tidak ditemukan`);
        return acq;
    }

    /**
     * Store ke stok:
     *   - Pilih ProductVariant existing → tambah qty stock + create StockMovement IN
     *   - ATAU create variant baru (+ product baru kalau perlu) lalu sama
     */
    async store(id: number, input: StoreAcquisitionInput) {
        const acq = await this.prisma.inventoryAcquisition.findUnique({
            where: { id },
            include: { rabPlan: true },
        });
        if (!acq) throw new NotFoundException(`Acquisition id=${id} tidak ditemukan`);
        if (acq.status === 'STORED') {
            throw new BadRequestException('Acquisition sudah pernah di-stok');
        }
        if (acq.status === 'CANCELLED') {
            throw new BadRequestException('Acquisition sudah cancelled, tidak bisa di-stok');
        }
        if (!input.warehouseId) {
            throw new BadRequestException('warehouseId wajib');
        }

        const qty = Number(acq.quantity);
        const unitCost = Number(acq.unitCost);

        return this.prisma.$transaction(async (tx) => {
            let variantId = input.productVariantId;

            // Create variant baru kalau perlu
            if (!variantId) {
                const nv = input.newVariant;
                if (!nv) {
                    throw new BadRequestException('productVariantId atau newVariant wajib');
                }

                let productId = nv.productId;

                // Create product baru kalau belum ada
                if (!productId) {
                    if (!nv.productName?.trim()) {
                        throw new BadRequestException('newVariant.productName wajib kalau create product baru');
                    }
                    if (!nv.categoryId || !nv.unitId) {
                        throw new BadRequestException('newVariant.categoryId & unitId wajib');
                    }
                    const product = await tx.product.create({
                        data: {
                            name: nv.productName.trim(),
                            categoryId: nv.categoryId,
                            unitId: nv.unitId,
                            productType: 'SELLABLE',
                            pricingMode: 'UNIT',
                            trackStock: true,
                        },
                    });
                    productId = product.id;
                }

                // Generate SKU otomatis kalau kosong
                const sku = nv.sku?.trim() || `INV-${acq.rabPlan.code}-${acq.id}`;
                const variant = await tx.productVariant.create({
                    data: {
                        productId,
                        sku,
                        variantName: nv.variantName?.trim() || acq.description.slice(0, 100),
                        price: new Prisma.Decimal(unitCost),    // default jual = cost (admin bisa edit nanti)
                        hpp: new Prisma.Decimal(unitCost),
                        stock: 0,                                 // start 0, akan di-add via movement
                    },
                });
                variantId = variant.id;
            }

            // Verifikasi variant exists
            const variant = await tx.productVariant.findUnique({ where: { id: variantId } });
            if (!variant) throw new NotFoundException(`Variant id=${variantId} tidak ditemukan`);

            // Verifikasi warehouse
            const wh = await tx.warehouse.findUnique({ where: { id: input.warehouseId } });
            if (!wh) throw new NotFoundException(`Warehouse id=${input.warehouseId} tidak ditemukan`);

            // Increment stock + create movement
            const newStock = variant.stock + Math.round(qty);
            await tx.productVariant.update({
                where: { id: variantId },
                data: { stock: newStock },
            });
            await tx.stockMovement.create({
                data: {
                    productVariantId: variantId,
                    type: 'IN',
                    quantity: new Prisma.Decimal(qty),
                    reason: `Pengadaan inventaris dari RAB ${acq.rabPlan.code}: ${acq.description}`,
                    balanceAfter: newStock,
                    referenceId: `RAB-ACQ-${acq.id}`,
                },
            });

            // Update acquisition status
            return tx.inventoryAcquisition.update({
                where: { id },
                data: {
                    status: 'STORED',
                    productVariantId: variantId,
                    warehouseId: input.warehouseId,
                    storedAt: new Date(),
                    photoUrl: input.photoUrl ?? null,
                    notes: input.notes ?? null,
                },
                include: {
                    productVariant: { include: { product: true } },
                    warehouse: true,
                },
            });
        });
    }

    async cancel(id: number, reason?: string) {
        const acq = await this.prisma.inventoryAcquisition.findUnique({ where: { id } });
        if (!acq) throw new NotFoundException();
        if (acq.status === 'STORED') {
            throw new BadRequestException('Tidak bisa cancel acquisition yang sudah STORED');
        }
        return this.prisma.inventoryAcquisition.update({
            where: { id },
            data: {
                status: 'CANCELLED',
                notes: reason ?? acq.notes,
            },
        });
    }

    async setPhoto(id: number, photoUrl: string | null) {
        await this.findOne(id);
        return this.prisma.inventoryAcquisition.update({
            where: { id },
            data: { photoUrl },
        });
    }
}
