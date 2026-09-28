import { Router } from "express";
import { createAlbum, listAlbums, patchAlbum } from "../services/albums.js";
import { requireAdmin, requireFamily } from "../middleware/auth.js";
import { adminDb } from "../services/supabase.js";
import { notFound } from "../utils/httpError.js";

import { isSupabaseConfigured } from "../config/env.js";
import { localStore } from "../services/localStore.js";

export const albumsRouter = Router();

albumsRouter.use(requireFamily);

/**
 * GET /api/albums
 * Daftar semua map/album kenangan keluarga
 */
albumsRouter.get("/", async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      const data = await localStore.listAlbums();
      return res.json(data);
    }

    const data = await listAlbums();
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/albums
 * Buat album kenangan baru
 */
albumsRouter.post("/", async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      const created = await localStore.createAlbum(req.body);
      return res.status(201).json({
        album: created,
        message: "Album baru berhasil dibuat di lemari.",
      });
    }

    const created = await createAlbum(req.body);
    res.status(201).json({
      album: created,
      message: "Album baru berhasil dibuat di lemari.",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/albums/:id
 * Detail album beserta daftar foto di dalamnya
 */
albumsRouter.get("/:id", async (req, res, next) => {
  try {
    const { data: album, error } = await adminDb
      .from("albums")
      .select("id, nama, deskripsi, cover_photo_id, created_at, updated_at")
      .eq("id", req.params.id)
      .maybeSingle();
    if (error) throw error;
    if (!album) throw notFound("Album tidak ditemukan.");

    res.json({ album });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/albums/:id
 * Ubah nama album, deskripsi, cover, atau susunan foto
 */
albumsRouter.patch("/:id", async (req, res, next) => {
  try {
    const updated = await patchAlbum(req.params.id, req.body);
    res.json({
      album: updated,
      message: "Keterangan album berhasil diperbarui.",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/albums/:id
 * Hapus album (foto tidak dihapus, hanya map yang dibubarkan)
 */
albumsRouter.delete("/:id", requireAdmin, async (req, res, next) => {
  try {
    const { error } = await adminDb.from("albums").delete().eq("id", req.params.id);
    if (error) throw error;
    res.json({
      ok: true,
      message: "Album telah dihapus. Semua foto di dalamnya tetap aman di Semua Foto.",
    });
  } catch (err) {
    next(err);
  }
});
