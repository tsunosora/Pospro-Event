import * as XLSX from 'xlsx';
import { saveAs } from 'file-saver';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import dayjs from 'dayjs';

/**
 * Export data array to Excel (XLSX) file.
 * @param data Array of objects to export (keys become headers)
 * @param fileName Full file name to save as (e.g. 'laporan_profit.xlsx')
 */
export const exportToExcel = (data: any[], fileName: string) => {
    // 1. Create a new workbook and a new worksheet
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();

    // 2. Append worksheet to workbook
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan');

    // 3. Convert to buffer and save
    const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const dataBlob = new Blob([excelBuffer], { type: 'application/octet-stream' });
    saveAs(dataBlob, fileName);
};

/**
 * Export specific array of data to simple PDF Report using AutoTable
 * @param title Header Title inside PDF
 * @param headers Array of column names (e.g., ['SKU', 'Produk', 'Total'])
 * @param body 2D Array of rows matching headers length (e.g., [['PROD-01', 'Kopi', 'Rp 20.000'], ...])
 * @param fileName Full file name to save as (e.g. 'laporan_profit.pdf')
 */
export const exportToPDF = (title: string, headers: string[], body: any[][], fileName: string) => {
    const doc = new jsPDF('landscape'); // Landscape to fit tables better typically

    // Title
    doc.setFontSize(18);
    doc.text(title, 14, 22);

    // Subtitle / Date printed
    doc.setFontSize(11);
    doc.setTextColor(100);
    doc.text(`Dicetak pada: ${dayjs().format('DD MMMM YYYY HH:mm')}`, 14, 30);

    // Auto Table
    autoTable(doc, {
        startY: 36,
        head: [headers],
        body: body,
        theme: 'striped',
        headStyles: { fillColor: [41, 128, 185], textColor: 255, fontStyle: 'bold' },
        styles: { fontSize: 10, cellPadding: 3 },
    });

    // Save
    doc.save(fileName);
};
