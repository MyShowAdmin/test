import express from "express";
import cors from "cors";
import { v2 as cloudinary } from "cloudinary";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.post("/upload-card", async (req, res) => {
  try {
    const { jpegBase64, fileName } = req.body;

    const upload = await cloudinary.uploader.upload(jpegBase64, {
      folder: "cartes-shopify",
      public_id: fileName.replace(".jpg", ""),
      resource_type: "image"
    });

    res.json({
      success: true,
      url: upload.secure_url
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false });
  }
});

app.get("/", (_, res) => res.send("Server OK"));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running"));