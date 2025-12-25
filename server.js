import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import cloudinary from "cloudinary";
import { savePendingImage } from "./store/imageStore.js";
import webhookRoutes from './routes/webhook.js';
import { generateImageId } from './utils/id.js';
import { renderCardImage } from './render/sharpRenderer.js';

const app = express();

/* Webhooks */
app.use(webhookRoutes);
app.use(cors());
app.use(express.json({ limit: "10mb" }));
app.get('/health/db', async (_, res) => {
    try {
      await pool.query('SELECT 1');
      res.send('DB OK');
    } catch {
      res.status(500).send('DB DOWN');
    }
  });

console.log("CLOUDINARY_URL =", process.env.CLOUDINARY_URL);
cloudinary.v2.config();

app.post("/render-card", async (req, res) => {
  try {
    const payload = req.body.payload;

    const imageId = generateImageId();

    // 1️⃣ Génération via Sharp
    const { buffer } = await renderCardImage(payload);

    // 2️⃣ Upload Cloudinary
    const upload = await cloudinary.v2.uploader.upload(
      `data:image/jpeg;base64,${buffer.toString('base64')}`,
      {
        folder: "cards",
        public_id: imageId,
        resource_type: "image",
        overwrite: false
      }
    );

    // 3️⃣ Sauvegarde DB
    await savePendingImage({
      imageId,
      cloudinaryPublicId: upload.public_id
    });

    // 4️⃣ Réponse pour Shopify
    res.json({ imageId });

  } catch (err) {
    console.error("render-card error:", err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

