import crypto from "crypto";

export function generateImageId() {
  return crypto.randomUUID(); // Node 18+ (Render OK)
}