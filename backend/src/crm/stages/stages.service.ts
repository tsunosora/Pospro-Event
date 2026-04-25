import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface UpsertStageInput {
    name: string;
    color?: string;
    isTerminal?: boolean;
    isWinStage?: boolean;
}

@Injectable()
export class StagesService {
    constructor(private prisma: PrismaService) { }

    findAll() {
        return this.prisma.leadStage.findMany({ orderBy: { orderIndex: 'asc' } });
    }

    async create(input: UpsertStageInput) {
        if (!input.name?.trim()) throw new BadRequestException('name wajib');
        const max = await this.prisma.leadStage.aggregate({ _max: { orderIndex: true } });
        return this.prisma.leadStage.create({
            data: {
                name: input.name.trim(),
                color: input.color || '#94a3b8',
                isTerminal: !!input.isTerminal,
                isWinStage: !!input.isWinStage,
                orderIndex: (max._max.orderIndex ?? -1) + 1,
            },
        });
    }

    async update(id: number, input: Partial<UpsertStageInput>) {
        const stage = await this.prisma.leadStage.findUnique({ where: { id } });
        if (!stage) throw new NotFoundException(`Stage ${id} tidak ditemukan`);
        return this.prisma.leadStage.update({
            where: { id },
            data: {
                name: input.name?.trim() ?? stage.name,
                color: input.color ?? stage.color,
                isTerminal: input.isTerminal ?? stage.isTerminal,
                isWinStage: input.isWinStage ?? stage.isWinStage,
            },
        });
    }

    async remove(id: number) {
        const count = await this.prisma.lead.count({ where: { stageId: id } });
        if (count > 0) throw new BadRequestException(`Stage masih punya ${count} lead — pindahkan dulu`);
        await this.prisma.leadStage.delete({ where: { id } });
        return { ok: true };
    }

    async reorder(orderedIds: number[]) {
        await this.prisma.$transaction(
            orderedIds.map((id, i) =>
                this.prisma.leadStage.update({ where: { id }, data: { orderIndex: i } }),
            ),
        );
        return this.findAll();
    }
}
