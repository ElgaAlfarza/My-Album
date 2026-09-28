import cron from "node-cron";
import { purgeExpiredTrash } from "../services/photos.js";
import { runWeeklyBackup } from "./backup.js";

export function startJobs() {
  cron.schedule("15 3 * * *", async () => {
    try {
      const result = await purgeExpiredTrash();
      console.log("[purge]", result);
    } catch (err) {
      console.error("[purge gagal]", err);
    }
  });

  cron.schedule("30 3 * * 0", async () => {
    try {
      const result = await runWeeklyBackup();
      console.log("[cadangan mingguan]", result);
    } catch (err) {
      console.error("[cadangan gagal]", err);
    }
  });
}
