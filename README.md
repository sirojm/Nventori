# Nventori — Sistem Manajemen Inventaris Alat Kantor (v1.5)

Aplikasi web modern untuk mengetahui keberadaan, kondisi, ketersediaan, dan penanggung jawab inventaris alat kantor (multimedia, komputer/IT, furnitur, drone/kamera, dan perlengkapan kegiatan).

Dirancang dan dibangun 100% mengikuti spesifikasi **[Nventori_Blueprint_v1_5.md](./Nventori_Blueprint_v1_5.md)**.

---

## Fitur Utama Sesuai Blueprint v1.5

1. **Tepat Tiga Level Pengguna**:
   - **Super Admin**: Hak akses penuh, audit log, dan pengelolaan akun petugas.
   - **Admin Inventaris**: Kelola kategori, lokasi, katalog jenis barang, registrasi aset fisik, penyesuaian stok kuantitas, dan paket kelengkapan.
   - **Operator**: Kelola buku kontak peminjam, catat peminjaman (internal/antarunit), serah terima, pemeriksaan checklist kembali, dan cetak bukti.

2. **Peminjam Tanpa Akun / Login**:
   - Peminjam (PIC) tidak perlu mendaftar atau login. Seluruh transaksi dicatat oleh petugas operator.
   - Kontak peminjam (Nama, Unit/Instansi, No HP/WA, Email aktif) disimpan ke buku kontak dan dapat langsung dipilih ulang tanpa mengetik ulang.
   - Transaksi menyimpan *snapshot* identitas peminjam pada saat pencatatan.

3. **Tanpa Alur Approval dalam Aplikasi**:
   - Pemakaian internal dan pinjaman antarunit diproses langsung oleh operator.
   - Untuk pinjaman antarunit, surat permohonan telah disetujui di luar aplikasi; petugas mencatat nomor surat, tanggal surat, unit pengirim, dan catatan arsip sebagai dokumen pendukung.

4. **Tiga Mode Pelacakan Inventaris**:
   - **Unit Unik**: Memiliki kode aset unik dan QR code (laptop, kamera, drone, proyektor).
   - **Kuantitas Dapat Kembali**: Pelacakan jumlah/pool dan kondisi (kursi lipat, kabel HDMI).
   - **Habis Pakai**: Pengeluaran konsumsi tanpa kewajiban pengembalian (baterai AA).

5. **Paket Kelengkapan (Kits)**:
   - Contoh nyata: **Paket Drone 01** (1 Unit Drone DJI Mavic 3, 1 Remote Control, 3 Baterai 5000mAh, 1 Hardcase).
   - Snapshot manifest komponen dicatat saat serah terima.
   - Saat pengembalian, setiap komponen diperiksa jumlah dan kondisinya secara individual.

6. **Pengembalian Melalui Satu QR & Parsial**:
   - Pemindaian satu QR transaksi membuka seluruh daftar kewajiban barang.
   - **Checklist awal kosong (unchecked)**: Operator memeriksa fisik dan mencentang barang yang benar-benar diterima.
   - Mendukung pengembalian bertahap/parsial (contoh: 3 baterai keluar, 2 kembali; sisa 1 unit tetap menjadi tanggungan dan masuk daftar pengingat).

7. **Pindai QR & Pencarian Cepat**:
   - Pemindai kamera terintegrasi (`html5-qrcode`) dengan fallback pencarian manual kode.
   - Resolusi otomatis untuk QR Aset Fisik, QR Transaksi, dan QR Paket.

8. **Cetak Label & Bukti Resmi**:
   - Profil cetak label termal: **50 × 30 mm** dan **60 × 40 mm** dengan QR Code kontras tinggi.
   - Cetak dokumen resmi format A4: **Bukti Serah Terima Inventaris** dan **Bukti Pengembalian Inventaris**.

9. **Agenda Kegiatan & Rekomendasi Pintar**:
   - Template kebutuhan acara (contoh: Wisuda, Seminar Nasional).
   - Analisis ketersediaan stok riil di gudang dengan faktor skala peserta, mendeteksi kekurangan stok dan menyarankan alternatif barang.

10. **Tampilan Responsif & Navbar HP Figma**:
    - Mode mobile dilengkapi bilah bawah (bottom bar) *glassmorphism* dengan lekukan melengkung (*curved cutout*) yang dinamis mengikuti menu aktif, serta lingkaran melayang (*floating bubble*) sesuai referensi Figma Blueprint Bagian 10.
    - Kontras teks memenuhi standar WCAG AA (> 4.5:1), tombol aksi memenuhi ukuran target sentuh minimal 44 × 44 px.

---

## Akun Demo Pengujian

Aplikasi telah dilengkapi seeder basis data awal dengan tiga level akun:

| Peran | Username | Kata Sandi | Kewenangan |
|---|---|---|---|
| **Super Admin** | `superadmin` | `password123` | Akses penuh, audit sistem, kelola petugas |
| **Admin Inventaris** | `admin_inv` | `password123` | Kelola master barang, lokasi, paket & stok |
| **Operator** | `operator1` | `password123` | Transaksi harian, serah terima & pengembalian |

*Tersedia juga tombol login instan 1-klik pada layar masuk untuk mempermudah evaluasi pengujian lokal.*

---

## Cara Menjalankan di Localhost

### Prasyarat
- **Node.js** v20+ (Direkomendasikan Node.js v24 yang sudah terpasang di sistem ini).
- Tidak memerlukan instalasi terpisah untuk database karena menggunakan SQLite bawaan (*built-in* `node:sqlite`).

