import { createCanvas, registerFont } from 'canvas';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

// 1️⃣ Charger la police
registerFont(path.join('./fonts', 'Anton.ttf'), { family: 'Anton' });

// 2️⃣ Créer un canvas de la taille de l'image finale
const width = 800;
const height = 600;
const canvas = createCanvas(width, height);
const ctx = canvas.getContext('2d');

ctx.fillStyle = '#ff0000';
ctx.font = '60px Anton';
ctx.textAlign = 'center';
ctx.textBaseline = 'middle';
ctx.fillText('Hello World', width / 2, height / 2);

// 5️⃣ Récupérer le buffer PNG
const buffer = canvas.toBuffer('image/png');

// 6️⃣ Composer sur un fond avec Sharp si besoin
const bgBuffer = fs.readFileSync('./images/background.png');

sharp(bgBuffer)
  .composite([{ input: buffer, blend: 'over' }])
  .jpeg({ quality: 92 })
  .toFile('output.jpg')
  .then(() => console.log('Image générée avec texte !'))
  .catch(console.error);