import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CompetitorsService {
    constructor(private prisma: PrismaService) { }

    async findAll() {
        return (this.prisma as any).competitor.findMany({ orderBy: { createdAt: 'desc' } });
    }

    async create(data: { name: string; type?: string; address?: string; latitude: number; longitude: number; notes?: string }) {
        return (this.prisma as any).competitor.create({ data });
    }

    async update(id: number, data: { name?: string; type?: string; address?: string; latitude?: number; longitude?: number; notes?: string }) {
        const item = await (this.prisma as any).competitor.findUnique({ where: { id } });
        if (!item) throw new NotFoundException('Competitor not found');
        return (this.prisma as any).competitor.update({ where: { id }, data });
    }

    async remove(id: number) {
        const item = await (this.prisma as any).competitor.findUnique({ where: { id } });
        if (!item) throw new NotFoundException('Competitor not found');
        return (this.prisma as any).competitor.delete({ where: { id } });
    }
}
