import { randomBytes, randomUUID } from "node:crypto";
import { CATEGORIES, resolveCategory } from "../config/categories.js";
import { env } from "../config/env.js";
import { formatDateId, lembarLabel, extensionFromMime, safeFileStem } from "../utils/format.js";
import { badRequest, notFound } from "../utils/httpError.js";
import { makeDerivatives, readExifYear } from "./images.js";
import { adminDb } from "./supabase.js";
import {
  createSignedUpload,
  downloadFile,
  removeFiles,
  signedUrls,
  uploadBuffer,
} from "./storage.js";

const PHOTO_SELECT = `
  id, uploader_id, status, original_path, thumbnail_path, display_path,
  mime_type, title, caption, place, category, chip, taken_year, taken_date,
  year_from_exif, created_at, updated_at, deleted_at,
  uploader:family_members!photos_uploader_id_fkey (id, nama),
  album_photos ( album:albums (id, nama) ),
  photo_hearts ( member_id )
`;

function firstAlbumName(row) {
  const names = (row.album_photos || []).map((item) => item.album?.nama).filter(Boolean);
  return names[0] || CATEGORIES[row.category]?.defaultAlbum || "Foto Keluarga";
}

export function presentPhoto(row, urlMap, memberId) {
  const liked = (row.photo_hearts || []).some((h) => h.member_id === memberId);
  const cat = CATEGORIES[row.category] || CATEGORIES.keluarga;
  const srcPath = row.thumbnail_path || row.display_path || row.original_path;
  return {
    id: row.id,
    title: row.title,
    caption: row.caption,
    place: row.place || "",
    year: row.taken_year,
    category: row.category,
    chip: row.chip || cat.chip,
    warm: cat.warm,
    liked,
    is_favorite: liked,
    album: firstAlbumName(row),
    albums: (row.album_photos || []).map((item) => ({
      id: item.album?.id,
      nama: item.album?.nama,
    })).filter((a) => a.id),
    src: srcPath ? urlMap.get(srcPath) : null,
    thumbnail_url: row.thumbnail_path ? urlMap.get(row.thumbnail_path) : null,
    display_url: row.display_path ? urlMap.get(row.display_path) : null,
    original_url: row.original_path ? urlMap.get(row.original_path) : null,
    taken_date: row.taken_date,
    taken_date_label: formatDateId(row.taken_date) || (row.taken_year ? `Tahun ${row.taken_year}` : null),
    year_label: row.taken_year ? `Tahun ${row.taken_year}` : "Tahun tidak diketahui",
    uploader: row.uploader ? { id: row.uploader.id, nama: row.uploader.nama } : null,
    created_at: row.created_at,
    created_at_label: formatDateId(row.created_at),
    status: row.status,
  };
}

async function presentMany(rows, memberId, ttl) {
  const paths = rows.flatMap((row) => [row.thumbnail_path, row.display_path, row.original_path]);
  const urlMap = await signedUrls(paths, ttl);
  return rows.map((row) => presentPhoto(row, urlMap, memberId));
}

