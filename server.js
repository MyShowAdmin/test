import express from "express";
import cors from "cors";
import cloudinary from "cloudinary";
import { generateImageHash } from "./utils/hash.js";
import { savePendingImage } from "./store/imageStore.js";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

// ✅ Cloudinary auto-config via CLOUDINARY_URL
console.log("CLOUDINARY_URL =", process.env.CLOUDINARY_URL);
cloudinary.v2.config();

app.post("/upload-card", async (req, res) => {
    console.log('BODY REÇU:', req.body);
    console.log('jpegBase64 existe ?', !!req.body?.jpegBase64);
    console.log('fileName:', req.body?.fileName);
  
    if (!req.body?.jpegBase64) {
      return res.status(400).json({ error: 'jpegBase64 manquant' });
    }
  
    if (!req.body.jpegBase64.startsWith('data:image/jpeg')) {
      return res.status(400).json({ error: 'Format JPEG invalide' });
    }
  try {
    const { jpegBase64, fileName } = req.body;

    if (!jpegBase64) {
      return res.status(400).json({ error: "Image manquante" });
    }

    const upload = await cloudinary.uploader.upload(jpegBase64, {
        folder: "cards",
        resource_type: "image"
      });
    
      const imageUrl = upload.secure_url;
      const hash = generateImageHash(imageUrl);
      console.log(hash)
    
      savePendingImage({ hash, imageUrl });
    
      res.json({
        hash // ⚠️ PAS L’URL
    });

  } catch (err) {
    console.error("Cloudinary error:", err);
    return res.status(500).json({ error: "Upload échoué" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});