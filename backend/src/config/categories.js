export const CATEGORIES = {
  keluarga: { id: "keluarga", chip: "Keluarga", label: "Foto Keluarga", warm: false, defaultAlbum: "Foto Keluarga" },
  liburan: { id: "liburan", chip: "Liburan", label: "Cucu & Liburan", warm: true, defaultAlbum: "Cucu & Liburan" },
  "hari-raya": { id: "hari-raya", chip: "Hari Raya", label: "Hari Raya", warm: true, defaultAlbum: "Hari Raya" },
  pernikahan: { id: "pernikahan", chip: "Pernikahan", label: "Masa Muda & Pernikahan", warm: false, defaultAlbum: "Masa Muda & Pernikahan" },
  "kenangan-rumah": { id: "kenangan-rumah", chip: "Kenangan Rumah", label: "Kenangan Rumah", warm: false, defaultAlbum: "Foto Keluarga" },
  "cucu-liburan": { id: "cucu-liburan", chip: "Liburan", label: "Cucu & Liburan", warm: true, defaultAlbum: "Cucu & Liburan" },
};

export const FILTERS = [
  { id: "semua", label: "Semua" },
  { id: "keluarga", label: "Foto Keluarga" },
  { id: "pernikahan", label: "Masa Muda & Pernikahan" },
  { id: "hari-raya", label: "Hari Raya" },
  { id: "liburan", label: "Cucu & Liburan" },
];

export function resolveCategory(input) {
  if (!input) return CATEGORIES.keluarga;
  const key = String(input).trim().toLowerCase();
  if (CATEGORIES[key]) return CATEGORIES[key];
  const byChip = Object.values(CATEGORIES).find(
    (c) => c.chip.toLowerCase() === key || c.label.toLowerCase() === key
  );
  return byChip || CATEGORIES.keluarga;
}

export function matchesUiFilter(category, filter) {
  if (!filter || filter === "semua") return true;
  if (filter === "liburan") return category === "liburan" || category === "cucu-liburan";
  if (filter === "pernikahan") return category === "pernikahan";
  if (filter === "keluarga") return category === "keluarga" || category === "kenangan-rumah";
  return category === filter;
}
