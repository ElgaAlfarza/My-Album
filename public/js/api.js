/**
 * Client API untuk Album Kenangan Saya
 * Menghubungkan antarmuka frontend ke backend Node.js & Supabase
 */

const API_BASE = window.KENANGAN_API_URL || (
  window.location.origin && !window.location.origin.startsWith("file:")
    ? `${window.location.origin}/api`
    : "http://localhost:8787/api"
);

export const api = {
  /**
   * Cek kesehatan backend
   */
  async checkHealth() {
    try {
      const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2000) });
      return res.ok;
    } catch {
      return false;
    }
  },

  /**
   * Mengambil daftar foto dengan filter
   */
  async getPhotos({ category, year, favorite, search } = {}) {
    const params = new URLSearchParams();
    if (category && category !== "semua") params.set("category", category);
    if (year) params.set("year", year);
    if (favorite) params.set("favorite", "true");
    if (search) params.set("search", search);

    const res = await fetch(`${API_BASE}/photos?${params.toString()}`);
    if (!res.ok) throw new Error("Gagal memuat foto dari lemari kenangan.");
    return res.json();
  },

  /**
   * Mengunggah foto langsung (multipart)
   */
  async uploadPhoto(file, metadata = {}) {
    const formData = new FormData();
    formData.append("photo", file);
    if (metadata.title) formData.append("title", metadata.title);
    if (metadata.caption) formData.append("caption", metadata.caption);
    if (metadata.category) formData.append("category", metadata.category);
    if (metadata.place) formData.append("place", metadata.place);
    if (metadata.taken_year) formData.append("taken_year", metadata.taken_year);
    if (metadata.album) formData.append("album", metadata.album);

    const res = await fetch(`${API_BASE}/photos/upload`, {
      method: "POST",
      body: formData,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || "Gagal menyimpan foto ke lemari.");
    }
    return res.json();
  },

  /**
   * Memperbarui keterangan foto
   */
  async updatePhoto(id, patch) {
    const res = await fetch(`${API_BASE}/photos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    });
    if (!res.ok) throw new Error("Gagal memperbarui keterangan.");
    return res.json();
  },

  /**
   * Tandai / batal favorit ("Tersimpan di Hati")
   */
  async toggleFavorite(id, liked) {
    const res = await fetch(`${API_BASE}/photos/${id}/heart`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ liked }),
    });
    if (!res.ok) throw new Error("Gagal memperbarui status favorit.");
    return res.json();
  },

  /**
   * Pindahkan foto ke tempat sampah (soft delete 30 hari)
   */
  async deletePhoto(id) {
    const res = await fetch(`${API_BASE}/photos/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error("Gagal memindahkan foto ke tempat sampah.");
    return res.json();
  },

  /**
   * Mengambil statistik lemari ("128 Lembar Foto")
   */
  async getStats() {
    const res = await fetch(`${API_BASE}/stats`);
    if (!res.ok) throw new Error("Gagal mengambil statistik.");
    return res.json();
  },

  /**
   * Daftar album map
   */
  async getAlbums() {
    const res = await fetch(`${API_BASE}/albums`);
    if (!res.ok) throw new Error("Gagal memuat album.");
    return res.json();
  },

  /**
   * Buat tautan WhatsApp bertenggang waktu
   */
  async shareWhatsApp(photoId, hours = 48) {
    const res = await fetch(`${API_BASE}/share/whatsapp`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_id: photoId, hours }),
    });
    if (!res.ok) throw new Error("Gagal membuat tautan berbagi.");
    return res.json();
  },

  /**
   * Trigger unduh arsip Buku Panduan Besar (.ZIP)
   */
  downloadArchiveUrl() {
    return `${API_BASE}/export`;
  },
};
