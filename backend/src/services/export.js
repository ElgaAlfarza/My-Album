import { PassThrough } from "node:stream";
import archiver from "archiver";
import { adminDb } from "./supabase.js";
import { downloadFile } from "./storage.js";
import { extensionFromMime, formatDateId, safeFileStem } from "../utils/format.js";
import { forbidden } from "../utils/httpError.js";

export async function exportFamilyArchive(member) {
  if (member.role !== "admin") {
    throw forbidden("Cadangan lengkap hanya bisa diunduh oleh admin keluarga.");
  }

  const { data: photos, error } = await adminDb
    .from("photos")
    .select("id, title, caption, place, category, chip, taken_year, taken_date, original_path, mime_type, created_at")
    .is("deleted_at", null)
    .eq("status", "ready")
    .order("taken_year", { ascending: true });
  if (error) throw error;

  const archive = archiver("zip", { zlib: { level: 8 } });
  const stream = new PassThrough();
  archive.pipe(stream);

  const lines = [
    "Buku Panduan Besar — Album Kenangan Saya",
    "Cadangan foto + keterangan untuk satu keluarga.",
    `Dibuat: ${formatDateId(new Date())}`,
    "",
  ];

  for (const [index, photo] of (photos || []).entries()) {
    const stem = `${String(index + 1).padStart(3, "0")}-${photo.taken_year || "tahun"}-${safeFileStem(photo.title)}`;
    const ext = extensionFromMime(photo.mime_type);
    if (photo.original_path) {
      try {
        const buf = await downloadFile(photo.original_path);
        archive.append(buf, { name: `foto/${stem}.${ext}` });
      } catch {
        lines.push(`(Berkas gagal dibaca) ${photo.title}`);
      }
    }
    lines.push(`# ${photo.title}`);
    lines.push(`Tahun: ${photo.taken_year || "-"}`);
    if (photo.taken_date) lines.push(`Tanggal: ${formatDateId(photo.taken_date)}`);
    if (photo.place) lines.push(`Tempat: ${photo.place}`);
    lines.push(`Kategori: ${photo.chip || photo.category}`);
    lines.push(`Keterangan: ${photo.caption || "-"}`);
    lines.push("");
  }

  archive.append(lines.join("\n"), { name: "keterangan.txt" });
  archive.append(JSON.stringify(photos || [], null, 2), { name: "metadata.json" });

  // Tambahkan buku panduan kenangan cetak offline
  const htmlBook = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Buku Panduan Besar — Album Kenangan Keluarga</title>
  <style>
    body { font-family: Georgia, serif; max-width: 900px; margin: 40px auto; padding: 20px; color: #2C2623; background: #FAF8F5; }
    h1 { text-align: center; font-size: 2.4rem; color: #A45D4B; margin-bottom: 0.2rem; }
    .subtitle { text-align: center; color: #6B625B; font-style: italic; margin-bottom: 3rem; }
    .photo-entry { background: #FFF; border: 1px solid #E2DBD0; border-radius: 12px; padding: 24px; margin-bottom: 36px; page-break-inside: avoid; }
    .photo-entry img { max-width: 100%; height: auto; border-radius: 8px; display: block; margin-bottom: 16px; }
    .title { font-size: 1.6rem; margin-bottom: 6px; }
    .meta { font-size: 0.95rem; color: #5F7464; font-weight: bold; margin-bottom: 12px; }
    .caption { font-size: 1.15rem; font-style: italic; line-height: 1.6; color: #4A423D; }
    @media print {
      body { background: #FFF; margin: 0; }
      .photo-entry { border: none; padding: 0; margin-bottom: 60px; page-break-after: always; }
    }
  </style>
</head>
<body>
  <h1>Buku Panduan Besar Kenangan Keluarga</h1>
  <p class="subtitle">Cadangan fisik & digital — Dicadangkan pada ${formatDateId(new Date())}</p>
  ${(photos || []).map((p, idx) => {
    const stem = `${String(idx + 1).padStart(3, "0")}-${p.taken_year || "tahun"}-${safeFileStem(p.title)}`;
    const ext = extensionFromMime(p.mime_type);
    return `
    <article class="photo-entry">
      <img src="foto/${stem}.${ext}" alt="${p.title}">
      <div class="meta">🗓️ ${p.taken_year ? `Tahun ${p.taken_year}` : ''} ${p.place ? `• 📍 ${p.place}` : ''}</div>
      <h2 class="title">${p.title}</h2>
      <p class="caption">“${p.caption || ''}”</p>
    </article>`;
  }).join("\n")}
</body>
</html>`;
  archive.append(htmlBook, { name: "Buku-Panduan-Besar.html" });

  await archive.finalize();

  return {
    stream,
    filename: `album-kenangan-cadangan-${new Date().toISOString().slice(0, 10)}.zip`,
    count: (photos || []).length,
  };
}
