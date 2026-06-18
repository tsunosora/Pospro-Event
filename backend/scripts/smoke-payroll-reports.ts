/**
 * Smoke-test LIVE: generate slip mingguan + laporan owner (PDF & XLSX) terhadap DB lokal.
 * Memastikan Puppeteer, template Handlebars, dan agregasi summary jalan end-to-end.
 * Tidak menulis data — hanya membaca & render ke buffer.
 *
 * Jalankan: npx ts-node --project tsconfig.seed.json scripts/smoke-payroll-reports.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { PayrollPayslipService } from '../src/payroll/payroll-payslip.service';
import { PayrollExportService } from '../src/payroll/payroll-export.service';
import { PrismaService } from '../src/prisma/prisma.service';

const FROM = '2026-05-25';
const TO = '2026-06-07';

function isPdf(b: Buffer) { return b.length > 1000 && b.slice(0, 5).toString() === '%PDF-'; }
function isXlsx(b: Buffer) { return b.length > 1000 && b[0] === 0x50 && b[1] === 0x4b; } // 'PK' zip

let pass = 0, fail = 0;
function check(label: string, cond: boolean, extra = '') {
    if (cond) { pass++; console.log(`  ✅ ${label} ${extra}`); }
    else { fail++; console.log(`  ❌ ${label} ${extra}`); }
}

async function main() {
    const app = await NestFactory.createApplicationContext(AppModule, { logger: ['error', 'warn'] });
    const payslip = app.get(PayrollPayslipService);
    const exporter = app.get(PayrollExportService);
    const prisma = app.get(PrismaService);

    try {
        console.log(`\nPeriode uji: ${FROM} sd ${TO}`);

        console.log('[1] Laporan Owner PDF');
        const ownerPdf = await payslip.renderOwnerReportPdf(FROM, TO, 'Periode Uji');
        check('PDF valid', isPdf(ownerPdf), `(${ownerPdf.length} bytes)`);

        console.log('[2] Laporan Owner XLSX');
        const ownerXlsx = await exporter.renderOwnerReportXlsx(FROM, TO, 'Periode Uji');
        check('XLSX valid', isXlsx(ownerXlsx), `(${ownerXlsx.length} bytes)`);

        console.log('[3] Slip mingguan per worker (PDF)');
        const w = await prisma.attendance.findFirst({ orderBy: { attendanceDate: 'asc' }, select: { workerId: true } });
        if (w) {
            const slip = await payslip.renderPayslipPdf(w.workerId, FROM, TO);
            check(`slip worker ${w.workerId} valid`, isPdf(slip), `(${slip.length} bytes)`);
        } else {
            console.log('  (skip — tidak ada attendance)');
        }
    } finally {
        await app.close();
    }

    console.log(`\n===== ${pass} lulus, ${fail} gagal =====`);
    process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
