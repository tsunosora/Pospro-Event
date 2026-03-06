import { Controller, Get, Post, Patch, Delete, Body, Param, ParseIntPipe, UseGuards } from '@nestjs/common';
import { CompetitorsService } from './competitors.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('competitors')
export class CompetitorsController {
    constructor(private readonly competitorsService: CompetitorsService) { }

    @Get()
    findAll() {
        return this.competitorsService.findAll();
    }

    @Post()
    create(@Body() data: { name: string; type?: string; address?: string; latitude: number; longitude: number; notes?: string }) {
        return this.competitorsService.create(data);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() data: any) {
        return this.competitorsService.update(id, data);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.competitorsService.remove(id);
    }
}
