import { Router } from "express";
import { requireFamily } from "../middleware/auth.js";

export const aiRouter = Router();
aiRouter.use(requireFamily);

// Simpan API key di memori (bisa di-set via admin atau env)
let cachedApiKey = process.env.GEMINI_API_KEY || "";

/**
 * GET /api/ai/status
 * Cek apakah API key sudah terpasang
 */
aiRouter.get("/status", (req, res) => {
  res.json({ configured: !!cachedApiKey });
});

/**
 * POST /api/ai/set-key
 * Simpan API key Gemini (hanya dari admin)
 */
aiRouter.post("/set-key", (req, res) => {
  const { key } = req.body;
  if (!key || typeof key !== "string" || key.trim().length < 10) {
    return res.status(400).json({ ok: false, message: "API key tidak valid." });
  }
  cachedApiKey = key.trim();
  res.json({ ok: true, message: "API key berhasil disimpan." });
});

/**
 * POST /api/ai/describe
 * Analisis foto dengan Gemini Vision dan hasilkan judul + deskripsi + saran album
 * Body: { image_base64: string, mime_type: string }
 */
aiRouter.post("/describe", async (req, res, next) => {
  try {
    if (!cachedApiKey) {
      return res.status(503).json({
        ok: false,
        message: "API key Gemini belum dipasang. Silakan atur di Admin → Pengaturan.",
      });
    }

    const { image_base64, mime_type } = req.body;
    if (!image_base64) {
      return res.status(400).json({ ok: false, message: "Data gambar tidak ada." });
    }

    const mimeType = mime_type || "image/jpeg";

    const prompt = `Anda adalah asisten album foto keluarga Indonesia.
Analisis foto ini dan kembalikan JSON dengan format berikut (tanpa markdown, langsung JSON saja):
{
  "title": "Judul singkat foto dalam bahasa Indonesia (max 60 karakter, jangan gunakan tanda kutip)",
  "description": "Keterangan/caption 1-2 kalimat dalam bahasa Indonesia yang hangat dan personal",
  "album": "Nama album yang paling sesuai dari pilihan: Foto Keluarga, Masa Muda & Pernikahan, Hari Raya, Cucu & Liburan",
  "place": "Tebak lokasi jika bisa (kosong jika tidak yakin)"
}

Pilih album berdasarkan isi foto:
- Foto Keluarga: foto keluarga sehari-hari, potret, dll
- Masa Muda & Pernikahan: foto pernikahan, wisuda, muda
- Hari Raya: foto lebaran, natal, tahun baru, sungkeman
- Cucu & Liburan: foto liburan, jalan-jalan, piknik, cucu bermain`;

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${cachedApiKey}`;

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [
            { inline_data: { mime_type: mimeType, data: image_base64 } },
            { text: prompt },
          ],
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 300,
        },
      }),
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error("Gemini API error:", response.status, errBody);
      if (response.status === 400) {
        return res.status(400).json({ ok: false, message: "Format gambar tidak didukung AI." });
      }
      if (response.status === 403 || response.status === 401) {
        return res.status(503).json({ ok: false, message: "API key tidak valid atau expired." });
      }
      if (response.status === 429) {
        return res.status(429).json({ ok: false, message: "Batas kuota AI tercapai. Coba lagi nanti." });
      }
      return res.status(502).json({ ok: false, message: "Gagal menghubungi AI." });
    }

    const geminiData = await response.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Parse JSON dari response Gemini
    let parsed = {};
    try {
      // Bersihkan markdown code block jika ada
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
      // Fallback jika JSON tidak valid
      parsed = {
        title: "",
        description: rawText.slice(0, 200),
        album: "Foto Keluarga",
        place: "",
      };
    }

    res.json({
      ok: true,
      title: (parsed.title || "").slice(0, 80),
      description: (parsed.description || "").slice(0, 300),
      album: parsed.album || "Foto Keluarga",
      place: (parsed.place || "").slice(0, 80),
    });
  } catch (err) {
    next(err);
  }
});
