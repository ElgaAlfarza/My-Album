import { Router } from "express";
import { stats } from "../services/photos.js";
import { requireFamily } from "../middleware/auth.js";
import { isSupabaseConfigured } from "../config/env.js";
import { localStore } from "../services/localStore.js";

export const statsRouter = Router();

statsRouter.use(requireFamily);

/**
 * GET /api/stats
 * Statistik koleksi lemari: total foto, foto per tahun, jumlah favorit
 * Digunakan untuk badge "128 Lembar Foto" dan ringkasan keluarga
 */
statsRouter.get("/", async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      const data = await localStore.stats();
      return res.json(data);
    }

    const data = await stats(req.member);
    res.json(data);
  } catch (err) {
    next(err);
  }
});
