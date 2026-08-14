import {
    Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CustomWagePresetsService, type CustomWagePresetInput } from './custom-wage-presets.service';

@Controller('custom-wage-presets')
@UseGuards(JwtAuthGuard)
export class CustomWagePresetsController {
    constructor(private svc: CustomWagePresetsService) { }

    @Get()
    list(@Query('includeInactive') includeInactive?: string) {
        return this.svc.list(includeInactive !== 'false');
    }

    @Get(':id')
    get(@Param('id', ParseIntPipe) id: number) {
        return this.svc.findOne(id);
    }

    @Post()
    create(@Body() body: CustomWagePresetInput) {
        return this.svc.create(body);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<CustomWagePresetInput>) {
        return this.svc.update(id, body);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }
}
