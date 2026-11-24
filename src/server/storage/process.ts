import sharp from "sharp";
import { UserError } from "@/lib/errors";

export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const limit = { limitInputPixels: 40_000_000 };

export async function processImage(input: Buffer) {
  if (input.length > MAX_IMAGE_BYTES) throw new UserError("Max 5 MB.");
  let format: string | undefined;
  try {
    format = (await sharp(input, limit).metadata()).format; // real type, not the extension
  } catch {
    throw new UserError("That file is not a readable image.");
  }
  if (!format || !["jpeg", "png", "webp"].includes(format))
    throw new UserError("JPEG, PNG or WebP only.");
  const img = sharp(input, limit).rotate(); // apply EXIF orientation; output drops all metadata, GPS included
  const full = await img
    .clone()
    .resize({ width: 1600, withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const thumb = await img
    .clone()
    .resize({ width: 256, height: 256, fit: "cover" })
    .webp({ quality: 75 })
    .toBuffer();
  return { full, thumb };
}
