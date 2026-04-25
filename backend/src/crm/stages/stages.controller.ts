import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { StagesService } from './stages.service';
import type { UpsertStageInput } from './stages.service';

@Controller('crm/stages')
@UseGuards(JwtAuthGuard)
export class StagesController {
    constructor(private svc: StagesService) { }

    @Get()
    list() { return this.svc.findAll(); }

    @Post()
    create(@Body() body: UpsertStageInput) { return this.svc.create(body); }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<UpsertStageInput>) {
        return this.svc.update(id, body);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id); }

    @Post('reorder')
    reorder(@Body() body: { orderedIds: number[] }) { return this.svc.reorder(body.orderedIds || []); }
}
