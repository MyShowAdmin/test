import sharp from 'sharp';
import { fetchImage } from '../utils/fetchImage.js';

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
  let userSharp = sharp(userBuffer);
  const metadata = await userSharp.metadata();

  /* ===========================
     3️⃣ CROP + DÉZOOM
     =========================== */
  const MIN_SIZE = 1;

  // Canvas assez grand pour contenir l'image et le crop
  const canvasWidth = Math.max(crop.width, crop.x + metadata.width, metadata.width);
  const canvasHeight = Math.max(crop.height, crop.y + metadata.height, metadata.height);

  // Position de l'image sur le canvas
  const imageLeft = crop.x < 0 ? -crop.x : 0;
  const imageTop = crop.y < 0 ? -crop.y : 0;

  // Créer le canvas transparent et placer l'image dessus
  userSharp = sharp({
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

  // Extraire la zone crop (toujours valide)
  userSharp = userSharp.extract({
    left: Math.max(crop.x, 0),
    top: Math.max(crop.y, 0),
    width: crop.width,
    height: crop.height
  }).resize(target.width, target.height);

  /* ===========================
     4️⃣ MASQUE
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
    userSharp = userSharp.composite([
      {
        input: Buffer.from(svgMask),
        blend: 'dest-in'
      }
    ]);
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

  return {
    buffer: finalImage,
    width: background.width,
    height: background.height
  };
}