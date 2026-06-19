import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PayrollSummaryService } from './payroll-summary.service';

const NAVY = 'FF1A3B7C';
const LIGHT = 'FFF1F5FB';
const TOTAL_GREY = 'FFD9E2F3';
const HEADER_TEXT = 'FFFFFFFF';

function border() {
    return {
        top: { style: 'thin' as const, color: { argb: 'FF999999' } },
        bottom: { style: 'thin' as const, color: { argb: 'FF999999' } },
        left: { style: 'thin' as const, color: { argb: 'FF999999' } },
        right: { style: 'thin' as const, color: { argb: 'FF999999' } },
    };
}

@Injectable()
export class PayrollExportService {
    constructor(private summaryService: PayrollSummaryService) { }

    /** Export rekap mingguan. 1 sheet — kolom 7 hari (mengikuti awal minggu) + Total. */
    async renderWeeklyXlsx(weekStart: string, weekEnd?: string): Promise<Buffer> {
        const data = await this.summaryService.weeklySummary(weekStart, weekEnd);
        const wb = new ExcelJS.Workbook();
        wb.creator = 'pospenawaran';
        wb.created = new Date();

        const ws = wb.addWorksheet('Rekap Mingguan');
        // Label hari diturunkan dari tanggal (bukan hardcode) agar benar untuk awal-minggu apa pun.
        const dayLabels = data.days.map((d) =>
            new Date(`${d}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'short', timeZone: 'UTC' }),
        );
        // Layout kolom dinamis (jumlah hari bisa >7 untuk rentang custom):
        // 1=Pekerja 2=Posisi 3=Tarif | 4..(3+N)=hari | lembur | total
        const N = dayLabels.length;
        const lemburCol = N + 4;
        const totalCol = N + 5;

        // Title
        ws.mergeCells(1, 1, 1, totalCol);
        const titleCell = ws.getCell('A1');
        titleCell.value = `Rekap Payroll Mingguan: ${data.weekStart} sd ${data.weekEnd}`;
        titleCell.font = { bold: true, size: 14, color: { argb: NAVY } };
        titleCell.alignment = { horizontal: 'left', vertical: 'middle' };
        ws.getRow(1).height = 22;

        // Subtitle
        ws.mergeCells(2, 1, 2, totalCol);
        ws.getCell('A2').value = `Generated: ${new Date().toLocaleString('id-ID')}`;
        ws.getCell('A2').font = { italic: true, size: 9, color: { argb: 'FF666666' } };

        // Headers (row 4)
        const headerRow = 4;
        const headers = ['Pekerja', 'Posisi', 'Tarif/hari', ...dayLabels, 'Total Lembur (jam)', 'Total Gaji'];
        ws.getRow(headerRow).values = headers;
        const headerCells = ws.getRow(headerRow);
        headerCells.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: HEADER_TEXT } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = border();
        });
        ws.getRow(headerRow).height = 22;

        // Set column widths
        ws.getColumn(1).width = 24; // Pekerja
        ws.getColumn(2).width = 15; // Posisi
        ws.getColumn(3).width = 14; // Tarif
        for (let i = 4; i <= 3 + N; i++) ws.getColumn(i).width = 9;  // kolom hari
        ws.getColumn(lemburCol).width = 14; // Lembur
        ws.getColumn(totalCol).width = 16;  // Total

        // Data rows
        let rowIdx = headerRow + 1;
        for (const r of data.rows) {
            const totalOvertime = r.cells.reduce((s, c) => s + c.overtimeHours, 0);
            const cells = [
                r.name,
                r.position ?? '',
                r.dailyWageRate,
                ...r.cells.map((c) => {
                    if (!c.status) return '—';
                    const status = c.status === 'FULL_DAY' ? '✓' : c.status === 'HALF_DAY' ? '½' : '✗';
                    return c.overtimeHours > 0 ? `${status} +${c.overtimeHours}j` : status;
                }),
                totalOvertime,
                r.totalWage,
            ];
            ws.getRow(rowIdx).values = cells;
            ws.getRow(rowIdx).eachCell({ includeEmpty: true }, (cell, col) => {
                cell.border = border();
                cell.alignment = { vertical: 'middle' };
                if (col === 3 || col === totalCol) {
                    cell.numFmt = '"Rp"#,##0';
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                }
                if (col >= 4 && col <= 3 + N) cell.alignment = { horizontal: 'center', vertical: 'middle' };
                if (col === lemburCol) cell.alignment = { horizontal: 'right', vertical: 'middle' };
            });
            // Highlight kalau gak ada payroll
            if (!r.hasPayroll) {
                ws.getRow(rowIdx).getCell(3).value = 'Belum diset';
                ws.getRow(rowIdx).getCell(3).font = { italic: true, color: { argb: 'FFCC6600' } };
            }
            rowIdx += 1;
        }

        // Grand Total row
        ws.mergeCells(rowIdx, 1, rowIdx, totalCol - 1);
        const grandLabel = ws.getCell(rowIdx, 1);
        grandLabel.value = 'GRAND TOTAL MINGGUAN';
        grandLabel.font = { bold: true };
        grandLabel.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_GREY } };
        grandLabel.alignment = { horizontal: 'right', vertical: 'middle' };
        grandLabel.border = border();
        const grandCell = ws.getCell(rowIdx, totalCol);
        grandCell.value = data.grandTotal;
        grandCell.numFmt = '"Rp"#,##0';
        grandCell.font = { bold: true, color: { argb: NAVY } };
        grandCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_GREY } };
        grandCell.alignment = { horizontal: 'right', vertical: 'middle' };
        grandCell.border = border();

        const buffer = await wb.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    /**
     * Laporan pengeluaran gaji untuk OWNER — rentang [from, to] bebas (mingguan/bulanan).
     * Kolom: No, Pekerja, Posisi, Hadir, ½, Lembur jam, Gaji (approved), Tunjangan, Potongan, Total Cair.
     * Hanya pekerja dengan aktivitas yang ditampilkan.
     */
    async renderOwnerReportXlsx(from: string, to: string, label?: string): Promise<Buffer> {
        const data = await this.summaryService.periodExpenseSummary(from, to);
        const active = data.rows.filter(
            (r) => r.approvedTotal !== 0 || r.adjustments.net !== 0 || r.pendingCount > 0 || r.fullDays > 0 || r.halfDays > 0,
        );
        const wb = new ExcelJS.Workbook();
        wb.creator = 'pospenawaran';
        wb.created = new Date();
        const ws = wb.addWorksheet('Pengeluaran Gaji');

        ws.mergeCells('A1:J1');
        ws.getCell('A1').value = `Laporan Pengeluaran Gaji: ${label || `${data.periodStart} sd ${data.periodEnd}`}`;
        ws.getCell('A1').font = { bold: true, size: 14, color: { argb: NAVY } };
        ws.getRow(1).height = 22;

        ws.mergeCells('A2:J2');
        ws.getCell('A2').value = `Periode: ${data.periodStart} sd ${data.periodEnd} · ${active.length} pekerja · Generated: ${new Date().toLocaleString('id-ID')}`;
        ws.getCell('A2').font = { italic: true, size: 9, color: { argb: 'FF666666' } };

        const headerRow = 4;
        const headers = ['No', 'Pekerja', 'Posisi', 'Hadir', '½ Hari', 'Lembur (jam)', 'Gaji (Approved)', 'Tunjangan', 'Potongan', 'Total Cair'];
        ws.getRow(headerRow).values = headers;
        ws.getRow(headerRow).eachCell((cell) => {
            cell.font = { bold: true, color: { argb: HEADER_TEXT } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = border();
        });
        ws.getRow(headerRow).height = 22;

        const widths = [5, 24, 16, 9, 8, 12, 16, 14, 14, 18];
        widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

        let rowIdx = headerRow + 1;
        for (const [i, r] of active.entries()) {
            const allowance = r.adjustments.bonus + r.adjustments.allowance;
            const deduction = r.adjustments.deduction + r.adjustments.advance;
            ws.getRow(rowIdx).values = [
                i + 1, r.name, r.position ?? '',
                r.fullDays, r.halfDays, r.overtimeHours,
                r.approvedTotal, allowance, deduction, r.grandTotal,
            ];
            ws.getRow(rowIdx).eachCell({ includeEmpty: true }, (cell, col) => {
                cell.border = border();
                cell.alignment = { vertical: 'middle' };
                if (col >= 7 && col <= 10) {
                    cell.numFmt = '"Rp"#,##0';
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                }
                if (col === 1 || (col >= 4 && col <= 6)) cell.alignment = { horizontal: 'center', vertical: 'middle' };
                if (col === 9 && deduction > 0) cell.font = { color: { argb: 'FFC8203A' } };
            });
            rowIdx += 1;
        }

        // Grand Total
        ws.mergeCells(`A${rowIdx}:F${rowIdx}`);
        ws.getCell(`A${rowIdx}`).value = 'TOTAL PENGELUARAN GAJI';
        ws.getCell(`A${rowIdx}`).font = { bold: true };
        ws.getCell(`A${rowIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_GREY } };
        ws.getCell(`A${rowIdx}`).alignment = { horizontal: 'right', vertical: 'middle' };
        ws.getCell(`A${rowIdx}`).border = border();
        const totalCols: Array<[string, number]> = [
            [`G${rowIdx}`, data.grandApproved],
            [`H${rowIdx}`, active.reduce((s, r) => s + r.adjustments.bonus + r.adjustments.allowance, 0)],
            [`I${rowIdx}`, active.reduce((s, r) => s + r.adjustments.deduction + r.adjustments.advance, 0)],
            [`J${rowIdx}`, data.grandFinal],
        ];
        for (const [addr, val] of totalCols) {
            const c = ws.getCell(addr);
            c.value = val;
            c.numFmt = '"Rp"#,##0';
            c.font = { bold: true, color: { argb: NAVY } };
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_GREY } };
            c.alignment = { horizontal: 'right', vertical: 'middle' };
            c.border = border();
        }

