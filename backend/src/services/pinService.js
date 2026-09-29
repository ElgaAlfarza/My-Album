import { env, isSupabaseConfigured } from "../config/env.js";
import { adminDb } from "./supabase.js";

let memoryPin = null;

/**
 * Mendapatkan PIN Admin yang sedang aktif
 */
export async function getActiveAdminPin() {
  if (memoryPin) return memoryPin;

  if (isSupabaseConfigured()) {
    // 1. Coba baca dari tabel family_members pada akun admin (dijamin persisten di cloud)
    try {
      const { data: adminMember } = await adminDb
        .from("family_members")
        .select("email")
        .eq("role", "admin")
        .eq("aktif", true)
        .limit(1)
        .maybeSingle();

      if (adminMember?.email && adminMember.email.startsWith("pin_")) {
        const match = adminMember.email.match(/^pin_(.+?)@/);
        if (match && match[1]) {
          memoryPin = match[1].trim();
          return memoryPin;
        }
      }
    } catch (err) {
      console.warn("Gagal membaca pin dari family_members:", err.message);
    }

    // 2. Coba baca dari tabel app_settings jika tersedia
    try {
      const { data } = await adminDb
        .from("app_settings")
        .select("value")
        .eq("key", "admin_pin")
        .maybeSingle();

      if (data?.value?.pin) {
        memoryPin = String(data.value.pin).trim();
        return memoryPin;
      }
    } catch {
      // Abaikan jika tabel app_settings belum ada
    }
  }

  return env.FAMILY_ADMIN_PIN || "1958";
}

/**
 * Memvalidasi apakah PIN yang dimasukkan cocok.
 * Mendukung PIN kustom aktif, PIN di environment Vercel, dan PIN cadangan keluarga 1958.
 */
export async function verifyAdminPin(inputPin) {
  if (!inputPin) return false;
  const inputStr = String(inputPin).trim();
  const activePin = String(await getActiveAdminPin()).trim();
  const envPin = String(env.FAMILY_ADMIN_PIN || "1958").trim();

  return inputStr === activePin || inputStr === envPin || inputStr === "1958";
}

/**
 * Menyimpan PIN Admin baru secara persisten ke database Supabase
 */
export async function updateAdminPin(newPin) {
  const pinStr = String(newPin).trim();
  memoryPin = pinStr;

  if (isSupabaseConfigured()) {
    // 1. Simpan ke database family_members pada akun admin
    try {
      await adminDb
        .from("family_members")
        .update({ email: `pin_${pinStr}@keluarga.local` })
        .eq("role", "admin");
    } catch (err) {
      console.warn("Gagal menyimpan PIN ke family_members:", err.message);
    }

    // 2. Simpan juga ke app_settings jika tabel tersedia
    try {
      await adminDb.from("app_settings").upsert({
        key: "admin_pin",
        value: { pin: pinStr },
        updated_at: new Date().toISOString(),
      });
    } catch {
      // Abaikan jika tabel app_settings belum ada
    }
  }

  return pinStr;
}
