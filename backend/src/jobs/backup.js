import { adminDb } from "../services/supabase.js";
import { copyToBackup } from "../services/storage.js";

export async function runWeeklyBackup() {
  const { data: run, error: runError } = await adminDb
    .from("backup_runs")
    .insert({ status: "running" })
    .select("id")
    .single();
  if (runError) throw runError;

  try {
    const { data: photos, error } = await adminDb
      .from("photos")
      .select("id, original_path, thumbnail_path")
      .is("deleted_at", null)
      .eq("status", "ready");
    if (error) throw error;

    const stamp = new Date().toISOString().slice(0, 10);
    let copied = 0;
    for (const photo of photos || []) {
      if (photo.original_path) {
        await copyToBackup(photo.original_path, `mingguan/${stamp}/${photo.id}-asli`);
        copied += 1;
      }
      if (photo.thumbnail_path) {
        await copyToBackup(photo.thumbnail_path, `mingguan/${stamp}/${photo.id}-kecil`);
      }
    }

    await adminDb
      .from("backup_runs")
      .update({
        status: "ok",
        finished_at: new Date().toISOString(),
        photo_count: copied,
        catatan: `Cadangan mingguan ${stamp} selesai.`,
      })
      .eq("id", run.id);

    return { photo_count: copied };
  } catch (err) {
    await adminDb
      .from("backup_runs")
      .update({
        status: "gagal",
        finished_at: new Date().toISOString(),
        catatan: err.message,
      })
      .eq("id", run.id);
    throw err;
  }
}
