import { Router } from "express";
import { adminDb } from "../services/supabase.js";
import { requireAdmin, requireFamily } from "../middleware/auth.js";
import { isSupabaseConfigured, env } from "../config/env.js";

export const settingsRouter = Router();

// In-memory fallback
let currentSettings = {
  site_name: "Album Kenangan Saya",
  site_tagline: "Lemari Foto Privat Keluarga",
  kicker: "Ruang Kenangan Pribadi",
  hero_title: "Selamat Datang di Lemari Kenangan",
  hero_lede: "Tempat aman untuk menyimpan, merapikan, dan membuka kembali foto-foto berharga Anda bersama keluarga tercinta dengan tenang dan mudah.",
  footer_title: "Album Kenangan Saya",
  footer_text: "Menjaga warisan kisah keluarga tetap abadi, tenang, dan mudah dijangkau.",
  admin_name: "Ayah (Admin)",
  admin_avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80",
};

/**
 * GET /api/settings
 * Membaca pengaturan umum website/lemari foto
 */
settingsRouter.get("/", async (req, res) => {
  try {
    let settings = { ...currentSettings };

    if (isSupabaseConfigured()) {
      // 1. Ambil data profil admin dari tabel family_members
      try {
        const { data: adminMember } = await adminDb
          .from("family_members")
          .select("nama, avatar_url")
          .eq("role", "admin")
          .eq("aktif", true)
          .limit(1)
          .maybeSingle();

        if (adminMember) {
          if (adminMember.nama) settings.admin_name = adminMember.nama;
          if (adminMember.avatar_url) settings.admin_avatar = adminMember.avatar_url;
        }
      } catch (err) {
        console.warn("Gagal membaca profil admin:", err.message);
      }

      // 2. Ambil pengaturan umum jika tabel app_settings sudah dibuat di Supabase
      try {
        const { data: dbSettings } = await adminDb
          .from("app_settings")
          .select("value")
          .eq("key", "general")
          .maybeSingle();

        if (dbSettings?.value && typeof dbSettings.value === "object") {
          settings = { ...settings, ...dbSettings.value };
        }
      } catch {
        // Abaikan jika tabel app_settings belum ada
      }
    }

    res.json({ settings });
  } catch (err) {
    res.json({ settings: currentSettings });
  }
});

/**
 * PUT & POST /api/settings
 * Mengubah nama web, sambutan, foto profil, dan nama admin (khusus admin)
 */
const handleSaveSettings = async (req, res, next) => {
  try {
    const {
      site_name,
      site_tagline,
      kicker,
      hero_title,
      hero_lede,
      footer_title,
      footer_text,
      admin_name,
      admin_avatar,
    } = req.body;

    const updated = {
      ...currentSettings,
      ...(site_name && { site_name: String(site_name).trim() }),
      ...(site_tagline && { site_tagline: String(site_tagline).trim() }),
      ...(kicker && { kicker: String(kicker).trim() }),
      ...(hero_title && { hero_title: String(hero_title).trim() }),
      ...(hero_lede && { hero_lede: String(hero_lede).trim() }),
      ...(footer_title && { footer_title: String(footer_title).trim() }),
      ...(footer_text && { footer_text: String(footer_text).trim() }),
      ...(admin_name && { admin_name: String(admin_name).trim() }),
      ...(admin_avatar && { admin_avatar: String(admin_avatar).trim() }),
    };

    currentSettings = updated;

    if (isSupabaseConfigured()) {
      // 1. Simpan nama admin dan avatar ke tabel family_members
      if (admin_name || admin_avatar) {
        const updates = {};
        if (admin_name) updates.nama = String(admin_name).trim();
        if (admin_avatar) updates.avatar_url = String(admin_avatar).trim();

        await adminDb
          .from("family_members")
          .update(updates)
          .eq("role", "admin");
      }

      // 2. Simpan pengaturan umum ke tabel app_settings jika tersedia
      try {
        await adminDb.from("app_settings").upsert({
          key: "general",
          value: updated,
          updated_at: new Date().toISOString(),
        });
      } catch {
        // Jika tabel app_settings belum ada, data tetap tersimpan di in-memory & family_members
      }
    }

    res.json({
      ok: true,
      settings: updated,
      message: "Pengaturan lemari kenangan berhasil diperbarui!",
    });
  } catch (err) {
    next(err);
  }
};

settingsRouter.put("/", requireFamily, requireAdmin, handleSaveSettings);
settingsRouter.post("/", requireFamily, requireAdmin, handleSaveSettings);
