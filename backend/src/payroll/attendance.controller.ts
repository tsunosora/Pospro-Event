import {
    Body,
    Controller,
    Delete,
    Get,
    Header,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
    Req,
    Res,
    UseGuards,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AttendanceService, type AttendanceRowInput } from './attendance.service';
import { PayrollSummaryService } from './payroll-summary.service';
import { PayrollExportService } from './payroll-export.service';
import { PayrollPayslipService } from './payroll-payslip.service';
import type { AttendanceApprovalStatus, AttendanceStatus } from '@prisma/client';

interface JwtRequest extends Request {
    user?: { userId?: number; id?: number };
}

function actorId(req: JwtRequest): number | null {
    return req.user?.userId ?? req.user?.id ?? null;
}

@Controller('payroll')
@UseGuards(JwtAuthGuard)
export class AttendanceController {
    constructor(
        private attendanceService: AttendanceService,
        private summaryService: PayrollSummaryService,
        private exportService: PayrollExportService,
        private payslipService: PayrollPayslipService,
    ) { }

    @Get('attendance')
    list(
        @Query('from') from?: string,
        @Query('to') to?: string,
        @Query('workerId') workerId?: string,
        @Query('approvalStatus') approvalStatus?: AttendanceApprovalStatus,
    ) {
        return this.attendanceService.list({
            from, to,
            workerId: workerId ? Number(workerId) : undefined,
            approvalStatus,
        });
    }

    @Post('attendance/bulk')
    bulkUpsert(
        @Body() body: { date: string; entries: AttendanceRowInput[] },
        @Req() req: JwtRequest,
    ) {
        return this.attendanceService.bulkUpsert(body.date, body.entries, null, actorId(req));
    }

    @Patch('attendance/:id')
    update(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: {
            status?: AttendanceStatus; overtimeHours?: number; notes?: string | null;
            eventId?: number | null; cityKey?: string | null; divisionKey?: string | null;
        },
        @Req() req: JwtRequest,
    ) {
        return this.attendanceService.update(id, body, actorId(req));
    }

    @Delete('attendance/:id')
    remove(@Param('id', ParseIntPipe) id: number, @Req() req: JwtRequest) {
        return this.attendanceService.remove(id, actorId(req));
    }

    /** Approve 1 attendance — set APPROVED. */
    @Post('attendance/:id/approve')
    approve(@Param('id', ParseIntPipe) id: number, @Req() req: JwtRequest) {
        const uid = actorId(req);
        if (!uid) throw new Error('User context missing');
        return this.attendanceService.approve(id, uid);
    }

    /** Reject 1 attendance dengan optional alasan. */
    @Post('attendance/:id/reject')
    reject(
        @Param('id', ParseIntPipe) id: number,
        @Body() body: { reason?: string },
        @Req() req: JwtRequest,
    ) {
        const uid = actorId(req);
        if (!uid) throw new Error('User context missing');
        return this.attendanceService.reject(id, uid, body?.reason ?? null);
    }

    /** Bulk approve — body { ids: number[] } */
    @Post('attendance/bulk-approve')
    bulkApprove(@Body() body: { ids: number[] }, @Req() req: JwtRequest) {
        const uid = actorId(req);
        if (!uid) throw new Error('User context missing');
        return this.attendanceService.bulkApprove(body.ids ?? [], uid);
    }

    /** Get audit log untuk 1 attendance row */
    @Get('attendance/:id/audit')
    auditLog(@Param('id', ParseIntPipe) id: number) {
        return this.attendanceService.getAuditLog(id);
    }

    @Get('summary/weekly')
    weeklySummary(@Query('weekStart') weekStart: string) {
        return this.summaryService.weeklySummary(weekStart);
    }

    @Get('summary/monthly')
    monthlySummary(
        @Query('year') year: string,
        @Query('month') month: string,
    ) {
        return this.summaryService.monthlySummary(Number(year), Number(month));
    }

    @Get('export/weekly.xlsx')
    @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    async exportWeekly(@Query('weekStart') weekStart: string, @Res() res: Response) {
        const buf = await this.exportService.renderWeeklyXlsx(weekStart);
        res.setHeader('Content-Disposition', `attachment; filename="payroll-weekly-${weekStart}.xlsx"`);
        res.setHeader('Content-Length', buf.length.toString());
        res.end(buf);
    }

    @Get('export/monthly.xlsx')
    @Header('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    async exportMonthly(
        @Query('year') year: string,
        @Query('month') month: string,
        @Res() res: Response,
    ) {
        const y = Number(year);
        const m = Number(month);
        const buf = await this.exportService.renderMonthlyXlsx(y, m);
        const monthLabel = `${y}-${String(m).padStart(2, '0')}`;
        res.setHeader('Content-Disposition', `attachment; filename="payroll-monthly-${monthLabel}.xlsx"`);
        res.setHeader('Content-Length', buf.length.toString());
        res.end(buf);
    }

    /** Slip gaji PDF per worker per periode. ?from=YYYY-MM-DD&to=YYYY-MM-DD */
    @Get('payslip/:workerId.pdf')
    @Header('Content-Type', 'application/pdf')
    async exportPayslip(
        @Param('workerId', ParseIntPipe) workerId: number,
        @Query('from') from: string,
        @Query('to') to: string,
        @Req() req: JwtRequest,
        @Res() res: Response,
    ) {
        const buf = await this.payslipService.renderPayslipPdf(workerId, from, to, actorId(req) ?? undefined);
        res.setHeader('Content-Disposition', `inline; filename="slip-gaji-${workerId}-${from}-${to}.pdf"`);
        res.setHeader('Content-Length', buf.length.toString());
        res.end(buf);
    }
}
