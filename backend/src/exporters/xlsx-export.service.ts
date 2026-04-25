import { Injectable } from '@nestjs/common';
import * as ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';

const NAVY = '1A3B7C';
const LIGHT = 'F1F5FB';
const TOTAL_GREY = 'D9E2F3';

function border() {
    return {
        top: { style: 'thin' as const, color: { argb: 'FF999999' } },
        bottom: { style: 'thin' as const, color: { argb: 'FF999999' } },
        left: { style: 'thin' as const, color: { argb: 'FF999999' } },
        right: { style: 'thin' as const, color: { argb: 'FF999999' } },
    };
}

@Injectable()
export class XlsxExportService {
    constructor(private prisma: PrismaService) { }

    async renderRabXlsx(rabId: number): Promise<Buffer> {
        const rab = await this.prisma.rabPlan.findUnique({
            where: { id: rabId },
            include: {
                items: {
                    include: { category: true },
                    orderBy: [{ categoryId: 'asc' }, { orderIndex: 'asc' }],
                },
                customer: true,
            },
        });
        if (!rab) throw new Error(`RAB id=${rabId} tidak ditemukan`);

        // Load semua kategori (termasuk inactive) supaya item lama tetap ke-render
        // dengan label kategorinya, bahkan jika kategori sudah di-soft-delete.
        const allCategories = await this.prisma.rabCategory.findMany({
            orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
        });

        const wb = new ExcelJS.Workbook();
        wb.creator = 'pospenawaran';
        wb.created = new Date();

        // ════════════════════════════════════════════════════════════════
        //  SHEET 1 — RINGKASAN (Kategori | RAB | COST | SELISIH | TOTAL)
        // ════════════════════════════════════════════════════════════════
        const summary = wb.addWorksheet('Ringkasan');
        summary.columns = [
            { key: 'kategori', width: 30 },
            { key: 'rab', width: 16 },
            { key: 'cost', width: 16 },
            { key: 'selisih', width: 16 },
        ];

        // Title block
        summary.mergeCells('A1:D1');
        summary.getCell('A1').value = `Ringkasan RAB: ${rab.title}`;
        summary.getCell('A1').font = { bold: true, size: 14, color: { argb: `FF${NAVY}` } };
        summary.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };
        summary.getRow(1).height = 22;

        summary.mergeCells('A2:D2');
        const sumMeta = [
            `Kode: ${rab.code}`,
            rab.projectName ? `Proyek: ${rab.projectName}` : '',
            rab.location ? `Lokasi: ${rab.location}` : '',
            rab.customer ? `Klien: ${rab.customer.companyName ?? rab.customer.name}` : '',
        ].filter(Boolean).join(' | ');
        summary.getCell('A2').value = sumMeta;
        summary.getCell('A2').font = { italic: true, size: 10, color: { argb: 'FF666666' } };

