import { Router } from "express";
import { createShareLink, resolveShare } from "../services/photos.js";
import { requireFamily } from "../middleware/auth.js";
import { badRequest } from "../utils/httpError.js";

import { isSupabaseConfigured } from "../config/env.js";
import { localStore } from "../services/localStore.js";

export const shareRouter = Router();

/**
 * POST /api/share/whatsapp
 * Generate link publik terbatas waktu (24-48 jam) untuk dikirim ke keluarga via WhatsApp
 */
shareRouter.post("/whatsapp", requireFamily, async (req, res, next) => {
  try {
    const photoId = req.body.photo_id;
    if (!photoId) throw badRequest("ID foto yang ingin dibagikan wajib disertakan.");
    const hours = Number(req.body.hours) || 48;

    if (!isSupabaseConfigured()) {
      const data = await localStore.createShareLink(photoId, hours);
      return res.json(data);
    }

    const data = await createShareLink(req.member, photoId, hours);
    res.json(data);
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/share/:token
 * Endpoint JSON untuk aplikasi klien jika ingin merender tautan berbagi
 */
shareRouter.get("/:token", async (req, res, next) => {
  try {
    const photo = !isSupabaseConfigured()
      ? await localStore.resolveShare(req.params.token)
      : await resolveShare(req.params.token);
    res.set("X-Robots-Tag", "noindex, nofollow, noarchive");
    res.json({ photo });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /s/:token
 * Halaman web hangat & ramah keluarga untuk membuka tautan dari WhatsApp
 * Tidak dapat di-index Google / mesin pencari (noindex, nofollow)
 */
shareRouter.get("/s/:token", async (req, res, next) => {
  try {
    const photo = !isSupabaseConfigured()
      ? await localStore.resolveShare(req.params.token)
      : await resolveShare(req.params.token);
    res.set("X-Robots-Tag", "noindex, nofollow, noarchive");

    const html = `<!DOCTYPE html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow, noarchive">
  <meta name="googlebot" content="noindex, nofollow, noarchive">
  <title>${escapeHtml(photo.title)} — Album Kenangan Keluarga</title>
  
  <!-- OpenGraph untuk pratinjau WhatsApp yang rapi -->
  <meta property="og:title" content="${escapeHtml(photo.title)}">
  <meta property="og:description" content="${escapeHtml(photo.caption || 'Foto kenangan dari keluarga')}">
  <meta property="og:image" content="${photo.image_url || ''}">
  <meta property="og:type" content="article">

  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Newsreader:ital,opsz,wght@0,6..72,400..700;1,6..72,400..700&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap" rel="stylesheet">
  
  <style>
    :root {
      --bg: #FDFBF7;
      --card-bg: #FFFFFF;
      --text: #2C2623;
      --muted: #6B625B;
      --sage: #5F7464;
      --terracotta: #A45D4B;
      --sand: #EAE4D9;
      --border: #E2DBD0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background-color: var(--bg);
      color: var(--text);
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 1.5rem 1rem 3rem;
    }
    .badge-top {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      background: var(--sand);
      color: var(--sage);
      padding: 0.4rem 0.9rem;
      border-radius: 999px;
      font-size: 0.875rem;
      font-weight: 600;
      margin-bottom: 1.5rem;
    }
    .container {
      max-width: 680px;
      width: 100%;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 20px;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(44, 38, 35, 0.05);
    }
    .frame {
      width: 100%;
      background: #111;
      text-align: center;
    }
    .frame img {
      width: 100%;
      max-height: 75vh;
      object-fit: contain;
      display: block;
    }
    .content {
      padding: 2rem;
    }
    .meta-row {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      margin-bottom: 0.75rem;
      font-size: 0.9rem;
      color: var(--terracotta);
      font-weight: 600;
    }
    h1 {
      font-family: 'Newsreader', Georgia, serif;
      font-size: 2rem;
      font-weight: 600;
      line-height: 1.25;
      margin-bottom: 1rem;
      color: var(--text);
    }
    .caption {
      font-family: 'Newsreader', Georgia, serif;
      font-style: italic;
      font-size: 1.25rem;
      line-height: 1.6;
      color: var(--muted);
      border-left: 3px solid var(--sand);
      padding-left: 1rem;
      margin-bottom: 1.5rem;
    }
    .footer-note {
      font-size: 0.85rem;
      color: var(--muted);
      background: #FAF7F2;
      padding: 1rem;
      border-radius: 12px;
      line-height: 1.5;
    }
    .footer-brand {
      margin-top: 2rem;
      font-size: 0.9rem;
      color: var(--muted);
      text-align: center;
    }
  </style>
</head>
<body>
  <div class="badge-top">
    <span>🔒 Ruang Kenangan Privat Keluarga</span>
  </div>

  <main class="container">
    <div class="frame">
      <img src="${photo.image_url}" alt="${escapeHtml(photo.title)}">
    </div>
    <div class="content">
      <div class="meta-row">
        ${photo.year_label ? `<span>🗓️ ${escapeHtml(photo.year_label)}</span>` : ''}
        ${photo.place ? `<span>📍 ${escapeHtml(photo.place)}</span>` : ''}
        ${photo.taken_date_label ? `<span>(${escapeHtml(photo.taken_date_label)})</span>` : ''}
      </div>
      <h1>${escapeHtml(photo.title)}</h1>
      <p class="caption">“${escapeHtml(photo.caption || 'Tanpa keterangan.')}”</p>
      <div class="footer-note">
        <strong>Pesan Keamanan:</strong> Tautan ini dibagikan khusus untuk Anda melalui WhatsApp dan akan kedaluwarsa secara otomatis. Foto ini bersifat privat dan tidak dapat dicari di Google.
      </div>
    </div>
  </main>

  <footer class="footer-brand">
    <p><strong>Album Kenangan Saya</strong> — Menjaga warisan kisah keluarga tetap abadi.</p>
  </footer>
</body>
</html>`;

    res.send(html);
  } catch (err) {
    next(err);
  }
});

function escapeHtml(text) {
  if (!text) return "";
  return String(text).replace(/[&<>"']/g, (m) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[m]));
}
