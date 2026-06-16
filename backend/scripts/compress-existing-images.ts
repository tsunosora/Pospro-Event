/**
 * Backfill: kompres semua gambar lama di public/uploads (sekali jalan).
 *
 * Memakai util yang sama dengan upload baru (compressImage), jadi hasilnya konsisten:
 * auto-resize maks 1200px, kualitas 80%, mozjpeg. GIF dilewati (animasi).
 *
 * Pemakaian:
 *   npm run compress:images            # kompres beneran (in-place)
 *   npm run compress:images -- --dry-run   # hanya tampilkan estimasi, tidak mengubah file
 *
 * Aman diulang: kalau dijalankan dua kali, gambar yang sudah kecil hanya
 * dire-encode ulang (penghematan mendekati nol). File otomatis di-backup
 * sementara oleh util (pakai .tmp + rename), jadi tidak ada file rusak separuh.
 */
import * as fs from 'fs';
import * as path from 'path';
import { compressImage } from '../src/common/utils/compress-image.util';

const UPLOADS_DIR = path.join(__dirname, '..', 'public', 'uploads');
const IMAGE_EXT = new Set(['.jpg', '.jpeg', '.jfif', '.png', '.webp']); // .gif sengaja dilewati
const DRY_RUN = process.argv.includes('--dry-run');

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(full));
    } else if (IMAGE_EXT.has(path.extname(entry.name).toLowerCase())) {
      out.push(full);
    }
  }
  return out;
}

function fmt(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

async function main() {
  if (!fs.existsSync(UPLOADS_DIR)) {
    console.error(`❌ Folder tidak ditemukan: ${UPLOADS_DIR}`);
    process.exit(1);
  }

  const files = walk(UPLOADS_DIR);
  console.log(`📂 ${UPLOADS_DIR}`);
  console.log(`🖼️  ${files.length} file gambar ditemukan${DRY_RUN ? ' (DRY RUN — tidak ada yang diubah)' : ''}\n`);

  let totalBefore = 0;
  let totalAfter = 0;
  let processed = 0;
  let skipped = 0;
  let failed = 0;

  for (const file of files) {
    const before = fs.statSync(file).size;
    totalBefore += before;

    if (DRY_RUN) {
      totalAfter += before;
      continue;
    }

    try {
      await compressImage(file);
      const after = fs.statSync(file).size;
      totalAfter += after;
      processed++;

      const saved = before - after;
      if (saved > 0) {
        const pct = ((saved / before) * 100).toFixed(0);
        console.log(`  ✔ ${path.relative(UPLOADS_DIR, file)}  ${fmt(before)} → ${fmt(after)}  (-${pct}%)`);
      } else {
        skipped++;
      }
    } catch (err) {
      failed++;
      totalAfter += before;
      console.error(`  ✗ GAGAL ${path.relative(UPLOADS_DIR, file)}:`, (err as Error).message);
    }
  }

  const saved = totalBefore - totalAfter;
  const pct = totalBefore > 0 ? ((saved / totalBefore) * 100).toFixed(1) : '0';

  console.log('\n────────────────────────────────────────');
  if (DRY_RUN) {
    console.log(`Total ukuran saat ini : ${fmt(totalBefore)}`);
    console.log(`Jalankan tanpa --dry-run untuk mengompres.`);
  } else {
    console.log(`Diproses : ${processed}  |  Tanpa perubahan : ${skipped}  |  Gagal : ${failed}`);
    console.log(`Sebelum  : ${fmt(totalBefore)}`);
    console.log(`Sesudah  : ${fmt(totalAfter)}`);
    console.log(`Hemat    : ${fmt(saved)} (-${pct}%)`);
  }
  console.log('────────────────────────────────────────');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
