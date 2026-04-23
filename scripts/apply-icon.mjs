// ─────────────────────────────────────────────
//  One-shot applier: take the definitive OPAL BAR icon (assets/ICONO 1.jpeg)
//  and fan it out to every native asset the app needs.
//
//  Outputs
//  · apps/mobile/assets/{icon,adaptive-icon,splash}.png
//  · Android legacy launcher  → mipmap-<d>/ic_launcher(.round)?.webp
//  · Android adaptive icon    → mipmap-<d>/ic_launcher_foreground.webp
//                               + mipmap-anydpi-v26/ic_launcher(_round).xml
//  · Android 12+ splash icon  → drawable/splashscreen_logo.png
//                               + styles.xml windowSplashScreenAnimatedIcon
//
//  The source image is a JPEG with *white* corners outside its rounded neon
//  frame. We don't want that white bleeding onto home-screen wallpapers, so
//  we crop the source to the visible neon frame with a rounded-rect mask
//  (same corner radius as the source art) before fanning out.
// ─────────────────────────────────────────────
import sharp from 'sharp';
import { promises as fs } from 'node:fs';
import path from 'node:path';

const SRC = path.resolve('apps/mobile/assets/ICONO 1.jpeg');
const ASSETS = path.resolve('apps/mobile/assets');
const RES = path.resolve('apps/mobile/android/app/src/main/res');
const BG = { r: 13, g: 13, b: 15, alpha: 1 }; // #0D0D0F

// The source art has ~7% padding between edge and its rounded neon frame.
// We trim that + add a rounded-rect mask matching the frame's radius (~12%).
const SRC_INSET = 0.93; // crop inward by (1 - 0.93) / 2 = 3.5% per side
const SRC_CORNER_R = 0.12;

// Prepare a transparent-corner version of the source art at `size` px, with
// rounded-rect mask applied. Returns a Buffer (PNG).
async function srcRounded(size) {
  const meta = await sharp(SRC).metadata();
  const w = meta.width ?? 0;
  const h = meta.height ?? 0;
  const side = Math.min(w, h);
  const inset = Math.round((side * (1 - SRC_INSET)) / 2);
  const cropLen = side - inset * 2;

  const cropped = await sharp(SRC)
    .extract({
      left: Math.round((w - side) / 2) + inset,
      top: Math.round((h - side) / 2) + inset,
      width: cropLen,
      height: cropLen,
    })
    .resize(size, size)
    .toBuffer();

  const r = Math.round(size * SRC_CORNER_R);
  const maskSvg = Buffer.from(
    `<svg width="${size}" height="${size}">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/>
    </svg>`,
  );

  return sharp(cropped)
    .ensureAlpha()
    .composite([{ input: maskSvg, blend: 'dest-in' }])
    .png()
    .toBuffer();
}

async function squareOnBg(size, scale) {
  const inner = Math.round(size * scale);
  const logo = await srcRounded(inner);
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function squareTransparent(size, scale) {
  const inner = Math.round(size * scale);
  const logo = await srcRounded(inner);
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toBuffer();
}

async function circleMask(size) {
  const r = size / 2;
  const svg = `<svg width="${size}" height="${size}"><circle cx="${r}" cy="${r}" r="${r}" fill="#fff"/></svg>`;
  return Buffer.from(svg);
}

// ── 1) App-level assets (Expo side) ───────────────────────────────────────
await fs.writeFile(path.join(ASSETS, 'icon.png'), await squareOnBg(1024, 0.96));
// Android adaptive-icon.png is consumed by some tooling — safe zone padding.
await fs.writeFile(path.join(ASSETS, 'adaptive-icon.png'), await squareOnBg(1024, 0.65));
await fs.writeFile(path.join(ASSETS, 'splash.png'), await squareOnBg(2048, 0.45));
console.log('  ✔ assets/{icon,adaptive-icon,splash}.png');

// ── 2) Android native launcher icons (legacy + adaptive foreground) ───────
const DENSITIES = {
  'mipmap-mdpi': { launcher: 48, foreground: 108 },
  'mipmap-hdpi': { launcher: 72, foreground: 162 },
  'mipmap-xhdpi': { launcher: 96, foreground: 216 },
  'mipmap-xxhdpi': { launcher: 144, foreground: 324 },
  'mipmap-xxxhdpi': { launcher: 192, foreground: 432 },
};

for (const [folder, { launcher, foreground }] of Object.entries(DENSITIES)) {
  const dir = path.join(RES, folder);
  await fs.mkdir(dir, { recursive: true });

  // Legacy launcher icons (for Android < 8 and as a fallback).
  const sq = await squareOnBg(launcher, 0.94);
  await fs.writeFile(
    path.join(dir, 'ic_launcher.webp'),
    await sharp(sq).webp({ quality: 92 }).toBuffer(),
  );
  const round = await sharp(sq)
    .composite([{ input: await circleMask(launcher), blend: 'dest-in' }])
    .webp({ quality: 92 })
    .toBuffer();
  await fs.writeFile(path.join(dir, 'ic_launcher_round.webp'), round);

  // Adaptive foreground — art fills ~62% of the 108dp canvas so the inner
  // neon frame stays inside the safe zone regardless of device mask shape.
  const fg = await squareTransparent(foreground, 0.62);
  await fs.writeFile(
    path.join(dir, 'ic_launcher_foreground.webp'),
    await sharp(fg).webp({ quality: 92 }).toBuffer(),
  );

  console.log(`  ✔ ${folder}: launcher ${launcher}px + fg ${foreground}px`);
}

// ── 3) Adaptive icon XML ──────────────────────────────────────────────────
const anydpi = path.join(RES, 'mipmap-anydpi-v26');
await fs.mkdir(anydpi, { recursive: true });
const adaptiveXml = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@drawable/ic_launcher_background" />
    <foreground android:drawable="@mipmap/ic_launcher_foreground" />
</adaptive-icon>
`;
await fs.writeFile(path.join(anydpi, 'ic_launcher.xml'), adaptiveXml);
await fs.writeFile(path.join(anydpi, 'ic_launcher_round.xml'), adaptiveXml);
console.log('  ✔ mipmap-anydpi-v26/ic_launcher(_round).xml');

// ── 4) Android 12+ splash icon ─────────────────────────────────────────────
// windowSplashScreenAnimatedIcon expects ~192dp canvas with content in the
// inner 96dp. We render at xxxhdpi density (432px canvas, art at ~0.45).
await fs.mkdir(path.join(RES, 'drawable-xxxhdpi'), { recursive: true });
const splashIcon = await squareTransparent(432, 0.45);
await fs.writeFile(path.join(RES, 'drawable-xxxhdpi', 'splashscreen_logo.png'), splashIcon);
await fs.writeFile(path.join(RES, 'drawable', 'splashscreen_logo.png'), splashIcon);
console.log('  ✔ drawable/splashscreen_logo.png (Android 12+ splash icon)');

console.log('\nDone.');
