import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { KasService } from './kas.service';
import type { CreatePenerimaanDto } from './kas.service';

interface JwtRequest extends Request {
  user?: { userId?: number; id?: number };
}
const uid = (r: JwtRequest) => r.user?.userId ?? r.user?.id ?? null;

@Controller('kas')
@UseGuards(JwtAuthGuard)
export class KasController {
  constructor(private service: KasService) {}

  @Get('summary')
  summary(@Query('userId') userId?: string) {
    return this.service.summary(userId ? Number(userId) : undefined);
  }

  @Get('by-admin')
  byAdmin() {
    return this.service.byAdmin();
  }

  @Get('penerimaan')
  listPenerimaan(@Query('userId') userId?: string) {
    return this.service.listPenerimaan(userId ? Number(userId) : undefined);
  }

  @Post('penerimaan')
  create(@Body() body: CreatePenerimaanDto, @Req() req: JwtRequest) {
    const u = uid(req);
    if (!u) throw new Error('User context missing');
    return this.service.createPenerimaan(body, u);
  }

  @Delete('penerimaan/:id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.removePenerimaan(id);
  }
}
