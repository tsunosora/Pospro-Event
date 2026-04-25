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
    UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { WarehousesService } from './warehouses.service';
import type {
    CreateWarehouseInput,
    UpdateWarehouseInput,
} from './warehouses.service';

@Controller('warehouses')
@UseGuards(JwtAuthGuard)
export class WarehousesController {
    constructor(private svc: WarehousesService) { }

    @Get()
    list(@Query('includeInactive') includeInactive?: string) {
        return this.svc.findAll(includeInactive === 'true' || includeInactive === '1');
    }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) {
        return this.svc.findOne(id);
    }

    @Post()
    create(@Body() body: CreateWarehouseInput) {
        return this.svc.create(body);
    }

    @Patch(':id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: UpdateWarehouseInput,
    ) {
        return this.svc.update(id, body);
    }

    @Patch(':id/restore')
    restore(@Param('id', ParseIntPipe) id: number) {
        return this.svc.restore(id);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }
}
