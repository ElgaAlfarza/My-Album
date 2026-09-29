import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { apiRouter } from "./routes/index.js";
import { shareRouter } from "./routes/share.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, "../../");

export const app = express();

// Keamanan HTTP Header — sesuaikan agar foto signed URL bisa dimuat di browser
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // Tidak memblokir signed URL CDN di frontend
  })
);

// CORS — izinkan frontend keluarga
const allowedOrigins = env.FRONTEND_ORIGIN.split(",").map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes("*") || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(null, true); // Tetap ramah untuk akses lokal di jaringan rumah
      }
    },
    credentials: true,
  })
);

// Rate limiter santai — lindungi server tanpa mengganggu scrolling foto keluarga
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: true,
    message: "Terlalu banyak permintaan dalam waktu singkat. Lemari istirahat sejenak.",
  },
});
app.use(limiter);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Sajikan berkas statis frontend (public, index.html, css, js, assets)
app.use(express.static(path.resolve(rootDir, "public")));
app.use(express.static(rootDir));
app.use("/local_storage", express.static(path.resolve(rootDir, "backend/local_storage")));

// Tautan pendek WhatsApp: http://domain/s/:token
app.use("/", shareRouter);

// Rute Utama API
app.use("/api", apiRouter);

// Halaman utama
app.get("/", (req, res) => {
  const publicHtml = path.resolve(rootDir, "public/index.html");
  if (fs.existsSync(publicHtml)) {
    return res.sendFile(publicHtml);
  }
  res.sendFile(path.join(rootDir, "index.html"));
});

// Penanganan 404 & Error Terpusat
app.use(notFoundHandler);
app.use(errorHandler);
