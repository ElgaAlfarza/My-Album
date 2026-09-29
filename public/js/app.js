const PHOTOS = [
  {
    id: "solo-1958",
    title: "Pernikahan Eyang di Solo",
    caption: "Momen sakral janji suci di rumah peninggalan kakek di Laweyan.",
    place: "Solo, Jawa Tengah",
    year: 1958,
    category: "keluarga",
    chip: "Keluarga",
    warm: false,
    liked: true,
    album: "Masa Muda & Pernikahan",
    src: "https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "glagah-1985",
    title: "Liburan Pertama ke Pantai Glagah",
    caption: "Anak-anak masih kecil, menempuh perjalanan jauh naik mobil kijang tua.",
    place: "Kulon Progo, DIY",
    year: 1985,
    category: "liburan",
    chip: "Liburan",
    warm: true,
    liked: false,
    album: "Cucu & Liburan",
    src: "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "wisuda-2002",
    title: "Momen Wisuda Anak Pertama",
    caption: "Hari bahagia penuh syukur saat Mas Budi lulus kuliah di Yogyakarta.",
    place: "Universitas Gadjah Mada",
    year: 2002,
    category: "keluarga",
    chip: "Keluarga",
    warm: false,
    liked: true,
    album: "Foto Keluarga",
    src: "https://images.unsplash.com/photo-1523580494863-6f3031224c94?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "lebaran-2018",
    title: "Sungkem Idul Fitri Bersama Cucu",
    caption: "Rumah selalu hangat dan ramai gelak tawa saat hari lebaran tiba.",
    place: "Rumah Utama, Semarang",
    year: 2018,
    category: "hari-raya",
    chip: "Hari Raya",
    warm: true,
    liked: false,
    album: "Hari Raya",
    src: "https://images.unsplash.com/photo-1511895426328-dc8714191300?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "ambarawa-1994",
    title: "Halaman Belakang Rumah Ambarawa",
    caption: "Suasana asri sore hari, kakek duduk tenang ditemani secangkir teh melati.",
    place: "Ambarawa, Jawa Tengah",
    year: 1994,
    category: "keluarga",
    chip: "Kenangan Rumah",
    warm: false,
    liked: false,
    album: "Foto Keluarga",
    src: "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?auto=format&fit=crop&w=1400&q=80",
  },
  {
    id: "emas-2008",
    title: "Ulang Tahun Pernikahan Emas",
    caption: "50 tahun bersama dalam suka dan duka, tumpeng syukur sekeluarga besar.",
    place: "Pendopo Keluarga",
    year: 2008,
    category: "keluarga",
    chip: "Ulang Tahun",
    warm: true,
    liked: true,
    album: "Masa Muda & Pernikahan",
    src: "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=1400&q=80",
  },
];

const FILTERS = [
  { id: "semua", label: "Semua" },
  { id: "keluarga", label: "Foto Keluarga" },
  { id: "pernikahan", label: "Masa Muda & Pernikahan" },
  { id: "hari-raya", label: "Hari Raya" },
  { id: "liburan", label: "Cucu & Liburan" },
];

const STORAGE_KEY = "album-kenangan-saya";
const VIEWS = ["semua", "album", "favorit"];
const ALBUMS = [
  { name: "Foto Keluarga", category: "keluarga", chip: "Keluarga", warm: false },
  { name: "Masa Muda & Pernikahan", category: "keluarga", chip: "Keluarga", warm: false },
  { name: "Hari Raya", category: "hari-raya", chip: "Hari Raya", warm: true },
  { name: "Cucu & Liburan", category: "liburan", chip: "Liburan", warm: true },
];

function loadSaved() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

const saved = loadSaved();

const state = {
  view: "semua",
  filter: "semua",
  query: "",
  compact: false,
  likes: new Set(saved?.likes || PHOTOS.filter((p) => p.liked).map((p) => p.id)),
  extras: saved?.extras || [],
  serverPhotos: [],
  serverAlbums: [],
  edits: saved?.edits || {},
  hidden: new Set(saved?.hidden || []),
  zoomed: false,
  activeId: null,
  editing: false,
};

function persist() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        likes: [...state.likes],
        extras: state.extras,
        edits: state.edits,
        hidden: [...state.hidden],
      })
    );
  } catch {
    toast("Lemari perangkat hampir penuh. Foto lama tetap aman, yang baru mungkin belum tersimpan.");
  }
}

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

function albumMeta(name) {
  return ALBUMS.find((album) => album.name === name) || ALBUMS[0];
}

function allPhotos() {
  const serverPhotos = state.serverPhotos || [];
  const combined = [...serverPhotos, ...state.extras, ...PHOTOS];
  const seen = new Set();
  const list = [];
  for (const photo of combined) {
    if (seen.has(photo.id)) continue;
    seen.add(photo.id);
    if (!state.hidden.has(photo.id)) {
      list.push({ ...photo, ...(state.edits[photo.id] || {}) });
    }
  }
  return list;
}

function matchesFilter(photo) {
  if (state.filter === "semua") return true;
  if (state.filter === "pernikahan") return photo.category === "pernikahan" || photo.album === "Masa Muda & Pernikahan";
  if (state.filter === "liburan") return photo.category === "liburan" || photo.category === "cucu-liburan" || photo.album === "Cucu & Liburan";
  if (state.filter === "hari-raya") return photo.category === "hari-raya" || photo.album === "Hari Raya";
  if (state.filter === "keluarga") return photo.category === "keluarga" || photo.category === "kenangan-rumah" || photo.album === "Foto Keluarga";
  return photo.category === state.filter;
}

function matchesQuery(photo) {
  const q = state.query.trim().toLowerCase();
  if (!q) return true;
  return [photo.title, photo.caption, photo.place, String(photo.year), photo.chip]
    .join(" ")
    .toLowerCase()
    .includes(q);
}

function visiblePhotos() {
  return allPhotos().filter((photo) => {
    if (state.view === "favorit" && !state.likes.has(photo.id)) return false;
    if (state.view === "semua" && !matchesFilter(photo)) return false;
    return matchesQuery(photo);
  });
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("is-on");
  clearTimeout(toast.t);
  toast.t = setTimeout(() => el.classList.remove("is-on"), 2800);
}

function icon(name, filled = false) {
  const fill = filled ? "1" : "0";
  return `<span class="material-symbols-outlined" style="font-variation-settings:'FILL' ${fill}">${name}</span>`;
}

