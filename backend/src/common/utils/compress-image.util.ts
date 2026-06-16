// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp: (input: string) => import('sharp').Sharp = require('sharp');
import * as path from 'path';
import * as fs from 'fs';

const MAX_DIMENSION = 1200;
const JPEG_QUALITY  = 80;
const WEBP_QUALITY  = 80;
const PNG_QUALITY   = 80;

export async function compressImage(filePath: string): Promise<void> {
  const ext = path.extname(filePath).toLowerCase();

  // GIF tidak diproses (animasi bisa rusak)
  if (ext === '.gif') return;

  const image = sharp(filePath).rotate(); // auto-fix EXIF orientation

  const meta = await image.metadata();
  const needsResize =
    (meta.width && meta.width > MAX_DIMENSION) ||
    (meta.height && meta.height > MAX_DIMENSION);

  if (needsResize) {
    image.resize(MAX_DIMENSION, MAX_DIMENSION, { fit: 'inside', withoutEnlargement: true });
  }

  if (ext === '.png') {
    image.png({ quality: PNG_QUALITY, compressionLevel: 9 });
  } else if (ext === '.webp') {
    image.webp({ quality: WEBP_QUALITY });
  } else {
    // .jpg / .jpeg / .jfif
    image.jpeg({ quality: JPEG_QUALITY, mozjpeg: true });
  }

  const tmpPath = filePath + '.tmp';
  await image.toFile(tmpPath);
  fs.renameSync(tmpPath, filePath);
}

/**
 * Kompres satu / banyak file hasil upload multer (in-place) tanpa pernah melempar error.
 * Aman dipanggil di handler setelah upload:
 *  - file `undefined` / array kosong → dilewati
 *  - file tanpa `path` (mis. memoryStorage) → dilewati
 *  - kalau kompres gagal, upload TIDAK digagalkan (hanya dicatat ke log)
 */
export async function compressUploaded(
  files:
    | { path?: string }
    | Array<{ path?: string } | undefined>
    | undefined
    | null,
): Promise<void> {
  if (!files) return;
  const list = Array.isArray(files) ? files : [files];
  await Promise.all(
    list.map(async (f) => {
      if (!f?.path) return;
      try {
        await compressImage(f.path);
      } catch (err) {
        // Jangan gagalkan upload hanya karena kompresi gagal
        console.error(`[compressUploaded] gagal kompres ${f.path}:`, err);
      }
    }),
  );
}
