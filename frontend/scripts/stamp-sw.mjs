// Inject unique build ID ke public/sw.js sebelum next build
// Tujuan: tiap deploy → CACHE_VERSION berubah → SW activate fresh, hapus cache lama
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const swPath = resolve(__dirname, '..', 'public', 'sw.js');

const buildId = String(Date.now()); // millisecond timestamp = unique per build
const content = readFileSync(swPath, 'utf8');

// Replace pattern: __BUILD_ID__ atau timestamp lama (digit string setelah pospro-v2-)
const updated = content.replace(
    /pospro-v2-(?:__BUILD_ID__|\d+)/,
    `pospro-v2-${buildId}`,
);

if (updated === content) {
    console.warn('[stamp-sw] No CACHE_VERSION pattern found in sw.js — skip');
    process.exit(0);
}

writeFileSync(swPath, updated, 'utf8');
console.log(`[stamp-sw] CACHE_VERSION → pospro-v2-${buildId}`);
