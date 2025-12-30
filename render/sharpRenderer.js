import sharp from 'sharp';
import { fetchImage } from '../utils/fetchImage.js';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, registerFont } from 'canvas';

/**
 * Dessine un texte multi-ligne centré horizontalement,
 * dont la position Y correspond à la BASELINE de la première ligne
 * (alignement identique au DOM / Shopify).
 */
function drawMultilineTextBaselineCentered(ctx, text, centerX, baselineY, options) {
  const {
    maxWidth,
    color,
    lineGap = 0
  } = options;

  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;

  // Découpage en lignes avec wrap
  const words = text.split(' ');
  const lines = [];
  let line = '';

  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);

  let currentY = baselineY;

  lines.forEach((l, i) => {
    const m = ctx.measureText(l);

    if (i === 0) {
      // 🔑 ALIGNEMENT BASELINE (DOM-compatible)
      currentY += m.actualBoundingBoxAscent;
    } else {
      currentY += m.actualBoundingBoxAscent + m.actualBoundingBoxDescent + lineGap;
    }

    ctx.fillText(l, centerX, currentY);
  });
}

export async function renderCardImage(payload) {
  const {
    background,
    userImage,
    crop,
    mask,
    target,
    texts,
    fontsFolder = './fonts'
  } = payload;

  /* ===========================
     0️⃣ REGISTER FONTS
     =========================== */
  const usedFamilies = Array.from(
    new Set(Object.values(texts).map(t => t.font.family))
  );

  usedFamilies.forEach(family => {
    const regex = new RegExp(`${family.replace(/\s+/g, '.*')}.*\\.(ttf|otf)$`, 'i');
    const file = fs.readdirSync(fontsFolder).find(f => regex.test(f));
    if (file) {
      registerFont(path.join(fontsFolder, file), { family });
    } else {
      console.warn(`⚠️ Font file not found for "${family}"`);
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

  const userFinalBuffer = await sharp(userBuffer)
    .extract({
      left: crop.x,
      top: crop.y,
      width: crop.width,
      height: crop.height
    })
    .resize(target.width, target.height)
    .png()
    .toBuffer();

  const userImg = await loadImage(userFinalBuffer);

  /* ===========================
     3️⃣ CREATE CANVAS
     =========================== */
  const canvas = createCanvas(background.width, background.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(bgImage, 0, 0);

  /* ===========================
     4️⃣ MASK (image utilisateur)
     =========================== */
  let finalUserImg = userImg;

  if (mask?.type === 'svg') {
    const userCanvas = createCanvas(target.width, target.height);
    const userCtx = userCanvas.getContext('2d');

    userCtx.drawImage(userImg, 0, 0);

    const maskSvg = `
      <svg width="${target.width}" height="${target.height}" viewBox="${mask.viewBox}" xmlns="http://www.w3.org/2000/svg">
        <path d="${mask.path}" fill="white"/>
      </svg>
    `;

    const maskRaster = await sharp(Buffer.from(maskSvg))
      .resize(target.width, target.height)
      .png()
      .toBuffer();

    const maskImg = await loadImage(maskRaster);

    userCtx.globalCompositeOperation = 'destination-in';
    userCtx.drawImage(maskImg, 0, 0);
    userCtx.globalCompositeOperation = 'source-over';

    finalUserImg = await loadImage(userCanvas.toBuffer());
  }

  ctx.drawImage(finalUserImg, target.x, target.y);

  /* ===========================
     5️⃣ TEXTES (BASELINE SHOPIFY)
     =========================== */
  Object.values(texts).forEach(t => {
    if (!t?.value) return;

    ctx.font = `${t.font.weight || 700} ${t.font.sizePx}px "${t.font.family}"`;

    const centerX = Math.round(background.width / 2);
    const baselineY = Math.round(t.y * background.height);

    drawMultilineTextBaselineCentered(ctx, t.value, centerX, baselineY, {
      maxWidth: Math.round(background.width * 0.86),
      color: t.color,
      lineGap: Math.round(t.font.sizePx * 0.25)
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
