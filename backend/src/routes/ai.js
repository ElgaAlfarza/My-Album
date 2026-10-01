import { Router } from "express";
import { requireFamily } from "../middleware/auth.js";
import { adminDb } from "../services/supabase.js";
import { isSupabaseConfigured } from "../config/env.js";

export const aiRouter = Router();
aiRouter.use(requireFamily);

// Cache in-memory (untuk performa, tapi diisi dari Supabase saat diperlukan)
let cachedApiKey = process.env.GEMINI_API_KEY || "";

/**
 * Muat API key dari Supabase (fallback jika memory kosong)
 * Disimpan di kolom no_hp admin member sebagai bagian dari JSON settings
 */
async function loadApiKeyFromDb() {
  if (cachedApiKey) return cachedApiKey;
  if (!isSupabaseConfigured()) return "";
  try {
    const { data: member } = await adminDb
      .from("family_members")
      .select("no_hp")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    if (member && member.no_hp) {
      let settings = {};
      try {
        // no_hp bisa berupa JSON atau string biasa
        if (member.no_hp.startsWith("{")) {
          settings = JSON.parse(member.no_hp);
        }
      } catch {}
      if (settings.gemini_api_key) {
        cachedApiKey = settings.gemini_api_key;
        return cachedApiKey;
      }
    }
  } catch (err) {
    console.warn("Gagal memuat Gemini key dari DB:", err.message);
  }
  return "";
}

/**
 * Simpan API key ke Supabase (merge dengan settings yang sudah ada)
 */
async function saveApiKeyToDb(key) {
  if (!isSupabaseConfigured()) return;
  try {
    const { data: member } = await adminDb
      .from("family_members")
      .select("no_hp")
      .eq("role", "admin")
      .limit(1)
      .maybeSingle();

    let settings = {};
    if (member && member.no_hp && member.no_hp.startsWith("{")) {
      try { settings = JSON.parse(member.no_hp); } catch {}
    }
    settings.gemini_api_key = key;

    await adminDb
      .from("family_members")
      .update({ no_hp: JSON.stringify(settings) })
      .eq("role", "admin");
  } catch (err) {
    console.warn("Gagal menyimpan Gemini key ke DB:", err.message);
    throw err;
  }
}

/**
 * GET /api/ai/status
 * Cek apakah API key sudah terpasang (cek memory + DB)
 */
aiRouter.get("/status", async (req, res) => {
  const key = await loadApiKeyFromDb();
  res.json({ configured: !!key });
});

/**
 * POST /api/ai/set-key
 * Simpan API key Gemini ke Supabase (persisten, tidak hilang saat restart)
 */
aiRouter.post("/set-key", async (req, res) => {
  const { key } = req.body;
  if (!key || typeof key !== "string" || key.trim().length < 10) {
    return res.status(400).json({ ok: false, message: "API key tidak valid." });
  }
  const trimmedKey = key.trim();

  // Simpan ke memory dan ke Supabase
  cachedApiKey = trimmedKey;
  try {
    await saveApiKeyToDb(trimmedKey);
    res.json({ ok: true, message: "API key berhasil disimpan ke cloud (tidak akan hilang saat refresh)." });
  } catch {
    // Memory sudah tersimpan, Supabase gagal — tetap laporkan sukses tapi kasih warning
    res.json({ ok: true, message: "API key disimpan di server. Peringatan: tidak bisa disimpan ke cloud, mungkin hilang saat restart." });
  }
});

/**
 * POST /api/ai/describe
 * Analisis foto dengan Gemini Vision → judul + deskripsi + saran album
 * Body: { image_base64: string, mime_type: string }
 */
/**
 * GET /api/ai/test
 * Tes koneksi Gemini API dengan teks saja (tanpa gambar) untuk diagnosa
 */
aiRouter.get("/test", async (req, res) => {
  const apiKey = await loadApiKeyFromDb();
  if (!apiKey) return res.json({ ok: false, message: "Key belum dipasang." });

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: "Halo, balas dengan: OK" }] }] }),
    });
    const body = await r.json();
    if (r.ok) {
      return res.json({ ok: true, message: "Gemini OK", reply: body?.candidates?.[0]?.content?.parts?.[0]?.text });
    }
    return res.json({ ok: false, status: r.status, gemini_error: body });
  } catch (err) {
    return res.json({ ok: false, message: err.message });
  }
});

aiRouter.post("/describe", async (req, res, next) => {
  try {
    const apiKey = await loadApiKeyFromDb();

    if (!apiKey) {
      return res.status(503).json({
        ok: false,
        message: "API key Gemini belum dipasang. Silakan atur di Admin → Pengaturan → Konfigurasi AI.",
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

    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

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
        generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
      }),
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      const geminiMsg = errBody?.error?.message || "Unknown error";
      console.error("Gemini API error:", response.status, geminiMsg);

      if (response.status === 400) {
        return res.status(400).json({ ok: false, message: `Gemini: ${geminiMsg}` });
      }
      if (response.status === 403 || response.status === 401) {
        return res.status(503).json({ ok: false, message: `API key tidak valid: ${geminiMsg}` });
      }
      if (response.status === 429) {
        return res.status(429).json({ ok: false, message: "Batas kuota AI tercapai. Coba lagi nanti." });
      }
      return res.status(502).json({ ok: false, message: `Gemini error ${response.status}: ${geminiMsg}` });
    }

    const geminiData = await response.json();
    const rawText = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    let parsed = {};
    try {
      const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      parsed = JSON.parse(cleaned);
    } catch {
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
