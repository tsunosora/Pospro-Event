import {
    BadRequestException,
    ConflictException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateRabCategoryInput {
    name: string;
    orderIndex?: number;
    isActive?: boolean;
}

export interface UpdateRabCategoryInput {
    name?: string;
    orderIndex?: number;
    isActive?: boolean;
}

@Injectable()
export class RabCategoriesService {
    constructor(private prisma: PrismaService) { }

    async findAll(includeInactive = false) {
        return this.prisma.rabCategory.findMany({
            where: includeInactive ? {} : { isActive: true },
            orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
            include: {
                _count: { select: { items: true } },
            },
        });
    }

    async findOne(id: number) {
        const cat = await this.prisma.rabCategory.findUnique({ where: { id } });
        if (!cat) throw new NotFoundException(`Kategori RAB id=${id} tidak ditemukan`);
        return cat;
    }

    async create(input: CreateRabCategoryInput) {
        const name = input.name.trim();
        if (!name) throw new BadRequestException('Nama kategori wajib diisi');

        const exists = await this.prisma.rabCategory.findUnique({ where: { name } });
        if (exists) throw new ConflictException(`Kategori "${name}" sudah ada`);

        // Default orderIndex = max+1
        let orderIndex = input.orderIndex;
        if (orderIndex === undefined) {
            const max = await this.prisma.rabCategory.aggregate({ _max: { orderIndex: true } });
            orderIndex = (max._max.orderIndex ?? -1) + 1;
        }

        return this.prisma.rabCategory.create({
            data: {
                name,
                orderIndex,
                isActive: input.isActive ?? true,
            },
        });
    }

    async update(id: number, input: UpdateRabCategoryInput) {
        const existing = await this.findOne(id);

        const data: any = {};
        if (input.name !== undefined) {
            const name = input.name.trim();
            if (!name) throw new BadRequestException('Nama kategori wajib diisi');
            if (name !== existing.name) {
                const dup = await this.prisma.rabCategory.findUnique({ where: { name } });
                if (dup) throw new ConflictException(`Kategori "${name}" sudah ada`);
                data.name = name;
            }
        }
        if (input.orderIndex !== undefined) data.orderIndex = input.orderIndex;
        if (input.isActive !== undefined) data.isActive = input.isActive;

        return this.prisma.rabCategory.update({ where: { id }, data });
    }

    /**
     * Soft delete: set isActive=false. Tidak menghapus data RAB items yang menggunakan kategori ini.
     * Kategori akan hilang dari dropdown editor RAB tapi data lama tetap utuh.
     */
    async remove(id: number) {
        const existing = await this.findOne(id);
        const usage = await this.prisma.rabItem.count({ where: { categoryId: id } });

        if (usage === 0 && !existing.key) {
            // Kategori user-added & belum dipakai → hard delete
            await this.prisma.rabCategory.delete({ where: { id } });
            return { mode: 'hard-delete', usage: 0 };
        }

        // Built-in atau sudah dipakai → soft delete
        await this.prisma.rabCategory.update({
            where: { id },
            data: { isActive: false },
        });
        return { mode: 'soft-delete', usage };
    }

    /**
     * Restore kategori yang sebelumnya soft-deleted.
     */
    async restore(id: number) {
        await this.findOne(id);
        return this.prisma.rabCategory.update({
            where: { id },
            data: { isActive: true },
        });
    }

    /**
     * Reorder kategori secara batch. Input: array id terurut.
     */
    async reorder(orderedIds: number[]) {
        const all = await this.prisma.rabCategory.findMany({ select: { id: true } });
        const allIds = new Set(all.map((c) => c.id));
        for (const id of orderedIds) {
            if (!allIds.has(id)) {
                throw new BadRequestException(`Kategori id=${id} tidak ditemukan`);
            }
        }
        await this.prisma.$transaction(
            orderedIds.map((id, idx) =>
                this.prisma.rabCategory.update({
                    where: { id },
                    data: { orderIndex: idx },
                }),
            ),
        );
        return this.findAll(true);
    }
}
