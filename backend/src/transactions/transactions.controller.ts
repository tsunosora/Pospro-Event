import { Controller, Get, Post, Patch, Body, Param, ParseIntPipe, UseGuards, Query } from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { PaymentMethod } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('transactions')
export class TransactionsController {
    constructor(private readonly transactionsService: TransactionsService) { }

    @Post()
    create(@Body() createTransactionDto: {
        items: { productVariantId: number; quantity: number; widthCm?: number; heightCm?: number; note?: string; customPrice?: number }[];
        paymentMethod: PaymentMethod;
        discount?: number;
        customerName?: string;
        customerPhone?: string;
        customerAddress?: string;
        dueDate?: string;
        downPayment?: number;
        cashierName?: string;
        employeeName?: string;
        bankAccountId?: number;
    }) {
        return this.transactionsService.create(createTransactionDto);
    }

    @Get()
    findAll(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.transactionsService.findAll(startDate, endDate);
    }

    @Get('dashboard/metrics')
    getDashboardMetrics() {
        return this.transactionsService.getDashboardMetrics();
    }

    @Get('dashboard/chart')
    getChartData(@Query('period') period: string = 'daily') {
        return this.transactionsService.getChartData(period);
    }

    @Get('reports/summary')
    getSummaryReport(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
    ) {
        return this.transactionsService.getSummaryReport(startDate, endDate);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.transactionsService.findOne(id);
    }

    @Post(':id/pay-off')
    payOff(@Param('id', ParseIntPipe) id: number, @Body() body: { paymentMethod: PaymentMethod, bankAccountId?: number }) {
        return this.transactionsService.payOff(id, body);
    }

    @Patch(':id/payment-method')
    updatePaymentMethod(@Param('id', ParseIntPipe) id: number, @Body() body: { paymentMethod: PaymentMethod; bankAccountId?: number }) {
        return this.transactionsService.updatePaymentMethod(id, body);
    }
}
