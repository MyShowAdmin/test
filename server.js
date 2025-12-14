import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json({ limit: "10mb" }));

app.post("/upload-card", (req, res) => {
  console.log("Reçu :", req.body);

  res.json({
    success: true,
    message: "Upload OK"
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});