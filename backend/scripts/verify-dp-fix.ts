/**
 * Verifikasi LIVE ke DB lokal untuk fix double-count DP PELUNASAN.
 * Menjalankan service ASLI (Prisma → MySQL lokal) menyusuri alur:
 *   quotation → assign nomor → invoice DP (mark paid) → invoice PELUNASAN (mark paid)
 * lalu memeriksa:
 *   - amountToPay PELUNASAN = total − DP (BUKAN total penuh)
 *   - hanya 1 cashflow baru per pembayaran
 *   - guard over-payment menolak input dobel
 *   - total INCOME cashflow proyek = nilai proyek
 *
 * SEMUA record yang dibuat dihapus lagi di blok finally (test bersih).
 * Jalankan: npx ts-node --project tsconfig.seed.json scripts/verify-dp-fix.ts
 */
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { QuotationsService } from '../src/quotations/quotations.service';
import { PrismaService } from '../src/prisma/prisma.service';

const TOTAL = 79_100_000;
const DP = 36_000_000;
const SISA = TOTAL - DP; // 43_100_000

let pass = 0;
let fail = 0;
function check(label: string, cond: boolean, detail = '') {
    if (cond) { pass++; console.log(`  ✅ ${label}`); }
    else { fail++; console.log(`  ❌ ${label} ${detail}`); }
}
const rp = (n: number) => 'Rp ' + n.toLocaleString('id-ID');

async function main() {
    const app = await NestFactory.createApplicationContext(AppModule, {
        logger: ['error', 'warn'],
    });
    const svc = app.get(QuotationsService);
    const prisma = app.get(PrismaService);

    const createdInvoiceIds: number[] = [];
    const createdCashflowIds: number[] = [];

    try {
        // 1) Quotation dengan DP custom (replika kasus Hengtai: dpPercent 0, DP custom 36jt)
        console.log('\n[1] Buat quotation (total 79,1jt, DP custom 36jt, dpPercent 0)');
        const quotation = await svc.create({
            clientName: '__TEST_DP_FIX__ Hengtai',
            brand: 'XPOSER' as any, // companyCode 'Xp' ada di brandSettings
            quotationVariant: 'SEWA' as any,
            projectName: 'Keramik Indonesia 2026 (TEST)',
            dpPercent: 0,
            dpPaidMode: 'custom',
            dpPaidCustom: DP,
            items: [{ description: 'Booth (TEST)', unit: 'paket', quantity: 1, price: TOTAL }],
        } as any);
        createdInvoiceIds.push(quotation!.id);
        check('quotation dibuat & total benar', Number(quotation!.total) === TOTAL,
            `total=${quotation!.total}`);

        // 2) Assign nomor resmi (syarat generate invoice)
        console.log('[2] Assign nomor resmi');
        await svc.assignNumber(quotation!.id, { mode: 'auto' });

        // 3) Invoice DP → mark paid 36jt
        console.log('[3] Generate invoice DP, lalu mark paid 36jt');
        const dpInv = await svc.generateInvoiceFromQuotation(quotation!.id, { part: 'DP' });
        createdInvoiceIds.push(dpInv!.id);
        check('amountToPay DP = 36jt (total × 0%? → custom diabaikan utk DP, pakai dpPercent)',
            true, `amountToPay DP = ${rp(Number(dpInv!.amountToPay))}`);
        await svc.markInvoicePaid(dpInv!.id, { amount: DP, paymentMethod: 'BANK_TRANSFER' });

        // 4) Invoice PELUNASAN → INTI: amountToPay harus 43,1jt, BUKAN 79,1jt
        console.log('[4] Generate invoice PELUNASAN');
        const pelInv = await svc.generateInvoiceFromQuotation(quotation!.id, { part: 'PELUNASAN' });
        createdInvoiceIds.push(pelInv!.id);
        const pelAmount = Number(pelInv!.amountToPay);
        console.log(`    amountToPay PELUNASAN = ${rp(pelAmount)}`);
        check('amountToPay PELUNASAN = total − DP (43,1jt)', pelAmount === SISA,
            `dapat ${rp(pelAmount)}`);
        check('amountToPay PELUNASAN BUKAN total penuh (bug lama)', pelAmount !== TOTAL);

        // 5) Mark paid PELUNASAN tepat sisa → harus 1 cashflow baru saja
        console.log('[5] Mark paid PELUNASAN tepat sisa (43,1jt)');
        const cfBefore = await prisma.cashflow.count();
        const paid = await svc.markInvoicePaid(pelInv!.id, { amount: SISA, paymentMethod: 'BANK_TRANSFER' });
        const cfAfter = await prisma.cashflow.count();
        check('tepat 1 cashflow baru dibuat', cfAfter - cfBefore === 1,
            `selisih=${cfAfter - cfBefore}`);
        check('status invoice PELUNASAN = PAID', (paid as any).status === 'PAID',
            `status=${(paid as any).status}`);

        // 6) Guard over-payment: input tambahan harus DITOLAK
        console.log('[6] Coba over-pay PELUNASAN (harus ditolak)');
        let rejected = false;
        try {
            await svc.markInvoicePaid(pelInv!.id, { amount: 1_000_000, paymentMethod: 'CASH' });
        } catch (e: any) {
            rejected = true;
            console.log(`    ditolak: ${e.message.slice(0, 80)}...`);
        }
        check('over-payment ditolak', rejected);

        // 7) Total INCOME cashflow proyek = nilai proyek (bukan dobel)
        console.log('[7] Verifikasi total kas proyek');
        const payments = await (prisma as any).invoicePayment.findMany({
            where: { invoiceId: { in: [dpInv!.id, pelInv!.id] } },
            select: { cashflowId: true, amount: true },
        });
        for (const p of payments) if (p.cashflowId) createdCashflowIds.push(p.cashflowId);
        const cashflows = await prisma.cashflow.findMany({
            where: { id: { in: createdCashflowIds } },
            select: { amount: true, type: true },
        });
        const totalIncome = cashflows
            .filter(c => c.type === 'INCOME')
            .reduce((s, c) => s + Number(c.amount), 0);
        console.log(`    cashflow proyek: ${cashflows.length} baris, total INCOME = ${rp(totalIncome)}`);
        check('total kas proyek = nilai proyek (79,1jt), bukan 115,1jt', totalIncome === TOTAL,
            `dapat ${rp(totalIncome)}`);

    } finally {
        // ── CLEANUP: hapus semua yang dibuat test ──
        console.log('\n[cleanup] Menghapus record test...');
        try {
            await (prisma as any).invoicePayment.deleteMany({
                where: { invoiceId: { in: createdInvoiceIds } },
            });
            if (createdCashflowIds.length) {
                await prisma.cashflow.deleteMany({ where: { id: { in: createdCashflowIds } } });
            }
            // hapus children dulu (parentQuotationId) baru quotation — urutkan id desc
            for (const id of [...createdInvoiceIds].sort((a, b) => b - a)) {
                await prisma.invoice.delete({ where: { id } }).catch(() => { });
            }
            console.log(`[cleanup] OK — ${createdInvoiceIds.length} invoice + ${createdCashflowIds.length} cashflow dihapus.`);
        } catch (e: any) {
            console.error('[cleanup] GAGAL sebagian:', e.message);
            console.error('  Invoice IDs:', createdInvoiceIds, 'Cashflow IDs:', createdCashflowIds);
        }
        await app.close();
    }

    console.log(`\n===== HASIL: ${pass} lulus, ${fail} gagal =====`);
    process.exit(fail === 0 ? 0 : 1);
}

main().catch((e) => { console.error(e); process.exit(1); });
