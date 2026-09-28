import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { PassThrough } from "node:stream";
import { randomBytes, randomUUID } from "node:crypto";
import archiver from "archiver";
import { CATEGORIES, resolveCategory } from "../config/categories.js";
import { formatDateId, lembarLabel, extensionFromMime, safeFileStem } from "../utils/format.js";
import { badRequest, notFound } from "../utils/httpError.js";
import { makeDerivatives, readExifYear } from "./images.js";
import { env } from "../config/env.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LOCAL_STORAGE_DIR = path.resolve(__dirname, "../../local_storage");

// Inisialisasi direktori lokal untuk upload
fs.mkdir(LOCAL_STORAGE_DIR, { recursive: true }).catch(() => {});

const INITIAL_PHOTOS = [
  {
    id: "solo-1958",
    title: "Pernikahan Eyang di Solo",
    caption: "Momen sakral janji suci di rumah peninggalan kakek di Laweyan.",
    place: "Solo, Jawa Tengah",
    taken_year: 1958,
    category: "pernikahan",
    chip: "Pernikahan",
    warm: false,
    liked: true,
    album: "Masa Muda & Pernikahan",
    src: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=80",
    created_at: new Date("2024-01-01").toISOString(),
    status: "ready",
    deleted_at: null,
  },
  {
    id: "glagah-1985",
    title: "Liburan Pertama ke Pantai Glagah",
    caption: "Anak-anak masih kecil, menempuh perjalanan jauh naik mobil kijang tua.",
    place: "Kulon Progo, DIY",
    taken_year: 1985,
    category: "liburan",
    chip: "Liburan",
    warm: true,
    liked: false,
    album: "Cucu & Liburan",
    src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80",
    created_at: new Date("2024-01-02").toISOString(),
    status: "ready",
    deleted_at: null,
  },
  {
    id: "wisuda-2002",
    title: "Momen Wisuda Anak Pertama",
    caption: "Hari bahagia penuh syukur saat Mas Budi lulus kuliah di Yogyakarta.",
    place: "Universitas Gadjah Mada",
    taken_year: 2002,
    category: "keluarga",
    chip: "Keluarga",
    warm: false,
    liked: true,
    album: "Foto Keluarga",
    src: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1400&q=80",
    created_at: new Date("2024-01-03").toISOString(),
    status: "ready",
    deleted_at: null,
  },
  {
    id: "lebaran-2018",
    title: "Sungkem Idul Fitri Bersama Cucu",
    caption: "Rumah selalu hangat dan ramai gelak tawa saat hari lebaran tiba.",
    place: "Rumah Utama, Semarang",
    taken_year: 2018,
    category: "hari-raya",
    chip: "Hari Raya",
    warm: true,
    liked: false,
    album: "Hari Raya",
    src: "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1400&q=80",
    created_at: new Date("2024-01-04").toISOString(),
    status: "ready",
    deleted_at: null,
  },
  {
    id: "ambarawa-1994",
    title: "Halaman Belakang Rumah Ambarawa",
    caption: "Suasana asri sore hari, kakek duduk tenang ditemani secangkir teh melati.",
    place: "Ambarawa, Jawa Tengah",
    taken_year: 1994,
    category: "keluarga",
    chip: "Kenangan Rumah",
    warm: false,
    liked: false,
    album: "Foto Keluarga",
    src: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1400&q=80",
    created_at: new Date("2024-01-05").toISOString(),
    status: "ready",
    deleted_at: null,
  },
  {
    id: "emas-2008",
    title: "Ulang Tahun Pernikahan Emas",
    caption: "50 tahun bersama dalam suka dan duka, tumpeng syukur sekeluarga besar.",
    place: "Pendopo Keluarga",
    taken_year: 2008,
    category: "keluarga",
    chip: "Ulang Tahun",
    warm: true,
    liked: true,
    album: "Masa Muda & Pernikahan",
    src: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=1400&q=80",
    created_at: new Date("2024-01-06").toISOString(),
    status: "ready",
    deleted_at: null,
  },
];

const INITIAL_ALBUMS = [
  { id: "alb-1", nama: "Foto Keluarga", deskripsi: "Foto bersama di rumah dan momen sehari-hari." },
  { id: "alb-2", nama: "Masa Muda & Pernikahan", deskripsi: "Kisah janji suci dan masa muda orang tua." },
  { id: "alb-3", nama: "Hari Raya", deskripsi: "Lebaran, sungkem, dan hari besar keluarga." },
  { id: "alb-4", nama: "Cucu & Liburan", deskripsi: "Perjalanan, pantai, dan tawa cucu." },
];

