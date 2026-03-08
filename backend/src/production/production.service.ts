import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProductionService {
    constructor(private prisma: PrismaService) {}

    private jobInclude() {
        return {
            transaction: {
                select: {
                    id: true,
                    invoiceNumber: true,
                    customerName: true,
                    customerPhone: true,
                    productionPriority: true,
                    productionDeadline: true,
                    productionNotes: true,
                    createdAt: true,
                },
            },
            transactionItem: {
                include: {
                    productVariant: { include: { product: true } },
                },
            },
            rollVariant: { include: { product: true } },
            batch: true,
        };
    }

    async getJobs(status?: string, priority?: string) {
        const where: any = {};
        if (status) where.status = status;
        if (priority) where.priority = priority;

        const jobs = await (this.prisma as any).productionJob.findMany({
            where,
            include: this.jobInclude(),
            orderBy: [
                { priority: 'asc' }, // EXPRESS < NORMAL alphabetically, so asc puts EXPRESS first
                { deadline: 'asc' },
                { createdAt: 'asc' },
            ],
        });

        // Put nulls at end for deadline ordering
        return jobs.sort((a: any, b: any) => {
            // Priority: EXPRESS before NORMAL
            if (a.priority !== b.priority) {
                return a.priority === 'EXPRESS' ? -1 : 1;
            }
            // Deadline: earliest first, nulls last
            if (!a.deadline && !b.deadline) return 0;
            if (!a.deadline) return 1;
            if (!b.deadline) return -1;
            return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        });
    }

    async getRolls() {
        return (this.prisma as any).productVariant.findMany({
            include: { product: true },
            orderBy: [{ product: { name: 'asc' } }],
        });
    }

    async startJob(id: number, data: {
        rollVariantId?: number;
        usedWaste: boolean;
        rollAreaM2?: number;   // luas bahan yang dipakai dalam m²
        operatorNote?: string;
    }) {
        return this.prisma.$transaction(async (tx) => {
            const job = await (tx as any).productionJob.findUnique({ where: { id } });
            if (!job) throw new NotFoundException('Job tidak ditemukan');
            if (job.status !== 'ANTRIAN') throw new BadRequestException('Job tidak dalam status ANTRIAN');

            if (!data.usedWaste && data.rollVariantId && data.rollAreaM2) {
                const roll = await (tx as any).productVariant.findUnique({ where: { id: data.rollVariantId } });
                if (!roll) throw new NotFoundException('Bahan tidak ditemukan');

                const currentStock = Number(roll.stock); // stock in m²
                const areaToDeduct = Math.ceil(data.rollAreaM2);
                const newStock = currentStock - areaToDeduct;
                if (newStock < 0) {
                    throw new BadRequestException(
                        `Stok bahan tidak cukup. Tersisa: ${currentStock}m², dibutuhkan: ${areaToDeduct}m²`
                    );
                }

                await (tx as any).productVariant.update({
                    where: { id: data.rollVariantId },
                    data: { stock: newStock },
                });

                await tx.stockMovement.create({
                    data: {
                        productVariantId: data.rollVariantId,
                        type: 'OUT',
                        quantity: areaToDeduct,
                        reason: `Produksi Job #${job.jobNumber} (${data.rollAreaM2.toFixed(2)}m²)`,
                    },
                });
            }

            return (tx as any).productionJob.update({
                where: { id },
                data: {
                    status: 'PROSES',
                    rollVariantId: data.rollVariantId || null,
                    usedWaste: data.usedWaste,
                    rollLengthUsed: data.rollAreaM2 || null, // field reused to store area m²
                    operatorNote: data.operatorNote || null,
                    startedAt: new Date(),
                },
                include: this.jobInclude(),
            });
        });
    }

    async completeJob(id: number, operatorNote?: string) {
        const job = await (this.prisma as any).productionJob.findUnique({ where: { id } });
        if (!job) throw new NotFoundException('Job tidak ditemukan');
        if (job.status !== 'PROSES') throw new BadRequestException('Job belum dalam status PROSES');

        return (this.prisma as any).productionJob.update({
            where: { id },
            data: {
                status: 'SELESAI',
                completedAt: new Date(),
                ...(operatorNote ? { operatorNote } : {}),
            },
            include: this.jobInclude(),
        });
    }

    async pickupJob(id: number) {
        const job = await (this.prisma as any).productionJob.findUnique({ where: { id } });
        if (!job) throw new NotFoundException('Job tidak ditemukan');
        if (job.status !== 'SELESAI') throw new BadRequestException('Job belum SELESAI');

        return (this.prisma as any).productionJob.update({
            where: { id },
            data: { status: 'DIAMBIL', pickedUpAt: new Date() },
            include: this.jobInclude(),
        });
    }

    async createBatch(data: {
        jobIds: number[];
        rollVariantId?: number;
        usedWaste: boolean;
        totalAreaM2?: number;  // total luas gabungan dalam m²
    }) {
        return this.prisma.$transaction(async (tx) => {
            const jobs = await (tx as any).productionJob.findMany({
                where: { id: { in: data.jobIds }, status: 'ANTRIAN' },
            });

            if (jobs.length !== data.jobIds.length) {
                throw new BadRequestException('Beberapa job tidak dalam status ANTRIAN atau tidak ditemukan');
            }

            const count = await (tx as any).productionBatch.count();
            const batchNumber = `BATCH-${String(count + 1).padStart(4, '0')}`;

            if (!data.usedWaste && data.rollVariantId && data.totalAreaM2) {
                const roll = await (tx as any).productVariant.findUnique({ where: { id: data.rollVariantId } });
                if (!roll) throw new NotFoundException('Bahan tidak ditemukan');

                const currentStock = Number(roll.stock); // stock in m²
                const areaToDeduct = Math.ceil(data.totalAreaM2);
                const newStock = currentStock - areaToDeduct;
                if (newStock < 0) {
                    throw new BadRequestException(
                        `Stok bahan tidak cukup. Tersisa: ${currentStock}m², dibutuhkan: ${areaToDeduct}m²`
                    );
                }

                await (tx as any).productVariant.update({
                    where: { id: data.rollVariantId },
                    data: { stock: newStock },
                });

                await tx.stockMovement.create({
                    data: {
                        productVariantId: data.rollVariantId,
                        type: 'OUT',
                        quantity: areaToDeduct,
                        reason: `Gabung Cetak ${batchNumber} (${data.totalAreaM2.toFixed(2)}m²)`,
                    },
                });
            }

            const batch = await (tx as any).productionBatch.create({
                data: {
                    batchNumber,
                    rollVariantId: data.rollVariantId || null,
                    usedWaste: data.usedWaste,
                    rollLengthUsed: data.totalAreaM2 || null,
                    status: 'PROSES',
                    startedAt: new Date(),
                },
            });

            await (tx as any).productionJob.updateMany({
                where: { id: { in: data.jobIds } },
                data: { status: 'PROSES', batchId: batch.id, startedAt: new Date() },
            });

            // Store total area in batch rollLengthUsed field
            await (tx as any).productionBatch.update({
                where: { id: batch.id },
                data: { rollLengthUsed: data.totalAreaM2 || null },
            });

            return batch;
        });
    }

    async completeBatch(id: number) {
        return this.prisma.$transaction(async (tx) => {
            const batch = await (tx as any).productionBatch.findUnique({ where: { id } });
            if (!batch) throw new NotFoundException('Batch tidak ditemukan');
            if (batch.status !== 'PROSES') throw new BadRequestException('Batch tidak dalam status PROSES');

            await (tx as any).productionJob.updateMany({
                where: { batchId: id, status: 'PROSES' },
                data: { status: 'SELESAI', completedAt: new Date() },
            });

            return (tx as any).productionBatch.update({
                where: { id },
                data: { status: 'SELESAI', completedAt: new Date() },
            });
        });
    }

    async verifyPin(pin: string) {
        const settings = await this.prisma.storeSettings.findFirst();
        const pin_ = (settings as any)?.operatorPin;
        if (!pin_) {
            return { valid: false, message: 'PIN operator belum dikonfigurasi. Hubungi admin.' };
        }
        return { valid: pin_ === pin };
    }

    async getStats() {
        const [antrian, proses, selesai] = await Promise.all([
            (this.prisma as any).productionJob.count({ where: { status: 'ANTRIAN' } }),
            (this.prisma as any).productionJob.count({ where: { status: 'PROSES' } }),
            (this.prisma as any).productionJob.count({ where: { status: 'SELESAI' } }),
        ]);
        return { antrian, proses, selesai };
    }
}
