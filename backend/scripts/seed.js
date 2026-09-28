import { adminDb } from "../src/services/supabase.js";
import { isSupabaseConfigured } from "../src/config/env.js";

async function seed() {
  if (!isSupabaseConfigured()) {
    console.error("❌ SUPABASE_URL atau kunci belum dikonfigurasi di backend/.env");
    process.exit(1);
  }

  console.log("🌱 Memulai inisialisasi data keluarga...");

  // 1. Inisialisasi Anggota Keluarga
  const members = [
    { nama: "Ayah (Admin)", role: "admin", email: "ayah@keluarga.local", no_hp: "081234567890" },
    { nama: "Ibu", role: "anggota", email: "ibu@keluarga.local", no_hp: "081234567891" },
    { nama: "Mas Budi", role: "anggota", email: "budi@keluarga.local", no_hp: "081234567892" },
    { nama: "Siti", role: "anggota", email: "siti@keluarga.local", no_hp: "081234567893" },
  ];

  for (const m of members) {
    const { data: existing } = await adminDb
      .from("family_members")
      .select("id")
      .eq("nama", m.nama)
      .maybeSingle();

    if (!existing) {
      const { error } = await adminDb.from("family_members").insert(m);
      if (error) console.warn(`Gagal menambah ${m.nama}:`, error.message);
    }
  }
  console.log("✅ Anggota keluarga siap.");

  // 2. Inisialisasi Album
  const albums = [
    { nama: "Foto Keluarga", deskripsi: "Foto bersama di rumah dan momen sehari-hari." },
    { nama: "Masa Muda & Pernikahan", deskripsi: "Kisah janji suci dan masa muda orang tua." },
    { nama: "Hari Raya", deskripsi: "Lebaran, sungkem, dan hari besar keluarga." },
    { nama: "Cucu & Liburan", deskripsi: "Perjalanan, pantai, dan tawa cucu." },
  ];

  for (const a of albums) {
    const { error } = await adminDb
      .from("albums")
      .upsert(a, { onConflict: "nama", ignoreDuplicates: true });
    if (error) {
      console.warn(`Gagal menambah album ${a.nama}:`, error.message);
    }
  }
  console.log("✅ Album map kertas siap.");

  console.log("🎉 Inisialisasi selesai! Lemari siap digunakan.");
}

seed().catch((err) => {
  console.error("Terjadi kesalahan:", err);
  process.exit(1);
});
