import { Controller, Get, Post, Body, Patch, Param, Delete, ParseIntPipe, Query, UseGuards } from '@nestjs/common';
import { InvoiceService } from './invoice.service';
import { InvoiceStatus, InvoiceType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('invoices')
export class InvoiceController {
    constructor(private readonly invoiceService: InvoiceService) { }

    @Post()
    create(@Body() createData: any) {
        return this.invoiceService.create(createData);
    }

    @Get()
    findAll(@Query('type') type?: InvoiceType) {
        return this.invoiceService.findAll(type);
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.invoiceService.findOne(id);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
        return this.invoiceService.update(id, data);
    }

    @Patch(':id/status')
    updateStatus(
        @Param('id', ParseIntPipe) id: number,
        @Body('status') status: InvoiceStatus,
    ) {
        return this.invoiceService.updateStatus(id, status);
    }

    @Patch(':id/type')
    updateType(
        @Param('id', ParseIntPipe) id: number,
        @Body('type') type: InvoiceType,
    ) {
        return this.invoiceService.updateType(id, type);
    }

    @Post(':id/convert-to-invoice')
    convertToInvoice(@Param('id', ParseIntPipe) id: number) {
        return this.invoiceService.convertToInvoice(id);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.invoiceService.remove(id);
    }
}
