import { adminDb } from "./supabase.js";
import { badRequest, notFound } from "../utils/httpError.js";
import { lembarLabel } from "../utils/format.js";
import { signedUrl } from "./storage.js";

export async function listAlbums() {
  const { data: albums, error } = await adminDb
    .from("albums")
    .select("id, nama, deskripsi, cover_photo_id, created_at")
    .order("nama");
  if (error) throw error;

  const { data: counts, error: countError } = await adminDb
    .from("album_photos")
    .select("album_id, photo:photos!inner(id, thumbnail_path, deleted_at, status)");
  if (countError) throw countError;

  const grouped = new Map();
  for (const row of counts || []) {
    if (!row.photo || row.photo.deleted_at || row.photo.status !== "ready") continue;
    const list = grouped.get(row.album_id) || [];
    list.push(row.photo);
    grouped.set(row.album_id, list);
  }

  const items = [];
  for (const album of albums || []) {
    const photos = grouped.get(album.id) || [];
    const coverPath = photos[0]?.thumbnail_path;
    items.push({
      id: album.id,
      nama: album.nama,
      deskripsi: album.deskripsi,
      photo_count: photos.length,
      photo_count_label: `${photos.length} lembar foto tersimpan rapi`,
      cover_url: coverPath ? await signedUrl(coverPath) : null,
      stack_urls: await Promise.all(photos.slice(0, 3).map((p) => signedUrl(p.thumbnail_path))),
    });
  }
  return { items, total_label: lembarLabel(items.reduce((sum, a) => sum + a.photo_count, 0)) };
}

export async function createAlbum(body) {
  const nama = String(body.nama || "").trim();
  if (!nama) throw badRequest("Nama album wajib diisi.");
  const { data, error } = await adminDb
    .from("albums")
    .insert({
      nama,
      deskripsi: body.deskripsi || "",
      cover_photo_id: body.cover_photo_id || null,
    })
    .select("*")
    .single();
  if (error) {
    if (String(error.message).includes("duplicate")) {
      throw badRequest("Nama album itu sudah ada.");
    }
    throw error;
  }
  return data;
}

export async function patchAlbum(id, body) {
  const { data: existing } = await adminDb.from("albums").select("id").eq("id", id).maybeSingle();
  if (!existing) throw notFound("Album tidak ditemukan.");
  const patch = {};
  if (body.nama != null) patch.nama = String(body.nama).trim();
  if (body.deskripsi != null) patch.deskripsi = body.deskripsi;
  if (body.cover_photo_id !== undefined) patch.cover_photo_id = body.cover_photo_id;
  const { data, error } = await adminDb.from("albums").update(patch).eq("id", id).select("*").single();
  if (error) throw error;

  if (Array.isArray(body.photo_ids)) {
    await adminDb.from("album_photos").delete().eq("album_id", id);
    if (body.photo_ids.length) {
      await adminDb.from("album_photos").insert(
        body.photo_ids.map((photo_id, urutan) => ({ album_id: id, photo_id, urutan }))
      );
    }
  }
  return data;
}
