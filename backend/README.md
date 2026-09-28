# Backend Album Kenangan Saya — Lemari Foto Privat Keluarga

Backend Node.js & Supabase untuk **Album Kenangan Saya** — sebuah private photo vault yang dirancang khusus untuk **SATU keluarga**. Sistem ini bukan platform SaaS publik, tidak menggunakan model multi-tenant, dan diprioritaskan untuk **Keamanan Data Mutlak**, **Ketahanan Arsip Seumur Hidup ("Foto Tidak Boleh Hilang")**, serta **Kemudahan Maksimal bagi Pengguna Lanjut Usia**.

---

## 🏛️ Arsitektur & Filosofi Sistem

1. **Satu Keluarga, Tanpa Kompleksitas SaaS**: Tidak ada konsep `tenant_id`, sistem billing, atau workspace. Akun dikhususkan untuk beberapa anggota keluarga inti (misal: Ayah, Ibu, Anak, Cucu).
2. **Koleksi Privat Secara Bawaan (Zero Public Bucket)**: Seluruh berkas disimpan dalam private bucket. Akses foto hanya dimungkinkan melalui *Signed URL* yang memiliki batas kedaluwarsa (TTL).
3. **Ketahanan Berkas Jangka Panjang ("Tidak Akan Hilang")**:
   - **Soft Delete 30 Hari**: Penghapusan foto dari UI hanya memindahkan foto ke status tempat sampah selama 30 hari sebelum dipurging, mencegah penghapusan tidak sengaja oleh lansia.
   - **Cron Cadangan Otomatis**: Skrip background terjadwal membuat salinan snapshot berkas mingguan ke bucket cadangan sekunder.
4. **Optimasi Performa & Aksesibilitas**:
   - Pemrosesan gambar otomatis dengan `sharp`: saat foto diunggah, server membuat thumbnail WebP (720px) yang ringan dan versi layar tajam (1920px).
   - Ekstraksi metadata kamera/EXIF otomatis untuk mendeteksi tahun dan tanggal pengambilan foto.
   - Data balasan API sudah diformat ke dalam Bahasa Indonesia (misal: `"Tahun 1985"`, `"128 Lembar Foto"`).

---

## 📁 Struktur Direktori Backend

```text
backend/
├── .env.example               # Panduan variabel lingkungan
├── .env                       # Konfigurasi aktif (PORT, URL Supabase, Kunci)
├── package.json               # Dependensi & skrip npm
├── scripts/
│   └── seed.js                # Inisialisasi akun keluarga & album bawaan
├── supabase/
│   └── migrations/
│       ├── 001_init.sql       # Skema tabel, indeks trgm, RLS & bucket privat
│       └── 002_seed_albums.sql # Inisialisasi album fisik lemari
└── src/
    ├── app.js                 # Konfigurasi Express, CORS, Helmet, Rate Limit
    ├── server.js              # Entrypoint server & inisialisasi scheduler cron
    ├── config/
    │   ├── categories.js      # Mapping kategori, chip, dan warna ke UI
    │   └── env.js             # Validasi variabel lingkungan dengan Zod
    ├── jobs/
    │   ├── backup.js          # Logika snapshot cadangan mingguan ke bucket sekunder
    │   ├── scheduler.js       # Penjadwal cron (purge 30 hari & cadangan)
    │   ├── run-backup.js      # Eksekusi manual cadangan
    │   └── run-purge.js       # Eksekusi manual pembersihan sampah
    ├── middleware/
    │   ├── auth.js            # Autentikasi keluarga (Supabase Auth / PIN / Dev fallback)
    │   └── error.js           # Penanganan rute 404 & error terpusat
    ├── routes/
    │   ├── index.js           # Agregator rute API
    │   ├── photos.js          # Rute unggah, list, edit, favorit, & soft delete
    │   ├── albums.js          # Rute pembuatan & pengelolaan album map
    │   ├── stats.js           # Rute statistik lemari ("128 Lembar Foto")
    │   ├── share.js           # Rute tautan sementara WhatsApp & halaman web /s/:token
    │   ├── export.js          # Rute export ZIP penuh ("Buku Panduan Besar")
    │   └── auth.js            # Rute data anggota keluarga & verifikasi PIN
    ├── services/
    │   ├── supabase.js        # Klien Supabase (Admin Service Role & User)
    │   ├── storage.js         # Operasi bucket privat & pembuatan Signed URL
    │   ├── images.js          # Sharp (resize, webp) & Exifr (ekstraksi tanggal)
    │   ├── photos.js          # Logika bisnis inti foto & pencarian teks
    │   ├── albums.js          # Logika bisnis album map
    │   └── export.js          # Generator arsip ZIP & teks cerita keluarga
    └── utils/
        ├── format.js          # Pemformat tanggal & label Bahasa Indonesia
        └── httpError.js       # Definisi kelas HttpError
```

---

## 🗄️ Skema Database (PostgreSQL / Supabase)