### Langkah Menjalankan:

1. Buka folder proyek di Terminal / VSCode:
   ```bash
   cd D:\Software\Nventori
   ```

2. Instal dependensi (bila belum diinstal):
   ```bash
   npm install
   ```

3. Jalankan pengisian data awal (seeder demo):
   ```bash
   npm run seed
   ```

4. Jalankan aplikasi dalam mode pengembangan (Dev):
   ```bash
   npm run dev
   ```
   Perintah ini akan menjalankan dua server secara bersamaan:
   - **Frontend Vite**: `http://localhost:5173`
   - **Backend API Express**: `http://localhost:3001`

5. Buka peramban (browser) di alamat:
   **[http://localhost:5173](http://localhost:5173)**

---

### Alternatif: Menjalankan Mode Production Server Standalone

Jika ingin menjalankan aplikasi langsung dari satu port backend (port 3001):
```bash
npm run build
npm start
```
Buka browser di **[http://localhost:3001](http://localhost:3001)**.

---

## Menjalankan dengan Docker (Opsional)

Untuk pengujian container atau pemasangan pada server produksi:
```bash
docker-compose up --build -d
```
Aplikasi akan aktif di `http://localhost:3001`.

---

## Struktur Repositori

```
D:\Software\Nventori\
├── package.json
├── vite.config.ts
├── tailwind.config.js
├── nventori.db               # Database SQLite lokal (dibuat otomatis)
├── server/
│   ├── index.js              # Server Express API
│   ├── db/
│   │   ├── database.js       # Driver native node:sqlite
│   │   ├── schema.sql        # Skema relasional ACID
│   │   └── seeder.js         # Data contoh lengkap
│   ├── middleware/
│   │   └── auth.js           # JWT & RBAC 3 level
│   └── routes/
│       ├── auth.js           # Autentikasi & kelola user
│       ├── inventory.js      # Barang, aset, pool stok & paket
│       ├── contacts.js       # Buku kontak peminjam
│       ├── transactions.js   # Reservasi, serah terima, pengembalian
│       ├── activities.js     # Agenda & rekomendasi kebutuhan
│       ├── qr.js             # Resolusi QR scanner & generator
│       └── reports.js        # Dasbor, KPI, & audit log
└── src/
    ├── App.tsx               # Shell utama aplikasi & routing
    ├── components/
    │   ├── layout/
    │   │   ├── Sidebar.tsx   # Navigasi desktop
    │   │   ├── Topbar.tsx    # Header & notifikasi
    │   │   └── MobileNavbar.tsx # Navbar HP glassmorphic curved cutout
    │   ├── scanner/
    │   │   └── QRScannerModal.tsx # Pemindai kamera & manual
    │   └── print/
    │       ├── LabelPrintModal.tsx # Cetak label termal QR
    │       └── ReceiptPrintModal.tsx # Cetak bukti serah terima/kembali
    └── pages/
        ├── LoginPage.tsx
        ├── DashboardPage.tsx
        ├── InventoryPage.tsx
        ├── TransactionsPage.tsx
        ├── NewTransactionPage.tsx
        ├── ReturnModal.tsx   # Checklist pengembalian satu QR
        ├── ContactsPage.tsx
        ├── ActivitiesPage.tsx
        ├── ReportsPage.tsx
        ├── AuditLogsPage.tsx
        └── UsersPage.tsx
```

---

## Panduan Verifikasi Alur Operasional di Localhost

1. **Uji Login 3 Role**:
   - Coba masuk sebagai `operator1`, `admin_inv`, atau `superadmin`. Menu "Kelola Petugas" hanya muncul untuk Super Admin.
2. **Uji Pengembalian Checklist Satu QR (TRX-202611-001)**:
   - Buka menu **Transaksi Alat**, pilih transaksi yang sedang berstatus "Diserahkan" (Dr. Hendra Wijaya).
   - Klik tombol **Checklist Kembali**.
   - Perhatikan daftar checklist awal kosong (unchecked).
   - Centang barang yang diterima (misal 1 Laptop dan 1 dari 2 Kabel HDMI).
   - Konfirmasi pengembalian -> status otomatis berubah menjadi **Kembali Sebagian** dan sisa 1 kabel tetap menjadi tanggungan!
3. **Uji Pinjaman Antarunit Baru dengan Referensi Surat**:
   - Klik **Catat Transaksi Baru**.
   - Pilih kontak peminjam tersimpan (misal Maya Anggraini), data terisi otomatis.
   - Pilih jenis transaksi: **Pinjaman Antarunit**, isi nomor surat permohonan (misal `099/BAK/XI/2026`).
   - Pilih paket **Paket Drone 01** atau barang individual.
   - Simpan transaksi -> status langsung terkonfirmasi **Dipesan** tanpa menunggu antrean persetujuan!
4. **Uji Rekomendasi Pintar Kegiatan**:
   - Buka menu **Kegiatan & Saran**, pilih template **Wisuda & Sidang Senat Terbuka**.
   - Ubah skala peserta dan klik **Hitung Kebutuhan & Cek Stok**.
   - Sistem akan menganalisis stok riil di gudang dan memberi tahu jika ada kekurangan atau saran barang alternatif.
5. **Uji Cetak Dokumen & Label QR**:
   - Di menu Inventaris, klik tombol **Cetak** pada salah satu unit untuk melihat pratinjau label termal 50×30 mm atau 60×40 mm.
   - Di menu Transaksi, klik ikon **Cetak** untuk melihat Bukti Serah Terima A4 lengkap dengan QR verifikasi dan kolom tanda tangan.
