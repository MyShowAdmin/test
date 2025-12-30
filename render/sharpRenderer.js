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
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
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
  console.log('📦 PAYLOAD', payload);

  const {
    background,
    userImage,
    target,
    transform,
    mask,
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

  const userBuffer = Buffer.from(
    userImage.dataUrl.split(',')[1],
    'base64'
  );

  /* ===========================
     3️⃣ CANVAS TRANSPARENT (ZONE IMAGE)
     =========================== */

  let userCanvas = sharp({
    create: {
      width: target.width,
      height: target.height,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 }
    }
  });

  /* ===========================
     4️⃣ IMAGE TRANSFORMÉE
     =========================== */

  const resizedUser = await sharp(userBuffer)
    .resize(
      Math.round(transform.imageWidth * transform.scale),
      Math.round(transform.imageHeight * transform.scale)
    )
    .png()
    .toBuffer();

  userCanvas = userCanvas.composite([
    {
      input: resizedUser,
      left: Math.round(transform.translateX),
      top: Math.round(transform.translateY)
    }
  ]);

  /* ===========================
     5️⃣ MASQUE (SVG)
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

    userCanvas = userCanvas.composite([
      {
        input: Buffer.from(svgMask),
        blend: 'dest-in'
      }
    ]);
  }

  const userFinal = await userCanvas.png().toBuffer();

  /* ===========================
     6️⃣ TEXTES
     =========================== */

  const textSvg = buildTextsSvg({
    texts,
    width: background.width,
    height: background.height
  });

  /* ===========================
     7️⃣ COMPOSITION FINALE
     =========================== */

  const finalImage = await sharp(bgBuffer)
    .composite([
      {
        input: userFinal,
        left: target.x,
        top: target.y
      },
      {
        input: textSvg,
        blend: 'over'
      }
    ])
    .jpeg({ quality: 92 })
    .toBuffer();

  return {
    buffer: finalImage,
    width: background.width,
    height: background.height
  };
}