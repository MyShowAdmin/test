import express from 'express';
import crypto from 'crypto';
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
      /* =====================
         1. Vérification HMAC
         ===================== */
      const shopifySecret = process.env.SHOPIFY_WEBHOOK_SECRET;
      const hmacHeader = req.get('X-Shopify-Hmac-Sha256');

      const digest = crypto
        .createHmac('sha256', shopifySecret)
        .update(req.body, 'utf8')
        .digest('base64');

      if (digest !== hmacHeader) {
        console.error('❌ HMAC invalide');
        return res.status(401).send('Unauthorized');
      }

      /* =====================
         2. Parse commande
         ===================== */
      const order = JSON.parse(req.body.toString());

      const orderId = order.id;
      const email = order.email;

      /* =====================
         3. Récupération des hash
         ===================== */
      const hashes = [];

      for (const item of order.line_items || []) {
        const prop = item.properties?.find(
          p => p.name === 'image_hash'
        );
        if (prop?.value) {
          hashes.push(prop.value);
        }
      }

      if (hashes.length === 0) {
        console.warn(`⚠️ Commande ${orderId} sans image_hash`);
        return res.status(200).send('No images');
      }

      /* =====================
         4. Update DB (multi-hash)
         ===================== */
      for (const hash of hashes) {
        await pool.query(
          `
          UPDATE images
          SET
            status = 'paid',
            order_id = $2,
            customer_email = $3,
            paid_at = NOW()
          WHERE hash = $1
          `,
          [hash, orderId, email]
        );
      }

      console.log(`✅ Commande ${orderId} : ${hashes.length} image(s) validée(s)`);

      res.status(200).send('OK');

    } catch (err) {
      console.error('🔥 Webhook error:', err);
      res.status(500).send('Server error');
    }
  }
);

export default router;