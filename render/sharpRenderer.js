import sharp from 'sharp';
import { fetchImage } from '../utils/fetchImage.js';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, registerFont } from 'canvas';

export async function renderCardImage(payload) {
  const { background, userImage, crop, mask, target, texts, fontsFolder = './fonts' } = payload;

  /* ===========================
     0️⃣ REGISTER FONTS
     =========================== */
  const usedFamilies = Array.from(new Set(Object.values(texts).map(t => t.font.family)));
  usedFamilies.forEach(family => {
    const regex = new RegExp(`${family.replace(/\s+/g, '.*')}.*\\.(ttf|otf)$`, 'i');
    const file = fs.readdirSync(fontsFolder).find(f => regex.test(f));
    if (file) {
      registerFont(path.join(fontsFolder, file), { family });
    } else {
      console.log(`⚠️ Font file not found for "${family}"`);
    }
  });

  /* ===========================
     1️⃣ BACKGROUND
     =========================== */
  const bgBuffer = await sharp(await fetchImage(background.url))
    .resize(background.width, background.height, { fit: 'cover' })
    .png()
    .toBuffer();
  const bgImage = await loadImage(bgBuffer);

  /* ===========================
     2️⃣ USER IMAGE
     =========================== */
  const userBuffer = Buffer.from(userImage.dataUrl.split(',')[1], 'base64');
  let userSharp = sharp(userBuffer).extract({
    left: crop.x,
    top: crop.y,
    width: crop.width,
    height: crop.height
  }).resize(target.width, target.height);
  const userFinalBuffer = await userSharp.png().toBuffer();
  const userImg = await loadImage(userFinalBuffer);

  /* ===========================
     3️⃣ CREATE CANVAS
     =========================== */
  const canvas = createCanvas(background.width, background.height);
  const ctx = canvas.getContext('2d');

  // Fond transparent + background
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bgImage, 0, 0);

  // Utilisateur
  ctx.drawImage(userImg, target.x, target.y);

  /* ===========================
     4️⃣ MASK (SVG → raster)
     =========================== */
  if (mask?.type === 'svg') {
    const maskSvg = `
      <svg width="${target.width}" height="${target.height}" viewBox="${mask.viewBox}" xmlns="http://www.w3.org/2000/svg">
        <path d="${mask.path}" fill="white"/>
      </svg>
    `;
    const maskBuffer = Buffer.from(maskSvg);
    const maskRaster = await sharp(maskBuffer)
      .resize(target.width, target.height)
      .png()
      .toBuffer();
    const maskImg = await loadImage(maskRaster);

    // Appliquer le masque via composition
    ctx.globalCompositeOperation = 'destination-in';
    ctx.drawImage(maskImg, target.x, target.y);
    ctx.globalCompositeOperation = 'source-over';
  }

  /* ===========================
     5️⃣ TEXTES
     =========================== */
  Object.values(texts).forEach(t => {
    if (!t?.value) return;

    ctx.font = `${t.font.weight || 400} ${t.font.sizePx}px "${t.font.family}"`;
    ctx.fillStyle = t.color;
    ctx.textAlign = 'center';
    const yPx = Math.round(t.y * background.height);
    ctx.fillText(t.value, background.width / 2, yPx);
  });

  /* ===========================
     6️⃣ OUTPUT
     =========================== */
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.92 });
  return {
    buffer,
    width: background.width,
    height: background.height
  };
}