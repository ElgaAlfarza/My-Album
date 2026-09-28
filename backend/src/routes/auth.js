import { Router } from "express";
import { adminDb } from "../services/supabase.js";
import { requireAdmin, requireFamily } from "../middleware/auth.js";
import { badRequest, notFound } from "../utils/httpError.js";
import { env } from "../config/env.js";

export const authRouter = Router();

/**
 * GET /api/members
 * Daftar anggota keluarga (Ayah, Ibu, Anak, dll.)
 */
authRouter.get("/members", requireFamily, async (req, res, next) => {
  try {
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
    if (!pin || pin !== env.FAMILY_ADMIN_PIN) {
      throw badRequest("PIN keluarga tidak sesuai. Silakan coba lagi.");
    }

    let member = null;
    if (member_id) {
      const { data } = await adminDb.from("family_members").select("*").eq("id", member_id).maybeSingle();
      member = data;
    }
    if (!member) {
      const { data } = await adminDb.from("family_members").select("*").eq("role", "admin").limit(1).maybeSingle();
      member = data;
    }

    res.json({
      ok: true,
      member: member || { nama: "Keluarga", role: "admin" },
      message: "Selamat datang kembali di lemari kenangan keluarga.",
    });
  } catch (err) {
    next(err);
  }
});
