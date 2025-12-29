import sharp from 'sharp';
import { fetchImage } from '../utils/fetchImage.js';
import fs from 'fs';
import path from 'path';

function buildTextsSvg({ texts, width, height }) {
  const entries = Object.values(texts);

  const svgTexts = entries.map(t => {
    if (!t?.value) return '';

    const yPx = Math.round(t.y * height);

    return `
      <text
        x="50%"
        y="${yPx}"
        text-anchor="middle"
        dominant-baseline="middle"
        font-family="${t.font.family}"
        font-size="${t.font.sizePx}"
        font-weight="${t.font.weight}"
        fill="${t.color}"
      >
        ${escapeXml(t.value)}
      </text>
    `;
  }).join('\n');

  return Buffer.from(`
    <svg
      width="${width}"
      height="${height}"
      xmlns="http://www.w3.org/2000/svg"
    >
      ${svgTexts}
    </svg>
  `);
}

function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function renderCardImage(payload) {
  const debugPath = '/tmp'; // chemin pour sauver les fichiers de debug
  const {
    background,
    userImage,
    crop,
    mask,
    target,
    texts
  } = payload;

  /* ===========================
     1️⃣ BACKGROUND
     =========================== */
  const bgBuffer = await sharp(await fetchImage(background.url))
    .resize(background.width, background.height, { fit: 'cover' })
    .png()
    .toBuffer();

  /* ===========================
     2️⃣ IMAGE UTILISATEUR
     =========================== */
  const userBuffer = Buffer.from(userImage.dataUrl.split(',')[1], 'base64');
  console.log('userBuffer length:', userBuffer.length);

  let userSharp = sharp(userBuffer);
  const metadata = await userSharp.metadata();
  console.log('user image metadata:', metadata);

  /* ===========================
     3️⃣ CROP + DÉZOOM + DEBUG
     =========================== */
  const MIN_SIZE = 1;

  const canvasWidth = Math.max(crop.width, crop.x + metadata.width, metadata.width);
  const canvasHeight = Math.max(crop.height, crop.y + metadata.height, metadata.height);

  const imageLeft = crop.x < 0 ? -crop.x : 0;
  const imageTop = crop.y < 0 ? -crop.y : 0;

  console.log('Crop:', crop);
  console.log('Canvas size:', canvasWidth, canvasHeight);
  console.log('Image placement on canvas:', imageLeft, imageTop);

  const canvas = sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  }).composite([
    {
      input: await userSharp.png().toBuffer(),
      left: imageLeft,
      top: imageTop
    }
  ]);

  await canvas.toFile(path.join(debugPath, 'debug_canvas.png'));
  console.log('Canvas saved: debug_canvas.png');

  const extracted = canvas.extract({
    left: Math.max(crop.x, 0),
    top: Math.max(crop.y, 0),
    width: crop.width,
    height: crop.height
  });

  await extracted.toFile(path.join(debugPath, 'debug_extract.png'));
  console.log('Extracted crop saved: debug_extract.png');

  const resized = extracted.resize(target.width, target.height);
  await resized.toFile(path.join(debugPath, 'debug_resized.png'));
  console.log('Resized crop saved: debug_resized.png');

  /* ===========================
     4️⃣ MASQUE (SVG)
     =========================== */
  if (mask?.type === 'svg') {
    const svgMask = `
      <svg
        width="${target.width}"
        height="${target.height}"
        viewBox="${mask.viewBox}"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="${mask.path}" fill="white"/>
      </svg>
    `;
    userSharp = sharp(await resized.png().toBuffer())
      .composite([
        {
          input: Buffer.from(svgMask),
          blend: 'dest-in'
        }
      ]);
  } else {
    userSharp = sharp(await resized.png().toBuffer());
  }

  const userFinal = await userSharp.png().toBuffer();

  /* ===========================
     5️⃣ COMPOSITE FINAL + TEXTES
     =========================== */
  const textSvg = buildTextsSvg({
    texts,
    width: background.width,
    height: background.height
  });

  const finalImage = await sharp(bgBuffer)
    .composite([
      { input: userFinal, left: target.x, top: target.y },
      { input: textSvg, blend: 'over' }
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  // Sauvegarde pour debug final
  await sharp(finalImage).toFile(path.join(debugPath, 'debug_final.png'));
  console.log('Final composite saved: debug_final.png');

  return {
    buffer: finalImage,
    width: background.width,
    height: background.height
  };
}