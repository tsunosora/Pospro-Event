import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { hitungVariance } from './plan.logic';

export interface CreatePlanDto {
  planDate: string; // ISO
  menuId: number;
  servings?: number;
  selectionMethod?: 'MANUAL' | 'VOTE' | 'SPIN';
  budget?: number | null;
  note?: string | null;
}

export interface UpdatePlanDto {
  planDate?: string;
  servings?: number;
  budget?: number | null;
  note?: string | null;
  status?: 'PLANNED' | 'DONE';
}

const INCLUDE = {
  menu: { select: { id: true, name: true, estimatedCost: true, servings: true } },
  createdBy: { select: { id: true, name: true } },
} as const;

@Injectable()
export class MenuPlanService {
  constructor(private prisma: PrismaService) {}

  private async defaultBudget(): Promise<number | null> {
    const s = await this.prisma.menuMakanSetting.findUnique({ where: { id: 1 } });
    const v = Number(s?.dailyBudget) || 0;
    return v > 0 ? v : null;
  }

  /** Total real cost (Belanja) untuk sekumpulan planId. Return map planId -> total. */
  private async realCostMap(planIds: number[]): Promise<Record<number, number>> {
    if (planIds.length === 0) return {};
    const rows = await this.prisma.belanja.groupBy({
      by: ['menuPlanId'],
      where: { menuPlanId: { in: planIds } },
      _sum: { amount: true },
    });
    const map: Record<number, number> = {};
    for (const r of rows) if (r.menuPlanId != null) map[r.menuPlanId] = Number(r._sum.amount) || 0;
    return map;
  }

  async create(dto: CreatePlanDto, userId: number) {
    if (!dto.menuId) throw new BadRequestException('Menu wajib dipilih');
    if (!dto.planDate) throw new BadRequestException('Tanggal wajib diisi');
    const menu = await this.prisma.menuMakan.findUnique({ where: { id: dto.menuId } });
    if (!menu) throw new NotFoundException('Menu tidak ditemukan');
    // snapshot cost menu × skala porsi (jika servings beda dari default menu)
    const baseServings = menu.servings || 1;
    const servings = dto.servings && dto.servings > 0 ? dto.servings : baseServings;
    const scale = baseServings > 0 ? servings / baseServings : 1;
    const estimatedCost = Math.round(Number(menu.estimatedCost) * scale);
    const budget = dto.budget ?? (await this.defaultBudget());
    return this.prisma.menuMakanPlan.create({
      data: {
        planDate: new Date(dto.planDate),
        menuId: dto.menuId,
        servings,
        selectionMethod: dto.selectionMethod ?? 'MANUAL',
        estimatedCost,
        budget: budget ?? null,
        note: dto.note ?? null,
        createdById: userId,
      },
      include: INCLUDE,
    });
  }

  async list(params: { from?: string; to?: string } = {}) {
    const where: any = {};
    if (params.from || params.to) {
      where.planDate = {};
      if (params.from) where.planDate.gte = new Date(params.from);
      if (params.to) where.planDate.lte = new Date(params.to);
    }
    const plans = await this.prisma.menuMakanPlan.findMany({ where, orderBy: { planDate: 'desc' }, include: INCLUDE });
    const rc = await this.realCostMap(plans.map((p) => p.id));
    return plans.map((p) => ({
      ...p,
      realCost: rc[p.id] ?? 0,
      variance: hitungVariance({ estimatedCost: p.estimatedCost as any, realCost: rc[p.id] ?? 0, budget: p.budget as any }),
    }));
  }

  async findOne(id: number) {
    const plan = await this.prisma.menuMakanPlan.findUnique({
      where: { id },
      include: {
        ...INCLUDE,
        menu: { include: { bahan: { orderBy: { sortOrder: 'asc' } } } },
        belanja: { orderBy: { spentAt: 'desc' }, include: { createdBy: { select: { id: true, name: true } } } },
      },
    });
    if (!plan) throw new NotFoundException('Rencana tidak ditemukan');
    const realCost = plan.belanja.reduce((s, b) => s + (Number(b.amount) || 0), 0);
    return {
      ...plan,
      realCost,
      variance: hitungVariance({ estimatedCost: plan.estimatedCost as any, realCost, budget: plan.budget as any }),
    };
  }

  async update(id: number, dto: UpdatePlanDto) {
    await this.findOne(id);
    const data: any = {
      planDate: dto.planDate ? new Date(dto.planDate) : undefined,
      servings: dto.servings,
      budget: dto.budget,
      note: dto.note,
      status: dto.status,
    };
    return this.prisma.menuMakanPlan.update({ where: { id }, data, include: INCLUDE });
  }

  async remove(id: number) {
    await this.findOne(id);
    // Belanja ter-tag di-set null (onDelete: SetNull) — belanja tidak ikut terhapus
    return this.prisma.menuMakanPlan.delete({ where: { id } });
  }

  /** Rekap agregat periode: total estimasi, total real, selisih. */
  async rekap(params: { from?: string; to?: string } = {}) {
    const plans = await this.list(params);
    const totalEstimasi = plans.reduce((s, p) => s + (Number(p.estimatedCost) || 0), 0);
    const totalReal = plans.reduce((s, p) => s + p.realCost, 0);
    return {
      totalPlan: plans.length,
      totalEstimasi,
      totalReal,
      selisih: totalReal - totalEstimasi,
      over: totalReal > totalEstimasi,
      plans,
    };
  }
}
