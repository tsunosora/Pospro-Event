/**
 * Koreksi data PRODUCTION untuk bug double-count DP — kasus PT. Hengtai Print.
 * Invoice PELUNASAN id=192 (5300rev1/Xp/Inv/VI/26).
 *
 * Target akhir:
 *   - hapus payment dobel (DP 36jt yang diketik ulang) + cashflow dobel-nya
 *   - amount_to_pay = total − dpPaidCustom = 43.100.000
 *   - paid_amount   = 43.100.000, status = PAID
 *
 * KEAMANAN:
 *   - DRY-RUN secara default. Tidak mengubah apa pun tanpa argumen `--apply`.
 *   - Memvalidasi SEMUA asumsi (nominal, relasi) sebelum menghapus. Abort kalau tak cocok.
 *   - Backup baris terdampak ke file JSON sebelum mutasi.
 *   - Semua mutasi dalam 1 transaksi. Idempotent (aman dijalankan ulang).
 *
 * Jalankan (preview):  npx ts-node --project tsconfig.seed.json scripts/fix-hengtai-production.ts
 * Jalankan (eksekusi): npx ts-node --project tsconfig.seed.json scripts/fix-hengtai-production.ts --apply
 *
 * PENTING: skrip memakai DATABASE_URL aktif. Pastikan .env menunjuk ke PRODUCTION
 * saat ingin mengoreksi production, dan sudah backup DB penuh.
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');

// ── Parameter kasus (sesuai brief). Diverifikasi dulu sebelum dipakai. ──
const INVOICE_ID = 192;
const INVOICE_NUMBER = '5300rev1/Xp/Inv/VI/26';
const DUP_PAYMENT_ID = 46;     // pembayaran DP dobel (36jt, cicilan ke-2)
const DUP_CASHFLOW_ID = 9015;  // cashflow INCOME dobel (36jt)

const rp = (n: any) => 'Rp ' + Number(n).toLocaleString('id-ID');

function dbHost(): string {
    try { return new URL(process.env.DATABASE_URL || '').host || '(?)'; }
    catch { return '(tidak terbaca)'; }
}

async function main() {
    console.log(`\n=== Koreksi Hengtai — DB host: ${dbHost()} ===`);
    console.log(APPLY ? '⚠️  MODE: --apply (akan MENGUBAH data)\n' : 'MODE: DRY-RUN (preview saja, tidak mengubah apa pun)\n');

    // 1) Ambil invoice & validasi identitas
    const inv = await prisma.invoice.findUnique({ where: { id: INVOICE_ID } });
    if (!inv) { console.error(`ABORT: invoice id=${INVOICE_ID} tidak ditemukan.`); process.exit(1); }
    if (inv.invoiceNumber !== INVOICE_NUMBER) {
        console.error(`ABORT: nomor invoice tak cocok. Diharapkan "${INVOICE_NUMBER}", dapat "${inv.invoiceNumber}". Jangan koreksi sembarang.`);
        process.exit(1);
    }
    if ((inv as any).invoicePart !== 'PELUNASAN') {
        console.error(`ABORT: invoicePart bukan PELUNASAN (${(inv as any).invoicePart}).`); process.exit(1);
    }
    const total = Number(inv.total);
    const dpCustom = (inv as any).dpPaidCustom != null ? Number((inv as any).dpPaidCustom) : null;
    if ((inv as any).dpPaidMode !== 'custom' || dpCustom == null) {
        console.error(`ABORT: dpPaidMode/dpPaidCustom tidak sesuai (mode=${(inv as any).dpPaidMode}, custom=${dpCustom}).`); process.exit(1);
    }
    const targetAmount = total - dpCustom; // sisa benar
    console.log(`Invoice ${inv.invoiceNumber}: total=${rp(total)}, dpPaidCustom=${rp(dpCustom)}`);
    console.log(`→ amount_to_pay benar = ${rp(targetAmount)}`);
    console.log(`  state sekarang: amount_to_pay=${rp((inv as any).amountToPay)}, paid_amount=${(inv as any).paidAmount != null ? rp((inv as any).paidAmount) : 'null'}, status=${inv.status}\n`);

    // 2) Cek payment & cashflow dobel (idempotent: boleh sudah terhapus)
    const dupPayment = await (prisma as any).invoicePayment.findUnique({ where: { id: DUP_PAYMENT_ID } });
    const dupCashflow = await prisma.cashflow.findUnique({ where: { id: DUP_CASHFLOW_ID } });

    let willDeletePayment = false;
    let willDeleteCashflow = false;

    if (dupPayment) {
        if (dupPayment.invoiceId !== INVOICE_ID) {
            console.error(`ABORT: payment id=${DUP_PAYMENT_ID} bukan milik invoice ${INVOICE_ID} (tapi ${dupPayment.invoiceId}).`); process.exit(1);
        }
        if (Number(dupPayment.amount) !== dpCustom) {
            console.error(`ABORT: nominal payment dobel (${rp(dupPayment.amount)}) ≠ dpPaidCustom (${rp(dpCustom)}). Tinjau manual.`); process.exit(1);
        }
        willDeletePayment = true;
        console.log(`• Payment id=${DUP_PAYMENT_ID} (${rp(dupPayment.amount)}) → AKAN DIHAPUS`);
    } else {
        console.log(`• Payment id=${DUP_PAYMENT_ID} → sudah tidak ada (skip)`);
    }

    if (dupCashflow) {
        if (dupCashflow.type !== 'INCOME' || Number(dupCashflow.amount) !== dpCustom) {
            console.error(`ABORT: cashflow id=${DUP_CASHFLOW_ID} tak cocok (type=${dupCashflow.type}, amount=${rp(dupCashflow.amount)}). Tinjau manual.`); process.exit(1);
        }
        willDeleteCashflow = true;
        console.log(`• Cashflow id=${DUP_CASHFLOW_ID} (${rp(dupCashflow.amount)} INCOME) → AKAN DIHAPUS`);
    } else {
        console.log(`• Cashflow id=${DUP_CASHFLOW_ID} → sudah tidak ada (skip)`);
    }

    // 3) Hitung paid_amount akhir dari payment yang TERSISA (setelah hapus dobel)
    const remainingPayments = await (prisma as any).invoicePayment.findMany({
        where: { invoiceId: INVOICE_ID, ...(willDeletePayment ? { id: { not: DUP_PAYMENT_ID } } : {}) },
        select: { id: true, amount: true },
    });
    const remainingPaid = remainingPayments.reduce((s: number, p: any) => s + Number(p.amount), 0);
    // paid_amount HARUS mencerminkan pembayaran nyata yang tersisa — JANGAN dikarang.
    // Kalau 0 (invoice belum pernah dibayar), biarkan status apa adanya (jangan paksa PAID).
    const finalPaid = remainingPaid;
    const finalStatus = remainingPaid <= 0
        ? inv.status // tak ada pembayaran → status tidak diubah
        : (remainingPaid >= targetAmount - 0.01 ? 'PAID' : ('PARTIALLY_PAID' as any));
    console.log(`\nPayment tersisa: ${remainingPayments.length} baris = ${rp(remainingPaid)}`);
    console.log(`→ paid_amount akhir = ${remainingPaid > 0 ? rp(finalPaid) : 'null (belum dibayar)'}, status akhir = ${finalStatus}`);
    if (remainingPaid <= 0) {
        console.log('   ⚠️  Tidak ada pembayaran tersisa — hanya amount_to_pay yang dikoreksi, status & paid_amount tidak dipaksa.');
    }

    if (!APPLY) {
        console.log('\n(DRY-RUN) Tidak ada perubahan. Jalankan ulang dengan `--apply` untuk eksekusi.');
        await prisma.$disconnect();
        return;
    }

    // 4) BACKUP baris terdampak ke file JSON
    const backup = {
        when: new Date().toISOString(),
        dbHost: dbHost(),
        invoice: inv,
        dupPayment,
        dupCashflow,
    };
    const backupPath = path.join(process.cwd(), `backup-hengtai-fix-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log(`\n[backup] baris terdampak disimpan → ${backupPath}`);

    // 5) Eksekusi dalam 1 transaksi
    await prisma.$transaction(async (tx) => {
        if (willDeletePayment) await (tx as any).invoicePayment.delete({ where: { id: DUP_PAYMENT_ID } });
        if (willDeleteCashflow) await tx.cashflow.delete({ where: { id: DUP_CASHFLOW_ID } });
        await tx.invoice.update({
            where: { id: INVOICE_ID },
            data: {
                amountToPay: targetAmount as any,
                // paid_amount & status hanya disentuh kalau ada pembayaran nyata tersisa.
                ...(remainingPaid > 0
                    ? { paidAmount: finalPaid as any, status: finalStatus as any }
                    : {}),
            } as any,
        });
    });

    // 6) Verifikasi akhir
    const after = await prisma.invoice.findUnique({ where: { id: INVOICE_ID } });
    console.log('\n✅ Selesai. State akhir invoice 192:');
    console.log(`   amount_to_pay = ${rp((after as any).amountToPay)}`);
    console.log(`   paid_amount   = ${rp((after as any).paidAmount)}`);
    console.log(`   status        = ${after!.status}`);
    const ok = Number((after as any).amountToPay) === targetAmount;
    console.log(ok ? '   ✔ nilai sesuai harapan' : '   ✘ nilai TIDAK sesuai — cek manual!');

    await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
