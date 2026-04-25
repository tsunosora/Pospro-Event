import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface UpsertLabelInput {
    name: string;
    color?: string;
}

@Injectable()
export class LabelsService {
    constructor(private prisma: PrismaService) { }

    findAll() {
        return this.prisma.leadLabel.findMany({ orderBy: { name: 'asc' } });
    }

    async create(input: UpsertLabelInput) {
        if (!input.name?.trim()) throw new BadRequestException('name wajib');
        return this.prisma.leadLabel.create({
            data: { name: input.name.trim(), color: input.color || '#ef4444' },
        });
    }

    async update(id: number, input: Partial<UpsertLabelInput>) {
        const label = await this.prisma.leadLabel.findUnique({ where: { id } });
        if (!label) throw new NotFoundException(`Label ${id} tidak ditemukan`);
        return this.prisma.leadLabel.update({
            where: { id },
            data: {
                name: input.name?.trim() ?? label.name,
                color: input.color ?? label.color,
            },
        });
    }

    async remove(id: number) {
        await this.prisma.leadLabel.delete({ where: { id } });
        return { ok: true };
    }

    async assign(leadId: number, labelIds: number[]) {
        await this.prisma.leadLabelOnLead.deleteMany({ where: { leadId } });
        if (labelIds.length > 0) {
            await this.prisma.leadLabelOnLead.createMany({
                data: labelIds.map((labelId) => ({ leadId, labelId })),
            });
        }
        return { ok: true };
    }
}
