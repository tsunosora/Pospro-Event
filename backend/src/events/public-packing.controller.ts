import {
    BadRequestException, Body, Controller, Get, NotFoundException, Param, ParseIntPipe, Post, UseGuards,
} from '@nestjs/common';
import { PackingDisposition } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PackingService } from '../packing/packing.service';
import { WarehousePinGuard } from '../warehouse-pin/warehouse-pin.guard';

@Controller('public/events/:token/packing')
export class PublicPackingController {
    constructor(
        private prisma: PrismaService,
        private packing: PackingService,
    ) { }

    @Get('workers')
    async workers(@Param('token') token: string) {
        const ev = await this.prisma.event.findUnique({ where: { shareToken: token }, select: { id: true } });
        if (!ev) throw new NotFoundException('Link tidak valid');
        return this.prisma.worker.findMany({
            where: { isActive: true },
            orderBy: { name: 'asc' },
            select: { id: true, name: true, position: true },
        });
    }

    @UseGuards(WarehousePinGuard)
    @Post('verify')
    async verify(@Param('token') token: string) {
        const ev = await this.prisma.event.findUnique({ where: { shareToken: token }, select: { id: true } });
        if (!ev) throw new NotFoundException('Link tidak valid');
        return { ok: true };
    }

    @UseGuards(WarehousePinGuard)
    @Post(':itemId/check')
    async setChecked(
        @Param('token') token: string,
        @Param('itemId', ParseIntPipe) itemId: number,
        @Body() body: { isChecked: boolean; workerId: number; disposition?: PackingDisposition | null },
    ) {
        if (typeof body?.isChecked !== 'boolean') throw new BadRequestException('isChecked wajib');
        if (!body?.workerId) throw new BadRequestException('Pekerja wajib dipilih');
        if (body.isChecked && !body.disposition) {
            throw new BadRequestException('Pilih klasifikasi: PINJAM atau OPERASIONAL');
        }

        const ev = await this.prisma.event.findUnique({ where: { shareToken: token }, select: { id: true } });
        if (!ev) throw new NotFoundException('Link tidak valid');

        const item = await this.prisma.eventPackingItem.findUnique({ where: { id: itemId }, select: { id: true, eventId: true } });
        if (!item || item.eventId !== ev.id) {
            throw new NotFoundException('Item packing tidak ditemukan di event ini');
        }

        const worker = await this.prisma.worker.findUnique({ where: { id: body.workerId }, select: { id: true, isActive: true } });
        if (!worker || !worker.isActive) throw new BadRequestException('Pekerja tidak valid');

        return this.packing.setChecked(itemId, body.isChecked, body.workerId, body.disposition ?? null);
    }
}
