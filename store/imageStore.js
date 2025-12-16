import { pool } from "../db.js";

export async function savePendingImage({ imageId, cloudinaryPublicId }) {
  await pool.query(
    `
    INSERT INTO images (
      image_id,
      cloudinary_public_id,
      status
    )
    VALUES ($1, $2, 'pending')
    `,
    [imageId, cloudinaryPublicId]
  );  
    console.log('📦 DB result:', result.rows);
  }