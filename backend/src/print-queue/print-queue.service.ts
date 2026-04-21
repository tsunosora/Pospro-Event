import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type PrintJobStatus = 'ANTRIAN' | 'PROSES' | 'SELESAI' | 'DIAMBIL';

@Injectable()
export class PrintQueueService {
    constructor(private prisma: PrismaService) {}

    private jobInclude() {
        return {
            transaction: {
                select: {
                    id: true,
                    invoiceNumber: true,
                    checkoutNumber: true,
                    customerName: true,
                    customerPhone: true,
                    status: true,
                    createdAt: true,
                },
            },
            transactionItem: {
                select: {
                    id: true,
                    quantity: true,
                    note: true,
                    clickType: true,
                    widthCm: true,
                    heightCm: true,
                    pcs: true,
                    productVariant: {
                        select: {
                            id: true,
                            variantName: true,
                            sku: true,
                            product: { select: { id: true, name: true } },
                        },
                    },
                },
            },
        };
    }

    async generateJobNumber(): Promise<string> {
        const today = new Date();
        const yyyymmdd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getDate()).padStart(2, '0')}`;
        const prefix = `PRT-${yyyymmdd}-`;
        const last = await (this.prisma as any).printJob.findFirst({
            where: { jobNumber: { startsWith: prefix } },
            orderBy: { jobNumber: 'desc' },
            select: { jobNumber: true },
        });
        let nextSeq = 1;
        if (last?.jobNumber) {
            const n = parseInt(last.jobNumber.slice(prefix.length), 10);
            if (!Number.isNaN(n)) nextSeq = n + 1;
        }
        return `${prefix}${String(nextSeq).padStart(4, '0')}`;
    }

    async listJobs(status?: PrintJobStatus, search?: string) {
        const where: any = {};
        if (status) where.status = status;
        if (search && search.trim()) {
            const q = search.trim();
            where.OR = [
                { jobNumber: { contains: q } },
                { transaction: { invoiceNumber: { contains: q } } },
                { transaction: { checkoutNumber: { contains: q } } },
                { transaction: { customerName: { contains: q } } },
            ];
        }
        return (this.prisma as any).printJob.findMany({
            where,
            include: this.jobInclude(),
            orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
        });
    }

    async stats() {
        const [antrian, proses, selesai, diambil] = await Promise.all([
            (this.prisma as any).printJob.count({ where: { status: 'ANTRIAN' } }),
            (this.prisma as any).printJob.count({ where: { status: 'PROSES' } }),
            (this.prisma as any).printJob.count({ where: { status: 'SELESAI' } }),
            (this.prisma as any).printJob.count({ where: { status: 'DIAMBIL' } }),
        ]);
        return { antrian, proses, selesai, diambil };
    }

    private async getJob(id: number) {
        const job = await (this.prisma as any).printJob.findUnique({ where: { id } });
        if (!job) throw new NotFoundException('Job cetak tidak ditemukan');
        return job;
    }

    async startJob(id: number, operatorName?: string) {
        const job = await this.getJob(id);
        if (job.status !== 'ANTRIAN') throw new BadRequestException('Job tidak dalam status ANTRIAN');
        return (this.prisma as any).printJob.update({
            where: { id },
            data: { status: 'PROSES', startedAt: new Date(), operatorName: operatorName || job.operatorName },
            include: this.jobInclude(),
        });
    }

    async finishJob(id: number, operatorName?: string) {
        const job = await this.getJob(id);
        if (job.status !== 'PROSES') throw new BadRequestException('Job tidak dalam status PROSES');
        return (this.prisma as any).printJob.update({
            where: { id },
            data: { status: 'SELESAI', finishedAt: new Date(), operatorName: operatorName || job.operatorName },
            include: this.jobInclude(),
        });
    }

    async pickupJob(id: number) {
        const job = await this.getJob(id);
        if (job.status !== 'SELESAI') throw new BadRequestException('Job belum selesai dicetak');
        return (this.prisma as any).printJob.update({
            where: { id },
            data: { status: 'DIAMBIL', pickedUpAt: new Date() },
            include: this.jobInclude(),
        });
    }

    async updateNotes(id: number, notes: string) {
        await this.getJob(id);
        return (this.prisma as any).printJob.update({
            where: { id },
            data: { notes },
            include: this.jobInclude(),
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
}
