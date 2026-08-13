import { BadRequestException, Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ManagerGuard } from '../auth/manager.guard';
import { MenuVoteService } from './vote.service';
import type { CreateSessionDto } from './vote.service';

interface JwtRequest extends Request {
  user?: { userId?: number; id?: number };
}
const uid = (r: JwtRequest) => r.user?.userId ?? r.user?.id ?? null;

@Controller('menu-vote')
@UseGuards(JwtAuthGuard, ManagerGuard) // urutan penting: JWT dulu, lalu cek role
export class MenuVoteController {
  constructor(private service: MenuVoteService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Get(':id')
  detail(@Param('id', ParseIntPipe) id: number) {
    return this.service.detail(id);
  }

  @Post()
  create(@Body() body: CreateSessionDto, @Req() req: JwtRequest) {
    const u = uid(req);
    if (!u) throw new BadRequestException('User context missing');
    return this.service.create(body, u);
  }

  @Post(':id/close')
  close(@Param('id', ParseIntPipe) id: number, @Req() req: JwtRequest) {
    const u = uid(req);
    if (!u) throw new BadRequestException('User context missing');
    return this.service.close(id, u);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }
}
