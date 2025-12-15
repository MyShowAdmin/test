import crypto from "crypto";

export function generateImageHash(imageUrl) {
  return crypto
    .createHash("sha512")
    .update(imageUrl)
    .digest("hex");
}