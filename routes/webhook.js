import express from 'express';
import crypto from 'crypto';
import { addLinksToOrderNote } from "./shopify/updateOrderNote.js";
import { pool } from '../db.js';

const router = express.Router();

/**
 * ⚠️ Shopify webhook requires RAW body
 */
router.post(
  '/webhooks/orders/paid',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    try {
      // 1️⃣ Vérif HMAC
      const digest = crypto
        .createHmac('sha256', process.env.SHOPIFY_WEBHOOK_SECRET)
        .update(req.body)
        .digest('base64');

      if (digest !== req.get('X-Shopify-Hmac-Sha256')) {
        return res.status(401).send('Unauthorized');
      }

      const order = JSON.parse(req.body.toString());
      const orderId = order.id;
      const email = order.email;

      // 2️⃣ Récupération image_id
      const imageIds = [];

      for (const item of order.line_items || []) {
        const prop = item.properties?.find(p => p.name === 'image_id');
        if (prop?.value) imageIds.push(prop.value);
      }

      if (imageIds.length === 0) {
        return res.status(200).send('No images');
      }

      // 3️⃣ Update DB
      await pool.query(
        `
        UPDATE images
        SET
          status = 'paid',
          order_id = $2,
          customer_email = $3,
          paid_at = NOW()
        WHERE image_id = ANY($1)
        `,
        [imageIds, orderId, email]
      );

      // 4️⃣ Récupération public_id
      const { rows } = await pool.query(
        `
        SELECT cloudinary_public_id
        FROM images
        WHERE image_id = ANY($1)
        `,
        [imageIds]
      );

      // 5️⃣ URLs signées
      const signedUrls = rows.map(r =>
        cloudinary.v2.url(r.cloudinary_public_id, {
          sign_url: true,
          secure: true,
          expires_at: Math.floor(Date.now() / 1000) + 86400
        })
      );

      await addLinksToOrderNote(orderId, signedUrls);

      res.status(200).send('OK');

    } catch (err) {
      console.error('Webhook error:', err);
      res.status(500).send('Server error');
    }
  }
);