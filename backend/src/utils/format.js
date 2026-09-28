const dateLong = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dateTimeLong = new Intl.DateTimeFormat("id-ID", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDateId(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateLong.format(date);
}

export function formatDateTimeId(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return dateTimeLong.format(date);
}

export function lembarLabel(count) {
  const n = Number(count) || 0;
  return `${n} Lembar Foto`;
}

export function extensionFromMime(mime) {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}

export function safeFileStem(name) {
  return String(name || "kenangan")
    .replace(/\.[^.]+$/, "")
    .replace(/[^\p{L}\p{N}\-_ ]+/gu, "")
    .trim()
    .slice(0, 80) || "kenangan";
}
