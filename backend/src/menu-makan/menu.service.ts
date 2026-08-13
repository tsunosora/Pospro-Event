import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hitungEstimasiCost } from './menu.logic';

export interface BahanInput {
  name: string;
  quantity?: number;
  unit?: string | null;
  unitPrice?: number;
  note?: string | null;
}

export interface CreateMenuDto {
  name: string;
  description?: string | null;
  servings?: number;
  recipe?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[] | null; // semua foto (bisa >1); imageUrl utama = imageUrls[0]
  isActive?: boolean;
  bahan?: BahanInput[];
}

const INCLUDE = {
  bahan: { orderBy: { sortOrder: 'asc' as const } },
  createdBy: { select: { id: true, name: true } },
} as const;

@Injectable()
export class MenuService {
  constructor(private prisma: PrismaService) {}

  list(params: { active?: boolean; q?: string } = {}) {
    const where: any = {};
    if (params.active !== undefined) where.isActive = params.active;
    if (params.q) where.name = { contains: params.q };
    return this.prisma.menuMakan.findMany({ where, orderBy: { name: 'asc' }, include: INCLUDE });
  }

  async findOne(id: number) {
    const menu = await this.prisma.menuMakan.findUnique({ where: { id }, include: INCLUDE });
    if (!menu) throw new NotFoundException('Menu tidak ditemukan');
    return menu;
  }

  private mapBahan(bahan: BahanInput[]) {
    return bahan.map((b, i) => ({
      name: b.name?.trim() || 'Bahan',
      quantity: b.quantity ?? 1,
      unit: b.unit ?? null,
      unitPrice: b.unitPrice ?? 0,
      note: b.note ?? null,
      sortOrder: i,
    }));
  }

  async create(dto: CreateMenuDto, userId: number) {
    if (!dto.name?.trim()) throw new BadRequestException('Nama menu wajib diisi');
    const bahan = dto.bahan ?? [];
    const estimatedCost = hitungEstimasiCost(bahan.map((b) => ({ quantity: b.quantity, unitPrice: b.unitPrice })));
    const photos = dto.imageUrls ?? null;
    return this.prisma.menuMakan.create({
      data: {
        name: dto.name.trim(),
        description: dto.description ?? null,
        servings: dto.servings && dto.servings > 0 ? dto.servings : 1,
        recipe: dto.recipe ?? null,
        imageUrl: photos?.[0] ?? dto.imageUrl ?? null,
        imageUrls: photos && photos.length ? JSON.stringify(photos) : null,
        isActive: dto.isActive ?? true,
        estimatedCost,
        createdById: userId,
        bahan: { create: this.mapBahan(bahan) },
      },
      include: INCLUDE,
    });
  }

  async update(id: number, dto: CreateMenuDto) {
    await this.findOne(id);
    const data: any = {
      name: dto.name?.trim(),
      description: dto.description,
      servings: dto.servings && dto.servings > 0 ? dto.servings : undefined,
      recipe: dto.recipe,
      isActive: dto.isActive,
    };
    // Foto: bila dikirim → simpan set baru (JSON) + set imageUrl utama
    if (dto.imageUrls !== undefined) {
      const photos = dto.imageUrls ?? [];
      data.imageUrls = photos.length ? JSON.stringify(photos) : null;
      data.imageUrl = photos[0] ?? null;
    } else if (dto.imageUrl !== undefined) {
      data.imageUrl = dto.imageUrl;
    }
    // Jika bahan dikirim → replace semua & recompute cost
    if (dto.bahan) {
      data.estimatedCost = hitungEstimasiCost(dto.bahan.map((b) => ({ quantity: b.quantity, unitPrice: b.unitPrice })));
      data.bahan = { deleteMany: {}, create: this.mapBahan(dto.bahan) };
    }
    return this.prisma.menuMakan.update({ where: { id }, data, include: INCLUDE });
  }

  async remove(id: number) {
    await this.findOne(id);
    // Bila menu sudah dipakai di rencana, nonaktifkan agar histori tetap utuh (soft)
    const used = await this.prisma.menuMakanPlan.count({ where: { menuId: id } });
    if (used > 0) {
      return this.prisma.menuMakan.update({ where: { id }, data: { isActive: false } });
    }
    return this.prisma.menuMakan.delete({ where: { id } });
  }
}
