import { Injectable, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class BranchesService implements OnModuleInit {
    constructor(private prisma: PrismaService) { }

    async onModuleInit() {
        const count = await this.prisma.branch.count();
        if (count === 0) {
            await this.prisma.branch.createMany({
                data: [
                    { name: 'Cabang Utama', address: 'Masukkan alamat cabang Anda', latitude: -6.2146, longitude: 106.8173, omset: 0, margin: 0 },
                ]
            });
        }
    }

    async findAll() {
        return this.prisma.branch.findMany({ orderBy: { createdAt: 'asc' } });
    }

    async create(data: { name: string; address?: string; latitude: number; longitude: number; omset?: number; margin?: number }) {
        return this.prisma.branch.create({ data });
    }

    async update(id: number, data: { name?: string; address?: string; latitude?: number; longitude?: number; omset?: number; margin?: number }) {
        const branch = await this.prisma.branch.findUnique({ where: { id } });
        if (!branch) throw new NotFoundException('Branch not found');
        return this.prisma.branch.update({ where: { id }, data });
    }

    async remove(id: number) {
        const branch = await this.prisma.branch.findUnique({ where: { id } });
        if (!branch) throw new NotFoundException('Branch not found');
        return this.prisma.branch.delete({ where: { id } });
    }
}
