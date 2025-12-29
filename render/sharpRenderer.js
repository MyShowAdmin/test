
import sharp from 'sharp';
import { fetchImage } from '../utils/fetchImage.js';

function buildTextsSvg({ texts, width, height }) {
  const entries = Object.values(texts); // name, dates, message

  const svgTexts = entries.map(t => {
    if (!t?.value) return '';

    const yPx = Math.round((t.y) * height);

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
    console.log(payload)
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

    const userBuffer = Buffer.from(
      userImage.dataUrl.split(',')[1],
      'base64'
    );

    let userSharp = sharp(userBuffer);

    /* ===========================
       3️⃣ CROP
       =========================== */

          const MIN_SIZE = 1;

    let left = Math.round(crop.x);
    let top = Math.round(crop.y);
    let width = Math.round(crop.width);
    let height = Math.round(crop.height);

    // clamp négatifs
    if (left < 0) {
      width += left;
      left = 0;
    }
    if (top < 0) {
      height += top;
      top = 0;
    }

    // clamp image bounds
    width = Math.min(width, metadata.width - left);
    height = Math.min(height, metadata.height - top);

    // sécurité Sharp absolue
    width = Math.max(MIN_SIZE, width);
    height = Math.max(MIN_SIZE, height);

    userSharp = userSharp.extract({
      left,
      top,
      width,
      height
    });

    /* ===========================
       4️⃣ RESIZE → TARGET
       =========================== */

    userSharp = userSharp.resize(target.width, target.height);

    /* ===========================
       5️⃣ MASQUE
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

    /* ===========================
       6️⃣ COMPOSITE FINAL
       =========================== */

    const userFinal = await userSharp.png().toBuffer();

    /* ===========================
      6️⃣.1 TEXTES (SVG)
      =========================== */

    const textSvg = buildTextsSvg({
      texts,          // ← envoyé depuis le front
      width: background.width,
      height: background.height
    });

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