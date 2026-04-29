// One-shot script: generate PWA icons dari icon.svg di frontend/public
// Run: cd backend && node scripts/gen-pwa-icons.mjs
import sharp from "sharp";
import { readFileSync, copyFileSync } from "fs";
import { resolve, join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const FRONTEND_PUB = resolve(__dirname, "..", "..", "frontend", "public");
const svg = readFileSync(join(FRONTEND_PUB, "icon.svg"));

const sizes = [
    { size: 192, name: "icon-192.png" },
    { size: 512, name: "icon-512.png" },
    { size: 180, name: "apple-touch-icon.png" },
    { size: 32, name: "favicon-32.png" },
    { size: 16, name: "favicon-16.png" },
];

for (const { size, name } of sizes) {
    await sharp(svg)
        .resize(size, size)
        .png({ compressionLevel: 9 })
        .toFile(join(FRONTEND_PUB, name));
    console.log(`OK ${name} (${size}x${size})`);
}

await sharp(svg)
    .resize(410, 410)
    .extend({ top: 51, bottom: 51, left: 51, right: 51, background: "#3b82f6" })
    .png({ compressionLevel: 9 })
    .toFile(join(FRONTEND_PUB, "icon-maskable-512.png"));
console.log("OK icon-maskable-512.png");

copyFileSync(join(FRONTEND_PUB, "favicon-32.png"), join(FRONTEND_PUB, "favicon.ico"));
console.log("OK favicon.ico");
