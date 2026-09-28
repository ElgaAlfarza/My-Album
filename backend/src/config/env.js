import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config(); // Coba cwd
dotenv.config({ path: path.resolve(__dirname, "../../.env") }); // Coba backend/.env
dotenv.config({ path: path.resolve(__dirname, "../../../.env") }); // Coba root/.env

const defaultPublicUrl =
  process.env.PUBLIC_APP_URL ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:8787");

const schema = z.object({
  PORT: z.coerce.number().default(8787),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PUBLIC_APP_URL: z.string().url().default(defaultPublicUrl),
  FRONTEND_ORIGIN: z.string().default("http://127.0.0.1:8765,http://localhost:5500,http://localhost:3000,http://localhost:5173,*"),
  SUPABASE_URL: z.string().url().default("https://placeholder-project.supabase.co"),
  SUPABASE_ANON_KEY: z.string().default("placeholder-anon-key-album-kenangan-min-20-chars"),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default("placeholder-service-role-key-album-kenangan-min-20-chars"),
  STORAGE_BUCKET: z.string().default("kenangan"),
  BACKUP_BUCKET: z.string().default("kenangan-cadangan"),
  SIGNED_URL_TTL_SECONDS: z.coerce.number().default(3600),
  SHARE_TTL_HOURS: z.coerce.number().min(1).max(168).default(48),
  MAX_UPLOAD_BYTES: z.coerce.number().default(20 * 1024 * 1024),
  FAMILY_ADMIN_PIN: z.string().default("1958"),
});

export const env = schema.parse(process.env);

export const ALLOWED_MIME = new Set(["image/jpeg", "image/jpg", "image/png", "image/webp"]);
export const TRASH_DAYS = 30;

export const isSupabaseConfigured = () => {
  if (!env.SUPABASE_URL) return false;
  const url = env.SUPABASE_URL.toLowerCase();
  const key = (env.SUPABASE_SERVICE_ROLE_KEY || "").toLowerCase();
  return (
    !url.includes("placeholder") &&
    !url.includes("your_project") &&
    !url.includes("your-project") &&
    !url.includes("xyz.supabase.co") &&
    !key.includes("your-supabase") &&
    !key.includes("placeholder") &&
    !key.includes("demo-service") &&
    key.length > 25
  );
};