Tabel-tabel utama yang dibuat melalui migrasi `supabase/migrations/001_init.sql`:

1. **`family_members`**: Menyimpan identitas anggota keluarga (Ayah, Ibu, Anak), tautan ke `auth.users`, role (`admin`/`anggota`), nomor WhatsApp, dan foto avatar.
2. **`photos`**: Berkas foto inti dengan kolom `original_path`, `thumbnail_path`, `display_path`, `caption`, `category`, `taken_year`, `taken_date`, `year_from_exif`, `deleted_at`.
3. **`albums`**: Map kenangan (misal: "Foto Keluarga", "Hari Raya", "Masa Muda & Pernikahan", "Cucu & Liburan").
4. **`album_photos`**: Relasi many-to-many antara foto dan album dengan urutan lembaran.
5. **`photo_hearts`**: Penanda status favorit ("Tersimpan di Hati") per anggota keluarga.
6. **`photo_people`**: Penanda anggota keluarga yang ada dalam suatu foto.
7. **`share_links`**: Tautan publik sementara bertoken acak dengan masa berlaku 24–48 jam untuk dikirim ke WhatsApp.
8. **`backup_runs`**: Log riwayat pencadangan otomatis storage.

---

## 🚀 Panduan Memulai Cepat

### 1. Prasyarat
- Node.js versi 20 atau lebih baru
- Akun Supabase (gratis)

### 2. Pemasangan Dependensi
Masuk ke direktori `backend` dan jalankan:
```bash
cd backend
npm install
```

### 3. Konfigurasi Lingkungan (`.env`)
Salin berkas `.env.example` ke `.env`:
```bash
cp .env.example .env
```
Isi konfigurasi Supabase Anda:
- `SUPABASE_URL`: URL proyek Supabase Anda (`https://xyz.supabase.co`)
- `SUPABASE_ANON_KEY`: Kunci anonim Supabase
- `SUPABASE_SERVICE_ROLE_KEY`: Kunci service role Supabase (hanya disimpan di server)

### 4. Eksekusi Migrasi Database
Buka **SQL Editor** pada Dashboard Supabase Anda, lalu salin dan jalankan isi dari:
1. `supabase/migrations/001_init.sql`
2. `supabase/migrations/002_seed_albums.sql`

Atau jalankan skrip benih awal:
```bash
npm run seed
```

### 5. Menjalankan Server
Mode pengembangan (otomatis reload saat berkas diubah):
```bash
npm run dev
```

Mode produksi:
```bash
npm start
```
Server akan aktif di `http://localhost:8787`.

---

## 🔌 Dokumentasi Endpoint API

Semua respons menggunakan struktur JSON terstandarisasi dengan data yang langsung siap dipakai oleh antarmuka pengguna tanpa perlu transformasi rumit di sisi frontend.

### 1. Foto (`/api/photos`)

#### • Unggah Foto Langsung (Multipart)
`POST /api/photos/upload`
- **Headers**: `Content-Type: multipart/form-data`
- **Body Form-Data**:
  - `photo`: Berkas gambar (JPG, PNG, atau WEBP, maks 20 MB)
  - `title` *(opsional)*: Judul foto (misal: "Liburan ke Candi Borobudur")
  - `caption` *(opsional)*: Cerita di balik foto
  - `category` *(opsional)*: `keluarga` | `liburan` | `hari-raya` | `pernikahan`
  - `taken_year` *(opsional)*: Tahun foto diambil (jika kosong, dideteksi otomatis via EXIF)
  - `place` *(opsional)*: Lokasi kenangan
  - `album` *(opsional)*: Nama album tujuan
- **Respons (201 Created)**:
```json
{
  "photo": {
    "id": "e6f7710b-81d3-48e0-a7d0-c3d3ff69bb12",
    "title": "Liburan ke Candi Borobudur",
    "caption": "Momen saat mengantar cucu pertama kali melihat stupa candi.",
    "place": "Magelang, Jawa Tengah",
    "year": 2015,
    "year_label": "Tahun 2015",
    "chip": "Liburan",
    "warm": true,
    "liked": false,
    "album": "Cucu & Liburan",
    "src": "https://...supabase.co/storage/v1/object/sign/kenangan/thumbs/...",
    "thumbnail_url": "https://...supabase.co/storage/v1/object/sign/kenangan/thumbs/...",
    "display_url": "https://...supabase.co/storage/v1/object/sign/kenangan/display/..."
  },
  "message": "Foto berhasil disimpan dengan aman ke dalam lemari."
}
```

#### • Unggah Dua Tahap (Signed URL Direct-to-Storage)
1. `POST /api/photos/upload` dengan JSON `{ "filename": "sungkem.jpg", "mime_type": "image/jpeg" }` → Mengembalikan `upload_url` dan `photo_id`.
2. Klien mengunggah binary langsung ke `upload_url`.
3. `POST /api/photos/:id/complete` → Server mengekstrak EXIF, menghasilkan thumbnail WebP, dan mengaktifkan foto.

