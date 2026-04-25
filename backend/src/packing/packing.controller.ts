import {
    Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { PackingDisposition } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PackingService } from './packing.service';
import type { CreatePackingItemInput, UpdatePackingItemInput } from './packing.service';

@UseGuards(JwtAuthGuard)
@Controller()
export class PackingController {
    constructor(private svc: PackingService) { }

    @Get('events/:eventId/packing')
    list(@Param('eventId', ParseIntPipe) eventId: number) {
        return this.svc.listForEvent(eventId);
    }

    @Get('events/:eventId/packing/summary')
    summary(@Param('eventId', ParseIntPipe) eventId: number) {
        return this.svc.summary(eventId);
    }

    @Post('events/:eventId/packing')
    create(
        @Param('eventId', ParseIntPipe) eventId: number,
        @Body() body: CreatePackingItemInput,
    ) {
        return this.svc.create(eventId, body);
    }

    @Post('events/:eventId/packing/bulk')
    bulkCreate(
        @Param('eventId', ParseIntPipe) eventId: number,
        @Body() body: { items: CreatePackingItemInput[] },
    ) {
        return this.svc.bulkCreate(eventId, body.items ?? []);
    }

    @Post('events/:eventId/packing/bulk-check')
    bulkSetChecked(
        @Param('eventId', ParseIntPipe) eventId: number,
        @Body() body: { ids: number[]; isChecked: boolean; workerId?: number | null; disposition?: PackingDisposition | null },
    ) {
        return this.svc.bulkSetChecked(
            eventId,
            body.ids ?? [],
            !!body.isChecked,
            body.workerId ?? null,
            body.disposition ?? null,
        );
    }

    @Get('events/:eventId/packing/prefill-withdrawal')
    prefill(
        @Param('eventId', ParseIntPipe) eventId: number,
        @Query('onlyChecked') onlyChecked?: string,
    ) {
        const only = onlyChecked === 'false' ? false : true;
        return this.svc.prefillWithdrawal(eventId, only);
    }

    @Patch('packing/:id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdatePackingItemInput & { workerId?: number | null },
    ) {
        const { workerId, ...rest } = body;
        return this.svc.update(id, rest, workerId ?? null);
    }

    @Post('packing/:id/check')
    setChecked(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { isChecked: boolean; workerId?: number | null; disposition?: PackingDisposition | null },
    ) {
        return this.svc.setChecked(id, !!body.isChecked, body.workerId ?? null, body.disposition ?? null);
    }

    @Delete('packing/:id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }
}
