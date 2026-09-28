import { HttpError } from "../utils/httpError.js";

export function notFoundHandler(req, res, next) {
  next(new HttpError(404, "Alamat ini tidak ada di lemari kenangan."));
}

export function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  res.status(status).json({
    error: true,
    message: err.status ? err.message : "Terjadi gangguan. Foto Anda tetap aman.",
    details: err.details || undefined,
  });
}
