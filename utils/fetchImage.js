export async function fetchImage(url) {
  const res = await fetch(url);

  if (!res.ok) {
    throw new Error(`Impossible de charger l’image : ${url}`);
  }

  return Buffer.from(await res.arrayBuffer());
}