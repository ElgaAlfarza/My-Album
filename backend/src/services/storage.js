import { adminDb } from "./supabase.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

const bucket = () => env.STORAGE_BUCKET;
const backup = () => env.BACKUP_BUCKET;

export async function createSignedUpload(path) {
  const { data, error } = await adminDb.storage.from(bucket()).createSignedUploadUrl(path);
  if (error) throw new HttpError(500, "Gagal menyiapkan tempat unggah yang aman.", error.message);
  return data;
}

export async function uploadBuffer(path, buffer, contentType) {
  const { error } = await adminDb.storage.from(bucket()).upload(path, buffer, {
    contentType,
    upsert: true,
  });
  if (error) throw new HttpError(500, "Gagal menyimpan berkas ke lemari aman.", error.message);
}

export async function downloadFile(path) {
  const { data, error } = await adminDb.storage.from(bucket()).download(path);
  if (error || !data) throw new HttpError(500, "Berkas asli tidak dapat dibaca dari penyimpanan.", error?.message);
  return Buffer.from(await data.arrayBuffer());
}

export async function signedUrl(path, expiresIn = env.SIGNED_URL_TTL_SECONDS) {
  if (!path) return null;
  const { data, error } = await adminDb.storage.from(bucket()).createSignedUrl(path, expiresIn);
  if (error) throw new HttpError(500, "Gagal membuat tautan foto sementara.", error.message);
  return data.signedUrl;
}

export async function signedUrls(paths, expiresIn = env.SIGNED_URL_TTL_SECONDS) {
  const unique = [...new Set(paths.filter(Boolean))];
  const map = new Map();
  await Promise.all(
    unique.map(async (path) => {
      map.set(path, await signedUrl(path, expiresIn));
    })
  );
  return map;
}

export async function copyToBackup(fromPath, toPath) {
  const file = await downloadFile(fromPath);
  const { error } = await adminDb.storage.from(backup()).upload(toPath, file, { upsert: true });
  if (error) throw new HttpError(500, "Gagal menyalin cadangan ke lokasi kedua.", error.message);
}

export async function removeFiles(paths) {
  const list = paths.filter(Boolean);
  if (!list.length) return;
  const { error } = await adminDb.storage.from(bucket()).remove(list);
  if (error) throw new HttpError(500, "Gagal menghapus berkas dari penyimpanan.", error.message);
}
