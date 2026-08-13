import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class MenuSettingService {
  constructor(private prisma: PrismaService) {}

  async get() {
    const s = await this.prisma.menuMakanSetting.findUnique({ where: { id: 1 } });
    return s ?? { id: 1, dailyBudget: '0', updatedById: null, updatedAt: null };
  }

  async update(dailyBudget: number, userId?: number) {
    return this.prisma.menuMakanSetting.upsert({
      where: { id: 1 },
      create: { id: 1, dailyBudget, updatedById: userId ?? null },
      update: { dailyBudget, updatedById: userId ?? null },
    });
  }
}
