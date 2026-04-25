import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LabelsService } from './labels.service';
import type { UpsertLabelInput } from './labels.service';

@Controller('crm/labels')
@UseGuards(JwtAuthGuard)
export class LabelsController {
    constructor(private svc: LabelsService) { }

    @Get()
    list() { return this.svc.findAll(); }

    @Post()
    create(@Body() body: UpsertLabelInput) { return this.svc.create(body); }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<UpsertLabelInput>) {
        return this.svc.update(id, body);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id); }
}
