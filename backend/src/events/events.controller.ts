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
    Put,
    Query,
    Res,
    UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { EventBrand, EventStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { EventsService } from './events.service';
import type {
    BastItemInput,
    CreateEventInput,
    ListEventsFilter,
    UpdateEventInput,
} from './events.service';
import { EventPdfExportService } from '../exporters/event-pdf-export.service';
import { ProjectReportPdfService } from '../exporters/project-report-pdf.service';
import { BastPdfExportService } from '../exporters/bast-pdf-export.service';
import { CashflowService } from '../cashflow/cashflow.service';
import { NotificationsService } from '../notifications/notifications.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('events')
@UseGuards(JwtAuthGuard)
export class EventsController {
    constructor(
        private svc: EventsService,
        private pdf: EventPdfExportService,
        private projectReportPdf: ProjectReportPdfService,
        private bastPdf: BastPdfExportService,
        private cashflowService: CashflowService,
        private notifications: NotificationsService,
        private prisma: PrismaService,
    ) { }

    @Get('dashboard')
    dashboard() {
        return this.svc.dashboardSnapshot();
    }

    @Get()
    list(
        @Query('status') status?: string,
        @Query('brand') brand?: string,
        @Query('year') yearStr?: string,
        @Query('month') monthStr?: string,
        @Query('search') search?: string,
    ) {
        const filter: ListEventsFilter = {};
        if (status) filter.status = status as EventStatus;
        if (brand) filter.brand = brand as EventBrand;
        if (yearStr) filter.year = Number(yearStr);
        if (monthStr) filter.month = Number(monthStr);
        if (search) filter.search = search;
        return this.svc.findAll(filter);
    }

    // Token link publik Event Timeline (kiosk tukang). Statik → harus di atas ':id'.
    @Get('timeline/share-token')
    async getTimelineShareToken() {
        const token = await this.svc.ensureTimelineShareToken();
        return { token };
    }

    @Post('timeline/share-token/regenerate')
    async regenerateTimelineShareToken() {
        const token = await this.svc.regenerateTimelineShareToken();
        return { token };
    }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) {
        return this.svc.findOne(id);
    }

    @Get(':id/summary')
    summary(@Param('id', ParseIntPipe) id: number) {
        return this.svc.summary(id);
    }

    @Post()
    create(@Body() body: CreateEventInput) {
        return this.svc.create(body);
    }

    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateEventInput,
    ) {
        return this.svc.update(id, body);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }

    @Post(':id/share')
    async createShare(@Param('id', ParseIntPipe) id: number) {
        const token = await this.svc.ensureShareToken(id);
        return { token };
    }

    @Post(':id/share/regenerate')
    async regenerateShare(@Param('id', ParseIntPipe) id: number) {
        const token = await this.svc.regenerateShareToken(id);
        return { token };
    }

    @Get(':id/export/pdf')
    async exportPdf(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
        const { buffer, filename } = await this.pdf.render(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.send(buffer);
    }

    @Get(':id/project-report.pdf')
    async exportProjectReport(
        @Param('id', ParseIntPipe) id: number,
        @Res() res: Response,
    ) {
        const { buffer, filename } = await this.projectReportPdf.render(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.send(buffer);
    }

    @Get(':id/bast.pdf')
    async exportBast(
        @Param('id', ParseIntPipe) id: number,
        @Res() res: Response,
    ) {
        const { buffer, filename } = await this.bastPdf.render(id);
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        res.send(buffer);
    }

    @Get(':id/bast-items')
    listBastItems(@Param('id', ParseIntPipe) id: number) {
        return this.svc.listBastItems(id);
    }

    @Get(':id/bast-items/suggestions')
    suggestBastItems(
        @Param('id', ParseIntPipe) id: number,
        @Query('source') source?: string,
        @Query('refId') refId?: string,
    ) {
        const ref = refId ? Number(refId) : undefined;
        return this.svc.suggestBastItems(
            id,
            source === 'quotation' ? 'quotation' : 'rab',
            Number.isFinite(ref) ? ref : undefined,
        );
    }

    @Put(':id/bast-items')
    replaceBastItems(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { items: BastItemInput[] },
    ) {
        return this.svc.replaceBastItems(id, body?.items ?? []);
    }

    @Get(':id/cashflow.csv')
    async exportEventCashflowCsv(
        @Param('id', ParseIntPipe) id: number,
        @Res() res: Response,
    ) {
        const { csv, filename } = await this.cashflowService.exportEventCsv(id);
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.send(csv);
    }

    @Post('project-reports/bulk-download')
    async exportProjectReportBulk(
        @Body() body: { eventIds: number[] },
        @Res() res: Response,
    ) {
        const ids = body.eventIds ?? [];
        if (!ids.length) {
            return res.status(400).json({ message: 'eventIds wajib (minimal 1 event)' });
        }
        const { buffer, filename, count, failed } = await this.projectReportPdf.renderBulkZip(ids);
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('X-PDF-Count', String(count));
        res.setHeader('X-PDF-Failed', failed.join(','));
        res.send(buffer);
    }

    @Post(':id/whatsapp')
    async sendWhatsapp(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { target?: string; includeLink?: boolean; shareBaseUrl?: string },
    ) {
        const settings = await this.prisma.storeSettings.findFirst();
        const discordUrl = (settings as any)?.discordWebhookUrl;
        if (!discordUrl) {
            throw new BadRequestException('Discord Webhook URL belum diatur di Settings › Notifikasi');
        }
        const message = await this.svc.buildEventMessage(id, {
            includeLink: body.includeLink ?? true,
            shareBaseUrl: body.shareBaseUrl,
        });
        await this.notifications.sendToDiscord(discordUrl, message);
        return { ok: true, target: 'discord' };
    }
}
