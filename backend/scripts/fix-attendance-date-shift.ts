/**
 * Migrasi koreksi GESER TANGGAL absensi & adjustment akibat bug timezone @db.Date lama.
 * Kode lama menyimpan tanggal MUNDUR 1 hari (mis. isi 13 → tersimpan 12) di server WIB.
 * Skrip ini menggeser data lama +1 hari agar selaras dengan kode yang sudah diperbaiki.
 *
 * KEAMANAN:
 *  - DRY-RUN default. Tanpa `--apply` tidak mengubah apa pun.
 *  - Backup baris terdampak ke JSON sebelum mutasi.
 *  - Hanya menggeser data yang dibuat SEBELUM cutoff (data baru sudah benar — jangan digeser dobel!).
 *  - Shift hari bisa diatur via SHIFT_DAYS (default +1).
 *
 * PENTING: jalankan HANYA SEKALI di tiap DB. Menjalankan dua kali = geser dobel.
 * Verifikasi dulu di DRY-RUN bahwa tanggal "sdebelum→sesudah" sesuai realita.
 *
 * Preview : npx ts-node --project tsconfig.seed.json scripts/fix-attendance-date-shift.ts
 * Eksekusi: npx ts-node --project tsconfig.seed.json scripts/fix-attendance-date-shift.ts --apply
 */
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();
const APPLY = process.argv.includes('--apply');
const SHIFT_DAYS = 1; // geser +1 hari

// Cutoff: hanya geser baris yang DIBUAT sebelum waktu ini (data lama buggy).
// Set ke ISO string saat deploy fix. Default: sekarang via env, fallback longgar.
const CUTOFF = process.env.SHIFT_CUTOFF || '2026-06-18T12:00:00Z';

function dbHost(): string {
    try { return new URL(process.env.DATABASE_URL || '').host || '(?)'; } catch { return '(?)'; }
}

async function main() {
    console.log(`\n=== Koreksi geser tanggal absensi — DB host: ${dbHost()} ===`);
    console.log(`Shift: +${SHIFT_DAYS} hari · cutoff createdAt < ${CUTOFF}`);
    console.log(APPLY ? '⚠️  MODE: --apply (MENGUBAH data)\n' : 'MODE: DRY-RUN (preview saja)\n');

    const cutoff = new Date(CUTOFF);

    // Ambil baris yang akan digeser (recordedAt < cutoff untuk attendance, createdAt < cutoff untuk adjustment)
    const att = await prisma.attendance.findMany({
        where: { recordedAt: { lt: cutoff } },
        select: { id: true, attendanceDate: true, recordedAt: true, workerId: true },
        orderBy: { attendanceDate: 'asc' },
    });
    const adj = await prisma.payrollAdjustment.findMany({
        where: { createdAt: { lt: cutoff } },
        select: { id: true, effectiveDate: true, createdAt: true, workerId: true },
        orderBy: { effectiveDate: 'asc' },
    });

    const iso = (d: Date) => d.toISOString().slice(0, 10);
    const shifted = (d: Date) => { const n = new Date(d); n.setUTCDate(n.getUTCDate() + SHIFT_DAYS); return n; };

    console.log(`Attendance terdampak: ${att.length} baris`);
    const sample = att.slice(0, 12);
    for (const a of sample) console.log(`  id=${a.id} worker=${a.workerId}: ${iso(a.attendanceDate)} → ${iso(shifted(a.attendanceDate))}`);
    if (att.length > sample.length) console.log(`  ...dan ${att.length - sample.length} lagi`);
    console.log(`Adjustment terdampak: ${adj.length} baris`);

    if (!APPLY) {
        console.log('\n(DRY-RUN) Tidak ada perubahan. Periksa kolom "sebelum → sesudah" di atas.');
        console.log('Kalau sudah sesuai realita, jalankan ulang dengan `--apply`.');
        await prisma.$disconnect();
        return;
    }

    // Backup
    const backup = { when: new Date().toISOString(), dbHost: dbHost(), shiftDays: SHIFT_DAYS, cutoff: CUTOFF, attendance: att, adjustment: adj };
    const backupPath = path.join(process.cwd(), `backup-attendance-shift-${Date.now()}.json`);
    fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2));
    console.log(`\n[backup] → ${backupPath}`);

    // Eksekusi dalam transaksi. attendance punya unique (workerId, attendanceDate):
    // geser dari tanggal TERBESAR dulu untuk hindari bentrok sementara.
    await prisma.$transaction(async (tx) => {
        for (const a of [...att].sort((x, y) => y.attendanceDate.getTime() - x.attendanceDate.getTime())) {
            await tx.attendance.update({ where: { id: a.id }, data: { attendanceDate: shifted(a.attendanceDate) } });
        }
        for (const a of adj) {
            await tx.payrollAdjustment.update({ where: { id: a.id }, data: { effectiveDate: shifted(a.effectiveDate) } });
        }
    }, { timeout: 60_000, maxWait: 15_000 });

    console.log(`✅ Selesai. ${att.length} attendance + ${adj.length} adjustment digeser +${SHIFT_DAYS} hari.`);
    await prisma.$disconnect();
}

main().catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