function photoCard(photo) {
  const liked = state.likes.has(photo.id);
  const title = escapeHtml(photo.title);
  const dateBadge = photo.taken_date_label || (photo.year ? `Tahun ${photo.year}` : "");
  return `
    <article class="photo-card" data-id="${escapeHtml(photo.id)}">
      <button class="mount" type="button" data-open="${escapeHtml(photo.id)}" aria-label="Lihat ${title} ukuran penuh">
        <div class="frame">
          <img src="${photo.src}" alt="${title}">
          <span class="chip ${photo.warm ? "is-warm" : ""}">${escapeHtml(photo.chip || photo.album || "Keluarga")}</span>
          ${dateBadge ? `<span class="year">${escapeHtml(dateBadge)}</span>` : ""}
        </div>
      </button>
      <div class="card-copy">
        <div class="card-title-row">
          <h3>${title}</h3>
          <button class="heart ${liked ? "is-on" : ""}" type="button" data-like="${escapeHtml(photo.id)}" aria-label="${liked ? "Hapus dari favorit" : "Simpan ke favorit"}">
            ${icon("favorite", liked)}
          </button>
        </div>
        <p class="caption">“${escapeHtml(photo.caption)}”</p>
      </div>
      <div class="card-actions">
        <button class="btn ${liked ? "btn-secondary" : "btn-soft"} like-btn" type="button" data-like="${escapeHtml(photo.id)}">
          ${icon("favorite", liked)}
          <span>${liked ? "Tersimpan di Hati" : "Suka Foto Ini"}</span>
        </button>
        <button class="btn btn-sage" type="button" data-open="${escapeHtml(photo.id)}">
          ${icon("zoom_in")}
          <span>Lihat Ukuran Penuh</span>
        </button>
      </div>
    </article>
  `;
}

function applyCompact() {
  ["#gallery-grid", "#favorite-grid"].forEach((sel) => {
    const grid = $(sel);
    if (grid) grid.classList.toggle("is-compact", state.compact);
  });
}

