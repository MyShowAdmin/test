import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage, registerFont } from 'canvas';
import { fetchImage } from '../utils/fetchImage.js';

/* ===========================
   UTILS
   =========================== */

/**
 * Convertit une zone relative (0–1) en pixels selon le background.
 */
function zoneToPixels(zone, bg) {
  return {
    x: Math.round(zone.x * bg.width),
    y: Math.round(zone.y * bg.height),
    width: Math.round(zone.width * bg.width),
    height: Math.round(zone.height * bg.height)
  };
}

/**
 * Texte multi-ligne, centré horizontalement, positionné par BASELINE (Shopify like)
 */
function drawMultilineTextBaselineCentered(ctx, text, centerX, baselineY, options) {
  const {
    maxWidth,
    color,
    baselinesY = null,
    leadingRatio = 0.22
  } = options;

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = color;

  // Découpage en lignes avec wrap
  const paragraphs = text.split('\n');
  const lines = [];

  paragraphs.forEach(p => {
    const words = p.split(' ');
    let line = '';

    words.forEach(word => {
      const test = line ? `${line} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    });

    if (line) lines.push(line);
  });

  const ref = ctx.measureText('Hg');
  const lineHeight =
    ref.actualBoundingBoxAscent +
    ref.actualBoundingBoxDescent;

  const leading = Math.round(lineHeight * leadingRatio);

  let currentY = Number.isFinite(baselineY) ? baselineY : 0;

  lines.forEach((l, i) => {
  const m = ctx.measureText(l);

  if (Array.isArray(baselinesY) && baselinesY.length && baselinesY[i] != null) {
    // 🔑 Shopify donne un TOP → on convertit en BASELINE
    currentY = baselinesY[i] + m.actualBoundingBoxAscent/2;
  } else {
    if (i === 0) {
      // 🔑 baselineY est aussi un TOP
      currentY = baselineY + m.actualBoundingBoxAscent;
    } else {
      currentY += lineHeight + leading;
    }
  }

  const x = Math.round(centerX - m.width / 2);
  ctx.fillText(l, x, currentY);
});

}

/* ===========================
   RENDER FINAL
   =========================== */

export async function renderCardImage(payload) {
  const {
    background,
    imageZone,
    userImage,
    mask,
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
     BACKGROUND
     =========================== */
  const bgBuffer = await sharp(await fetchImage(background.url))
    .resize(background.width, background.height, { fit: 'cover' })
    .png()
    .toBuffer();

  const bgImage = await loadImage(bgBuffer);

  /* ===========================
     IMAGE ZONE
     =========================== */
  const zonePx = zoneToPixels(imageZone, background);

  /* ===========================
     IMAGE USER (scale réel)
     =========================== */
  // userImage: {
  //   dataUrl OR path,
  //   realSize: { width, height },
  //   offset: { x, y }
  // }

  let userSourceBuffer;

  if (userImage.dataUrl) {
    userSourceBuffer = Buffer.from(userImage.dataUrl.split(',')[1], 'base64');
  } else if (userImage.path) {
    userSourceBuffer = fs.readFileSync(userImage.path);
  } else {
    throw new Error('❌ userImage must contain dataUrl or path');
  }

  const userScaled = await sharp(userSourceBuffer)
    .resize(
      Math.round(userImage.realSize.width),
      Math.round(userImage.realSize.height)
    )
    .png()
    .toBuffer();

  const userImg = await loadImage(userScaled);

  /* ===========================
     CANVAS OFFSCREEN (zone)
     =========================== */
  const offCanvas = createCanvas(
    Math.round(zonePx.width),
    Math.round(zonePx.height)
  );
  const offCtx = offCanvas.getContext('2d');

  const offset = {
    x: userImage.offset?.x || 0,
    y: userImage.offset?.y || 0
  };

  // Ancrage haut-gauche + compensation offset (logique locale)
  offCtx.drawImage(
    userImg,
    Math.round(-offset.x),
    Math.round(-offset.y)
  );

  /* ===========================
     MASK SVG
     =========================== */
  if (mask?.type === 'svg') {
    const svg = `
      <svg width="${zonePx.width}" height="${zonePx.height}" viewBox="${mask.viewBox}"
           xmlns="http://www.w3.org/2000/svg">
        <path d="${mask.path}" fill="white"/>
      </svg>
    `;

    const maskRaster = await sharp(Buffer.from(svg))
      .resize(zonePx.width, zonePx.height)
      .png()
      .toBuffer();

    const maskImg = await loadImage(maskRaster);

    offCtx.globalCompositeOperation = 'destination-in';
    offCtx.drawImage(maskImg, 0, 0);
    offCtx.globalCompositeOperation = 'source-over';
  }

  /* ===========================
     COMPOSITION FINALE
     =========================== */
  const composed = await sharp(bgBuffer)
    .composite([
      {
        input: offCanvas.toBuffer(),
        left: zonePx.x,
        top: zonePx.y
      }
    ])
    .png()
    .toBuffer();

  /* ===========================
     TEXTES
     =========================== */
  const canvas = createCanvas(background.width, background.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(await loadImage(composed), 0, 0);

  Object.values(texts).forEach(t => {
    if (!t?.value) return;

    ctx.font = `${t.font.weight || 700} ${t.font.sizePx}px "${t.font.family}"`;
    console.log(ctx.font)
    const centerX = Math.round(background.width / 2);

    const baselineY = Array.isArray(t.baselinesY) && t.baselinesY.length
      ? 0
      : Math.round((t.y ?? 0.5) * background.height);

    console.log(baselineY)

    drawMultilineTextBaselineCentered(ctx, t.value, centerX, baselineY, {
      maxWidth: Math.round(background.width * 0.86),
      color: t.color,
      baselinesY: t.baselinesY || null
    });
  });

  /* ===========================
     OUTPUT
     =========================== */
  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.92 });

  return {
    buffer,
    width: background.width,
    height: background.height
  };
}
