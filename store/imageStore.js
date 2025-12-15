import { pool } from "../db.js";

export async function savePendingImage({ hash, imageUrl }) {
    console.log('💾 savePendingImage called', { hash, imageUrl });
  
    const result = await pool.query(
      `
      INSERT INTO images (hash, cloudinary_url, status)
      VALUES ($1, $2, 'pending')
      ON CONFLICT (hash) DO NOTHING
      RETURNING *
      `,
      [hash, imageUrl]
    );
  
    console.log('📦 DB result:', result.rows);
  }