        const buffer = await wb.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    /** Export rekap bulanan. 1 sheet — kolom: Pekerja, Hadir, ½, Lembur jam, Base, Lembur Rp, Total. */
    async renderMonthlyXlsx(year: number, month: number): Promise<Buffer> {
        const data = await this.summaryService.monthlySummary(year, month);
        const wb = new ExcelJS.Workbook();
        wb.creator = 'pospenawaran';
        wb.created = new Date();

        const ws = wb.addWorksheet('Rekap Bulanan');

        const monthName = new Date(year, month - 1, 1).toLocaleString('id-ID', { month: 'long', year: 'numeric' });

        ws.mergeCells('A1:H1');
        ws.getCell('A1').value = `Rekap Payroll Bulanan: ${monthName}`;
        ws.getCell('A1').font = { bold: true, size: 14, color: { argb: NAVY } };
        ws.getRow(1).height = 22;

        ws.mergeCells('A2:H2');
        ws.getCell('A2').value = `Periode: ${data.periodStart} sd ${data.periodEnd} · Generated: ${new Date().toLocaleString('id-ID')}`;
        ws.getCell('A2').font = { italic: true, size: 9, color: { argb: 'FF666666' } };

        const headerRow = 4;
        const headers = [
            'Pekerja', 'Posisi', 'Tarif/hari',
            'Hari Hadir', '½ Hari', 'Lembur (jam)',
            'Base', 'Lembur (Rp)', 'Total Gaji',
        ];
        ws.getRow(headerRow).values = headers;
        ws.getRow(headerRow).eachCell((cell) => {
            cell.font = { bold: true, color: { argb: HEADER_TEXT } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = border();
        });
        ws.getRow(headerRow).height = 22;

        // Column widths
        const widths = [24, 15, 14, 11, 9, 14, 14, 14, 16];
        widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });

        let rowIdx = headerRow + 1;
        for (const r of data.rows) {
            ws.getRow(rowIdx).values = [
                r.name,
                r.position ?? '',
                r.dailyWageRate,
                r.fullDays,
                r.halfDays,
                r.overtimeHours,
                r.baseTotal,
                r.overtimeTotal,
                r.totalWage,
            ];
            ws.getRow(rowIdx).eachCell({ includeEmpty: true }, (cell, col) => {
                cell.border = border();
                cell.alignment = { vertical: 'middle' };
                if (col === 3 || col === 7 || col === 8 || col === 9) {
                    cell.numFmt = '"Rp"#,##0';
                    cell.alignment = { horizontal: 'right', vertical: 'middle' };
                }
                if (col >= 4 && col <= 6) cell.alignment = { horizontal: 'center', vertical: 'middle' };
            });
            if (!r.hasPayroll) {
                ws.getRow(rowIdx).getCell(3).value = 'Belum diset';
                ws.getRow(rowIdx).getCell(3).font = { italic: true, color: { argb: 'FFCC6600' } };
            }
            rowIdx += 1;
        }

        // Grand Total
        ws.mergeCells(`A${rowIdx}:H${rowIdx}`);
        ws.getCell(`A${rowIdx}`).value = 'GRAND TOTAL BULANAN';
        ws.getCell(`A${rowIdx}`).font = { bold: true };
        ws.getCell(`A${rowIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_GREY } };
        ws.getCell(`A${rowIdx}`).alignment = { horizontal: 'right', vertical: 'middle' };
        ws.getCell(`A${rowIdx}`).border = border();
        ws.getCell(`I${rowIdx}`).value = data.grandTotal;
        ws.getCell(`I${rowIdx}`).numFmt = '"Rp"#,##0';
        ws.getCell(`I${rowIdx}`).font = { bold: true, color: { argb: NAVY } };
        ws.getCell(`I${rowIdx}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: TOTAL_GREY } };
        ws.getCell(`I${rowIdx}`).alignment = { horizontal: 'right', vertical: 'middle' };
        ws.getCell(`I${rowIdx}`).border = border();

        const buffer = await wb.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }
}