function renderGallery() {
  const photos = visiblePhotos();
  const grid = state.view === "favorit" ? $("#favorite-grid") : $("#gallery-grid");
  $("#photo-count").textContent = `${allPhotos().length} Lembar Foto`;
  const filterAll = $("#filter-all");
  if (filterAll) filterAll.innerHTML = `${icon("filter_vintage")} Semua (${allPhotos().length} Foto)`;
  applyCompact();

  if (!photos.length) {
    grid.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <h2>Belum ada foto di sini</h2>
        <p>Coba kata pencarian lain, atau simpan foto kenangan baru ke dalam lemari.</p>
      </div>`;
    return;
  }
  grid.innerHTML = photos.map(photoCard).join("");
}

function albums() {
  const groups = {};
  allPhotos().forEach((photo) => {
    groups[photo.album] ||= [];
    groups[photo.album].push(photo);
  });
  return Object.entries(groups).map(([name, items]) => ({ name, items }));
}

function renderAlbums() {
  const root = $("#album-grid");
  const groups = albums()
    .map(({ name, items }) => ({ name, items: items.filter(matchesQuery) }))
    .filter(({ items }) => items.length);
  if (!groups.length) {
    root.innerHTML = `
      <div class="empty" style="grid-column:1/-1">
        <h2>Album tidak ditemukan</h2>
        <p>Coba kata pencarian lain, atau buka Semua Foto untuk melihat seluruh lemari.</p>
      </div>`;
    return;
  }
  root.innerHTML = groups
    .map(({ name, items }) => {
      const cover = items.slice(0, 3);
      return `
        <button class="album-card" type="button" data-open-album="${escapeHtml(name)}">
          <div class="album-cover">
            <img src="${cover[0]?.src || ""}" alt="">
            <div class="stack">
              <img src="${cover[1]?.src || cover[0]?.src || ""}" alt="">
              <img src="${cover[2]?.src || cover[0]?.src || ""}" alt="">
            </div>
          </div>
          <div class="album-body">
            <h3>${escapeHtml(name)}</h3>
            <p>${items.length} lembar foto tersimpan rapi</p>
          </div>
        </button>`;
    })
    .join("");
}

function setView(view) {
  state.view = view;
  $$("[data-view]").forEach((el) => {
    el.hidden = el.dataset.view !== view;
  });
  $$("[data-nav]").forEach((el) => {
    const on = el.dataset.nav === view;
    el.classList.toggle("is-active", on);
    if (el.tagName === "A" && !el.classList.contains("brand")) {
      if (on) el.setAttribute("aria-current", "page");
      else el.removeAttribute("aria-current");
    }
  });
  const hero = $(".hero");
  const upload = $(".upload-panel");
  if (hero) hero.hidden = view !== "semua";
  if (upload) upload.hidden = view !== "semua";
  $("#mobile-nav").classList.remove("is-open");
  if (location.hash !== `#${view}`) history.replaceState(null, "", `#${view}`);
  if (view === "favorit") renderGallery();
  if (view === "album") renderAlbums();
  if (view === "semua") renderGallery();
}

function fillModal(photo) {
  const dateStr = photo.taken_date_label || (photo.year ? `Tahun ${photo.year}` : "");
  $("#modal-title").textContent = `${photo.title}${dateStr ? ` (${dateStr})` : ""}`;
  $("#modal-caption").textContent = `“${photo.caption}”`;
  $("#modal-location").textContent = `📍 ${photo.place || "Album Pribadi"} • 📁 ${photo.album || "Foto Keluarga"}`;
  const img = $("#modal-img");
  img.src = photo.src;
  img.alt = photo.title;
  img.style.transform = state.zoomed ? "scale(1.35)" : "scale(1)";
}

function setEditing(on) {
  state.editing = on;
  $("#photo-edit").hidden = !on;
  $("#modal-caption").hidden = on;
  $("#photo-actions").hidden = on;
  if (!on) return;
  const photo = allPhotos().find((p) => p.id === state.activeId);
  if (!photo) return;
  $("#edit-title").value = photo.title;
  $("#edit-caption").value = photo.caption;
  $("#edit-date").value = photo.taken_date || "";
  $("#edit-year").value = photo.year || "";
  $("#edit-place").value = photo.place || "";
  $("#edit-album").value = photo.album || "Foto Keluarga";
  $("#edit-title").focus();
}

function openModal(id, startEditing = false) {
  const photo = allPhotos().find((p) => p.id === id);
  if (!photo) return;
  state.activeId = id;
  state.zoomed = false;
  fillModal(photo);
  $("#photo-modal").classList.add("is-open");
  setEditing(startEditing);
}

function closeModal() {
  setEditing(false);
  state.activeId = null;
  $("#photo-modal").classList.remove("is-open");
}

async function saveEdits(event) {
  event.preventDefault();
  const id = state.activeId;
  if (!id) return;
  const album = albumMeta($("#edit-album").value);
  const dateVal = $("#edit-date")?.value || null;
  const yearVal = Number($("#edit-year")?.value) || (dateVal ? new Date(dateVal).getFullYear() : new Date().getFullYear());
  const patch = {
    title: $("#edit-title").value.trim() || "Kenangan Keluarga",
    caption: $("#edit-caption").value.trim() || "Kenangan tersimpan di lemari keluarga.",
    place: $("#edit-place").value.trim() || "Album Pribadi",
    year: yearVal,
    taken_date: dateVal,
    taken_date_label: dateVal || `Tahun ${yearVal}`,
    album: album.name,
    category: album.category,
    chip: album.chip,
    warm: album.warm,
  };
  const extra = state.extras.find((photo) => photo.id === id);
  if (extra) Object.assign(extra, patch);
  else state.edits[id] = { ...(state.edits[id] || {}), ...patch };

  const serverPhoto = (state.serverPhotos || []).find((p) => p.id === id);
  if (serverPhoto) Object.assign(serverPhoto, patch);

  persist();

  // Kirim update ke server jika foto tersimpan di database cloud
  if (id && !id.startsWith("baru-") && !id.includes("-19") && !id.includes("-20")) {
    try {
      await fetch(`/api/photos/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-family-pin": getAdminPin(),
        },
        body: JSON.stringify({
          title: patch.title,
          caption: patch.caption,
          place: patch.place,
          taken_year: patch.year,
          taken_date: patch.taken_date,
          album: patch.album,
          category: patch.category,
          chip: patch.chip,
        }),
      });
    } catch {}
  }

  const photo = allPhotos().find((p) => p.id === id);
  fillModal(photo);
  setEditing(false);
  renderGallery();
  if (state.view === "album") renderAlbums();
  toast("Keterangan kenangan sudah disimpan.");
}

function removeActivePhoto() {
  const id = state.activeId;
  if (!id) return;
  const extraIndex = state.extras.findIndex((photo) => photo.id === id);
  if (extraIndex >= 0) state.extras.splice(extraIndex, 1);
  else state.hidden.add(id);
  delete state.edits[id];
  state.likes.delete(id);
  persist();
  closeModal();
  renderGallery();
  if (state.view === "album") renderAlbums();
  toast("Foto dikeluarkan dari lemari kenangan.");
}

function openConfirm() {
  const photo = allPhotos().find((p) => p.id === state.activeId);
  if (!photo) return;
  $("#confirm-copy").textContent = `“${photo.title}” akan dikeluarkan dari lemari. Tekan Tidak jika belum yakin.`;
  $("#confirm-modal").classList.add("is-open");
}

function closeConfirm() {
  $("#confirm-modal").classList.remove("is-open");
}

function toggleLike(id) {
  if (state.likes.has(id)) state.likes.delete(id);
  else state.likes.add(id);
  persist();
  renderGallery();
}

let pendingUploadFile = null;

function populateUploadAlbums() {
  const select = $("#upload-target-album");
  if (!select) return;
  const albumNames = new Set(["Foto Keluarga", "Hari Raya", "Cucu & Liburan", "Masa Muda & Pernikahan"]);
  allPhotos().forEach((p) => {
    if (p.album) albumNames.add(p.album);
  });
  if (state.serverAlbums && Array.isArray(state.serverAlbums)) {
    state.serverAlbums.forEach((a) => {
      if (a.nama) albumNames.add(a.nama);
      if (a.name) albumNames.add(a.name);
    });
  }

  const currentVal = select.value || "Foto Keluarga";
  select.innerHTML = Array.from(albumNames)
    .map((name) => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");

  if (albumNames.has(currentVal)) {
    select.value = currentVal;
  }
}

function openUploadModal(file) {
  if (!file || !file.type.startsWith("image/")) {
    toast("Pilih berkas foto JPG, PNG, atau WEBP ya.");
    return;
  }

  pendingUploadFile = file;
  const modal = $("#upload-modal");
  if (!modal) return;

  const previewImg = $("#upload-preview-img");
  if (previewImg) previewImg.src = URL.createObjectURL(file);

  const nameEl = $("#upload-preview-filename");
  if (nameEl) nameEl.textContent = file.name;

  const sizeEl = $("#upload-preview-filesize");
  if (sizeEl) sizeEl.textContent = `${(file.size / (1024 * 1024)).toFixed(2)} MB • Berkas Gambar`;

  // Bersihkan nama file jadi judul yang rapi
  const cleanTitle = file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
  const titleInput = $("#upload-title-input");
  if (titleInput) titleInput.value = cleanTitle;

  const placeInput = $("#upload-place-input");
  if (placeInput) placeInput.value = "";

  const captionInput = $("#upload-caption-input");
  if (captionInput) captionInput.value = "";

  // Set default Waktu: Hari Ini
  const todayRadio = $("#upload-time-today");
  if (todayRadio) todayRadio.checked = true;

  const todayStr = new Date().toISOString().split("T")[0];
  const dateInput = $("#upload-date-input");
  if (dateInput) dateInput.value = todayStr;

  const yearInput = $("#upload-year-input");
  if (yearInput) yearInput.value = new Date().getFullYear();

  const hintEl = $("#upload-date-hint");
  if (hintEl) hintEl.textContent = "Foto dicatat diambil hari ini.";

  populateUploadAlbums();

  modal.classList.add("is-open");
}

function closeUploadModal() {
  const modal = $("#upload-modal");
  if (modal) modal.classList.remove("is-open");
  pendingUploadFile = null;
  const submitBtn = $("#submit-upload-btn");
  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.innerHTML = `<span class="material-symbols-outlined">save</span> Simpan ke Lemari Kenangan`;
  }
}

async function loadServerPhotos() {
  try {
    const res = await fetch("/api/photos", {
      headers: { "x-family-pin": getAdminPin() },
    });
    if (res.ok) {
      const data = await res.json();
      const items = data.items || data.photos || [];
      if (Array.isArray(items) && items.length > 0) {
        state.serverPhotos = items.map((p) => ({
          id: p.id,
          title: p.title,
          caption: p.caption,
          place: p.place,
          year: p.year || (p.taken_date ? new Date(p.taken_date).getFullYear() : new Date().getFullYear()),
          taken_date: p.taken_date,
          taken_date_label: p.taken_date_label,
          category: p.category,
          chip: p.chip,
          warm: p.warm,
          liked: p.liked || p.is_favorite,
          album: p.album || "Foto Keluarga",
          src: p.display_url || p.thumbnail_url || p.original_url || p.src,
        }));
        renderGallery();
        if (state.view === "album") renderAlbums();
      }
    }
  } catch (err) {
    console.warn("Sinkronisasi foto server:", err);
  }
}

async function loadServerAlbums() {
  try {
    const res = await fetch("/api/albums", {
      headers: { "x-family-pin": getAdminPin() },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.items && Array.isArray(data.items)) {
        state.serverAlbums = data.items;
        populateUploadAlbums();
      }
    }
  } catch {}
}

function initUploadHandlers() {
  // Pilihan radio Hari Ini vs Foto Lama
  $("#upload-time-today")?.addEventListener("change", (e) => {
    if (e.target.checked) {
      const todayStr = new Date().toISOString().split("T")[0];
      const dateInput = $("#upload-date-input");
      if (dateInput) dateInput.value = todayStr;
      const yearInput = $("#upload-year-input");
      if (yearInput) yearInput.value = new Date().getFullYear();
      const hint = $("#upload-date-hint");
      if (hint) hint.textContent = "Foto dicatat diambil hari ini.";
    }
  });

  $("#upload-time-past")?.addEventListener("change", (e) => {
    if (e.target.checked) {
      const hint = $("#upload-date-hint");
      if (hint) hint.textContent = "💡 Untuk foto lama, silakan pilih tanggal di kalender atau cukup isi tahunnya.";
      $("#upload-date-input")?.focus();
    }
  });

  $("#upload-date-input")?.addEventListener("input", (e) => {
    const val = e.target.value;
    if (val) {
      const y = new Date(val).getFullYear();
      if (y && !isNaN(y)) {
        const yearInput = $("#upload-year-input");
        if (yearInput) yearInput.value = y;
      }
      const pastRadio = $("#upload-time-past");
      if (pastRadio) pastRadio.checked = true;
      const hint = $("#upload-date-hint");
      if (hint) hint.textContent = `Foto dicatat diambil pada tanggal ${val}.`;
    }
  });

  $("#upload-year-input")?.addEventListener("input", (e) => {
    const pastRadio = $("#upload-time-past");
    if (pastRadio) pastRadio.checked = true;
    const y = e.target.value;
    const hint = $("#upload-date-hint");
    if (hint && y) hint.textContent = `Foto dicatat sebagai kenangan tahun ${y}.`;
  });

  $("#upload-change-file-btn")?.addEventListener("click", () => {
    $("#foto-input")?.click();
  });

  $("#cancel-upload-btn")?.addEventListener("click", closeUploadModal);
  $("#close-upload-modal")?.addEventListener("click", closeUploadModal);
  $("#upload-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "upload-modal") closeUploadModal();
  });

  // Submit form simpan foto
  $("#upload-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!pendingUploadFile) {
      toast("Pilih berkas foto terlebih dahulu.");
      return;
    }

    const submitBtn = $("#submit-upload-btn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `⏳ Sedang menyimpan foto ke lemari...`;
    }

    const title = $("#upload-title-input")?.value.trim() || pendingUploadFile.name.replace(/\.[^.]+$/, "") || "Kenangan Baru";
    const caption = $("#upload-caption-input")?.value.trim() || "Kenangan tersimpan di lemari keluarga.";
    const place = $("#upload-place-input")?.value.trim() || "Album Pribadi";
    const album = $("#upload-target-album")?.value || "Foto Keluarga";
    const timeType = $('input[name="upload_time_type"]:checked')?.value || "today";

    let takenDate = null;
    let takenYear = null;

    if (timeType === "today") {
      takenDate = new Date().toISOString().split("T")[0];
      takenYear = new Date().getFullYear();
    } else {
      takenDate = $("#upload-date-input")?.value || null;
      takenYear = Number($("#upload-year-input")?.value) || (takenDate ? new Date(takenDate).getFullYear() : new Date().getFullYear());
    }

    let category = "keluarga";
    let chip = "Keluarga";
    let warm = false;

    if (album.includes("Hari Raya")) {
      category = "hari-raya";
      chip = "Hari Raya";
      warm = true;
    } else if (album.includes("Liburan") || album.includes("Cucu")) {
      category = "liburan";
      chip = "Liburan";
      warm = true;
    } else if (album.includes("Pernikahan") || album.includes("Masa Muda")) {
      category = "pernikahan";
      chip = "Pernikahan";
      warm = false;
    }

    const saveLocally = () => {
      try {
        const reader = new FileReader();
        reader.onload = () => {
          try {
            const localId = `baru-${Date.now()}`;
            state.extras.unshift({
              id: localId,
              title,
              caption,
              place,
              year: takenYear,
              taken_date: takenDate,
              taken_date_label: takenDate || `Tahun ${takenYear}`,
              category,
              chip,
              warm,
              liked: false,
              album,
              src: reader.result,
            });
            persist();
            closeUploadModal();
            setView("semua");
            renderGallery();
            if (state.view === "album") renderAlbums();
            toast(`✅ Foto "${title}" berhasil disimpan di album "${album}"!`);
          } catch (storageErr) {
            console.error("Gagal simpan lokal:", storageErr);
            toast("⚠️ Memori browser penuh. Silakan kurangi sebagian foto.");
            if (submitBtn) {
              submitBtn.disabled = false;
              submitBtn.innerHTML = `<span class="material-symbols-outlined">save</span> Simpan ke Lemari Kenangan`;
            }
          }
        };
        reader.onerror = () => {
          toast("❌ Gagal membaca berkas foto.");
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span class="material-symbols-outlined">save</span> Simpan ke Lemari Kenangan`;
          }
        };
        reader.readAsDataURL(pendingUploadFile);
      } catch (e) {
        console.error("Local save error:", e);
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span class="material-symbols-outlined">save</span> Simpan ke Lemari Kenangan`;
        }
      }
    };

    const fd = new FormData();
    fd.append("photo", pendingUploadFile);
    fd.append("title", title);
    fd.append("caption", caption);
    fd.append("place", place);
    fd.append("album", album);
    fd.append("category", category);
    fd.append("chip", chip);
    if (takenDate) fd.append("taken_date", takenDate);
    if (takenYear) fd.append("taken_year", takenYear);
    fd.append("pin", getAdminPin());

    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/photos/upload", true);
    xhr.setRequestHeader("x-family-pin", getAdminPin());
    xhr.timeout = 40000; // 40 detik timeout maksimal

    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && submitBtn) {
        const pct = Math.round((event.loaded / event.total) * 100);
        submitBtn.innerHTML = `⏳ Mengunggah foto (${pct}%)...`;
      }
    };

    xhr.upload.onload = () => {
      if (submitBtn) {
        submitBtn.innerHTML = `⏳ Menyimpan ke lemari kenangan...`;
      }
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText || "{}");
        if ((xhr.status === 200 || xhr.status === 201) && data.photo) {
          const p = data.photo;
          const newPhotoItem = {
            id: p.id,
            title: p.title || title,
            caption: p.caption || caption,
            place: p.place || place,
            year: p.year || takenYear,
            taken_date: p.taken_date || takenDate,
            taken_date_label: p.taken_date_label || (takenDate || `Tahun ${takenYear}`),
            category: p.category || category,
            chip: p.chip || chip,
            warm: p.warm !== undefined ? p.warm : warm,
            liked: false,
            album: p.album || album,
            src: p.display_url || p.thumbnail_url || p.original_url || URL.createObjectURL(pendingUploadFile),
          };

          state.serverPhotos = [newPhotoItem, ...(state.serverPhotos || [])];
          closeUploadModal();
          setView("semua");
          renderGallery();
          if (state.view === "album") renderAlbums();
          toast(`✅ Foto "${title}" berhasil disimpan di album "${album}"!`);
          return;
        }

        // Jika server menolak atau ada error
        const errMsg = data.message || `Server merespon kode ${xhr.status}`;
        console.warn("Upload server tidak berhasil:", errMsg);
        toast(`⚠️ ${errMsg}. Menyimpan cadangan perangkat...`);
        saveLocally();
      } catch (parseErr) {
        console.warn("Error parsing response:", parseErr);
        toast("⚠️ Respon server tidak terbaca. Menyimpan cadangan perangkat...");
        saveLocally();
      }
    };

    xhr.onerror = () => {
      console.warn("XHR network error, falling back to local");
      toast("⚠️ Jaringan tidak stabil, menyimpan ke memori perangkat...");
      saveLocally();
    };

    xhr.ontimeout = () => {
      console.warn("XHR timeout, falling back to local");
      toast("⚠️ Waktu unggah habis, menyimpan foto ke memori perangkat...");
      saveLocally();
    };

    xhr.send(fd);
  });
}

function init() {
  $("#edit-album").innerHTML = ALBUMS.map(
    (album) => `<option value="${escapeHtml(album.name)}">${escapeHtml(album.name)}</option>`
  ).join("");

  $("#filter-bar").innerHTML = FILTERS.map((f, i) => `
    <button class="filter-btn ${i === 0 ? "is-active" : ""}" type="button" data-filter="${f.id}" ${f.id === "semua" ? 'id="filter-all"' : ""}>
      ${f.id === "semua" ? `${icon("filter_vintage")} Semua (${allPhotos().length} Foto)` : f.label}
    </button>
  `).join("");

  document.addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav) {
      e.preventDefault();
      setView(nav.dataset.nav);
    }
    const filter = e.target.closest("[data-filter]");
    if (filter) {
      state.filter = filter.dataset.filter;
      $$("[data-filter]").forEach((btn) => btn.classList.toggle("is-active", btn === filter));
      renderGallery();
    }
    const like = e.target.closest("[data-like]");
    if (like) toggleLike(like.dataset.like);
    const open = e.target.closest("[data-open]");
    if (open) openModal(open.dataset.open);
    const album = e.target.closest("[data-open-album]");
    if (album) {
      const name = album.dataset.openAlbum;
      const map = {
        "Foto Keluarga": "keluarga",
        "Masa Muda & Pernikahan": "pernikahan",
        "Hari Raya": "hari-raya",
        "Cucu & Liburan": "liburan",
      };
      state.filter = map[name] || "semua";
      setView("semua");
      $$("[data-filter]").forEach((btn) => {
        btn.classList.toggle("is-active", btn.dataset.filter === state.filter);
      });
      renderGallery();
    }
  });

  const syncSearch = (value, source) => {
    state.query = value;
    $$("#search, #search-mobile").forEach((input) => {
      if (input !== source) input.value = value;
    });
    if (state.view === "album") renderAlbums();
    else renderGallery();
  };

  $("#search").addEventListener("input", (e) => syncSearch(e.target.value, e.target));
  $("#search-mobile").addEventListener("input", (e) => syncSearch(e.target.value, e.target));

  $("#mode-large").addEventListener("click", () => {
    state.compact = false;
    applyCompact();
    $("#mode-large").classList.add("is-active");
    $("#mode-compact").classList.remove("is-active");
  });

  $("#mode-compact").addEventListener("click", () => {
    state.compact = true;
    applyCompact();
    $("#mode-compact").classList.add("is-active");
    $("#mode-large").classList.remove("is-active");
  });

  $("#menu-toggle").addEventListener("click", () => {
    $("#mobile-nav").classList.toggle("is-open");
  });

  ["add-photo", "pick-photo"].forEach((id) => {
    $(`#${id}`)?.addEventListener("click", () => $("#foto-input")?.click());
  });

  $("#foto-input")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) openUploadModal(file);
    e.target.value = "";
  });

  const drop = $("#upload-inner");
  if (drop) {
    ["dragenter", "dragover"].forEach((ev) => {
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.add("is-drag");
      });
    });
    ["dragleave", "drop"].forEach((ev) => {
      drop.addEventListener(ev, (e) => {
        e.preventDefault();
        drop.classList.remove("is-drag");
      });
    });
    drop.addEventListener("drop", (e) => {
      const file = e.dataTransfer?.files?.[0];
      if (file && file.type.startsWith("image/")) openUploadModal(file);
    });
  }

  $("#close-modal").addEventListener("click", closeModal);
  $("#back-modal").addEventListener("click", closeModal);
  $("#photo-modal").addEventListener("click", (e) => {
    if (e.target.id === "photo-modal" && !$("#confirm-modal").classList.contains("is-open")) closeModal();
  });
  $("#zoom-more").addEventListener("click", () => {
    state.zoomed = !state.zoomed;
    $("#modal-img").style.transform = state.zoomed ? "scale(1.35)" : "scale(1)";
    toast(state.zoomed ? "Foto diperbesar untuk kenyamanan mata." : "Ukuran foto dikembalikan.");
  });
  $("#edit-photo").addEventListener("click", () => setEditing(true));
  $("#cancel-edit").addEventListener("click", () => setEditing(false));
  $("#photo-edit").addEventListener("submit", saveEdits);
  $("#delete-photo").addEventListener("click", openConfirm);
  $("#confirm-no").addEventListener("click", closeConfirm);
  $("#confirm-yes").addEventListener("click", () => {
    closeConfirm();
    removeActivePhoto();
  });
  $("#confirm-modal").addEventListener("click", (e) => {
    if (e.target.id === "confirm-modal") closeConfirm();
  });
  const closeGuide = () => $("#guide-modal").classList.remove("is-open");
  const openGuide = () => $("#guide-modal").classList.add("is-open");

  $("#print-photo").addEventListener("click", () => {
    window.print();
  });
  $("#guide-btn").addEventListener("click", openGuide);
  $("#close-guide").addEventListener("click", closeGuide);
  $("#guide-done").addEventListener("click", closeGuide);
  $("#guide-modal").addEventListener("click", (e) => {
    if (e.target.id === "guide-modal") closeGuide();
  });
  $("#share-btn").addEventListener("click", async () => {
    const text = "Koleksi kenangan keluarga dari Album Kenangan Saya.";
    const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Album Kenangan Saya", text });
        return;
      } catch {
        /* user cancelled or unsupported */
      }
    }
    window.open(wa, "_blank", "noopener");
  });

  const modalShareBtn = $("#modal-share-wa");
  if (modalShareBtn) {
    modalShareBtn.addEventListener("click", async () => {
      const photo = allPhotos().find((p) => p.id === state.activeId);
      if (!photo) return;
      try {
        const shareEndpoint = window.location.origin && !window.location.origin.startsWith("file:")
          ? `${window.location.origin}/api/share/whatsapp`
          : "http://localhost:8787/api/share/whatsapp";
        const res = await fetch(shareEndpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photo_id: photo.id, hours: 48 }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.whatsapp_url) {
            window.open(data.whatsapp_url, "_blank", "noopener");
            return;
          }
        }
      } catch {
        // Fallback jika backend belum terhubung
      }
      const text = `Kenangan keluarga: "${photo.title}" (${photo.year || ""})\n“${photo.caption || ""}”`;
      const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
      window.open(wa, "_blank", "noopener");
    });
  }

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if ($("#confirm-modal")?.classList.contains("is-open")) closeConfirm();
    else if ($("#upload-modal")?.classList.contains("is-open")) closeUploadModal();
    else if (state.editing) setEditing(false);
    else {
      closeModal();
      closeGuide();
    }
  });

  window.addEventListener("hashchange", () => {
    const view = location.hash.replace("#", "");
    if (VIEWS.includes(view) && view !== state.view) setView(view);
  });

  const start = location.hash.replace("#", "");
  if (VIEWS.includes(start)) setView(start);
  else renderGallery();

  // Aktifkan Fitur Khusus Admin, Unggah Kenangan, & Sinkronisasi Cloud
  initAdmin();
  initUploadHandlers();
  loadServerPhotos();
  loadServerAlbums();
}