#### • Daftar Foto & Filter
`GET /api/photos?category=&year=&favorite=&search=`
- **Query Params**:
  - `category`: `semua`, `keluarga`, `liburan`, `hari-raya`, `pernikahan`
  - `year`: Angka tahun (contoh: `1985`)
  - `favorite`: `true` (menampilkan hanya yang "Tersimpan di Hati")
  - `search`: Pencarian teks pada judul, caption, tempat, atau chip
- **Respons (200 OK)**:
```json
{
  "items": [ ... ],
  "total": 6,
  "total_label": "6 Lembar Foto",
  "filters": [
    { "id": "semua", "label": "Semua" },
    { "id": "keluarga", "label": "Foto Keluarga" },
    { "id": "pernikahan", "label": "Masa Muda & Pernikahan" },
    { "id": "hari-raya", "label": "Hari Raya" },
    { "id": "liburan", "label": "Cucu & Liburan" }
  ]
}
```

#### • Perbarui Keterangan Foto
`PATCH /api/photos/:id`
- **Body**:
```json
{
  "title": "Pernikahan Eyang di Solo",
  "caption": "Momen sakral janji suci di rumah kakek di Laweyan.",
  "place": "Solo, Jawa Tengah",
  "taken_year": 1958,
  "category": "pernikahan",
  "is_favorite": true
}
```

#### • Hapus Sementara (Soft Delete)
`DELETE /api/photos/:id`
- Foto tidak langsung musnah; dipindahkan ke tempat sampah selama 30 hari.
- Respons:
```json
{
  "ok": true,
  "message": "Foto dipindah ke tempat sampah selama 30 hari, belum dihapus permanen."
}
```

---

### 2. Album Map (`/api/albums`)

- `GET /api/albums`: Mengambil seluruh album beserta cover foto dan 3 foto tumpukan (stack) untuk tampilan fisik map kartu.
- `POST /api/albums`: Menambah map album baru `{ "nama": "Kenangan Haji 1995", "deskripsi": "..." }`.
- `PATCH /api/albums/:id`: Mengubah nama album atau susunan foto.

---

### 3. Statistik Lemari (`/api/stats`)

`GET /api/stats`
- **Respons (200 OK)**:
```json
{
  "total_photos": 128,
  "total_label": "128 Lembar Foto",
  "subtitle": "Tersimpan rapi & abadi",
  "favorites": 24,
  "favorites_label": "24 Tersimpan di Hati",
  "by_year": [
    { "year": 2024, "count": 18, "label": "Tahun 2024" },
    { "year": 2018, "count": 32, "label": "Tahun 2018" }
  ],
  "by_category": [
    { "id": "keluarga", "count": 64, "label": "Foto Keluarga" },
    { "id": "liburan", "count": 35, "label": "Cucu & Liburan" }
  ]
}
```

---

### 4. Berbagi via WhatsApp (`/api/share/whatsapp`)

`POST /api/share/whatsapp`
- **Body**: `{ "photo_id": "...", "hours": 48 }`
- **Fitur Khusus**:
  1. Menghasilkan tautan bertenggang waktu: `http://domain/s/:token`.
  2. Memberikan tautan instan `whatsapp_url` (`https://wa.me/?text=...`) untuk langsung dikirim ke anak atau cucu.
  3. Halaman web `/s/:token` dirancang dengan layout ramah lansia, kartu foto beresolusi jelas, dan disertai proteksi `X-Robots-Tag: noindex, nofollow` agar tidak terlacak mesin pencari publik.

---

### 5. Ekspor Penuh "Buku Panduan Besar" (`/api/export`)

`POST /api/export` atau `GET /api/export`
- Mengalirkan (*stream*) berkas `.zip` kompresi tinggi yang berisi:
  - Direktori `foto/`: Seluruh berkas asli berkualitas penuh yang dinamai terurut (`001-1958-judul.jpg`).
  - `keterangan.txt`: Dokumen teks rapi berisi daftar tahun, tanggal, lokasi, dan cerita setiap foto yang dapat dicetak langsung.
  - `metadata.json`: Data terstruktur untuk jaminan ketahanan arsip di masa mendatang.

---

## 🛡️ Otomasi & Ketahanan Berkas (Cron Jobs)

Server dilengkapi penjadwal otomatis di background:
1. **Pembersihan Tempat Sampah Kedaluwarsa** (Setiap hari pukul 03.15):
   Menghapus secara permanen foto yang telah berada di tempat sampah melebihi 30 hari.
2. **Pencadangan Mingguan** (Setiap Minggu pukul 03.30):
   Menyalin seluruh foto aktif ke bucket cadangan sekunder (`kenangan-cadangan`).

Untuk menjalankan tugas secara manual kapan saja:
```bash
npm run backup        # Menjalankan cadangan mingguan instan
npm run purge-trash   # Membersihkan sampah > 30 hari
```
