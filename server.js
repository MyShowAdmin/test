import express from 'express';
import cors from 'cors';
import { pool } from './db.js';
import cloudinary from "cloudinary";
import { generateImageHash } from "./utils/hash.js";
import { savePendingImage } from "./store/imageStore.js";
import webhookRoutes from './routes/webhook.js';
import { generateImageId } from './utils/id.js';




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

// ✅ Cloudinary auto-config via CLOUDINARY_URL
console.log("CLOUDINARY_URL =", process.env.CLOUDINARY_URL);
cloudinary.v2.config();

app.post("/upload-card", async (req, res) => {
  try {
    const { jpegBase64 } = req.body;

    if (!jpegBase64?.startsWith("data:image/jpeg")) {
      return res.status(400).json({ error: "Format JPEG invalide" });
    }

    const imageId = generateImageId();

    const upload = await cloudinary.uploader.upload(jpegBase64, {
      folder: "cards",
      public_id: imageId,
      resource_type: "image",
      overwrite: false
    });

    await savePendingImage({
      imageId,
      cloudinaryPublicId: upload.public_id
    });

    // ✅ ON RETOURNE imageId
    res.json({ imageId });

  } catch (err) {
    console.error("Upload-card error:", err);
    res.status(500).json({ error: "Upload échoué" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