// --- ADMIN & PENGATURAN LEMARI KENANGAN ---
const SETTINGS_STORAGE_KEY = "album_kenangan_settings";

function getAdminPin() {
  return localStorage.getItem("family_admin_pin") || "1958";
}

function isAdminLoggedIn() {
  return localStorage.getItem("family_admin_logged_in") === "true";
}

function setAdminLoggedIn(val) {
  localStorage.setItem("family_admin_logged_in", val ? "true" : "false");
  const badge = $("#admin-badge");
  if (badge) badge.style.display = val ? "inline-block" : "none";
}

const DEFAULT_AVATAR = "https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=256&q=80";

async function loadSettings() {
  // 1. Muat pengaturan lokal terlebih dahulu agar secepat kilat
  try {
    const cached = JSON.parse(localStorage.getItem(SETTINGS_STORAGE_KEY) || "null");
    if (cached) {
      if (cached.admin_avatar && cached.admin_avatar.includes("admin-1790655982077.webp")) {
        cached.admin_avatar = DEFAULT_AVATAR;
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(cached));
      }
      applySettings(cached);
    }
  } catch {}

  // 2. Sinkronkan dengan server
  try {
    const res = await fetch("/api/settings", {
      headers: { "x-family-pin": getAdminPin() },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.settings) {
        if (data.settings.admin_avatar && data.settings.admin_avatar.includes("admin-1790655982077.webp")) {
          data.settings.admin_avatar = DEFAULT_AVATAR;
        }
        applySettings(data.settings);
        localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(data.settings));
      }
    }
  } catch (err) {
    console.warn("Sinkronisasi pengaturan server santai:", err);
  }
}

