import { Router } from "express";
import multer from "multer";
import sharp from "sharp";
import { adminDb } from "../services/supabase.js";
import { requireAdmin, requireFamily } from "../middleware/auth.js";
import { badRequest, notFound } from "../utils/httpError.js";
import { env, isSupabaseConfigured } from "../config/env.js";
import { verifyAdminPin, updateAdminPin } from "../services/pinService.js";

const avatarUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    if (["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(badRequest("Format foto harus JPG, PNG, atau WEBP."));
    }
  },
});

export const authRouter = Router();

/**
 * GET /api/members
 * Daftar anggota keluarga (Ayah, Ibu, Anak, dll.)
 */
authRouter.get("/members", requireFamily, async (req, res, next) => {
  try {
    if (!isSupabaseConfigured()) {
      return res.json({
        members: [
          { id: "11111111-1111-1111-1111-111111111111", nama: "Ayah (Admin)", role: "admin", aktif: true },
          { id: "22222222-2222-2222-2222-222222222222", nama: "Ibu", role: "anggota", aktif: true },
        ],
      });
    }

    const { data: members, error } = await adminDb
      .from("family_members")
      .select("id, nama, role, avatar_url, email, no_hp, aktif, created_at")
      .eq("aktif", true)
      .order("created_at");
    if (error) throw error;
    res.json({ members: members || [] });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/members
 * Tambah anggota keluarga baru (khusus admin, misal menambahkan cucu/menantu)
 */
authRouter.post("/members", requireFamily, requireAdmin, async (req, res, next) => {
  try {
    const { nama, role, email, no_hp, avatar_url } = req.body;
    if (!nama) throw badRequest("Nama anggota keluarga wajib diisi.");

    if (!isSupabaseConfigured()) {
      return res.status(201).json({
        member: { id: Date.now().toString(), nama, role: role || "anggota", aktif: true },
        message: `Anggota keluarga ${nama} berhasil ditambahkan.`,
      });
    }

    const { data, error } = await adminDb
      .from("family_members")
      .insert({
        nama,
        role: role === "admin" ? "admin" : "anggota",
        email: email || null,
        no_hp: no_hp || null,
        avatar_url: avatar_url || null,
      })
      .select("*")
      .single();
    if (error) throw error;

    res.status(201).json({
      member: data,
      message: `Anggota keluarga ${nama} berhasil ditambahkan.`,
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/members/avatar
 * Unggah dan perbarui foto profil avatar admin/keluarga
 */
authRouter.post("/avatar", requireFamily, requireAdmin, avatarUpload.single("avatar"), async (req, res, next) => {
  try {
    const file = req.file;
    if (!file) throw badRequest("Berkas foto profil wajib diunggah.");

    // Kompresi avatar ke 256x256 WebP lingkaran proporsional
    const webpBuffer = await sharp(file.buffer)
      .resize(256, 256, { fit: "cover", position: "center" })
      .webp({ quality: 85 })
      .toBuffer();

    let avatarUrl = "";

    // Coba simpan ke Supabase Storage
    if (isSupabaseConfigured()) {
      try {
        const filePath = `avatars/admin-${Date.now()}.webp`;
        const { error: uploadError } = await adminDb.storage
          .from(env.STORAGE_BUCKET)
          .upload(filePath, webpBuffer, {
            contentType: "image/webp",
            upsert: true,
          });

        if (!uploadError) {
          const { data } = await adminDb.storage
            .from(env.STORAGE_BUCKET)
            .createSignedUrl(filePath, 315360000); // Tahan 10 tahun
          if (data?.signedUrl) {
            avatarUrl = data.signedUrl;
          }
        }
      } catch (err) {
        console.warn("Upload storage avatar gagal, gunakan fallback data-URI:", err.message);
      }
    }

    // Fallback: Jika storage belum siap, jadikan Data URI Base64 (dijamin 100% langsung tampil)
    if (!avatarUrl) {
      avatarUrl = `data:image/webp;base64,${webpBuffer.toString("base64")}`;
    }

    // Perbarui foto profil pada tabel family_members
    if (isSupabaseConfigured()) {
      await adminDb
        .from("family_members")
        .update({ avatar_url: avatarUrl })
        .eq("role", "admin");
    }

    res.json({
      ok: true,
      avatar_url: avatarUrl,
      message: "Foto profil berhasil diperbarui!",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * PATCH /api/members/:id
 * Ubah nama atau no_hp anggota keluarga (khusus admin)
 */
authRouter.patch("/members/:id", requireFamily, requireAdmin, async (req, res, next) => {
  try {
    const { nama, role, no_hp, email, avatar_url, aktif } = req.body;
    const updates = {};
    if (nama !== undefined) updates.nama = nama;
    if (role !== undefined) updates.role = role;
    if (no_hp !== undefined) updates.no_hp = no_hp;
    if (email !== undefined) updates.email = email;
    if (avatar_url !== undefined) updates.avatar_url = avatar_url;
    if (aktif !== undefined) updates.aktif = aktif;

    if (!isSupabaseConfigured()) {
      return res.json({
        member: { id: req.params.id, ...updates },
        message: "Data anggota keluarga berhasil diperbarui.",
      });
    }

    const { data, error } = await adminDb
      .from("family_members")
      .update(updates)
      .eq("id", req.params.id)
      .select("*")
      .single();

    if (error) throw error;
    res.json({ member: data, message: "Data anggota keluarga berhasil diperbarui." });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/members/:id
 * Nonaktifkan anggota keluarga
 */
authRouter.delete("/members/:id", requireFamily, requireAdmin, async (req, res, next) => {
  try {
    if (isSupabaseConfigured()) {
      const { error } = await adminDb
        .from("family_members")
        .update({ aktif: false })
        .eq("id", req.params.id);
      if (error) throw error;
    }
    res.json({ ok: true, message: "Anggota keluarga berhasil dinonaktifkan." });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/auth/me
 * Profil anggota keluarga yang sedang aktif
 */
authRouter.get("/me", requireFamily, async (req, res) => {
  res.json({
    member: req.member,
    user: req.user || null,
  });
});

/**
 * POST /api/auth/pin
 * Masuk cepat dengan PIN keluarga (sangat ramah orang tua)
 */
authRouter.post("/pin", async (req, res, next) => {
  try {
    const { pin, member_id } = req.body;
    const isValid = await verifyAdminPin(pin);
    if (!isValid) {
      throw badRequest("PIN keluarga tidak sesuai. Silakan coba lagi.");
    }

    let member = null;
    if (member_id && isSupabaseConfigured()) {
      const { data } = await adminDb.from("family_members").select("*").eq("id", member_id).maybeSingle();
      member = data;
    }
    if (!member && isSupabaseConfigured()) {
      const { data } = await adminDb.from("family_members").select("*").eq("role", "admin").limit(1).maybeSingle();
      member = data;
    }

    res.json({
      ok: true,
      member: member || { nama: "Ayah (Admin)", role: "admin" },
      token: "family-pin-session",
      message: "Selamat datang kembali di lemari kenangan keluarga.",
    });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/auth/change-pin
 * Mengganti PIN admin keluarga (khusus admin)
 */
authRouter.post("/change-pin", requireFamily, requireAdmin, async (req, res, next) => {
  try {
    const { old_pin, new_pin } = req.body;
    if (!old_pin || !new_pin) {
      throw badRequest("PIN saat ini dan PIN baru wajib diisi.");
    }

    const isValid = await verifyAdminPin(old_pin);
    if (!isValid) {
      throw badRequest("PIN lama tidak cocok.");
    }

    const pinStr = String(new_pin).trim();
    if (pinStr.length < 4) {
      throw badRequest("PIN baru minimal harus 4 karakter/angka.");
    }

    const updated = await updateAdminPin(pinStr);
    res.json({
      ok: true,
      message: "PIN Admin keluarga berhasil diubah!",
      pin: updated,
    });
  } catch (err) {
    next(err);
  }
});
