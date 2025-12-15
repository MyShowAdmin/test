import fetch from "node-fetch";

const SHOP = process.env.SHOPIFY_SHOP_DOMAIN;
const TOKEN = process.env.SHOPIFY_ADMIN_TOKEN;

export async function addLinksToOrderNote(orderId, imageUrls) {
  const note = [
    "🖼️ Images payées :",
    ...imageUrls.map((url, i) => `#${i + 1} ${url}`)
  ].join("\n");

  const res = await fetch(
    `https://${SHOP}/admin/api/2024-01/orders/${orderId}.json`,
    {
      method: "PUT",
      headers: {
        "X-Shopify-Access-Token": TOKEN,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        order: {
          id: orderId,
          note
        }
      })
    }
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Shopify API error: ${text}`);
  }

  return true;
}