import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('apps/mobile/assets/ICONOS/ICONO OPAL.jpeg');
const ASSETS = path.resolve('apps/mobile/assets');
const RES = path.resolve('apps/mobile/android/app/src/main/res');
const BG = { r: 13, g: 13, b: 15, alpha: 1 }; // #0D0D0F — matches app.json

// Fit the cocktail into a square canvas with a bit of breathing room.
async function squareFit(size, scale = 0.92) {
  const inner = Math.round(size * scale);
  const resized = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: BG })
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: resized, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function roundMask(size) {
  const r = size / 2;
  const svg = `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`;
  return Buffer.from(svg);
}

// ── 1) App-level assets (icon.png, adaptive-icon.png, splash.png) ──────────
const icon1024 = await squareFit(1024, 0.92);
await fs.writeFile(path.join(ASSETS, 'icon.png'), icon1024);

// adaptive-icon needs more padding — Android crops heavily.
const adaptive1024 = await squareFit(1024, 0.68);
await fs.writeFile(path.join(ASSETS, 'adaptive-icon.png'), adaptive1024);

// Splash: keep the 2048 canvas, cocktail centered at ~45% size.
const splash2048 = await squareFit(2048, 0.45);
await fs.writeFile(path.join(ASSETS, 'splash.png'), splash2048);

console.log('  ✔ icon.png (1024)');
console.log('  ✔ adaptive-icon.png (1024, padded)');
console.log('  ✔ splash.png (2048)');

// ── 2) Android native mipmaps ──────────────────────────────────────────────
const SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

for (const [folder, size] of Object.entries(SIZES)) {
  const dir = path.join(RES, folder);
  await fs.mkdir(dir, { recursive: true });

  const squareBuf = await squareFit(size, 0.9);
  await fs.writeFile(
    path.join(dir, 'ic_launcher.webp'),
    await sharp(squareBuf).webp({ quality: 92 }).toBuffer(),
  );

  const mask = await roundMask(size);
  const roundBuf = await sharp(squareBuf)
    .composite([{ input: mask, blend: 'dest-in' }])
    .webp({ quality: 92 })
    .toBuffer();
  await fs.writeFile(path.join(dir, 'ic_launcher_round.webp'), roundBuf);

  console.log(`  ✔ ${folder}: ${size}x${size}`);
}

console.log('\nDone.');
