import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard } from '../auth/manager.guard';
import { MenuSettingService } from './setting.service';

interface JwtRequest extends Request {
  user?: { userId?: number; id?: number };
}
const uid = (r: JwtRequest) => r.user?.userId ?? r.user?.id ?? undefined;

@Controller('menu-setting')
@UseGuards(JwtAuthGuard)
export class MenuSettingController {
  constructor(private service: MenuSettingService) {}

  @Get()
  get() {
    return this.service.get();
  }

  // Ubah budget harian = owner/admin saja
  @Put()
  @UseGuards(ManagerGuard)
  update(@Body() body: { dailyBudget: number }, @Req() req: JwtRequest) {
    return this.service.update(Number(body.dailyBudget) || 0, uid(req));
  }
}
