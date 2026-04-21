import { Body, Controller, Get, Param, ParseIntPipe, Post, Query } from '@nestjs/common';
import { PrintQueueService } from './print-queue.service';
import type { PrintJobStatus } from './print-queue.service';

// All endpoints public (PIN-gated on client) — consistent with /production
@Controller('print-queue')
export class PrintQueueController {
    constructor(private readonly svc: PrintQueueService) {}

    @Get('jobs')
    list(@Query('status') status?: PrintJobStatus, @Query('search') search?: string) {
        return this.svc.listJobs(status, search);
    }

    @Get('stats')
    stats() {
        return this.svc.stats();
    }

    @Post('pin/verify')
    verifyPin(@Body('pin') pin: string) {
        return this.svc.verifyPin(pin);
    }

    @Post('jobs/:id/start')
    start(@Param('id', ParseIntPipe) id: number, @Body('operatorName') operatorName?: string) {
        return this.svc.startJob(id, operatorName);
    }

    @Post('jobs/:id/finish')
    finish(@Param('id', ParseIntPipe) id: number, @Body('operatorName') operatorName?: string) {
        return this.svc.finishJob(id, operatorName);
    }

    @Post('jobs/:id/pickup')
    pickup(@Param('id', ParseIntPipe) id: number) {
        return this.svc.pickupJob(id);
    }

    @Post('jobs/:id/notes')
    notes(@Param('id', ParseIntPipe) id: number, @Body('notes') notes: string) {
        return this.svc.updateNotes(id, notes);
    }
}
