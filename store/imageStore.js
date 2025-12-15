const pendingImages = new Map();

export function savePendingImage({ hash, imageUrl }) {
  pendingImages.set(hash, {
    hash,
    imageUrl,
    paid: false,
    createdAt: Date.now()
  });
}

export function markImageAsPaid(hash, orderId) {
  const item = pendingImages.get(hash);
  if (!item) return null;

  item.paid = true;
  item.orderId = orderId;
  return item;
}

export function getImageByHash(hash) {
  return pendingImages.get(hash);
}