let localPhotos = [...INITIAL_PHOTOS];
let localAlbums = [...INITIAL_ALBUMS];
let localShares = new Map();

function presentLocal(p) {
  const cat = CATEGORIES[p.category] || CATEGORIES.keluarga;
  return {
    id: p.id,
    title: p.title,
    caption: p.caption,
    place: p.place || "",
    year: p.taken_year,
    year_label: p.taken_year ? `Tahun ${p.taken_year}` : "Tahun tidak diketahui",
    category: p.category,
    chip: p.chip || cat.chip,
    warm: p.warm ?? cat.warm,
    liked: Boolean(p.liked),
    is_favorite: Boolean(p.liked),
    album: p.album || "Foto Keluarga",
    src: p.src,
    thumbnail_url: p.thumbnail_url || p.src,
    display_url: p.display_url || p.src,
    original_url: p.original_url || p.src,
    taken_date: p.taken_date || null,
    taken_date_label: p.taken_date ? formatDateId(p.taken_date) : (p.taken_year ? `Tahun ${p.taken_year}` : null),
    created_at: p.created_at,
    created_at_label: formatDateId(p.created_at),
    status: p.status || "ready",
  };
}

export const localStore = {
  async listPhotos({ category, year, favorite, search, trash = false }) {
    let list = localPhotos.filter((p) => (trash ? p.deleted_at !== null : p.deleted_at === null));

    if (category && category !== "semua") {
      if (category === "liburan") {
        list = list.filter((p) => p.category === "liburan" || p.category === "cucu-liburan" || p.album === "Cucu & Liburan");
      } else if (category === "pernikahan") {
        list = list.filter((p) => p.category === "pernikahan" || p.album === "Masa Muda & Pernikahan");
      } else if (category === "keluarga") {
        list = list.filter((p) => p.category === "keluarga" || p.category === "kenangan-rumah" || p.album === "Foto Keluarga");
      } else {
        list = list.filter((p) => p.category === category);
      }
    }

    if (year) {
      list = list.filter((p) => String(p.taken_year) === String(year));
    }

    if (favorite === "true" || favorite === true) {
      list = list.filter((p) => p.liked);
    }

    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((p) =>
        [p.title, p.caption, p.place, p.chip, String(p.taken_year || "")]
          .join(" ")
          .toLowerCase()
          .includes(q)
      );
    }

    const items = list.map(presentLocal);
    return {
      items,
      total: items.length,
      total_label: lembarLabel(items.length),
      filters: [
        { id: "semua", label: "Semua" },
        { id: "keluarga", label: "Foto Keluarga" },
        { id: "pernikahan", label: "Masa Muda & Pernikahan" },
        { id: "hari-raya", label: "Hari Raya" },
        { id: "liburan", label: "Cucu & Liburan" },
      ],
    };
  },

  async getPhoto(id) {
    const photo = localPhotos.find((p) => p.id === id);
    if (!photo) throw notFound("Foto tidak ditemukan di lemari.");
    return presentLocal(photo);
  },

  async uploadDirect(member, file, body) {
    if (!file) throw badRequest("Belum ada foto yang dipilih.");

    const id = randomUUID();
    const ext = extensionFromMime(file.mimetype);
    const filename = `${id}.${ext}`;
    const filePath = path.join(LOCAL_STORAGE_DIR, filename);

    await fs.writeFile(filePath, file.buffer);

    // Proses Sharp dan EXIF
    const exif = await readExifYear(file.buffer);
    const derived = await makeDerivatives(file.buffer);

    const thumbFilename = `${id}-thumb.webp`;
    const displayFilename = `${id}-display.jpg`;
    await fs.writeFile(path.join(LOCAL_STORAGE_DIR, thumbFilename), derived.thumbnailBuffer);
    await fs.writeFile(path.join(LOCAL_STORAGE_DIR, displayFilename), derived.displayBuffer);

    const takenYear = body.taken_year ? Number(body.taken_year) : exif.takenYear || new Date().getFullYear();
    const cat = resolveCategory(body.category);

    const newPhoto = {
      id,
      title: body.title || safeFileStem(file.originalname) || "Kenangan Baru",
      caption: body.caption || "Baru saja disimpan ke lemari kenangan keluarga.",
      place: body.place || "Album Pribadi",
      taken_year: takenYear,
      taken_date: exif.takenDate || null,
      year_from_exif: exif.fromExif,
      category: cat.id,
      chip: body.chip || cat.chip,
      warm: cat.warm,
      liked: false,
      album: body.album || cat.defaultAlbum,
      src: `/local_storage/${displayFilename}`,
      thumbnail_url: `/local_storage/${thumbFilename}`,
      display_url: `/local_storage/${displayFilename}`,
      original_url: `/local_storage/${filename}`,
      status: "ready",
      created_at: new Date().toISOString(),
      deleted_at: null,
    };

    localPhotos.unshift(newPhoto);

    return {
      photo: presentLocal(newPhoto),
      message: "Foto berhasil disimpan dengan aman ke dalam lemari.",
    };
  },

  async patchPhoto(id, body) {
    const photo = localPhotos.find((p) => p.id === id);
    if (!photo) throw notFound("Foto tidak ditemukan.");

    if (body.title != null) photo.title = String(body.title).trim();
    if (body.caption != null) photo.caption = String(body.caption).trim();
    if (body.place != null) photo.place = String(body.place).trim();
    if (body.taken_year != null) photo.taken_year = Number(body.taken_year) || null;
    if (body.category != null) {
      const cat = resolveCategory(body.category);
      photo.category = cat.id;
      photo.chip = body.chip || cat.chip;
      photo.warm = cat.warm;
    }
    if (body.album != null) photo.album = body.album;
    if (typeof body.is_favorite === "boolean" || typeof body.liked === "boolean") {
      photo.liked = body.is_favorite ?? body.liked;
    }

    return presentLocal(photo);
  },

  async setFavorite(id, liked) {
    const photo = localPhotos.find((p) => p.id === id);
    if (photo) photo.liked = Boolean(liked);
    return photo ? presentLocal(photo) : null;
  },

  async softDelete(id) {
    const photo = localPhotos.find((p) => p.id === id);
    if (!photo) throw notFound("Foto tidak ditemukan.");
    photo.deleted_at = new Date().toISOString();
    return {
      ok: true,
      message: "Foto dipindah ke tempat sampah selama 30 hari, belum dihapus permanen.",
    };
  },

  async listAlbums() {
    const activePhotos = localPhotos.filter((p) => p.deleted_at === null);
    const items = localAlbums.map((album) => {
      const photos = activePhotos.filter((p) => p.album === album.nama);
      const cover = photos[0]?.src || null;
      return {
        id: album.id,
        nama: album.nama,
        deskripsi: album.deskripsi,
        photo_count: photos.length,
        photo_count_label: `${photos.length} lembar foto tersimpan rapi`,
        cover_url: cover,
        stack_urls: photos.slice(0, 3).map((p) => p.src),
      };
    });
    return { items, total_label: lembarLabel(items.reduce((s, a) => s + a.photo_count, 0)) };
  },

  async createAlbum(body) {
    const nama = String(body.nama || "").trim();
    if (!nama) throw badRequest("Nama album wajib diisi.");
    const newAlb = { id: `alb-${Date.now()}`, nama, deskripsi: body.deskripsi || "" };
    localAlbums.push(newAlb);
    return newAlb;
  },

  async stats() {
    const active = localPhotos.filter((p) => p.deleted_at === null);
    const byYearMap = new Map();
    const byCategoryMap = new Map();
    let favorites = 0;

    for (const p of active) {
      const y = p.taken_year || "tidak-diketahui";
      byYearMap.set(y, (byYearMap.get(y) || 0) + 1);
      byCategoryMap.set(p.category, (byCategoryMap.get(p.category) || 0) + 1);
      if (p.liked) favorites += 1;
    }

    return {
      total_photos: active.length,
      total_label: lembarLabel(active.length),
      subtitle: "Tersimpan rapi & abadi (Mode Lemari Lokal)",
      favorites,
      favorites_label: `${favorites} Tersimpan di Hati`,
      by_year: [...byYearMap.entries()]
        .map(([year, count]) => ({ year, count, label: year === "tidak-diketahui" ? "Tahun tidak diketahui" : `Tahun ${year}` }))
        .sort((a, b) => String(b.year).localeCompare(String(a.year))),
      by_category: [...byCategoryMap.entries()].map(([id, count]) => ({
        id,
        count,
        label: CATEGORIES[id]?.label || id,
      })),
    };
  },

  async createShareLink(photoId, hours = 48) {
    const photo = localPhotos.find((p) => p.id === photoId);
    if (!photo) throw notFound("Foto tidak ditemukan.");

    const token = randomBytes(24).toString("base64url");
    const expires = new Date(Date.now() + hours * 60 * 60 * 1000);
    localShares.set(token, { photo, expires_at: expires.toISOString() });

    const shareUrl = `${env.PUBLIC_APP_URL}/s/${token}`;
    const text = `Kenangan keluarga untuk Anda: ${shareUrl}\nTautan ini hanya berlaku sementara.`;
    return {
      share_url: shareUrl,
      whatsapp_url: `https://wa.me/?text=${encodeURIComponent(text)}`,
      expires_at: expires.toISOString(),
      expires_label: `Berlaku sampai ${formatDateId(expires)} (sekitar ${hours} jam)`,
      message: "Tautan siap dikirim ke WhatsApp. Tidak bisa ditemukan lewat mesin pencari.",
    };
  },

  async resolveShare(token) {
    const item = localShares.get(token);
    if (!item) throw notFound("Tautan berbagi sudah kedaluwarsa atau tidak berlaku.");
    if (new Date(item.expires_at).getTime() < Date.now()) {
      throw notFound("Tautan berbagi sudah kedaluwarsa.");
    }
    const photo = item.photo;
    return {
      title: photo.title,
      caption: photo.caption,
      place: photo.place,
      year_label: photo.taken_year ? `Tahun ${photo.taken_year}` : null,
      taken_date_label: formatDateId(photo.taken_date),
      image_url: photo.display_url || photo.src,
      expires_at: item.expires_at,
      robots: "noindex, nofollow",
    };
  },

  async exportArchive() {
    const active = localPhotos.filter((p) => p.deleted_at === null);
    const archive = archiver("zip", { zlib: { level: 8 } });
    const stream = new PassThrough();
    archive.pipe(stream);

    const lines = [
      "Buku Panduan Besar — Album Kenangan Saya",
      "Cadangan foto + keterangan untuk satu keluarga (Mode Lokal).",
      `Dibuat: ${formatDateId(new Date())}`,
      "",
    ];

    for (const [index, p] of active.entries()) {
      lines.push(`# ${p.title}`);
      lines.push(`Tahun: ${p.taken_year || "-"}`);
      if (p.place) lines.push(`Tempat: ${p.place}`);
      lines.push(`Kategori: ${p.chip || p.category}`);
      lines.push(`Keterangan: ${p.caption || "-"}`);
      lines.push("");
    }

    archive.append(lines.join("\n"), { name: "keterangan.txt" });
    archive.append(JSON.stringify(active, null, 2), { name: "metadata.json" });

    const htmlBook = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <title>Buku Panduan Besar — Album Kenangan Keluarga</title>
  <style>
    body { font-family: Georgia, serif; max-width: 900px; margin: 40px auto; padding: 20px; color: #2C2623; background: #FAF8F5; }
    h1 { text-align: center; font-size: 2.4rem; color: #A45D4B; margin-bottom: 0.2rem; }
    .subtitle { text-align: center; color: #6B625B; font-style: italic; margin-bottom: 3rem; }
    .photo-entry { background: #FFF; border: 1px solid #E2DBD0; border-radius: 12px; padding: 24px; margin-bottom: 36px; }
    .photo-entry img { max-width: 100%; height: auto; border-radius: 8px; display: block; margin-bottom: 16px; }
    .title { font-size: 1.6rem; margin-bottom: 6px; }
    .meta { font-size: 0.95rem; color: #5F7464; font-weight: bold; margin-bottom: 12px; }
    .caption { font-size: 1.15rem; font-style: italic; line-height: 1.6; color: #4A423D; }
  </style>
</head>
<body>
  <h1>Buku Panduan Besar Kenangan Keluarga</h1>
  <p class="subtitle">Dicadangkan pada ${formatDateId(new Date())}</p>
  ${active.map((p) => `
    <article class="photo-entry">
      <img src="${p.src}" alt="${p.title}">
      <div class="meta">🗓️ ${p.taken_year ? `Tahun ${p.taken_year}` : ''} ${p.place ? `• 📍 ${p.place}` : ''}</div>
      <h2 class="title">${p.title}</h2>
      <p class="caption">“${p.caption || ''}”</p>
    </article>`).join("\n")}
</body>
</html>`;
    archive.append(htmlBook, { name: "Buku-Panduan-Besar.html" });

    await archive.finalize();
    return {
      stream,
      filename: `album-kenangan-cadangan-${new Date().toISOString().slice(0, 10)}.zip`,
      count: active.length,
    };
  },
};
