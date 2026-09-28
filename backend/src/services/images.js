import sharp from "sharp";
import exifr from "exifr";

export async function readExifYear(buffer) {
  try {
    const exif = await exifr.parse(buffer, { pick: ["DateTimeOriginal", "CreateDate", "ModifyDate"] });
    const raw = exif?.DateTimeOriginal || exif?.CreateDate || exif?.ModifyDate;
    if (!raw) return { takenDate: null, takenYear: null, fromExif: false };
    const date = raw instanceof Date ? raw : new Date(raw);
    if (Number.isNaN(date.getTime())) return { takenDate: null, takenYear: null, fromExif: false };
    return {
      takenDate: date.toISOString().slice(0, 10),
      takenYear: date.getFullYear(),
      fromExif: true,
    };
  } catch {
    return { takenDate: null, takenYear: null, fromExif: false };
  }
}

export async function makeDerivatives(buffer) {
  const pipeline = sharp(buffer, { failOn: "none" }).rotate();
  const meta = await pipeline.metadata();

  const thumbnail = await pipeline
    .clone()
    .resize(720, 720, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 76 });

  const display = await pipeline
    .clone()
    .resize(1920, 1920, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 86, mozjpeg: true });

  const [thumbnailBuffer, displayBuffer] = await Promise.all([thumbnail.toBuffer(), display.toBuffer()]);

  return {
    width: meta.width || null,
    height: meta.height || null,
    thumbnailBuffer,
    displayBuffer,
  };
}
