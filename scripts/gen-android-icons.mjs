import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('apps/mobile/assets/icon.png');
const RES = path.resolve('apps/mobile/android/app/src/main/res');

const SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

async function roundMask(size) {
  const r = size / 2;
  const svg = `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`;
  return Buffer.from(svg);
}

for (const [folder, size] of Object.entries(SIZES)) {
  const dir = path.join(RES, folder);
  await fs.mkdir(dir, { recursive: true });

  const square = await sharp(SRC).resize(size, size, { fit: 'cover' }).webp({ quality: 92 }).toBuffer();
  await fs.writeFile(path.join(dir, 'ic_launcher.webp'), square);

  const mask = await roundMask(size);
  const round = await sharp(SRC)
    .resize(size, size, { fit: 'cover' })
    .composite([{ input: mask, blend: 'dest-in' }])
    .webp({ quality: 92 })
    .toBuffer();
  await fs.writeFile(path.join(dir, 'ic_launcher_round.webp'), round);

  console.log(`  ✔ ${folder}: ${size}x${size}`);
}

console.log('\nDone.');
