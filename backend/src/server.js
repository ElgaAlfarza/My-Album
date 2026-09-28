import { app } from "./app.js";
import { env, isSupabaseConfigured } from "./config/env.js";
import { startJobs } from "./jobs/scheduler.js";

const server = app.listen(env.PORT, () => {
  console.log("==================================================");
  console.log(" 📸 LEMARI ALBUM KENANGAN SAYA BERJALAN AKTIF");
  console.log("==================================================");
  console.log(` 🌐 Server URL       : http://localhost:${env.PORT}`);
  console.log(` 🩺 Health Check     : http://localhost:${env.PORT}/api/health`);
  console.log(` 🗄️  Status Database  : ${isSupabaseConfigured() ? "Terkoneksi ke Supabase Cloud" : "Mode Lemari Lokal Aktif"}`);
  console.log(" ⏳ Jadwal Otomatis  : Pembersihan Sampah (30 hari) & Cadangan Mingguan Aktif");
  console.log(" 🔒 Akses Foto       : Privat via Signed URLs (Expire)");
  console.log("==================================================");

  // Jalankan background cron jobs jika di server aktif
  if (isSupabaseConfigured()) {
    startJobs();
    console.log(" ☁️  Sinkronisasi cloud Supabase aktif.");
  } else {
    console.log(" 💡 Lemari siap dipakai langsung dalam Mode Lokal!");
    console.log("    Buka browser Anda di: http://localhost:8787");
    console.log("    (Jika ingin sinkron cloud, isi kredensial di backend/.env)");
  }
});

process.on("SIGTERM", () => {
  console.log("Menutup server lemari kenangan dengan aman...");
  server.close(() => {
    console.log("Server telah ditutup.");
    process.exit(0);
  });
});
