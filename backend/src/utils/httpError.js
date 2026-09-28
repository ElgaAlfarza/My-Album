export class HttpError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export function notFound(message = "Data tidak ditemukan.") {
  return new HttpError(404, message);
}

export function forbidden(message = "Anda tidak diizinkan melakukan ini.") {
  return new HttpError(403, message);
}

export function badRequest(message, details) {
  return new HttpError(400, message, details);
}
