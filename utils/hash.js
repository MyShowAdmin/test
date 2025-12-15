import crypto from "crypto";

export function generateImageHash(jpegBase64) {
  return crypto
    .createHash("sha512")
    .update(jpegBase64)
    .digest("hex");
}