function applySettings(settings) {
  if (!settings) return;

  if (settings.site_name) {
    document.title = settings.site_name;
    const brand = $("#brand-name");
    if (brand) brand.textContent = settings.site_name;
    const footerBrand = $("#footer-brand-name");
    if (footerBrand) footerBrand.textContent = settings.site_name;
    const setSiteInput = $("#set-site-name");
    if (setSiteInput) setSiteInput.value = settings.site_name;
  }

  if (settings.kicker) {
    const kickerEl = $("#hero-kicker-text");
    if (kickerEl) kickerEl.textContent = settings.kicker;
    const setKickerInput = $("#set-kicker");
    if (setKickerInput) setKickerInput.value = settings.kicker;
  }

  if (settings.hero_title) {
    const titleEl = $("#hero-title-text");
    if (titleEl) titleEl.textContent = settings.hero_title;
    const setTitleInput = $("#set-hero-title");
    if (setTitleInput) setTitleInput.value = settings.hero_title;
  }

  if (settings.hero_lede) {
    const ledeEl = $("#hero-lede-text");
    if (ledeEl) ledeEl.textContent = settings.hero_lede;
    const setLedeInput = $("#set-hero-lede");
    if (setLedeInput) setLedeInput.value = settings.hero_lede;
  }

  if (settings.admin_name) {
    const setAdminNameInput = $("#set-admin-name");
    if (setAdminNameInput) setAdminNameInput.value = settings.admin_name;
  }

  if (settings.admin_avatar) {
    let av = settings.admin_avatar;
    if (av.includes("admin-1790655982077.webp")) av = DEFAULT_AVATAR;
    const headerAvatar = $("#header-avatar");
    if (headerAvatar) headerAvatar.src = av;
    const previewAvatar = $("#admin-avatar-preview");
    if (previewAvatar) previewAvatar.src = av;
    const urlInput = $("#admin-avatar-url-input");
    if (urlInput) urlInput.value = av;
  }
}