export async function getMemberByAuthId(authUserId) {
  const { data, error } = await adminDb
    .from("family_members")
    .select("*")
    .eq("auth_user_id", authUserId)
    .eq("aktif", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function listPhotos({ member, category, year, favorite, search, albumId, trash = false }) {
  let query = adminDb
    .from("photos")
    .select(PHOTO_SELECT)
    .order("taken_year", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (trash) query = query.not("deleted_at", "is", null);
  else query = query.is("deleted_at", null).eq("status", "ready");

  if (category && category !== "semua") {
    if (category === "liburan") query = query.in("category", ["liburan", "cucu-liburan"]);
    else if (category === "keluarga") query = query.in("category", ["keluarga", "kenangan-rumah"]);
    else query = query.eq("category", category);
  }
  if (year) query = query.eq("taken_year", Number(year));
  if (albumId) {
    const { data: links, error: linkError } = await adminDb
      .from("album_photos")
      .select("photo_id")
      .eq("album_id", albumId);
    if (linkError) throw linkError;
    const ids = (links || []).map((row) => row.photo_id);
    if (!ids.length) {
      return emptyPhotoList();
    }
    query = query.in("id", ids);
  }

  const { data, error } = await query;
  if (error) throw error;
  let rows = data || [];

  if (favorite === "true" || favorite === true) {
    rows = rows.filter((row) => (row.photo_hearts || []).some((h) => h.member_id === member.id));
  }
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    rows = rows.filter((row) =>
      [row.title, row.caption, row.place, row.chip, String(row.taken_year || "")]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }

  const items = await presentMany(rows, member.id);
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
}

export async function getPhoto(id, member, { includeDeleted = false } = {}) {
  let query = adminDb.from("photos").select(PHOTO_SELECT).eq("id", id);
  if (!includeDeleted) query = query.is("deleted_at", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Foto tidak ditemukan di lemari.");
  const [item] = await presentMany([data], member.id);
  return item;
}

export async function getPhotoRow(id) {
  const { data, error } = await adminDb.from("photos").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw notFound("Foto tidak ditemukan di lemari.");
  return data;
}

export async function initUpload(member, body) {
  const mime = body.mime_type || body.contentType;
  if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(mime)) {
    throw badRequest("Format yang diterima hanya JPG, PNG, atau WEBP.");
  }
  const cat = resolveCategory(body.category);
  const title = (body.title || safeFileStem(body.filename) || "Kenangan Baru").slice(0, 120);
  const ext = extensionFromMime(mime);
  const id = randomUUID();
  const original_path = `originals/${id}/asli.${ext}`;

  let takenYear = null;
  if (body.taken_year && Number(body.taken_year) > 1800) {
    takenYear = Number(body.taken_year);
  } else if (body.taken_date) {
    takenYear = new Date(body.taken_date).getFullYear();
  } else {
    takenYear = new Date().getFullYear();
  }

  const takenDate = body.taken_date || (takenYear ? `${takenYear}-01-01` : null);

  const { data, error } = await adminDb
    .from("photos")
    .insert({
      id,
      uploader_id: member.id,
      status: "pending",
      original_path,
      mime_type: mime,
      title,
      caption: body.caption || "Baru saja disimpan ke lemari kenangan keluarga.",
      place: body.place || "Album Pribadi",
      category: cat.id,
      chip: body.chip || cat.chip,
      taken_year: takenYear,
      taken_date: takenDate,
    })
    .select("id")
    .single();
  if (error) throw error;

  if (body.album_id || body.album) {
    await attachAlbum(data.id, body.album_id, body.album, cat.defaultAlbum);
  } else {
    await attachAlbum(data.id, null, cat.defaultAlbum, cat.defaultAlbum);
  }

  const upload = await createSignedUpload(original_path);
  return {
    photo_id: data.id,
    upload_url: upload.signedUrl,
    upload_token: upload.token,
    path: original_path,
    message: "Silakan unggah fotonya ke tautan aman ini, lalu konfirmasi setelah selesai.",
  };
}

async function attachAlbum(photoId, albumId, albumName, fallbackName) {
  let album = null;

  // 1. Cari berdasarkan ID eksplisit
  if (albumId) {
    const found = await adminDb.from("albums").select("id, nama").eq("id", albumId).maybeSingle();
    album = found.data;
  }

  // 2. Cari berdasarkan nama album yang dikirim
  if (!album && albumName) {
    const found = await adminDb.from("albums").select("id, nama").ilike("nama", albumName.trim()).maybeSingle();
    album = found.data;
  }

  // 3. Jika nama album custom belum ada → buat album baru sekarang
  //    Jangan fall back ke defaultAlbum jika albumName berbeda dari fallbackName
  if (!album && albumName && albumName !== fallbackName) {
    try {
      const created = await adminDb
        .from("albums")
        .insert({ nama: albumName.trim() })
        .select("id, nama")
        .maybeSingle();
      album = created.data;
    } catch {}
  }

  // 4. Hanya gunakan fallback jika albumName tidak ada atau sama dengan fallback
  if (!album && fallbackName) {
    const found = await adminDb.from("albums").select("id, nama").ilike("nama", fallbackName.trim()).maybeSingle();
    album = found.data;
    // Buat fallback album jika juga belum ada
    if (!album) {
      try {
        const created = await adminDb
          .from("albums")
          .insert({ nama: fallbackName.trim() })
          .select("id, nama")
          .maybeSingle();
        album = created.data;
      } catch {}
    }
  }

  if (!album) return;
  await adminDb.from("album_photos").upsert({ album_id: album.id, photo_id: photoId });
}

export async function completeUpload(member, photoId) {
  const row = await getPhotoRow(photoId);
  if (row.uploader_id !== member.id && member.role !== "admin") {
    throw badRequest("Hanya pengunggah atau admin yang dapat menyelesaikan unggahan ini.");
  }
  if (!row.original_path) throw badRequest("Berkas asli belum tersedia.");

  const original = await downloadFile(row.original_path);
  const exif = await readExifYear(original);
  const derived = await makeDerivatives(original);
  const thumbPath = `thumbs/${row.id}/kecil.webp`;
  const displayPath = `display/${row.id}/layar.jpg`;
  await uploadBuffer(thumbPath, derived.thumbnailBuffer, "image/webp");
  await uploadBuffer(displayPath, derived.displayBuffer, "image/jpeg");

  // Prioritaskan tanggal dan tahun yang dipilih pengguna secara sadar saat mengunggah foto
  const takenYear = row.taken_year || exif.takenYear || new Date().getFullYear();
  const takenDate = row.taken_date || exif.takenDate || null;

  const { error } = await adminDb
    .from("photos")
    .update({
      status: "ready",
      thumbnail_path: thumbPath,
      display_path: displayPath,
      width: derived.width,
      height: derived.height,
      file_size_bytes: original.length,
      taken_year: takenYear,
      taken_date: takenDate,
      year_from_exif: exif.fromExif,
    })
    .eq("id", row.id);
  if (error) throw error;

  return getPhoto(row.id, member);
}

export async function uploadDirect(member, file, body) {
  if (!file) throw badRequest("Belum ada foto yang dipilih.");
  const mime = (file.mimetype || "image/jpeg").toLowerCase();
  const isImage =
    ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/pjpeg", "image/jfif"].includes(mime) ||
    /\.(jpe?g|png|webp|jfif)$/i.test(file.originalname || "");
  if (!isImage) {
    throw badRequest("Format yang diterima hanya JPG, PNG, atau WEBP.");
  }
  if (file.size > env.MAX_UPLOAD_BYTES) {
    throw badRequest("Ukuran foto terlalu besar. Maksimal 20 MB.");
  }

  // Hitung tahun dan tanggal dari body (prioritas) atau EXIF
  let exif = { takenYear: null, takenDate: null, fromExif: false };
  try {
    exif = await readExifYear(file.buffer);
  } catch {}

  let takenYear = null;
  if (body.taken_year && Number(body.taken_year) > 1800) {
    takenYear = Number(body.taken_year);
  } else if (body.taken_date) {
    takenYear = new Date(body.taken_date).getFullYear();
  } else if (exif.takenYear) {
    takenYear = exif.takenYear;
  } else {
    takenYear = new Date().getFullYear();
  }
  const takenDate = body.taken_date || exif.takenDate || `${takenYear}-01-01`;

  const cat = resolveCategory(body.category);
  const title = (body.title || safeFileStem(file.originalname) || "Kenangan Baru").slice(0, 120);
  const ext = extensionFromMime(mime) || "jpg";
  const id = randomUUID();
  const originalPath = `originals/${id}/asli.${ext}`;
  const thumbPath = `thumbs/${id}/kecil.webp`;
  const displayPath = `display/${id}/layar.jpg`;

  // Resize dari buffer yang sudah ada di memori — aman dengan try/catch
  let derived;
  try {
    derived = await makeDerivatives(file.buffer);
  } catch (imgErr) {
    console.warn("Peringatan resize Sharp, memakai buffer asli:", imgErr.message);
    derived = {
      width: null,
      height: null,
      thumbnailBuffer: file.buffer,
      displayBuffer: file.buffer,
    };
  }

  // Upload semua file sekaligus secara paralel
  await Promise.all([
    uploadBuffer(originalPath, file.buffer, mime),
    uploadBuffer(thumbPath, derived.thumbnailBuffer, "image/webp"),
    uploadBuffer(displayPath, derived.displayBuffer, "image/jpeg"),
  ]);

  // Simpan ke database langsung dengan status ready
  const { data: inserted, error } = await adminDb
    .from("photos")
    .insert({
      id,
      uploader_id: member.id,
      status: "ready",
      original_path: originalPath,
      thumbnail_path: thumbPath,
      display_path: displayPath,
      mime_type: file.mimetype,
      title,
      caption: body.caption || "Baru saja disimpan ke lemari kenangan keluarga.",
      place: body.place || "Album Pribadi",
      category: cat.id,
      chip: body.chip || cat.chip,
      taken_year: takenYear,
      taken_date: takenDate,
      year_from_exif: exif.fromExif && !body.taken_year && !body.taken_date,
      width: derived.width,
      height: derived.height,
      file_size_bytes: file.size,
    })
    .select("id")
    .single();
  if (error) throw error;

  // Tautkan ke album
  await attachAlbum(inserted.id, body.album_id, body.album || cat.defaultAlbum, cat.defaultAlbum);

  const photo = await getPhoto(inserted.id, member);
  return {
    photo,
    message: "Foto berhasil disimpan dengan aman ke dalam lemari.",
  };
}

export async function patchPhoto(member, id, body) {
  const row = await getPhotoRow(id);
  if (row.deleted_at) throw notFound("Foto sedang di tempat sampah.");

  const patch = {};
  if (body.title != null) patch.title = String(body.title).slice(0, 120);
  if (body.caption != null) patch.caption = String(body.caption);
  if (body.place != null) patch.place = String(body.place);
  if (body.taken_year != null) patch.taken_year = Number(body.taken_year) || null;
  if (body.taken_date != null) patch.taken_date = body.taken_date;
  if (body.category) {
    const cat = resolveCategory(body.category);
    patch.category = cat.id;
    patch.chip = body.chip || cat.chip;
  }
  if (body.chip) patch.chip = body.chip;
  if (Object.keys(patch).length) {
    const { error } = await adminDb.from("photos").update(patch).eq("id", id);
    if (error) throw error;
  }

  if (body.album_id || body.album) {
    await adminDb.from("album_photos").delete().eq("photo_id", id);
    await attachAlbum(id, body.album_id, body.album, null);
  }

  if (typeof body.is_favorite === "boolean" || typeof body.liked === "boolean") {
    const liked = body.is_favorite ?? body.liked;
    await setFavorite(member, id, liked);
  }

  if (Array.isArray(body.people_ids)) {
    await adminDb.from("photo_people").delete().eq("photo_id", id);
    if (body.people_ids.length) {
      await adminDb.from("photo_people").insert(
        body.people_ids.map((family_member_id) => ({ photo_id: id, family_member_id }))
      );
    }
  }

  return getPhoto(id, member);
}

export async function setFavorite(member, photoId, liked) {
  if (liked) {
    const { error } = await adminDb
      .from("photo_hearts")
      .upsert({ photo_id: photoId, member_id: member.id });
    if (error) throw error;
  } else {
    const { error } = await adminDb
      .from("photo_hearts")
      .delete()
      .eq("photo_id", photoId)
      .eq("member_id", member.id);
    if (error) throw error;
  }
}

export async function softDelete(member, id) {
  const row = await getPhotoRow(id);
  if (member.role !== "admin" && row.uploader_id !== member.id) {
    throw badRequest("Hanya pengunggah atau admin yang dapat memindahkan foto ke tempat sampah.");
  }
  const { error } = await adminDb.from("photos").update({ deleted_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
  return {
    ok: true,
    message: "Foto dipindah ke tempat sampah selama 30 hari, belum dihapus permanen.",
  };
}

export async function restorePhoto(member, id) {
  if (member.role !== "admin") throw badRequest("Hanya admin keluarga yang dapat mengembalikan foto dari sampah.");
  const { error } = await adminDb.from("photos").update({ deleted_at: null }).eq("id", id);
  if (error) throw error;
  return getPhoto(id, member, { includeDeleted: true });
}

function emptyPhotoList() {
  return {
    items: [],
    total: 0,
    total_label: lembarLabel(0),
    filters: [
      { id: "semua", label: "Semua" },
      { id: "keluarga", label: "Foto Keluarga" },
      { id: "pernikahan", label: "Masa Muda & Pernikahan" },
      { id: "hari-raya", label: "Hari Raya" },
      { id: "liburan", label: "Cucu & Liburan" },
    ],
  };
}

export async function purgeExpiredTrash() {
  const limit = new Date();
  limit.setDate(limit.getDate() - 30);
  const { data, error } = await adminDb
    .from("photos")
    .select("id, original_path, thumbnail_path, display_path")
    .not("deleted_at", "is", null)
    .lt("deleted_at", limit.toISOString());
  if (error) throw error;
  for (const row of data || []) {
    await removeFiles([row.original_path, row.thumbnail_path, row.display_path]);
    await adminDb.from("photos").delete().eq("id", row.id);
  }
  return { purged: (data || []).length };
}

export async function stats(member) {
  const { data, error } = await adminDb
    .from("photos")
    .select("id, taken_year, category, photo_hearts(member_id)")
    .is("deleted_at", null)
    .eq("status", "ready");
  if (error) throw error;
  const rows = data || [];
  const byYearMap = new Map();
  const byCategoryMap = new Map();
  let favorites = 0;
  for (const row of rows) {
    const year = row.taken_year || "tidak-diketahui";
    byYearMap.set(year, (byYearMap.get(year) || 0) + 1);
    byCategoryMap.set(row.category, (byCategoryMap.get(row.category) || 0) + 1);
    if ((row.photo_hearts || []).some((h) => h.member_id === member.id)) favorites += 1;
  }
  return {
    total_photos: rows.length,
    total_label: lembarLabel(rows.length),
    subtitle: "Tersimpan rapi & abadi",
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
}

export async function createShareLink(member, photoId, hours = env.SHARE_TTL_HOURS) {
  await getPhoto(photoId, member);
  const token = randomBytes(24).toString("base64url");
  const expires = new Date(Date.now() + hours * 60 * 60 * 1000);
  const { error } = await adminDb.from("share_links").insert({
    token,
    photo_id: photoId,
    created_by: member.id,
    expires_at: expires.toISOString(),
  });
  if (error) throw error;
  const shareUrl = `${env.PUBLIC_APP_URL}/s/${token}`;
  const text = `Kenangan keluarga untuk Anda: ${shareUrl}\nTautan ini hanya berlaku sementara.`;
  return {
    share_url: shareUrl,
    whatsapp_url: `https://wa.me/?text=${encodeURIComponent(text)}`,
    expires_at: expires.toISOString(),
    expires_label: `Berlaku sampai ${formatDateId(expires)} (sekitar ${hours} jam)`,
    message: "Tautan siap dikirim ke WhatsApp. Tidak bisa ditemukan lewat mesin pencari.",
  };
}

export async function resolveShare(token) {
  const { data, error } = await adminDb
    .from("share_links")
    .select("id, expires_at, revoked_at, view_count, photo_id, photos(*)")
    .eq("token", token)
    .maybeSingle();
  if (error) throw error;
  if (!data || data.revoked_at) throw notFound("Tautan berbagi sudah tidak berlaku.");
  if (new Date(data.expires_at).getTime() < Date.now()) {
    throw notFound("Tautan berbagi sudah kedaluwarsa. Minta keluarga mengirim ulang.");
  }
  const photo = data.photos;
  if (!photo || photo.deleted_at || photo.status !== "ready") {
    throw notFound("Foto pada tautan ini tidak tersedia.");
  }
  await adminDb.from("share_links").update({ view_count: (data.view_count || 0) + 1 }).eq("id", data.id);

  const ttl = Math.max(60, Math.floor((new Date(data.expires_at).getTime() - Date.now()) / 1000));
  const urlMap = await signedUrls([photo.display_path, photo.thumbnail_path], Math.min(ttl, 48 * 3600));
  return {
    title: photo.title,
    caption: photo.caption,
    place: photo.place,
    year_label: photo.taken_year ? `Tahun ${photo.taken_year}` : null,
    taken_date_label: formatDateId(photo.taken_date),
    image_url: urlMap.get(photo.display_path) || urlMap.get(photo.thumbnail_path),
    expires_at: data.expires_at,
    robots: "noindex, nofollow",
  };
}
