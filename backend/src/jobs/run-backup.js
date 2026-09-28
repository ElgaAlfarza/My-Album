import { runWeeklyBackup } from "./backup.js";
import "../config/env.js";

runWeeklyBackup()
  .then((result) => {
    console.log("Cadangan selesai", result);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
