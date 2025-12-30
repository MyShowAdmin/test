import { createCanvas, loadImage } from 'canvas';
import sharp from 'sharp';
import { fetchImage } from '../utils/fetchImage.js';
import fs from 'fs';
import path from 'path';

// Fonction pour échapper le texte XML
function escapeXml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

// Génération des textes SVG
export function buildTextsSvg({ texts, width, height, fontsFolder = './fonts' }) {
  const fontFamilies = {};

  Object.values(texts).forEach(t => {
    if (!t?.value) return;
    const family = t.font.family;
    const weight = t.font.weight || 400;

    if (!fontFamilies[family]) {
      const regex = new RegExp(`${family.replace(/\s+/g, '.*')}.*\\.(ttf|otf)$`, 'i');
      const file = fs.readdirSync(fontsFolder).find(f => regex.test(f));
      if (!file) return;

      const fontData = fs.readFileSync(path.join(fontsFolder, file));
      const ext = path.extname(file).toLowerCase().slice(1);
      const format = ext === 'ttf' ? 'truetype' : 'opentype';

      fontFamilies[family] = `
        @font-face {
          font-family: '${family}';
          font-weight: ${weight};
          src: url(data:font/${ext};base64,${fontData.toString('base64')}) format('${format}');
        }
      `;
    }
  });

  const fontCss = Object.values(fontFamilies).join('\n');

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

  return Buffer.from(`
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <style>${fontCss}</style>
      ${svgTexts}
    </svg>
  `);
}

export async function renderCardImage(payload) {
  const { background, userImage, crop, mask, target, texts } = payload;

  // 1️⃣ BACKGROUND
  const bgBuffer = await sharp(await fetchImage(background.url))
    .resize(background.width, background.height, { fit: 'cover' })
    .png()
    .toBuffer();
  const bgImage = await loadImage(bgBuffer);

  // 2️⃣ IMAGE UTILISATEUR
  const userBuffer = Buffer.from(userImage.dataUrl.split(',')[1], 'base64');
  let userSharp = sharp(userBuffer)
    .extract({
      left: crop.x,
      top: crop.y,
      width: crop.width,
      height: crop.height
    })
    .resize(target.width, target.height);

  let userFinalBuffer = await userSharp.png().toBuffer();

  // 3️⃣ MASQUE (appliqué uniquement sur l'utilisateur)
  if (mask?.type === 'svg') {
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

    const userCanvas = createCanvas(target.width, target.height);
    const userCtx = userCanvas.getContext('2d');

    const userImg = await loadImage(userFinalBuffer);
    userCtx.drawImage(userImg, 0, 0);

    userCtx.globalCompositeOperation = 'destination-in';
    userCtx.drawImage(maskImg, 0, 0);
    userCtx.globalCompositeOperation = 'source-over';

    userFinalBuffer = userCanvas.toBuffer('image/png');
  }

  // 4️⃣ TEXTE SVG
  const textSvgBuffer = buildTextsSvg({
    texts,
    width: background.width,
    height: background.height
  });
  const textImg = await loadImage(textSvgBuffer);

  // 5️⃣ COMPOSITE FINAL
  const canvas = createCanvas(background.width, background.height);
  const ctx = canvas.getContext('2d');

  ctx.drawImage(bgImage, 0, 0); // background
  const userCanvasImg = await loadImage(userFinalBuffer);
  ctx.drawImage(userCanvasImg, target.x, target.y); // utilisateur masqué
  ctx.drawImage(textImg, 0, 0); // texte

  return {
    buffer: canvas.toBuffer('image/png'),
    width: background.width,
    height: background.height
  };
}