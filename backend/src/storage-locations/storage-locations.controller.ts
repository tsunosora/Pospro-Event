import {
    Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { StorageLocationsService } from './storage-locations.service';
import type { CreateStorageLocationInput, UpdateStorageLocationInput } from './storage-locations.service';

@Controller('storage-locations')
@UseGuards(JwtAuthGuard)
export class StorageLocationsController {
    constructor(private svc: StorageLocationsService) { }

    @Get()
    list(
        @Query('warehouseId') warehouseId?: string,
        @Query('includeInactive') includeInactive?: string,
    ) {
        return this.svc.findAll(
            warehouseId ? Number(warehouseId) : undefined,
            includeInactive === 'true' || includeInactive === '1',
        );
    }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) { return this.svc.findOne(id); }

    @Post()
    create(@Body() body: CreateStorageLocationInput) { return this.svc.create(body); }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateStorageLocationInput) {
        return this.svc.update(id, body);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id); }
}
