import { Router } from "express";
import multer from "multer";
import {
  completeUpload,
  getPhoto,
  initUpload,
  listPhotos,
  patchPhoto,
  restorePhoto,
  setFavorite,
  softDelete,
  uploadDirect,
} from "../services/photos.js";
import { requireAdmin, requireFamily } from "../middleware/auth.js";
import { badRequest } from "../utils/httpError.js";
import { env, isSupabaseConfigured } from "../config/env.js";
import { localStore } from "../services/localStore.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: env.MAX_UPLOAD_BYTES,
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const mime = (file.mimetype || "").toLowerCase();
    const isImage =
      ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/pjpeg", "image/jfif"].includes(mime) ||
      /\.(jpe?g|png|webp|jfif)$/i.test(file.originalname || "");
    if (isImage) {
      cb(null, true);
    } else {
      cb(badRequest("Format foto harus JPG, PNG, atau WEBP."));
    }
  },
});

// Middleware wrapper untuk tangani error multer secara ramah
function handleUpload(req, res, next) {
  upload.single("photo")(req, res, (err) => {
    if (!err) return next();
    if (err.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ error: true, message: "Ukuran foto terlalu besar. Maksimal 20 MB." });
    }
    if (err.code === "LIMIT_UNEXPECTED_FILE") {
      return res.status(400).json({ error: true, message: "Field foto tidak dikenali. Gunakan field 'photo'." });
    }
    next(err);
  });
}

export const photosRouter = Router();

// Seluruh rute foto membutuhkan autentikasi keluarga
photosRouter.use(requireFamily);

/**
 * POST /api/photos/upload
 * Fleksibel:
 * 1. Jika dikirim multipart (field 'photo'): langsung proses kompresi, EXIF, dan simpan sekaligus.
 * 2. Jika dikirim JSON: generate signed upload URL untuk direct-to-storage upload.
 */
photosRouter.post("/upload", handleUpload, async (req, res, next) => {
  try {
    const file = req.file;

    if (!isSupabaseConfigured()) {
      if (file) {
        const result = await localStore.uploadDirect(req.member, file, req.body);
        return res.status(201).json(result);
      }
      return res.status(400).json({ error: true, message: "Kirim foto via multipart (field 'photo') dalam mode lokal." });
    }

    if (file) {
      // Direct upload: resize + simpan sekaligus, tanpa roundtrip download
      const result = await uploadDirect(req.member, file, req.body);
      return res.status(201).json(result);
    }

    // Direct-to-storage signed URL flow (untuk client yang mau upload langsung ke Supabase)
    const init = await initUpload(req.member, req.body);
    res.status(201).json(init);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/photos/:id/complete
 * Menyelesaikan proses upload bertahap (signed URL)
 */
photosRouter.post("/:id/complete", async (req, res, next) => {
  try {
    const photo = await completeUpload(req.member, req.params.id);
    res.json({
      photo,
      message: "Foto berhasil diproses dan disimpan ke lemari kenangan.",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/photos
 * List foto dengan filter kategori, tahun, favorit, dan pencarian teks
 */
photosRouter.get("/", async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      const result = await localStore.listPhotos({
        category: req.query.category,
        year: req.query.year,
        favorite: req.query.favorite ?? req.query.liked,
        search: req.query.search ?? req.query.q,
        trash: req.query.trash === "true",
      });
      return res.json(result);
    }

    const result = await listPhotos({
      member: req.member,
      category: req.query.category,
      year: req.query.year,
      favorite: req.query.favorite ?? req.query.liked,
      search: req.query.search ?? req.query.q,
      albumId: req.query.album_id,
      trash: req.query.trash === "true",
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/photos/:id
 * Detail satu foto
 */
photosRouter.get("/:id", async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      const photo = await localStore.getPhoto(req.params.id);
      return res.json({ photo });
    }

    const photo = await getPhoto(req.params.id, req.member, {
      includeDeleted: req.query.include_deleted === "true",
    });
    res.json({ photo });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/photos/:id
 * Perbarui judul, caption, tahun, tempat, album, atau status favorit
 */
photosRouter.patch("/:id", async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      const photo = await localStore.patchPhoto(req.params.id, req.body);
      return res.json({
        photo,
        message: "Keterangan foto berhasil diperbarui.",
      });
    }

    const updated = await patchPhoto(req.member, req.params.id, req.body);
    res.json({
      photo: updated,
      message: "Keterangan foto berhasil diperbarui.",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/photos/:id/heart
 * Tandai favorit ("Tersimpan di Hati")
 */
photosRouter.post("/:id/heart", async (req, res, next) => {
  try {
    const liked = req.body.liked !== false;

    if (!isSupabaseConfigured()) {
      const photo = await localStore.setFavorite(req.params.id, liked);
      return res.json({
        photo,
        message: liked ? "Tersimpan di Hati." : "Dihapus dari Favorit.",
      });
    }

    await setFavorite(req.member, req.params.id, liked);
    const photo = await getPhoto(req.params.id, req.member);
    res.json({
      photo,
      message: liked ? "Tersimpan di Hati." : "Dihapus dari Favorit.",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/photos/:id
 * Soft delete foto (disimpan 30 hari di tempat sampah agar tidak hilang tidak sengaja)
 */
photosRouter.delete("/:id", async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      const result = await localStore.softDelete(req.params.id);
      return res.json(result);
    }

    const result = await softDelete(req.member, req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/photos/:id/restore
 * Pulihkan foto dari tempat sampah (khusus admin)
 */
photosRouter.post("/:id/restore", requireAdmin, async (req, res, next) => {
  try {
    const photo = await restorePhoto(req.member, req.params.id);
    res.json({
      photo,
      message: "Foto berhasil dipulihkan kembali ke lemari kenangan.",
    });
  } catch (err) {
    next(err);
  }
});
