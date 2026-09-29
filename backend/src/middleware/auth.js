import { getMemberByAuthId } from "../services/photos.js";
import { adminDb, createUserClient } from "../services/supabase.js";
import { HttpError } from "../utils/httpError.js";
import { env, isSupabaseConfigured } from "../config/env.js";
import { verifyAdminPin } from "../services/pinService.js";

// Mock admin fallback untuk kemudahan keluarga saat development
const DEV_FALLBACK_MEMBER = {
  id: "11111111-1111-1111-1111-111111111111",
  nama: "Kepala Keluarga (Ayah)",
  role: "admin",
  email: "ayah@keluarga.local",
  aktif: true,
};

export async function requireFamily(req, res, next) {
  try {
    const header = req.get("authorization") || "";
    const memberHeader = req.get("x-family-member-id") || req.get("x-family-member");
    const pinHeader = req.get("x-family-pin") || req.body?.pin || req.body?.old_pin || req.query?.pin;
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    // 1. Supabase Auth JWT
    if (token && isSupabaseConfigured()) {
      const supabase = createUserClient(token);
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) {
        const member = await getMemberByAuthId(data.user.id);
        if (member) {
          req.user = data.user;
          req.member = member;
          return next();
        }
      }
    }

    // 2. Akses via Header Anggota Keluarga (misal: "Ayah", "Ibu", atau UUID)
    if (memberHeader && isSupabaseConfigured()) {
      let query = adminDb.from("family_members").select("*").eq("aktif", true);
      if (memberHeader.includes("-")) {
        query = query.eq("id", memberHeader);
      } else {
        query = query.ilike("nama", `%${memberHeader}%`);
      }
      const { data: member } = await query.maybeSingle();
      if (member) {
        req.member = member;
        return next();
      }
    }

    // 3. Akses via PIN Keluarga Sederhana
    if (pinHeader && (await verifyAdminPin(pinHeader))) {
      if (isSupabaseConfigured()) {
        const { data: adminMember } = await adminDb
          .from("family_members")
          .select("*")
          .eq("role", "admin")
          .eq("aktif", true)
          .limit(1)
          .maybeSingle();
        if (adminMember) {
          req.member = adminMember;
          return next();
        }
      }
      req.member = DEV_FALLBACK_MEMBER;
      return next();
    }

    // 4. Fallback aman di mode development jika belum setup auth login
    if (env.NODE_ENV === "development") {
      if (isSupabaseConfigured()) {
        const { data: defaultMember } = await adminDb
          .from("family_members")
          .select("*")
          .eq("aktif", true)
          .order("created_at")
          .limit(1)
          .maybeSingle();
        if (defaultMember) {
          req.member = defaultMember;
          return next();
        }
      }
      req.member = DEV_FALLBACK_MEMBER;
      return next();
    }

    throw new HttpError(401, "Silakan masuk terlebih dahulu untuk membuka lemari kenangan.");
  } catch (err) {
    next(err);
  }
}

export function requireAdmin(req, res, next) {
  if (req.member?.role !== "admin") {
    return next(new HttpError(403, "Fitur ini hanya untuk admin keluarga."));
  }
  next();
}

