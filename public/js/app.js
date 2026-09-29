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
  return [...PHOTOS, ...state.extras]
    .filter((photo) => !state.hidden.has(photo.id))
    .map((photo) => ({ ...photo, ...(state.edits[photo.id] || {}) }));
}

function matchesFilter(photo) {
  if (state.filter === "semua") return true;
  if (state.filter === "pernikahan") return photo.album === "Masa Muda & Pernikahan";
  if (state.filter === "liburan") return photo.category === "liburan" || photo.album === "Cucu & Liburan";
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
  return `
    <article class="photo-card" data-id="${escapeHtml(photo.id)}">
      <button class="mount" type="button" data-open="${escapeHtml(photo.id)}" aria-label="Lihat ${title} ukuran penuh">
        <div class="frame">
          <img src="${photo.src}" alt="${title}">
          <span class="chip ${photo.warm ? "is-warm" : ""}">${escapeHtml(photo.chip)}</span>
          <span class="year">Tahun ${escapeHtml(photo.year)}</span>
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
  $("#modal-title").textContent = `${photo.title} (${photo.year})`;
  $("#modal-caption").textContent = `“${photo.caption}”`;
  $("#modal-location").textContent = `📍 ${photo.place}`;
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
  $("#edit-year").value = photo.year;
  $("#edit-place").value = photo.place;
  $("#edit-album").value = photo.album;
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

function saveEdits(event) {
  event.preventDefault();
  const id = state.activeId;
  if (!id) return;
  const album = albumMeta($("#edit-album").value);
  const year = Number($("#edit-year").value) || new Date().getFullYear();
  const patch = {
    title: $("#edit-title").value.trim() || "Kenangan Keluarga",
    caption: $("#edit-caption").value.trim() || "Kenangan tersimpan di lemari keluarga.",
    place: $("#edit-place").value.trim() || "Album Pribadi",
    year,
    album: album.name,
    category: album.category,
    chip: album.chip,
    warm: album.warm,
  };
  const extra = state.extras.find((photo) => photo.id === id);
  if (extra) Object.assign(extra, patch);
  else state.edits[id] = { ...(state.edits[id] || {}), ...patch };
  persist();
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

function addLocalPhoto(file) {
  if (!file.type.startsWith("image/")) {
    toast("Pilih berkas foto JPG atau PNG ya.");
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const year = new Date().getFullYear();
    const id = `baru-${Date.now()}`;
    state.extras.unshift({
      id,
      title: file.name.replace(/\.[^.]+$/, "") || "Kenangan Baru",
      caption: "Baru saja disimpan ke lemari kenangan keluarga.",
      place: "Album Pribadi",
      year,
      category: "keluarga",
      chip: "Baru",
      warm: true,
      liked: false,
      album: "Foto Keluarga",
      src: reader.result,
    });
    persist();
    setView("semua");
    renderGallery();
    toast("Foto berhasil disimpan. Silakan tulis keterangannya.");
    openModal(id, true);
  };
  reader.onerror = () => toast("Foto belum bisa dibaca. Coba pilih ulang.");
  reader.readAsDataURL(file);
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
    $(`#${id}`).addEventListener("click", () => $("#foto-input").click());
  });

  $("#foto-input").addEventListener("change", (e) => {
    const file = e.target.files?.[0];
    if (file) addLocalPhoto(file);
    e.target.value = "";
  });

  const drop = $("#upload-inner");
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
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith("image/")) addLocalPhoto(file);
  });

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
    if ($("#confirm-modal").classList.contains("is-open")) closeConfirm();
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
}

document.addEventListener("DOMContentLoaded", init);
