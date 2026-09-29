import { env, isSupabaseConfigured } from "../config/env.js";
import { adminDb } from "./supabase.js";

let memoryPin = null;

/**
 * Mendapatkan PIN Admin yang sedang aktif
 */
export async function getActiveAdminPin() {
  if (memoryPin) return memoryPin;

  if (isSupabaseConfigured()) {
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
 * Memvalidasi apakah PIN yang dimasukkan cocok
 */
export async function verifyAdminPin(inputPin) {
  if (!inputPin) return false;
  const activePin = await getActiveAdminPin();
  return String(inputPin).trim() === String(activePin).trim();
}

/**
 * Menyimpan PIN Admin baru
 */
export async function updateAdminPin(newPin) {
  const pinStr = String(newPin).trim();
  memoryPin = pinStr;

  if (isSupabaseConfigured()) {
    try {
      await adminDb.from("app_settings").upsert({
        key: "admin_pin",
        value: { pin: pinStr },
        updated_at: new Date().toISOString(),
      });
    } catch (err) {
      console.warn("Simpan PIN ke app_settings dilewati:", err.message);
    }
  }

  return pinStr;
}
