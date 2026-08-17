import {
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
import { ManagerGuard } from '../auth/manager.guard';
import { PengajuanService } from './pengajuan.service';
import type {
  CreatePengajuanDto,
  CreatePengajuanItemDto,
  UpdatePengajuanItemDto,
} from './dto/pengajuan.dto';

interface JwtRequest extends Request {
  user?: { userId?: number; id?: number; sub?: number };
}
const uid = (r: JwtRequest) => r.user?.userId ?? r.user?.id ?? r.user?.sub ?? null;

@Controller('pengajuan')
@UseGuards(JwtAuthGuard)
export class PengajuanController {
  constructor(private service: PengajuanService) {}

  @Get()
  list(@Query('eventId') eventId?: string) {
    return this.service.list(eventId ? Number(eventId) : undefined);
  }

  // Inbox persetujuan (deklarasikan sebelum ':id')
  @Get('approval/pending')
  pendingGroups() {
    return this.service.pendingGroups();
  }

  @Get('approval/count')
  pendingCount() {
    return this.service.pendingCount();
  }

  @Patch('approval/approve')
  @UseGuards(ManagerGuard)
  approveItems(@Body() body: { itemIds: number[] }, @Req() req: JwtRequest) {
    const u = uid(req);
    if (!u) throw new Error('User context missing');
    return this.service.approveItems(body?.itemIds ?? [], u);
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.service.findOne(id);
  }

  @Post()
  create(@Body() body: CreatePengajuanDto, @Req() req: JwtRequest) {
    const u = uid(req);
    if (!u) throw new Error('User context missing');
    return this.service.create(body, u);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.service.remove(id);
  }

  // Item CRUD
  @Post(':id/items')
  addItem(@Param('id', ParseIntPipe) id: number, @Body() body: CreatePengajuanItemDto) {
    return this.service.addItem(id, body);
  }

  @Patch('items/:itemId')
  updateItem(
    @Param('itemId', ParseIntPipe) itemId: number,
    @Body() body: UpdatePengajuanItemDto,
  ) {
    return this.service.updateItem(itemId, body);
  }

  @Delete('items/:itemId')
  removeItem(@Param('itemId', ParseIntPipe) itemId: number) {
    return this.service.removeItem(itemId);
  }

  // Approval (OWNER only)
  @Patch('items/:itemId/approve')
  @UseGuards(ManagerGuard)
  approve(@Param('itemId', ParseIntPipe) itemId: number, @Req() req: JwtRequest) {
    const u = uid(req);
    if (!u) throw new Error('User context missing');
    return this.service.approveItem(itemId, u);
  }

  @Patch('items/:itemId/unapprove')
  @UseGuards(ManagerGuard)
  unapprove(@Param('itemId', ParseIntPipe) itemId: number) {
    return this.service.unapproveItem(itemId);
  }

  // Convert ke RAB (OWNER only)
  @Post(':id/convert-to-rab')
  @UseGuards(ManagerGuard)
  convert(@Param('id', ParseIntPipe) id: number) {
    return this.service.convertToRab(id);
  }
}
