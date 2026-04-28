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
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';
import { LeadsService } from './leads.service';
import type {
    ActivityInput,
    ConvertInput,
    CreateLeadInput,
    ReorderInput,
    UpdateLeadInput,
} from './leads.service';
import type { LeadLevel } from '@prisma/client';

@Controller('crm')
@UseGuards(JwtAuthGuard)
export class LeadsController {
    constructor(private svc: LeadsService) { }

    @Get('board')
    board() { return this.svc.board(); }

    @Get('stats')
    stats() { return this.svc.stats(); }

    @Get('leads')
    list(
        @Query('stageId') stageId?: string,
        @Query('level') level?: LeadLevel,
        @Query('assignedWorkerId') assignedWorkerId?: string,
        @Query('city') city?: string,
        @Query('productCategory') productCategory?: string,
        @Query('search') search?: string,
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ) {
        return this.svc.list({
            stageId: stageId ? Number(stageId) : undefined,
            level,
            assignedWorkerId: assignedWorkerId ? Number(assignedWorkerId) : undefined,
            city: city || undefined,
            productCategory: productCategory || undefined,
            search,
            from,
            to,
            limit: limit ? Number(limit) : undefined,
            offset: offset ? Number(offset) : undefined,
        });
    }

    @Get('distinct/:field')
    distinct(@Param('field') field: string) {
        if (field !== 'city' && field !== 'productCategory') {
            return [];
        }
        return this.svc.distinctValues(field);
    }

    @Get('performance/by-marketer')
    performanceByMarketer(
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        return this.svc.performanceByMarketer({ from, to });
    }

    @Get('dashboard/summary')
    dashboardSummary(
        @Query('from') from?: string,
        @Query('to') to?: string,
    ) {
        return this.svc.dashboardSummary({ from, to });
    }

    @Get('leads/:id')
    getOne(@Param('id', ParseIntPipe) id: number) { return this.svc.getOne(id); }

    @Post('leads')
    create(@Body() body: CreateLeadInput) { return this.svc.create(body); }

    @Patch('leads/:id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: UpdateLeadInput) {
        return this.svc.update(id, body);
    }

    @Delete('leads/:id')
    remove(@Param('id', ParseIntPipe) id: number) { return this.svc.remove(id); }

    @Post('leads/reorder')
    reorder(@Body() body: ReorderInput) { return this.svc.reorder(body); }

    @Get('leads/:id/activities')
    listActivities(@Param('id', ParseIntPipe) id: number) { return this.svc.listActivities(id); }

    @Post('leads/:id/activities')
    addActivity(@Param('id', ParseIntPipe) id: number, @Body() body: ActivityInput) {
        return this.svc.addActivity(id, body);
    }

    @Post('leads/:id/convert')
    convert(@Param('id', ParseIntPipe) id: number, @Body() body: ConvertInput) {
        return this.svc.convert(id, body || {});
    }
}
