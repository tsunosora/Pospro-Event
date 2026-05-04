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
    Req,
    UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PayrollAdjustmentsService, type AdjustmentInput } from './payroll-adjustments.service';
import type { PayrollAdjustmentType } from '@prisma/client';

interface JwtRequest extends Request {
    user?: { userId?: number; id?: number };
}

@Controller('payroll/adjustments')
@UseGuards(JwtAuthGuard)
export class PayrollAdjustmentsController {
    constructor(private svc: PayrollAdjustmentsService) { }

    @Get()
    list(
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('workerId') workerId?: string,
        @Query('type') type?: PayrollAdjustmentType,
    ) {
        return this.svc.list({
            from, to,
            workerId: workerId ? Number(workerId) : undefined,
            type,
        });
    }

    @Post()
    create(@Body() body: AdjustmentInput, @Req() req: JwtRequest) {
        const actor = req.user?.userId ?? req.user?.id ?? null;
        return this.svc.create(body, actor);
    }

    @Patch(':id')
    update(@Param('id', ParseIntPipe) id: number, @Body() body: Partial<AdjustmentInput>) {
        return this.svc.update(id, body);
    }

    @Delete(':id')
    remove(@Param('id', ParseIntPipe) id: number) {
        return this.svc.remove(id);
    }
}