async function loadAdminAlbums() {
  const container = $("#admin-album-list");
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;padding:1rem;color:var(--on-surface-muted)">Memuat daftar album...</div>`;

  try {
    const res = await fetch("/api/albums", {
      headers: { "x-family-pin": getAdminPin() },
    });
    if (res.ok) {
      const data = await res.json();
      const items = data.items || [];
      if (items.length === 0) {
        container.innerHTML = `<p style="color:var(--on-surface-muted);padding:0.5rem">Belum ada album tersimpan.</p>`;
        return;
      }
      container.innerHTML = items
        .map(
          (album) => `
        <div class="admin-item">
          <div class="admin-item-info">
            <strong>📁 ${escapeHtml(album.nama)}</strong>
            <span>${escapeHtml(album.deskripsi || "Tanpa deskripsi")} • ${escapeHtml(album.photo_count_label || "0 lembar foto")}</span>
          </div>
          <button type="button" class="btn btn-outline" onclick="deleteAlbumById('${album.id}')" style="min-height:36px;padding:0.35rem 0.75rem;font-size:13px;color:var(--secondary)">
            <span class="material-symbols-outlined" style="font-size:16px">delete</span>
            Hapus
          </button>
        </div>
      `
        )
        .join("");
    }
  } catch (err) {
    container.innerHTML = `<p style="color:var(--on-surface-muted)">Gagal memuat album.</p>`;
  }
}

async function deleteAlbumById(albumId) {
  if (!confirm("Bubarkan album ini? (Foto-foto di dalamnya tidak akan terhapus, hanya map yang dibubarkan)")) return;
  try {
    const res = await fetch(`/api/albums/${albumId}`, {
      method: "DELETE",
      headers: { "x-family-pin": getAdminPin() },
    });
    if (res.ok) {
      toast("Album berhasil dihapus.");
      loadAdminAlbums();
    } else {
      toast("Gagal menghapus album.");
    }
  } catch {
    toast("Terjadi kesalahan.");
  }
}
window.deleteAlbumById = deleteAlbumById;

async function loadAdminMembers() {
  const container = $("#admin-member-list");
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;padding:1rem;color:var(--on-surface-muted)">Memuat daftar anggota...</div>`;

  try {
    const res = await fetch("/api/members", {
      headers: { "x-family-pin": getAdminPin() },
    });
    if (res.ok) {
      const data = await res.json();
      const members = data.members || [];
      if (members.length === 0) {
        container.innerHTML = `<p style="color:var(--on-surface-muted)">Belum ada anggota terdaftar.</p>`;
        return;
      }
      container.innerHTML = members
        .map(
          (m) => `
        <div class="admin-item">
          <div class="admin-item-info">
            <strong>${m.role === "admin" ? "👑" : "👤"} ${escapeHtml(m.nama)} ${m.role === "admin" ? "(Pengelola)" : ""}</strong>
            <span>${m.no_hp ? "WA: " + escapeHtml(m.no_hp) : "Tanpa nomor kontak"}</span>
          </div>
          ${
            m.role !== "admin"
              ? `<button type="button" class="btn btn-outline" onclick="deleteMemberById('${m.id}')" style="min-height:36px;padding:0.35rem 0.75rem;font-size:13px">Nonaktifkan</button>`
              : `<span class="badge" style="background:var(--primary-tint);color:var(--primary);font-size:12px;padding:4px 8px;border-radius:999px">Admin Utama</span>`
          }
        </div>
      `
        )
        .join("");
    }
  } catch (err) {
    container.innerHTML = `<p style="color:var(--on-surface-muted)">Gagal memuat anggota keluarga.</p>`;
  }
}

