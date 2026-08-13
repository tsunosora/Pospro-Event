import {
  Controller,
  Get,
  Post,
  Patch,
  Put,
  Delete,
  Param,
  Body,
  Query,
  Req,
  ParseIntPipe,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { BoronganService } from './borongan.service';
import type { UpsertBoronganCrewDto } from './borongan.service';

interface JwtRequest extends Request {
  user?: { userId?: number; id?: number };
}
const uid = (r: JwtRequest) => r.user?.userId ?? r.user?.id ?? null;

@Controller('borongan')
@UseGuards(JwtAuthGuard)
export class BoronganController {
  constructor(private svc: BoronganService) {}

  // ─── Per event: tarif + crew ──────────────────────────────────────────
  @Get('events/:eventId/crew')
  listByEvent(@Param('eventId', ParseIntPipe) eventId: number) {
    return this.svc.listByEvent(eventId);
  }

  @Put('events/:eventId/rates')
  setRates(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() body: { rateA?: number | string | null; rateB?: number | string | null },
  ) {
    return this.svc.setRates(eventId, body);
  }

  @Post('events/:eventId/crew')
  addCrew(@Param('eventId', ParseIntPipe) eventId: number, @Body() body: UpsertBoronganCrewDto) {
    return this.svc.addCrew(eventId, body);
  }

  @Patch('crew/:id')
  updateCrew(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<UpsertBoronganCrewDto>) {
    return this.svc.updateCrew(id, body);
  }

  @Delete('crew/:id')
  removeCrew(@Param('id', ParseIntPipe) id: number) {
    return this.svc.removeCrew(id);
  }

  // ─── Slip mingguan ────────────────────────────────────────────────────
  @Get('slips')
  listSlips(
    @Query('weekStart') weekStart?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('status') status?: string,
  ) {
    return this.svc.listSlips({ weekStart, from, to, status });
  }

  @Get('weeks')
  weeks() {
    return this.svc.weekSummary();
  }

  @Post('slips/generate')
  generate(@Body() body: { weekStart: string }) {
    return this.svc.generateWeek(body.weekStart);
  }

  @Post('slips/:id/pay')
  pay(@Param('id', ParseIntPipe) id: number, @Req() req: JwtRequest) {
    const u = uid(req);
    if (!u) throw new Error('User context missing');
    return this.svc.paySlip(id, u);
  }

  @Post('slips/:id/unpay')
  unpay(@Param('id', ParseIntPipe) id: number) {
    return this.svc.unpaySlip(id);
  }
}
