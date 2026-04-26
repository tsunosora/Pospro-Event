import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { CashflowService } from './cashflow.service';
import { Prisma } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('cashflow')
export class CashflowController {
    constructor(private readonly cashflowService: CashflowService) { }

    @Post()
    create(@Body() createData: Prisma.CashflowCreateInput, @Request() req: any) {
        return this.cashflowService.create({
            ...createData,
            user: { connect: { id: req.user.userId } },
        });
    }

    @Get()
    findAll(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('eventId') eventId?: string,
        @Query('rabPlanId') rabPlanId?: string,
    ) {
        return this.cashflowService.findAll(
            startDate,
            endDate,
            eventId ? Number(eventId) : undefined,
            rabPlanId ? Number(rabPlanId) : undefined,
        );
    }

    @Get('event-profit/:eventId')
    getEventProfit(@Param('eventId') eventId: string) {
        return this.cashflowService.getEventProfit(Number(eventId));
    }

    @Get('all-events-profit')
    getAllEventsProfit(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.cashflowService.getAllEventsProfit({ startDate, endDate });
    }

    @Get('monthly-trend')
    getMonthlyTrend() {
        return this.cashflowService.getMonthlyTrend();
    }

    @Get('category-breakdown')
    getCategoryBreakdown(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
        return this.cashflowService.getCategoryBreakdown(startDate, endDate);
    }

    @Get('platform-breakdown')
    getPlatformBreakdown(@Query('startDate') startDate?: string, @Query('endDate') endDate?: string) {
        return this.cashflowService.getPlatformBreakdown(startDate, endDate);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() data: {
        category?: string;
        amount?: number;
        note?: string;
        platformSource?: string | null;
        paymentMethod?: string | null;
        bankAccountId?: number | null;
        eventId?: number | null;
        rabPlanId?: number | null;
    }) {
        return this.cashflowService.update(+id, data);
    }

    @Delete('bulk')
    removeBulk(@Body() body: { ids: number[] }) {
        return this.cashflowService.removeBulk(body.ids ?? []);
    }

    @Delete(':id')
    remove(@Param('id') id: string) {
        return this.cashflowService.remove(+id);
    }
}
