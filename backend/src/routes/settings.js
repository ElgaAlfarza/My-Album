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
  admin_name: "Elga Alfareza",
  admin_avatar: "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80",
};

/**
 * GET /api/settings
 * Membaca pengaturan umum website/lemari foto
 */
settingsRouter.get("/", async (req, res) => {
  try {
    let settings = { ...currentSettings };

    if (isSupabaseConfigured()) {
      // 1. Ambil data profil admin & pengaturan umum dari tabel family_members
      try {
        const { data: adminMember } = await adminDb
          .from("family_members")
          .select("nama, avatar_url, no_hp")
          .eq("role", "admin")
          .eq("aktif", true)
          .limit(1)
          .maybeSingle();

        if (adminMember) {
          if (adminMember.nama) settings.admin_name = adminMember.nama;
          if (adminMember.avatar_url && !adminMember.avatar_url.includes("admin-1790655982077.webp")) {
            settings.admin_avatar = adminMember.avatar_url;
          }

          // Baca pengaturan umum dari kolom no_hp (JSON persisten di database)
          if (adminMember.no_hp && adminMember.no_hp.startsWith("{")) {
            try {
              const saved = JSON.parse(adminMember.no_hp);
              if (saved && typeof saved === "object") {
                settings = { ...settings, ...saved };
              }
            } catch {}
          }
        }
      } catch (err) {
        console.warn("Gagal membaca profil admin:", err.message);
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
      // Simpan pengaturan umum ke kolom no_hp dan nama/avatar ke family_members (pasti ada & persisten di cloud!)
      try {
        const settingsToPersist = {
          site_name: updated.site_name,
          site_tagline: updated.site_tagline,
          kicker: updated.kicker,
          hero_title: updated.hero_title,
          hero_lede: updated.hero_lede,
          footer_title: updated.footer_title,
          footer_text: updated.footer_text,
        };

        const updates = {
          no_hp: JSON.stringify(settingsToPersist),
        };
        if (admin_name) updates.nama = String(admin_name).trim();
        if (admin_avatar) updates.avatar_url = String(admin_avatar).trim();

        await adminDb
          .from("family_members")
          .update(updates)
          .eq("role", "admin");
      } catch (err) {
        console.warn("Gagal menyimpan ke family_members:", err.message);
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

// In-memory fallback untuk pohon keluarga
let currentFamilyTree = null;

/**
 * GET /api/settings/family-tree
 * Membaca bagan silsilah pohon keluarga
 */
settingsRouter.get("/family-tree", async (req, res) => {
  try {
    if (isSupabaseConfigured()) {
      try {
        const { data: member } = await adminDb
          .from("family_members")
          .select("email")
          .eq("role", "admin")
          .limit(1)
          .maybeSingle();
        if (member && member.email && member.email.startsWith("[")) {
          const tree = JSON.parse(member.email);
          if (Array.isArray(tree) && tree.length > 0) {
            return res.json({ tree });
          }
        }
      } catch (err) {
        console.warn("Gagal membaca silsilah keluarga dari db:", err.message);
      }
    }
    res.json({ tree: currentFamilyTree || [] });
  } catch {
    res.json({ tree: currentFamilyTree || [] });
  }
});

/**
 * POST /api/settings/family-tree
 * Menyimpan bagan silsilah pohon keluarga ke cloud
 */
settingsRouter.post("/family-tree", async (req, res) => {
  try {
    const { tree } = req.body;
    if (Array.isArray(tree)) {
      currentFamilyTree = tree;
      if (isSupabaseConfigured()) {
        try {
          await adminDb
            .from("family_members")
            .update({ email: JSON.stringify(tree) })
            .eq("role", "admin");
        } catch (err) {
          console.warn("Gagal menyimpan silsilah ke db:", err.message);
        }
      }
    }
    res.json({ ok: true, tree: currentFamilyTree || [] });
  } catch (err) {
    res.status(500).json({ ok: false, message: err.message });
  }
});

