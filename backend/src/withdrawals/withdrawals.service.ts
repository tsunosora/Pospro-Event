import {
    BadRequestException,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { DocumentNumberService } from '../document-numbers/document-number.service';

export type WithdrawalType = 'BORROW' | 'USE';

export interface CheckoutItemInput {
    productVariantId: number;
    quantity: number | string;
    notes?: string;
}

export interface CheckoutInput {
    workerId: number;
    warehouseId: number;
    eventId?: number | null;
    type: WithdrawalType;
    purpose: string;
    scheduledReturnAt?: string | Date | null;
    notes?: string;
    items: CheckoutItemInput[];
    checkoutPhotoUrl?: string;
}

export interface ReturnItemInput {
    withdrawalItemId: number;
    returnQuantity: number | string;
    notes?: string;
}

export interface ReturnInput {
    items: ReturnItemInput[];
    returnPhotoUrl?: string;
    notes?: string;
}

@Injectable()
export class WithdrawalsService {
    private readonly logger = new Logger(WithdrawalsService.name);

    constructor(
        private prisma: PrismaService,
        private docNumbers: DocumentNumberService,
    ) { }

    async findAll(filter: {
        status?: string;
        type?: string;
        workerId?: number;
        warehouseId?: number;
        eventId?: number;
        overdue?: boolean;
    } = {}) {
        const where: any = {};
        if (filter.status) where.status = filter.status;
        if (filter.type) where.type = filter.type;
        if (filter.workerId) where.workerId = filter.workerId;
        if (filter.warehouseId) where.warehouseId = filter.warehouseId;
        if (filter.eventId) where.eventId = filter.eventId;
        if (filter.overdue) {
            where.status = { in: ['CHECKED_OUT', 'PARTIAL_RETURNED', 'OVERDUE'] };
            where.scheduledReturnAt = { lt: new Date() };
            where.type = 'BORROW';
        }

        return this.prisma.withdrawal.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            include: {
                worker: { select: { id: true, name: true, position: true, photoUrl: true } },
                warehouse: { select: { id: true, name: true } },
                event: { select: { id: true, code: true, name: true, brand: true, eventStart: true } },
                items: {
                    include: {
                        productVariant: {
                            select: {
                                id: true, sku: true, variantName: true,
                                product: { select: { id: true, name: true, imageUrl: true } },
                            },
                        },
                    },
                },
                _count: { select: { items: true } },
            },
        });
    }

    async findOne(id: number) {
        const w = await this.prisma.withdrawal.findUnique({
            where: { id },
            include: {
                worker: true,
                warehouse: true,
                event: { select: { id: true, code: true, name: true, brand: true, venue: true, eventStart: true, eventEnd: true } },
                createdBy: { select: { id: true, name: true, email: true } },
                items: {
                    include: {
                        productVariant: {
                            include: {
                                product: { select: { id: true, name: true, imageUrl: true, unit: { select: { name: true } } } },
                            },
                        },
                    },
                },
            },
        });
        if (!w) throw new NotFoundException(`Pengambilan id=${id} tidak ditemukan`);
        return w;
    }

    async checkout(input: CheckoutInput, userId?: number) {
        if (!input.workerId) throw new BadRequestException('Pekerja wajib dipilih');
        if (!input.warehouseId) throw new BadRequestException('Gudang wajib dipilih');
        if (!input.purpose?.trim()) throw new BadRequestException('Keperluan wajib diisi');
        if (!['BORROW', 'USE'].includes(input.type)) throw new BadRequestException('Tipe harus BORROW atau USE');
        if (!input.items?.length) throw new BadRequestException('Minimal 1 barang harus diambil');

        if (input.type === 'BORROW' && !input.scheduledReturnAt) {
            throw new BadRequestException('Tanggal rencana kembali wajib diisi untuk peminjaman');
        }

        const worker = await this.prisma.worker.findUnique({ where: { id: input.workerId } });
        if (!worker) throw new BadRequestException('Pekerja tidak ditemukan');
        if (!worker.isActive) throw new BadRequestException('Pekerja tidak aktif');

        const warehouse = await this.prisma.warehouse.findUnique({ where: { id: input.warehouseId } });
        if (!warehouse) throw new BadRequestException('Gudang tidak ditemukan');
        if (!warehouse.isActive) throw new BadRequestException('Gudang tidak aktif');

        let safeEventId: number | null = null;
        if (input.eventId) {
            const ev = await this.prisma.event.findUnique({
                where: { id: input.eventId },
                select: { id: true, status: true },
            });
            if (!ev) throw new BadRequestException('Event tidak ditemukan');
            if (ev.status === 'CANCELLED') {
                throw new BadRequestException('Event sudah dibatalkan, tidak bisa dipilih');
            }
            safeEventId = ev.id;
        }

        // Validate stock from ProductVariant.stock (sumber tunggal via /inventory)
        const normItems: Array<{ productVariantId: number; quantity: number; notes: string | null }> = [];
        for (const it of input.items) {
            const qty = Number(it.quantity);
            if (!Number.isFinite(qty) || qty <= 0) {
                throw new BadRequestException(`Quantity untuk varian id=${it.productVariantId} harus > 0`);
            }
            const variant = await this.prisma.productVariant.findUnique({
                where: { id: it.productVariantId },
                include: { product: { select: { name: true } } },
            });
            if (!variant) {
                throw new BadRequestException(`Varian id=${it.productVariantId} tidak ditemukan`);
            }
            if (variant.stock < qty) {
                throw new BadRequestException(
                    `Stok tidak cukup untuk ${variant.product?.name ?? 'barang'} (${variant.sku}): tersedia ${variant.stock}, diminta ${qty}`,
                );
            }
            normItems.push({
                productVariantId: it.productVariantId,
                quantity: qty,
                notes: it.notes?.trim() || null,
            });
        }

        const now = new Date();
        const year = now.getFullYear();
        const seq = await this.docNumbers.nextSequence('WD', 'WD', year);
        const code = `WD-${year}-${String(seq).padStart(4, '0')}`;

        const scheduled = input.scheduledReturnAt ? new Date(input.scheduledReturnAt) : null;

        // Verifikasi user exist. Kalau token stale / user sudah dihapus, simpan null.
        let safeCreatedById: number | null = null;
        if (userId) {
            const exists = await this.prisma.user.findUnique({
                where: { id: userId },
                select: { id: true },
            });
            if (exists) safeCreatedById = exists.id;
            else this.logger.warn(`createdById=${userId} tidak ditemukan di users, disimpan null`);
        }

        const withdrawal = await this.prisma.$transaction(async (tx) => {
            const w = await tx.withdrawal.create({
                data: {
                    code,
                    workerId: input.workerId,
                    warehouseId: input.warehouseId,
                    eventId: safeEventId,
                    type: input.type,
                    status: 'CHECKED_OUT',
                    purpose: input.purpose.trim(),
                    scheduledReturnAt: scheduled,
                    checkoutPhotoUrl: input.checkoutPhotoUrl || null,
                    notes: input.notes?.trim() || null,
                    createdById: safeCreatedById,
                    items: {
                        create: normItems.map((it) => ({
                            productVariantId: it.productVariantId,
                            quantity: it.quantity,
                            notes: it.notes,
                        })),
                    },
                },
                include: { items: true },
            });

            // Decrement stok varian + catat StockMovement OUT
            for (const it of normItems) {
                const updated = await tx.productVariant.update({
                    where: { id: it.productVariantId },
                    data: { stock: { decrement: Math.round(it.quantity) } },
                });
                await tx.stockMovement.create({
                    data: {
                        productVariantId: it.productVariantId,
                        type: 'OUT',
                        quantity: it.quantity,
                        reason: `${input.type === 'BORROW' ? 'Pinjam' : 'Pakai'}: ${input.purpose.trim()} (${worker.name})`,
                        balanceAfter: updated.stock,
                        referenceId: code,
                    },
                });
            }

            return w;
        });

        return this.findOne(withdrawal.id);
    }

    async returnItems(id: number, input: ReturnInput) {
        const w = await this.findOne(id);

        if (w.status === 'RETURNED' || w.status === 'CANCELLED') {
            throw new BadRequestException(`Pengambilan sudah ${w.status}`);
        }
        if (w.type !== 'BORROW') {
            throw new BadRequestException('Hanya peminjaman (BORROW) yang bisa dikembalikan');
        }
        if (!input.items?.length) {
            throw new BadRequestException('Minimal 1 item harus dikembalikan');
        }

        const itemMap = new Map(w.items.map((i) => [i.id, i]));
        const normalizedReturns: Array<{
            itemId: number;
            productVariantId: number;
            returnQty: number;
            newReturnedQty: number;
            notes: string | null;
        }> = [];

        for (const r of input.items) {
            const item = itemMap.get(r.withdrawalItemId);
            if (!item) {
                throw new BadRequestException(`Item id=${r.withdrawalItemId} bukan bagian pengambilan ini`);
            }
            const returnQty = Number(r.returnQuantity);
            if (!Number.isFinite(returnQty) || returnQty <= 0) continue;
            const alreadyReturned = Number(item.returnedQty);
            const maxReturn = Number(item.quantity) - alreadyReturned;
            if (returnQty > maxReturn + 0.0001) {
                throw new BadRequestException(
                    `Kembali ${returnQty} melebihi sisa ${maxReturn} untuk item id=${item.id}`,
                );
            }
            normalizedReturns.push({
                itemId: item.id,
                productVariantId: item.productVariantId,
                returnQty,
                newReturnedQty: alreadyReturned + returnQty,
                notes: r.notes?.trim() || item.notes || null,
            });
        }

        if (!normalizedReturns.length) {
            throw new BadRequestException('Quantity kembali harus > 0');
        }

        await this.prisma.$transaction(async (tx) => {
            for (const r of normalizedReturns) {
                await tx.withdrawalItem.update({
                    where: { id: r.itemId },
                    data: {
                        returnedQty: r.newReturnedQty,
                        ...(r.notes !== null && { notes: r.notes }),
                    },
                });
                const updated = await tx.productVariant.update({
                    where: { id: r.productVariantId },
                    data: { stock: { increment: Math.round(r.returnQty) } },
                });
                await tx.stockMovement.create({
                    data: {
                        productVariantId: r.productVariantId,
                        type: 'IN',
                        quantity: r.returnQty,
                        reason: `Kembali pinjam: ${w.code} (${w.worker?.name ?? ''})`,
                        balanceAfter: updated.stock,
                        referenceId: w.code,
                    },
                });
            }
        });

        const fresh = await this.prisma.withdrawal.findUnique({
            where: { id },
            include: { items: true },
        });
        if (!fresh) throw new NotFoundException();

        const totalQty = fresh.items.reduce((s, it) => s + Number(it.quantity), 0);
        const returnedQty = fresh.items.reduce((s, it) => s + Number(it.returnedQty), 0);
        let newStatus: 'RETURNED' | 'PARTIAL_RETURNED' = 'PARTIAL_RETURNED';
        let actualReturnAt: Date | null = fresh.actualReturnAt;
        if (returnedQty >= totalQty - 0.0001) {
            newStatus = 'RETURNED';
            actualReturnAt = new Date();
        }

        await this.prisma.withdrawal.update({
            where: { id },
            data: {
                status: newStatus,
                actualReturnAt,
                returnPhotoUrl: input.returnPhotoUrl || fresh.returnPhotoUrl,
                notes: input.notes?.trim()
                    ? (fresh.notes ? `${fresh.notes}\n[return] ${input.notes.trim()}` : `[return] ${input.notes.trim()}`)
                    : fresh.notes,
            },
        });

        return this.findOne(id);
    }

    async cancel(id: number) {
        const w = await this.findOne(id);
        if (w.status === 'CANCELLED') throw new BadRequestException('Sudah dibatalkan');
        if (w.status === 'RETURNED') throw new BadRequestException('Sudah selesai, tidak bisa dibatalkan');

        const restoreEntries: Array<{ productVariantId: number; qty: number }> = [];
        for (const it of w.items) {
            const remaining = Number(it.quantity) - Number(it.returnedQty);
            if (remaining > 0) restoreEntries.push({ productVariantId: it.productVariantId, qty: remaining });
        }

        await this.prisma.$transaction(async (tx) => {
            for (const r of restoreEntries) {
                const updated = await tx.productVariant.update({
                    where: { id: r.productVariantId },
                    data: { stock: { increment: Math.round(r.qty) } },
                });
                await tx.stockMovement.create({
                    data: {
                        productVariantId: r.productVariantId,
                        type: 'IN',
                        quantity: r.qty,
                        reason: `Batal pengambilan: ${w.code}`,
                        balanceAfter: updated.stock,
                        referenceId: w.code,
                    },
                });
            }
            await tx.withdrawal.update({
                where: { id },
                data: { status: 'CANCELLED', actualReturnAt: new Date() },
            });
        });

        return this.findOne(id);
    }

    async getOverdueCount(): Promise<number> {
        return this.prisma.withdrawal.count({
            where: {
                type: 'BORROW',
                status: { in: ['CHECKED_OUT', 'PARTIAL_RETURNED', 'OVERDUE'] },
                scheduledReturnAt: { lt: new Date() },
            },
        });
    }

    @Cron(CronExpression.EVERY_DAY_AT_1AM)
    async markOverdueCron() {
        try {
            const result = await this.prisma.withdrawal.updateMany({
                where: {
                    type: 'BORROW',
                    status: { in: ['CHECKED_OUT', 'PARTIAL_RETURNED'] },
                    scheduledReturnAt: { lt: new Date() },
                },
                data: { status: 'OVERDUE' },
            });
            if (result.count > 0) {
                this.logger.log(`Marked ${result.count} withdrawal(s) as OVERDUE`);
            }
        } catch (e) {
            this.logger.error('markOverdueCron failed', e);
        }
    }
}
