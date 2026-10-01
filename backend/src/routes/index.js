import { Router } from "express";
import { photosRouter } from "./photos.js";
import { albumsRouter } from "./albums.js";
import { statsRouter } from "./stats.js";
import { shareRouter } from "./share.js";
import { exportRouter } from "./export.js";
import { authRouter } from "./auth.js";
import { settingsRouter } from "./settings.js";
import { aiRouter } from "./ai.js";

export const apiRouter = Router();

// Health check endpoint
apiRouter.get("/health", (req, res) => {
  res.json({
    status: "ok",
    app: "Album Kenangan Saya",
    family: "Satu Keluarga Privat",
    timestamp: new Date().toISOString(),
  });
});

apiRouter.use("/photos", photosRouter);
apiRouter.use("/albums", albumsRouter);
apiRouter.use("/stats", statsRouter);
apiRouter.use("/share", shareRouter);
apiRouter.use("/export", exportRouter);
apiRouter.use("/settings", settingsRouter);
apiRouter.use("/ai", aiRouter);
apiRouter.use("/members", authRouter);
apiRouter.use("/auth", authRouter);
apiRouter.use("/", authRouter);
