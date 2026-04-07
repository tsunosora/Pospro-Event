import { Controller, Get, Post, Body, Param, Query, ParseIntPipe, UseGuards } from '@nestjs/common';
import { StockMovementsService } from './stock-movements.service';
import { MovementType } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('stock-movements')
export class StockMovementsController {
    constructor(private readonly stockMovementsService: StockMovementsService) { }

    @Post()
    create(@Body() createMovementDto: { productVariantId: number; type: MovementType; quantity: number; reason?: string }) {
        return this.stockMovementsService.create(createMovementDto);
    }

    @Get()
    findAll(
        @Query('startDate') startDate?: string,
        @Query('endDate')   endDate?: string,
        @Query('type')      type?: MovementType,
        @Query('search')    search?: string,
    ) {
        return this.stockMovementsService.findAll({ startDate, endDate, type, search });
    }

    @Get('waste')
    findWaste(
        @Query('variantId') variantId: string,
        @Query('since') since: string,
    ) {
        return this.stockMovementsService.findWasteByVariantSince(
            parseInt(variantId),
            since ? new Date(since) : new Date(0),
        );
    }

    @Get(':id')
    findOne(@Param('id', ParseIntPipe) id: number) {
        return this.stockMovementsService.findOne(id);
    }
}
