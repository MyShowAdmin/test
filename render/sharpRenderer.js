import sharp from 'sharp';
import { fetchImage } from '../utils/fetchImage.js';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, registerFont } from 'canvas';

function drawMultilineText(ctx, text, x, y, options) {
  const {
    maxWidth,
    lineHeight,
    align = 'center',
    color,
    lift = 0
  } = options;

  ctx.textAlign = align;
  ctx.textBaseline = 'top';
  ctx.fillStyle = color;

  const words = text.split(' ');
  const lines = [];
  let line = '';

  words.forEach(word => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = testLine;
    }
  });
  lines.push(line);

  const totalHeight = lines.length * lineHeight;
  let startY = y - totalHeight / 2 - lift;

  lines.forEach((l, i) => {
    ctx.fillText(l, x, startY + i * lineHeight);
  });
}


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

  // Dessiner le background
  ctx.drawImage(bgImage, 0, 0);

  /* ===========================
     4️⃣ MASK (appliqué uniquement sur l'image utilisateur)
     =========================== */
  let finalUserImg = userImg;

  if (mask?.type === 'svg') {
    // Canvas temporaire pour appliquer le masque
    const userCanvas = createCanvas(target.width, target.height);
    const userCtx = userCanvas.getContext('2d');

    userCtx.drawImage(userImg, 0, 0);

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

    userCtx.globalCompositeOperation = 'destination-in';
    userCtx.drawImage(maskImg, 0, 0);
    userCtx.globalCompositeOperation = 'source-over';

    finalUserImg = await loadImage(userCanvas.toBuffer());
  }

  // Dessiner l'image utilisateur masquée sur le canvas principal
  ctx.drawImage(finalUserImg, target.x, target.y);

/* ===========================
   5️⃣ TEXTES (MULTI-LIGNES STABLES)
   =========================== */
   Object.values(texts).forEach(t => {
    if (!t?.value) return;
  
    ctx.font = `${t.font.weight || 700} ${t.font.sizePx}px "${t.font.family}"`;
  
    const xPx = Math.round(background.width / 2);
    const yPx = Math.round(t.y * background.height);
  
    const lift = t.font.sizePx >= 48 ? t.font.sizePx * 0.2 : 0;
  
    drawMultilineText(ctx, t.value, xPx, yPx, {
      maxWidth: background.width * 0.8,
      lineHeight: t.font.sizePx * 1.2,
      align: 'center',
      color: t.color,
      lift
    });
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