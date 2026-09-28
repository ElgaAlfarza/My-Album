import { purgeExpiredTrash } from "../services/photos.js";
import "../config/env.js";

purgeExpiredTrash()
  .then((result) => {
    console.log("Sampah kedaluwarsa dibersihkan", result);
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
