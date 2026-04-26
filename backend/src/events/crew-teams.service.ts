import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateTeamInput {
    name: string;
    leaderWorkerId?: number | null;
    color?: string;
    notes?: string | null;
    isActive?: boolean;
}
export interface UpdateTeamInput {
    name?: string;
    leaderWorkerId?: number | null;
    color?: string;
    notes?: string | null;
    isActive?: boolean;
}

@Injectable()
export class CrewTeamsService {
    constructor(private prisma: PrismaService) { }

    async list(includeInactive = false) {
        return this.prisma.crewTeam.findMany({
            where: includeInactive ? {} : { isActive: true },
            include: {
                leader: { select: { id: true, name: true, position: true, phone: true } },
                _count: { select: { assignments: true } },
            },
            orderBy: { name: 'asc' },
        });
    }

    async findOne(id: number) {
        const t = await this.prisma.crewTeam.findUnique({
            where: { id },
            include: {
                leader: { select: { id: true, name: true, position: true, phone: true } },
            },
        });
        if (!t) throw new NotFoundException('Team tidak ditemukan');
        return t;
    }

    async create(input: CreateTeamInput) {
        if (!input.name?.trim()) throw new BadRequestException('Nama team wajib');
        return this.prisma.crewTeam.create({
            data: {
                name: input.name.trim(),
                leaderWorkerId: input.leaderWorkerId ?? null,
                color: input.color ?? '#6366f1',
                notes: input.notes ?? null,
                isActive: input.isActive ?? true,
            },
            include: { leader: { select: { id: true, name: true, position: true } } },
        });
    }

    async update(id: number, input: UpdateTeamInput) {
        const data: Record<string, unknown> = {};
        if (input.name !== undefined) data.name = input.name.trim();
        if (input.leaderWorkerId !== undefined) data.leaderWorkerId = input.leaderWorkerId;
        if (input.color !== undefined) data.color = input.color;
        if (input.notes !== undefined) data.notes = input.notes;
        if (input.isActive !== undefined) data.isActive = input.isActive;
        return this.prisma.crewTeam.update({
            where: { id },
            data,
            include: { leader: { select: { id: true, name: true, position: true } } },
        });
    }

    async remove(id: number) {
        await this.prisma.crewTeam.delete({ where: { id } });
        return { ok: true };
    }
}
