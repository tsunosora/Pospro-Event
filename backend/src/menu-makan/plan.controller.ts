import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MenuPlanService } from './plan.service';
import type { CreatePlanDto, UpdatePlanDto } from './plan.service';

interface JwtRequest extends Request {
  user?: { userId?: number; id?: number };
}
const uid = (r: JwtRequest) => r.user?.userId ?? r.user?.id ?? null;

@Controller('menu-plan')
@UseGuards(JwtAuthGuard)
export class MenuPlanController {
  constructor(private service: MenuPlanService) {}

  @Get()
  list(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.list({ from, to });
  }

  // Deklarasi 'rekap' SEBELUM ':id' agar tak tertangkap sebagai param
  @Get('rekap')
  rekap(@Query('from') from?: string, @Query('to') to?: string) {
    return this.service.rekap({ from, to });
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: CreatePlanDto, @Req() req: JwtRequest) {
    const u = uid(req);
    if (!u) throw new BadRequestException('User context missing');
    return this.service.create(body, u);
  }

  @Patch(':id')
  update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdatePlanDto) {
    return this.service.update(id, body);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
