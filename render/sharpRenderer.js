import sharp from 'sharp';
import { fetchImage } from '../utils/fetchImage.js';
import fs from 'fs';
import path from 'path';

function fontToBase64(fontPath) {
  const fontBuffer = fs.readFileSync(fontPath);
  return fontBuffer.toString('base64');
}

function buildTextsSvg({ texts, width, height }) {

  // mapping police → fichier local
  const FONT_MAP = {
    'Playfair Display': 'PlayfairDisplay-Regular.ttf',
    'Montserrat': 'Montserrat-Regular.ttf',
    'Roboto': 'Roboto-Regular.ttf'
  };

  const usedFonts = new Set(
    Object.values(texts)
      .filter(t => t?.value)
      .map(t => t.font.family)
  );

  const fontFaces = [...usedFonts].map(family => {
    const file = FONT_MAP[family];
    if (!file) return '';

    const base64 = fontToBase64(
      path.resolve('fonts', file)
    );

    return `
      @font-face {
        font-family: '${family}';
        src: url(data:font/ttf;base64,${base64}) format('truetype');
        font-weight: normal;
        font-style: normal;
      }
    `;
  }).join('\n');

  const svgTexts = Object.values(texts).map(t => {
    if (!t?.value) return '';

    return `
      <text
        x="50%"
        y="${Math.round((t.y * height) + (t.font.sizePx * 0.35))}"
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
    <svg xmlns="http://www.w3.org/2000/svg"
         width="${width}"
         height="${height}">
      <style>
        ${fontFaces}
      </style>
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

    userSharp = userSharp.extract({
      left: crop.x,
      top: crop.y,
      width: crop.width,
      height: crop.height
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