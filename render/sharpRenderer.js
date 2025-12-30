import sharp from 'sharp';
import { fetchImage } from '../utils/fetchImage.js';
import fs from 'fs';
import path from 'path';

export function buildTextsSvg({ texts, width, height, fontsFolder = './fonts' }) {
  // 1️⃣ Générer les @font-face pour toutes les polices utilisées
  const fontFamilies = {};

  Object.values(texts).forEach(t => {
    if (!t?.value) return;

    const family = t.font.family;
    const weight = t.font.weight || 400;

    if (!fontFamilies[family]) {
      // Chercher un fichier correspondant dans fontsFolder
      // On privilégie TTF > OTF, Regular = 400
      const regex = new RegExp(`${family.replace(/\s+/g, '.*')}.*\\.(ttf|otf)$`, 'i');
      console.log(regex)
      const file = fs.readdirSync(fontsFolder).find(f => regex.test(f));
      if (!file) {
        console.log(`⚠️ Font file not found for "${family}"`);
        return;
      }
      const fontData = fs.readFileSync(path.join(fontsFolder, file));
      const ext = path.extname(file).toLowerCase().slice(1); // ttf ou otf
      const format = ext === 'ttf' ? 'truetype' : 'opentype';
      fontFamilies[family] = `
        @font-face {
          font-family: '${family}';
          font-weight: ${weight};
          src: url(data:font/${ext};base64,${fontData.toString('base64')}) format('${format}');
        }
      `;
      console.log(fontFamilies[family])
    }
  });

  const fontCss = Object.values(fontFamilies).join('\n');

  // 2️⃣ Générer les textes SVG
  const svgTexts = Object.values(texts)
    .map(t => {
      if (!t?.value) return '';
      const yPx = Math.round(t.y * height);
      return `
        <text
          x="50%"
          y="${yPx}"
          text-anchor="middle"
          font-family="${t.font.family}"
          font-size="${t.font.sizePx}"
          font-weight="${t.font.weight || 400}"
          fill="${t.color}"
        >
          ${escapeXml(t.value)}
        </text>
      `;
    })
    .join('\n');

  // 3️⃣ Retourner le buffer SVG complet
  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>${fontCss}</style>
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