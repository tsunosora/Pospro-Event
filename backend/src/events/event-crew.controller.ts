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
import { EventCrewService } from './event-crew.service';
import type { CreateAssignmentInput, UpdateAssignmentInput } from './event-crew.service';

@Controller('event-crew')
@UseGuards(JwtAuthGuard)
export class EventCrewController {
    constructor(private svc: EventCrewService) { }

    @Get('by-event/:eventId')
    list(@Param('eventId', ParseIntPipe) eventId: number) {
        return this.svc.listByEvent(eventId);
    }

    @Get('report')
    report(@Query('eventId') eventId?: string) {
        return this.svc.report(eventId ? parseInt(eventId, 10) : undefined);
    }

    @Post('bulk')
    bulk(
        @Body() body: {
            eventId: number;
            workerIds: number[];
            teamId?: number | null;
            role?: string | null;
            scheduledStart?: string | null;
            scheduledEnd?: string | null;
        },
    ) {
        return this.svc.createBulk(body.eventId, body.workerIds ?? [], {
            teamId: body.teamId,
            role: body.role,
            scheduledStart: body.scheduledStart,
            scheduledEnd: body.scheduledEnd,
        });
    }

    @Post()
    create(
        @Body() input: CreateAssignmentInput,
        @Query('notify') notify?: string,
        @Query('baseUrl') baseUrlQuery?: string,
        @Req() req?: Request,
    ) {
        const shouldNotify = notify !== 'false' && notify !== '0';
        // Prefer client-supplied baseUrl (frontend origin) > Origin header > Referer
        const baseUrl =
            baseUrlQuery ??
            req?.headers.origin ??
            (req?.headers.referer ? new URL(req.headers.referer as string).origin : '') ??
            '';
        return this.svc.create(input, { notify: shouldNotify, baseUrl: baseUrl as string });
    }

    @Delete('bulk')
    removeBulk(@Body() body: { ids: number[] }) {
        return this.svc.removeBulk(body.ids ?? []);
    }

    @Patch('bulk/reassign-team')
    reassignTeamBulk(@Body() body: { ids: number[]; teamId: number | null }) {
        return this.svc.reassignTeamBulk(body.ids ?? [], body.teamId ?? null);
    }

    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() input: UpdateAssignmentInput,
    ) {
        return this.svc.update(id, input);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }

    @Post(':id/regenerate-token')
    regenToken(@Param('id', ParseIntPipe) id: number) {
        return this.svc.regenerateToken(id);
    }
}
