import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { WageRatesModule } from '../wage-rates/wage-rates.module';
import { AttendanceService } from './attendance.service';
import { PayrollSummaryService } from './payroll-summary.service';
import { PayrollExportService } from './payroll-export.service';
import { PayrollAdjustmentsService } from './payroll-adjustments.service';
import { PayrollPayslipService } from './payroll-payslip.service';
import { AttendanceController } from './attendance.controller';
import { PublicAttendanceController } from './public-attendance.controller';
import { PayrollAdjustmentsController } from './payroll-adjustments.controller';

@Module({
    imports: [PrismaModule, WageRatesModule],
    controllers: [AttendanceController, PublicAttendanceController, PayrollAdjustmentsController],
    providers: [AttendanceService, PayrollSummaryService, PayrollExportService, PayrollAdjustmentsService, PayrollPayslipService],
    exports: [AttendanceService, PayrollSummaryService, PayrollAdjustmentsService, PayrollPayslipService],
})
export class PayrollModule { }