        // Header row
        const sumHeaderRow = 4;
        const sumHeaders = ['Kategori', 'RAB', 'COST', 'SELISIH'];
        sumHeaders.forEach((h, i) => {
            const cell = summary.getRow(sumHeaderRow).getCell(i + 1);
            cell.value = h;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } };
            cell.alignment = { horizontal: i === 0 ? 'left' : 'center', vertical: 'middle' };
            cell.border = border();
        });
        summary.getRow(sumHeaderRow).height = 20;

        // Hitung subtotal per kategori (dari items, bukan dari sheet detail)
        const catTotals = new Map<number, { rab: number; cost: number }>();
        for (const cat of allCategories) {
            catTotals.set(cat.id, { rab: 0, cost: 0 });
        }
        for (const it of rab.items as any[]) {
            const qRab = Number(it.quantity);
            const qCost = Number(it.quantityCost ?? it.quantity);
            const pRab = Number(it.priceRab);
            const pCost = Number(it.priceCost);
            const slot = catTotals.get(it.categoryId);
            if (slot) {
                slot.rab += qRab * pRab;
                slot.cost += qCost * pCost;
            }
        }

        // Baris kategori
        let sumRowIdx = sumHeaderRow + 1;
        const sumFirstDataRow = sumRowIdx;
        for (const cat of allCategories) {
            const t = catTotals.get(cat.id)!;
            const row = summary.getRow(sumRowIdx);
            row.getCell(1).value = cat.name + (cat.isActive ? '' : ' (nonaktif)');
            row.getCell(2).value = t.rab > 0 ? t.rab : null;
            row.getCell(3).value = t.cost > 0 ? t.cost : null;
            row.getCell(4).value = { formula: `IFERROR(B${sumRowIdx}-C${sumRowIdx},0)` };

            row.getCell(1).font = { size: 11 };
            row.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };

            [2, 3, 4].forEach((c) => {
                const cell = row.getCell(c);
                cell.numFmt = '#,##0;-#,##0;"-"';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            });

            for (let c = 1; c <= 4; c++) row.getCell(c).border = border();
            row.height = 18;
            sumRowIdx++;
        }
        const sumLastDataRow = sumRowIdx - 1;

        // Baris TOTAL
        const sumTotalRow = sumRowIdx;
        const totRow = summary.getRow(sumTotalRow);
        totRow.getCell(1).value = 'TOTAL';
        totRow.getCell(2).value = { formula: `SUM(B${sumFirstDataRow}:B${sumLastDataRow})` };
        totRow.getCell(3).value = { formula: `SUM(C${sumFirstDataRow}:C${sumLastDataRow})` };
        totRow.getCell(4).value = { formula: `B${sumTotalRow}-C${sumTotalRow}` };
        for (let c = 1; c <= 4; c++) {
            const cell = totRow.getCell(c);
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 12 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } };
            cell.border = border();
            if (c === 1) {
                cell.alignment = { horizontal: 'left', vertical: 'middle' };
            } else {
                cell.numFmt = '#,##0;-#,##0;"-"';
                cell.alignment = { horizontal: 'right', vertical: 'middle' };
            }
        }
        totRow.height = 22;

        // ════════════════════════════════════════════════════════════════
        //  SHEET 2 — DETAIL ITEMS (existing, lengkap dgn formula per row)
        // ════════════════════════════════════════════════════════════════
        const ws = wb.addWorksheet(rab.code, {
            views: [{ state: 'frozen', ySplit: 4 }],
        });

        ws.columns = [
            { key: 'no', width: 6 },
            { key: 'desc', width: 40 },
            { key: 'qty', width: 10 },
            { key: 'unit', width: 10 },
            { key: 'priceRab', width: 16 },
            { key: 'subRab', width: 18 },
            { key: 'qtyCost', width: 10 },
            { key: 'priceCost', width: 16 },
            { key: 'subCost', width: 18 },
            { key: 'selisih', width: 18 },
            { key: 'notes', width: 26 },
        ];

        // ----- HEADER BLOCK ----- //
        ws.mergeCells('A1:K1');
        ws.getCell('A1').value = `RAB: ${rab.title}`;
        ws.getCell('A1').font = { bold: true, size: 16, color: { argb: `FF${NAVY}` } };
        ws.getCell('A1').alignment = { horizontal: 'left', vertical: 'middle' };

        ws.mergeCells('A2:K2');
        const meta = [
            `Kode: ${rab.code}`,
            rab.projectName ? `Proyek: ${rab.projectName}` : '',
            rab.location ? `Lokasi: ${rab.location}` : '',
            rab.customer ? `Klien: ${rab.customer.companyName ?? rab.customer.name}` : '',
        ].filter(Boolean).join(' | ');
        ws.getCell('A2').value = meta;
        ws.getCell('A2').font = { italic: true, size: 10 };

        // ----- TABLE HEADER ----- //
        const headerRowIdx = 4;
        const headers = ['No', 'Uraian', 'Qty', 'Satuan', 'Harga RAB', 'Sub RAB', 'Qty COST', 'Harga COST', 'Sub COST', 'Selisih', 'Catatan'];
        const headerRow = ws.getRow(headerRowIdx);
        headers.forEach((h, i) => {
            const cell = headerRow.getCell(i + 1);
            cell.value = h;
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } };
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = border();
        });
        headerRow.height = 20;

        // ----- CATEGORY BLOCKS ----- //
        let rowIdx = headerRowIdx + 1;
        const categoryRanges: Array<{ categoryId: number; firstItemRow: number; lastItemRow: number; subtotalRow: number }> = [];

        for (const cat of allCategories) {
            const items = (rab.items as any[]).filter((it) => it.categoryId === cat.id);
            if (items.length === 0) continue;

            // Category divider row
            ws.mergeCells(`A${rowIdx}:K${rowIdx}`);
            const divCell = ws.getCell(`A${rowIdx}`);
            divCell.value = cat.name.toUpperCase() + (cat.isActive ? '' : ' (NONAKTIF)');
            divCell.font = { bold: true, color: { argb: `FF${NAVY}` } };
            divCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${LIGHT}` } };
            divCell.alignment = { horizontal: 'left', vertical: 'middle' };
            divCell.border = border();
            rowIdx++;

            const firstItemRow = rowIdx;

            items.forEach((it, idx) => {
                const qRab = Number(it.quantity);
                const qCost = Number((it as any).quantityCost ?? it.quantity);
                const pRab = Number(it.priceRab);
                const pCost = Number(it.priceCost);
                const row = ws.getRow(rowIdx);
                row.getCell(1).value = idx + 1;
                row.getCell(2).value = it.description;
                row.getCell(3).value = qRab;
                row.getCell(4).value = it.unit ?? '';
                row.getCell(5).value = pRab;
                row.getCell(6).value = { formula: `C${rowIdx}*E${rowIdx}`, result: qRab * pRab };
                row.getCell(7).value = qCost;
                row.getCell(8).value = pCost;
                row.getCell(9).value = { formula: `G${rowIdx}*H${rowIdx}`, result: qCost * pCost };
                row.getCell(10).value = { formula: `F${rowIdx}-I${rowIdx}`, result: qRab * pRab - qCost * pCost };
                row.getCell(11).value = it.notes ?? '';

                [3, 5, 6, 7, 8, 9, 10].forEach((c) => {
                    row.getCell(c).numFmt = '#,##0';
                    row.getCell(c).alignment = { horizontal: 'right' };
                });
                row.getCell(1).alignment = { horizontal: 'center' };
                row.getCell(4).alignment = { horizontal: 'center' };
                for (let c = 1; c <= 11; c++) row.getCell(c).border = border();
                rowIdx++;
            });

            const lastItemRow = rowIdx - 1;
            const subtotalRow = rowIdx;
            const sRow = ws.getRow(subtotalRow);
            sRow.getCell(1).value = '';
            ws.mergeCells(`A${subtotalRow}:E${subtotalRow}`);
            sRow.getCell(1).value = `Subtotal ${cat.name}`;
            sRow.getCell(1).font = { bold: true };
            sRow.getCell(1).alignment = { horizontal: 'right' };
            sRow.getCell(6).value = { formula: `SUM(F${firstItemRow}:F${lastItemRow})` };
            sRow.getCell(9).value = { formula: `SUM(I${firstItemRow}:I${lastItemRow})` };
            sRow.getCell(10).value = { formula: `F${subtotalRow}-I${subtotalRow}` };
            [6, 9, 10].forEach((c) => {
                sRow.getCell(c).numFmt = '#,##0';
                sRow.getCell(c).font = { bold: true };
                sRow.getCell(c).alignment = { horizontal: 'right' };
                sRow.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${TOTAL_GREY}` } };
            });
            for (let c = 1; c <= 11; c++) sRow.getCell(c).border = border();

            categoryRanges.push({ categoryId: cat.id, firstItemRow, lastItemRow, subtotalRow });
            rowIdx++;

            // empty gap
            rowIdx++;
        }

        // ----- GRAND TOTAL ----- //
        const grandRow = rowIdx;
        ws.mergeCells(`A${grandRow}:E${grandRow}`);
        ws.getCell(`A${grandRow}`).value = 'GRAND TOTAL';
        ws.getCell(`A${grandRow}`).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
        ws.getCell(`A${grandRow}`).alignment = { horizontal: 'right' };
        ws.getCell(`A${grandRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } };

        const rabTotalFormula = categoryRanges.map((r) => `F${r.subtotalRow}`).join('+') || '0';
        const costTotalFormula = categoryRanges.map((r) => `I${r.subtotalRow}`).join('+') || '0';
        ws.getCell(`F${grandRow}`).value = { formula: rabTotalFormula };
        ws.getCell(`I${grandRow}`).value = { formula: costTotalFormula };
        ws.getCell(`J${grandRow}`).value = { formula: `F${grandRow}-I${grandRow}` };
        [6, 9, 10].forEach((c) => {
            const cell = ws.getRow(grandRow).getCell(c);
            cell.numFmt = '#,##0';
            cell.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
            cell.alignment = { horizontal: 'right' };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } };
        });
        for (let c = 1; c <= 11; c++) ws.getRow(grandRow).getCell(c).border = border();
        rowIdx = grandRow + 2;

        // ----- PENDAPATAN & SALDO ----- //
        ws.getCell(`A${rowIdx}`).value = 'PENDAPATAN';
        ws.getCell(`A${rowIdx}`).font = { bold: true };
        rowIdx++;

        const dpRow = rowIdx;
        ws.getCell(`A${dpRow}`).value = 'DP';
        ws.getCell(`F${dpRow}`).value = Number(rab.dpAmount);
        ws.getCell(`F${dpRow}`).numFmt = '#,##0';
        rowIdx++;

        const lunasRow = rowIdx;
        ws.getCell(`A${lunasRow}`).value = 'Pelunasan';
        ws.getCell(`F${lunasRow}`).value = Number(rab.pelunasan);
        ws.getCell(`F${lunasRow}`).numFmt = '#,##0';
        rowIdx++;

        const otherRow = rowIdx;
        ws.getCell(`A${otherRow}`).value = 'Pendapatan Lain';
        ws.getCell(`F${otherRow}`).value = Number(rab.incomeOther);
        ws.getCell(`F${otherRow}`).numFmt = '#,##0';
        rowIdx++;

        const totalIncomeRow = rowIdx;
        ws.getCell(`A${totalIncomeRow}`).value = 'Total Pendapatan';
        ws.getCell(`A${totalIncomeRow}`).font = { bold: true };
        ws.getCell(`F${totalIncomeRow}`).value = { formula: `SUM(F${dpRow}:F${otherRow})` };
        ws.getCell(`F${totalIncomeRow}`).numFmt = '#,##0';
        ws.getCell(`F${totalIncomeRow}`).font = { bold: true };
        rowIdx += 2;

        const saldoRow = rowIdx;
        ws.getCell(`A${saldoRow}`).value = 'SALDO (Pendapatan - COST)';
        ws.getCell(`A${saldoRow}`).font = { bold: true, size: 12 };
        ws.getCell(`F${saldoRow}`).value = { formula: `F${totalIncomeRow}-I${grandRow}` };
        ws.getCell(`F${saldoRow}`).numFmt = '#,##0';
        ws.getCell(`F${saldoRow}`).font = { bold: true, size: 12 };
        ws.getCell(`F${saldoRow}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${TOTAL_GREY}` } };

        const arr = await wb.xlsx.writeBuffer();
        return Buffer.from(arr as ArrayBuffer);
    }
}
