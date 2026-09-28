import { Router } from "express";
import { exportFamilyArchive } from "../services/export.js";
import { requireFamily } from "../middleware/auth.js";

import { isSupabaseConfigured } from "../config/env.js";
import { localStore } from "../services/localStore.js";

export const exportRouter = Router();

exportRouter.use(requireFamily);

/**
 * POST /api/export & GET /api/export
 * Mengunduh seluruh foto asli + keterangan cerita dalam berkas ZIP
 * Mendukung fitur "Buku Panduan Besar" dan cadangan seumur hidup ("tidak akan hilang")
 */
const handleExport = async (req, res, next) => {
  try {
    const { stream, filename } = !isSupabaseConfigured()
      ? await localStore.exportArchive()
      : await exportFamilyArchive(req.member);

    res.attachment(filename);
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Cache-Control", "no-store");
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
};

exportRouter.post("/", handleExport);
exportRouter.get("/", handleExport);