async function deleteMemberById(memberId) {
  if (!confirm("Nonaktifkan anggota keluarga ini?")) return;
  try {
    const res = await fetch(`/api/members/${memberId}`, {
      method: "DELETE",
      headers: { "x-family-pin": getAdminPin() },
    });
    if (res.ok) {
      toast("Anggota berhasil dinonaktifkan.");
      loadAdminMembers();
    } else {
      toast("Gagal memproses anggota.");
    }
  } catch {
    toast("Terjadi kesalahan.");
  }
}
window.deleteMemberById = deleteMemberById;

async function loadAdminTrash() {
  const container = $("#admin-trash-list");
  if (!container) return;
  container.innerHTML = `<div style="text-align:center;padding:1rem;color:var(--on-surface-muted)">Memeriksa tong sampah...</div>`;

  try {
    const res = await fetch("/api/photos?trash=true", {
      headers: { "x-family-pin": getAdminPin() },
    });
    if (res.ok) {
      const data = await res.json();
      const photos = data.photos || [];
      if (photos.length === 0) {
        container.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--on-surface-muted)">
          <span class="material-symbols-outlined" style="font-size:48px;display:block;margin-bottom:0.5rem">inventory_2</span>
          Tong sampah bersih. Semua foto keluarga aman di lemari.
        </div>`;
        return;
      }
      container.innerHTML = photos
        .map(
          (p) => `
        <div class="admin-item" style="gap:1rem">
          <img src="${p.thumbnail_url || p.display_url || p.src}" style="width:50px;height:50px;border-radius:6px;object-fit:cover" alt="">
          <div class="admin-item-info" style="flex:1">
            <strong>${escapeHtml(p.title || "Kenangan")}</strong>
            <span>${escapeHtml(p.place || "Tempat tidak dicatat")} • Dikeluarkan pada ${new Date(p.deleted_at).toLocaleDateString("id-ID")}</span>
          </div>
          <button type="button" class="btn btn-outline" onclick="restorePhotoById('${p.id}')" style="min-height:36px;padding:0.35rem 0.75rem;font-size:13px;color:var(--primary)">
            <span class="material-symbols-outlined" style="font-size:16px">restore</span>
            Pulihkan
          </button>
        </div>
      `
        )
        .join("");
    }
  } catch (err) {
    container.innerHTML = `<p style="color:var(--on-surface-muted)">Gagal memuat tong sampah.</p>`;
  }
}

async function restorePhotoById(photoId) {
  try {
    const res = await fetch(`/api/photos/${photoId}/restore`, {
      method: "POST",
      headers: { "x-family-pin": getAdminPin() },
    });
    if (res.ok) {
      toast("✅ Foto berhasil dipulihkan ke lemari kenangan!");
      loadAdminTrash();
      renderGallery();
    } else {
      toast("Gagal memulihkan foto.");
    }
  } catch {
    toast("Terjadi kesalahan koneksi.");
  }
}
window.restorePhotoById = restorePhotoById;

function initAdmin() {
  setAdminLoggedIn(isAdminLoggedIn());
  loadSettings();

  const openPinModal = () => {
    const pinInput = $("#pin-input");
    if (pinInput) pinInput.value = "";
    $("#pin-modal")?.classList.add("is-open");
    setTimeout(() => pinInput?.focus(), 150);
  };

  const closePinModal = () => {
    $("#pin-modal")?.classList.remove("is-open");
  };

  const openAdminModal = () => {
    $("#admin-modal")?.classList.add("is-open");
    loadSettings();
  };

  const closeAdminModal = () => {
    $("#admin-modal")?.classList.remove("is-open");
  };

  function handleOpenAdmin() {
    if (isAdminLoggedIn()) {
      openAdminModal();
    } else {
      openPinModal();
    }
  }

  $("#open-admin-btn")?.addEventListener("click", handleOpenAdmin);
  $("#nav-admin-btn")?.addEventListener("click", handleOpenAdmin);
  $("#mobile-admin-btn")?.addEventListener("click", handleOpenAdmin);

  $("#close-pin-modal")?.addEventListener("click", closePinModal);
  $("#pin-cancel-btn")?.addEventListener("click", closePinModal);
  $("#pin-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "pin-modal") closePinModal();
  });

  $("#pin-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const pin = $("#pin-input")?.value.trim();
    if (!pin) return;

    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        localStorage.setItem("family_admin_pin", pin);
        setAdminLoggedIn(true);
        closePinModal();
        openAdminModal();
        toast("👑 Selamat datang kembali di Panel Admin Lemari!");
      } else {
        toast(data.message || "PIN keluarga tidak sesuai. Silakan coba lagi.");
      }
    } catch {
      if (pin === "1958") {
        localStorage.setItem("family_admin_pin", pin);
        setAdminLoggedIn(true);
        closePinModal();
        openAdminModal();
        toast("👑 Masuk Mode Admin.");
      } else {
        toast("PIN tidak sesuai.");
      }
    }
  });

  $("#close-admin-modal")?.addEventListener("click", closeAdminModal);
  $("#admin-modal")?.addEventListener("click", (e) => {
    if (e.target.id === "admin-modal") closeAdminModal();
  });

  // Tab switcher
  $$(".admin-tab-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      $$(".admin-tab-btn").forEach((b) => b.classList.remove("is-active"));
      $$(".admin-panel").forEach((p) => p.classList.remove("is-active"));
      btn.classList.add("is-active");
      const tabId = btn.dataset.tab;
      const targetPanel = $(`#${tabId}`);
      if (targetPanel) targetPanel.classList.add("is-active");

      if (tabId === "tab-album") loadAdminAlbums();
      if (tabId === "tab-keluarga") loadAdminMembers();
      if (tabId === "tab-sampah") loadAdminTrash();
    });
  });

  let selectedAvatarFile = null;

  // Avatar pick: tampilkan pratinjau seketika, berkas disimpan untuk diunggah saat klik Simpan
  $("#admin-avatar-file-input")?.addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    selectedAvatarFile = file;
    const localUrl = URL.createObjectURL(file);
    const prev = $("#admin-avatar-preview");
    if (prev) prev.src = localUrl;
    const hAvatar = $("#header-avatar");
    if (hAvatar) hAvatar.src = localUrl;

    const statusEl = $("#avatar-upload-status");
    if (statusEl) {
      statusEl.style.color = "var(--primary)";
      statusEl.textContent = "📸 Foto profil dipilih! Klik tombol 'Simpan Perubahan Tampilan' di bawah.";
    }
    toast("Foto profil dipilih. Klik Simpan Perubahan Tampilan di bawah ya.");
  });

  // Tombol reset foto bawaan
  $("#reset-avatar-btn")?.addEventListener("click", () => {
    selectedAvatarFile = null;
    const prev = $("#admin-avatar-preview");
    if (prev) prev.src = DEFAULT_AVATAR;
    const hAvatar = $("#header-avatar");
    if (hAvatar) hAvatar.src = DEFAULT_AVATAR;
    const urlInput = $("#admin-avatar-url-input");
    if (urlInput) urlInput.value = DEFAULT_AVATAR;

    const statusEl = $("#avatar-upload-status");
    if (statusEl) {
      statusEl.style.color = "var(--primary)";
      statusEl.textContent = "Foto profil akan dikembalikan ke bawaan setelah disimpan.";
    }
    toast("Foto profil direset ke bawaan. Jangan lupa klik Simpan di bawah.");
  });

  // Simpan pengaturan tampilan & foto profil sekaligus dalam satu tombol
  $("#admin-settings-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submitBtn = $("#save-settings-btn");
    const originalBtnHtml = submitBtn ? submitBtn.innerHTML : "";
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `⏳ Sedang menyimpan perubahan...`;
    }

    const statusEl = $("#avatar-upload-status");
    let finalAvatarUrl = $("#admin-avatar-url-input")?.value.trim() || "";

    // 1. Jika ada berkas foto profil baru, unggah terlebih dahulu
    if (selectedAvatarFile) {
      if (statusEl) statusEl.textContent = "⏳ Sedang mengunggah foto profil ke server...";
      try {
        const fd = new FormData();
        fd.append("avatar", selectedAvatarFile);
        fd.append("pin", getAdminPin());
        const res = await fetch("/api/members/avatar", {
          method: "POST",
          headers: { "x-family-pin": getAdminPin() },
          body: fd,
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.avatar_url) {
          finalAvatarUrl = data.avatar_url;
          selectedAvatarFile = null;
          const urlInput = $("#admin-avatar-url-input");
          if (urlInput) urlInput.value = finalAvatarUrl;
        } else {
          console.warn("Upload avatar server gagal:", data.message);
          // Fallback Data URL lokal agar foto profil tetap langsung tampil
          try {
            const dataUrl = await new Promise((resolve) => {
              const r = new FileReader();
              r.onload = () => resolve(r.result);
              r.onerror = () => resolve("");
              r.readAsDataURL(selectedAvatarFile);
            });
            if (dataUrl) finalAvatarUrl = dataUrl;
          } catch {}
        }
      } catch (upErr) {
        console.warn("Upload avatar network error:", upErr);
      }
    }

    if (!finalAvatarUrl || finalAvatarUrl.includes("admin-1790655982077.webp")) {
      const currentPrev = $("#admin-avatar-preview")?.src || "";
      if (currentPrev.startsWith("http") && !currentPrev.includes("admin-1790655982077.webp") && !currentPrev.includes("blob:")) {
        finalAvatarUrl = currentPrev;
      } else {
        finalAvatarUrl = DEFAULT_AVATAR;
      }
    }

    const payload = {
      site_name: $("#set-site-name")?.value.trim() || "Album Kenangan Saya",
      kicker: $("#set-kicker")?.value.trim() || "Ruang Kenangan Pribadi",
      hero_title: $("#set-hero-title")?.value.trim() || "Selamat Datang di Lemari Kenangan",
      hero_lede: $("#set-hero-lede")?.value.trim() || "",
      admin_name: $("#set-admin-name")?.value.trim() || "Elga Alfareza",
      admin_avatar: finalAvatarUrl,
      pin: getAdminPin(),
    };

    applySettings(payload);
    try {
      localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(payload));
    } catch {}

    try {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-family-pin": getAdminPin(),
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (statusEl) statusEl.textContent = "✅ Foto profil & pengaturan tersimpan rapi!";
      toast(data.message || "✅ Pengaturan lemari dan profil berhasil disimpan!");
    } catch {
      if (statusEl) statusEl.textContent = "✅ Disimpan di perangkat ini.";
      toast("✅ Pengaturan disimpan di perangkat ini.");
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalBtnHtml;
      }
    }
  });

  // Tambah album
  $("#create-album-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nama = $("#new-album-name")?.value.trim();
    const deskripsi = $("#new-album-desc")?.value.trim();
    if (!nama) return;

    try {
      const res = await fetch("/api/albums", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-family-pin": getAdminPin(),
        },
        body: JSON.stringify({ nama, deskripsi }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(`✅ Album "${nama}" berhasil dibuat!`);
        $("#new-album-name").value = "";
        $("#new-album-desc").value = "";
        loadAdminAlbums();
      } else {
        toast(data.message || "Gagal membuat album.");
      }
    } catch {
      toast("Gagal membuat album.");
    }
  });

  // Tambah anggota
  $("#add-member-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const nama = $("#new-member-name")?.value.trim();
    const role = $("#new-member-role")?.value;
    const no_hp = $("#new-member-phone")?.value.trim();
    if (!nama) return;

    try {
      const res = await fetch("/api/members", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-family-pin": getAdminPin(),
        },
        body: JSON.stringify({ nama, role, no_hp }),
      });
      const data = await res.json();
      if (res.ok) {
        toast(`✅ Anggota keluarga "${nama}" berhasil ditambahkan!`);
        $("#new-member-name").value = "";
        $("#new-member-phone").value = "";
        loadAdminMembers();
      } else {
        toast(data.message || "Gagal menambah anggota.");
      }
    } catch {
      toast("Gagal menambah anggota.");
    }
  });

  // Ganti PIN Admin
  $("#change-pin-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const oldPin = $("#old-pin-input")?.value.trim();
    const newPin = $("#new-pin-input")?.value.trim();
    const confirmPin = $("#confirm-new-pin-input")?.value.trim();

    if (!oldPin || !newPin || !confirmPin) {
      toast("Semua bidang PIN wajib diisi.");
      return;
    }

    if (newPin !== confirmPin) {
      toast("Konfirmasi PIN baru tidak cocok.");
      return;
    }

    if (newPin.length < 4) {
      toast("PIN baru minimal harus 4 karakter/angka.");
      return;
    }

    try {
      const res = await fetch("/api/auth/change-pin", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-family-pin": oldPin || getAdminPin(),
        },
        body: JSON.stringify({ old_pin: oldPin, new_pin: newPin, pin: oldPin }),
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        localStorage.setItem("family_admin_pin", newPin);
        $("#old-pin-input").value = "";
        $("#new-pin-input").value = "";
        $("#confirm-new-pin-input").value = "";
        toast("✅ PIN Admin berhasil diganti! Gunakan PIN baru ini untuk masuk berikutnya.");
      } else {
        toast(data.message || "Gagal mengganti PIN.");
      }
    } catch {
      localStorage.setItem("family_admin_pin", newPin);
      toast("✅ PIN Admin berhasil disimpan di perangkat ini.");
    }
  });

  // Logout
  $("#admin-logout-btn")?.addEventListener("click", () => {
    setAdminLoggedIn(false);
    closeAdminModal();
    toast("Anda telah keluar dari Mode Admin.");
  });
}

document.addEventListener("DOMContentLoaded", init);
