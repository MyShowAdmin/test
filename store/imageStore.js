import { pool } from "../db.js";

export async function savePendingImage({ hash, imageUrl }) {
  await pool.query(
    `
    INSERT INTO images (hash, cloudinary_url, status)
    VALUES ($1, $2, 'pending')
    ON CONFLICT (hash) DO NOTHING
    `,
    [hash, imageUrl]
  );
}