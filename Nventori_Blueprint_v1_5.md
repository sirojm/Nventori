# Nventori — Blueprint Produk dan Pembangunan v1.5

Tanggal: 5 November 2026 • Zona waktu bisnis: Asia/Jakarta  
Status: rancangan diperbarui untuk implementasi; belum merupakan aplikasi yang telah dibangun atau diuji.

Revisi v1.5: bentuk navbar mobile dikonfirmasi melalui screenshot pengguna; efek kaca dipertahankan. Detail ditetapkan pada bagian 10.

Riwayat v1.4: referensi desain diperbarui ke Figma; referensi pertama untuk navbar mode mobile apps di HP dan referensi kedua untuk UI keseluruhan. Referensi Behance sebelumnya digantikan. Nama aplikasi tetap Nventori (ditetapkan pada v1.3).

Ketentuan v1.2: tepat tiga level pengguna; pemakaian internal dan pinjaman antarunit tanpa persetujuan dalam aplikasi. Surat permohonan antarunit telah disampaikan kepada kepala unit di luar aplikasi. Ketentuan v1.1 tentang kontak peminjam tanpa akun dan paket kelengkapan tetap berlaku.

## 1. Tujuan dan keputusan awal

Nventori adalah aplikasi web untuk mengetahui keberadaan, kondisi, ketersediaan, dan penanggung jawab alat kantor. Produk melayani inventaris umum: multimedia, komputer, furnitur, perlengkapan kegiatan, alat laboratorium, dan kategori lain yang dapat ditambah administrator.

Keputusan yang telah dipilih pengguna:

- Pengembangan dan uji coba di localhost menggunakan VSCode, kemudian pemasangan pada server.
- Level pengguna hanya tiga: Super Admin, Admin Inventaris dan Operator.
- Pemakaian internal dan pinjaman antarunit tidak memerlukan persetujuan dalam aplikasi.
- Surat permohonan antarunit sudah disampaikan kepada kepala unit melalui proses di luar aplikasi; petugas mencatat referensi surat sebagai dokumen pendukung.
- Pengingat versi pertama melalui notifikasi aplikasi untuk petugas dan email aktif peminjam.
- Peminjam tidak memiliki akun/login; semua transaksi dicatat petugas.
- Kontak peminjam disimpan dan dipilih kembali pada transaksi berikutnya.
- Paket barang mempunyai daftar komponen beserta jumlah, identitas dan kondisi.
- Antarmuka responsif; navigasi bawah pada HP; glassmorphism yang tetap mudah dibaca.

Asumsi rancangan: satu organisasi, banyak unit kerja, lokasi penyimpanan dapat lebih dari satu. Ini belum produk SaaS multi-organisasi. Nama aplikasi ditetapkan menjadi Nventori sesuai pilihan pengguna; tidak perlu menyediakan fitur penggantian nama aplikasi bagi pengguna umum.

Ukuran tim, jumlah pengguna bersamaan, volume barang, server akhir, SMTP, serta jenis printer belum ditetapkan. Hal tersebut tidak menghalangi perancangan, tetapi menentukan pengujian kapasitas dan konfigurasi operasional.

## 2. Ruang lingkup dan hasil yang diharapkan

| Modul | Perilaku versi pertama | Bukti penerimaan |
|---|---|---|
| Login dan akses | Login, logout, reset password, pengelolaan pengguna, peran dan cakupan unit | Request tanpa izin ditolak oleh server |
| Master inventaris | Kategori dinamis, lokasi, unit, jenis barang, unit fisik, stok kuantitas, foto, kondisi | Kode aset unik; riwayat tidak hilang saat data dinonaktifkan |
| Pembaruan inventaris | Barang masuk, koreksi stok, mutasi lokasi, perubahan kondisi, penonaktifan | Semua perubahan memiliki alasan dan jejak operator |
| Pemakaian internal | Jenis transaksi dipilih lebih dahulu; jadwal dan barang, PIC opsional, serah terima dan kembali | Ketersediaan berkurang sesuai barang yang keluar |
| Kontak peminjam | Nama, unit/instansi, HP/WA, email aktif; pencarian dan pemakaian ulang untuk pinjaman antarunit | Peminjam ulang dipilih tanpa akun atau mengetik ulang |
| Paket kelengkapan | Paket fisik, daftar komponen, jumlah dan kondisi | Kelengkapan diperiksa saat keluar dan kembali |
| Pinjaman antarunit | Petugas mencatat permintaan dan referensi surat, reservasi serta penyerahan tanpa persetujuan aplikasi | Aset yang sama tidak dialokasikan pada jadwal bertabrakan |
| Pengembalian | Scan QR transaksi, checklist, jumlah, kondisi, pengembalian sebagian | Hanya barang yang dikonfirmasi diterima tercatat kembali |
| QR dan label | QR aset; QR bukti transaksi; cetak label dan dokumen | Hasil cetak terbaca kamera dan isi sesuai transaksi |
| Kegiatan | Agenda, kalender, PIC, lokasi, rentang waktu dan daftar kebutuhan | Kegiatan terhubung dengan transaksi alat |
| Rekomendasi | Template kebutuhan, jumlah, ketersediaan dan alternatif | Pengguna melihat alasan dan dapat mengubah pilihan |
| Pengingat | Dalam aplikasi dan email ke PIC, log kegagalan dan retry | Pengingat berhenti setelah kewajiban selesai |
| Dasbor dan laporan | Persediaan, alat keluar, keterlambatan, kegiatan, perawatan, riwayat | Angka dapat ditelusuri ke transaksi sumber |

Fase lanjutan: WhatsApp, integrasi SSO, rekomendasi berbasis histori/AI, mobile native, akuntansi penyusutan, dan transaksi offline. Transaksi stok versi pertama harus dikonfirmasi server; tidak memakai penyimpanan browser sebagai sumber data utama.

## 3. Tim dan pembagian tanggung jawab

Enam peran yang diminta telah dilibatkan untuk menyusun rancangan ini. Peran desain tidak berarti sudah tersedia tim manusia untuk menjalankan jadwal pengembangan.

| Peran | Tanggung jawab | Hasil kerja |
|---|---|---|
| Senior PM | Ruang lingkup, prioritas, milestone, risiko, penerimaan | Blueprint, backlog, keputusan dan gerbang rilis |
| Senior Architect | Batas modul, model data, konsistensi transaksi | Arsitektur dan aturan integritas |
| Senior Backend | Autentikasi, otorisasi, stok, API, job notifikasi | Aturan domain dan kontrak layanan |
| Senior Frontend | Alur operator, desain responsif, aksesibilitas | Struktur layar dan spesifikasi interaksi |
| Senior Fullstack | Integrasi, localhost, deployment, dokumentasi | Rencana implementasi dan operasi |
| Senior QA | Kriteria penerimaan, skenario kritis, uji perangkat | Matriks uji dan gerbang rilis |

Pemilik produk/pengelola inventaris menetapkan tata kelola inventaris dan menerima hasil pilot. Proses surat kepada kepala unit berlangsung di luar aplikasi; kepala unit tidak memerlukan akun khusus atau tindakan persetujuan di Nventori. Operator gudang memvalidasi langkah serah terima, pengembalian, dan label nyata. Admin TI bertanggung jawab atas domain, server, email, backup dan pemulihan.

## 4. Peran pengguna dan hak akses

| Level | Hak utama | Batas |
|---|---|---|
| Super Admin | Seluruh hak Admin Inventaris; kelola akun dan tiga level pengguna, konfigurasi, seluruh unit dan audit | Semua tindakan tetap diaudit |
| Admin Inventaris | Seluruh hak Operator; kelola kategori, lokasi, barang, paket, label, penyesuaian inventaris dan laporan | Tidak mengubah level pengguna atau konfigurasi sistem |
| Operator | Kelola kontak peminjam; catat pemakaian/pinjaman dan surat; reservasi, serah terima, kembali, pemeriksaan serta cetak bukti | Tidak mengelola akun/level atau penyesuaian stok manual; terbatas cakupan unit/lokasi |

Setiap akun memiliki satu dari tiga level tersebut. Hak bersifat bertingkat: Super Admin mencakup Admin Inventaris, dan Admin Inventaris mencakup Operator. Tidak ada level Penyetuju/Kepala, Pimpinan/Auditor atau Peminjam. Fitur laporan dan audit diakses melalui tiga level ini sesuai kewenangannya, bukan melalui role tambahan.

Peminjam/PIC adalah kontak tanpa akun/login. Semua transaksi dicatat petugas; pemakaian internal tidak mewajibkan identitas PIC, sedangkan pinjaman antarunit tetap memerlukannya. Otorisasi tetap diperiksa server pada setiap aksi dan objek, termasuk jika pengguna mengganti ID pada URL. Perubahan level atau penonaktifan akun berlaku pada operasi berikutnya.

Bootstrap admin dilakukan melalui proses instalasi; tidak menyediakan password universal permanen. Password disimpan menggunakan hash, login dibatasi percobaannya, sesi menggunakan cookie aman, dan reset password memakai token terbatas waktu. Tindakan keluar/kembali memerlukan sesi dan perlindungan CSRF.

### Kontak peminjam

Petugas mencari kontak berdasarkan nama, unit/instansi, HP/WA atau email. Pilihan kontak mengisi data otomatis. Petugas cukup mengonfirmasi data masih benar; jika belum ada, tambahkan kontak langsung dari form transaksi dan simpan untuk transaksi berikutnya.

Data kontak: nama lengkap, unit/instansi, nomor HP/WA, email aktif wajib dan catatan opsional. Validasi format email tidak membuktikan inbox aktif; petugas mengonfirmasi alamat kepada peminjam dan sistem mencatat kegagalan pengiriman. Peminjam tidak harus login untuk menerima email.

Tampilkan kandidat kontak ganda berdasarkan email/nomor yang dinormalisasi sebelum menyimpan. Nama sama tidak otomatis berarti orang yang sama. Email bersama tidak dipaksakan unik global. Penyatuan kontak harus diperiksa petugas dan mempertahankan seluruh riwayat.

Transaksi menyimpan referensi kontak serta snapshot nama, unit, nomor dan email pada saat pencatatan. Pembaruan buku kontak tidak mengubah bukti lama. Koreksi email penerima transaksi aktif dikonfirmasi petugas dan diaudit. Pengiriman berikutnya memakai alamat transaksi yang telah dikoreksi. Detail kontak menampilkan riwayat pinjaman dan tanggungan. Kontak yang telah dipakai dinonaktifkan tanpa menghapus transaksi.

## 5. Model inventaris

### Tiga mode pelacakan

| Mode | Contoh | Cara pencatatan |
|---|---|---|
| Unit unik | Laptop, kamera, proyektor | Satu nomor inventaris dan QR untuk setiap unit fisik |
| Kuantitas dapat kembali | Kursi identik, kabel tertentu | Jumlah per jenis, lokasi dan kondisi; keluar dan kembali memakai jumlah |
| Habis pakai | Baterai sekali pakai, kertas | Pengeluaran konsumsi; tidak menjadi kewajiban kembali |

Nomor seri pabrik berbeda dari kode aset internal. Paket fisik mengelompokkan barang beserta kelengkapannya. Komponen wajib kembali menjadi baris manifest, bukan catatan bebas.

### Paket barang dan kelengkapan

Contoh paket **Drone 01**:

| Komponen | Jumlah standar | Pelacakan usulan |
|---|---|---|
| Drone | 1 | Unit unik/kode aset |
| Remote control | 1 | Unit unik atau komponen berkode |
| Baterai | 3 | Unit berkode per baterai untuk riwayat individual, atau jumlah jika belum diberi identitas |
| Hardcase/tas | 1 | Komponen berkode atau jumlah |

Petugas membuat template kelengkapan per jenis barang, lalu mengaitkan komponen nyata ke paket fisik. Template rekomendasi kegiatan hanya menyarankan kebutuhan; paket fisik mempunyai isi nyata yang dipinjam.

Memilih atau memindai QR paket mengisi komponen ke daftar pemeriksaan keluar. Petugas memeriksa jumlah, identitas dan kondisi yang benar-benar diserahkan. Snapshot manifest menjadi acuan kembali; perubahan standar paket di kemudian hari tidak mengubah transaksi lama.

Aturan paket:

- Paket merupakan pengelompokan, bukan stok tambahan. Komponen tidak dihitung atau dikeluarkan dua kali.
- Alokasi paket mencakup seluruh komponen nyata. Komponen yang dipinjam terpisah membuat paket tidak tersedia lengkap; peminjaman paket mencegah alokasi komponen yang sama pada transaksi lain.
- Komponen wajib harus lengkap dan layak sebelum diserahkan. Pengecualian paket sebagian memerlukan petugas berwenang, alasan serta daftar isi aktual yang jelas pada bukti.
- Penggantian komponen memilih barang nyata yang tersedia, divalidasi ulang dan dicatat pada manifest.
- QR paket/QR transaksi membuka checklist isi. QR komponen mengikuti mode pelacakan dan tidak wajib dipindai satu per satu.
- Saat kembali, petugas mengisi jumlah dan kondisi setiap komponen. Baterai keluar 3, kembali 2: sisa 1 tetap menjadi tanggungan dan masuk pengingat.
- Status pinjaman dan kelengkapan paket dipisahkan. Transaksi belum selesai selama kewajiban komponen belum kembali/terselesaikan. Penyelesaian kehilangan yang sah dapat menutup transaksi, tetapi paket tetap tidak siap lengkap sampai komponen diganti atau konfigurasi diubah secara berwenang.
- Paket tidak siap lengkap jika komponen wajib hilang, rusak atau sedang dipakai; tampilkan penyebabnya.

Jenis barang menyimpan nama, kategori, merek/model, satuan, spesifikasi, mode pelacakan dan foto. Unit fisik menyimpan kode inventaris, nomor seri opsional, lokasi, pemilik unit kerja, kondisi dan QR. Kategori dapat ditambah serta dinonaktifkan tanpa memutus riwayat.

Status kondisi dipisahkan dari ketersediaan: barang dapat berkondisi baik dan berada di gudang, tetapi sudah dipesan untuk tanggal tertentu. Ketersediaan selalu terkait rentang waktu. Draft tidak memesan stok; reservasi yang dikonfirmasi petugas mengalokasikannya. Serah keluar mengubah alokasi menjadi penguasaan aktual tanpa mengurangi stok dua kali.

Koreksi stok tidak menimpa riwayat. Buat pergerakan penyesuaian dengan jumlah, alasan, operator dan waktu. Barang dengan riwayat transaksi dinonaktifkan, bukan dihapus permanen.

## 6. Siklus transaksi

Status utama: Draft → Dipesan → Diserahkan → Kembali sebagian → Selesai. Status Dipesan berlaku saat reservasi dikonfirmasi petugas. Barang yang langsung diambil dapat melalui pencatatan dan penyerahan dalam satu proses atomik tanpa harus menunggu reservasi terpisah. Jalur Dibatalkan tersedia sebelum penyerahan. Tidak ada status Diajukan, Menunggu Persetujuan, Disetujui atau Ditolak. Setelah barang keluar, perubahan memakai peristiwa pengembalian/penyelesaian, bukan pembatalan yang menghilangkan pergerakan.

Pemakaian internal dan pinjaman antarunit memakai satu mesin transaksi dengan jenis berbeda. Keduanya langsung diproses petugas tanpa persetujuan dalam aplikasi. Petugas tetap memeriksa ketersediaan, kelengkapan dan kondisi, lalu mengonfirmasi reservasi atau penyerahan. Validasi ini menjaga ketepatan pencatatan dan bukan persetujuan kepala.

### Surat permohonan antarunit

Surat permohonan telah dikirim antarunit dan sampai kepada kepala unit melalui prosedur di luar aplikasi. Nventori mencatat nomor surat, tanggal surat, unit pengirim dan catatan terkait; unggahan salinan surat disediakan sebagai arsip opsional agar dokumen fisik yang sudah diterima tidak memerlukan proses persetujuan digital tambahan. Tidak ada antrean persetujuan, tombol setujui/tolak, akun kepala atau notifikasi permintaan persetujuan. Pemakaian internal tidak memerlukan surat pada alur aplikasi.

Referensi surat terkait dengan transaksi dan dapat ditelusuri kembali dari bukti/riwayat. Pengunggahan atau pencatatan surat tidak mengubah stok; pergerakan hanya terjadi ketika petugas mengonfirmasi reservasi/penyerahan.

### Pencatatan sampai penyerahan

1. Petugas login dan mencari kontak peminjam tersimpan. Bila belum ada, tambahkan kontak termasuk email aktif.
2. Pilih kontak agar data terisi otomatis; konfirmasi data lalu isi jenis transaksi, unit, kegiatan, tempat dan jadwal.
3. Masukkan rentang pengambilan, pelaksanaan, pembongkaran dan batas kembali.
4. Tambahkan alat/paket secara manual, dengan QR, atau rekomendasi. Paket menguraikan daftar komponennya.
5. Tampilkan ketersediaan dan konflik pada rentang yang diminta.
6. Untuk pinjaman antarunit, petugas mencatat referensi surat yang sudah diterima; salinan dapat dilampirkan. Petugas langsung mengonfirmasi reservasi atau penyerahan tanpa persetujuan aplikasi. Peminjam tidak mengoperasikan aplikasi.
7. Operator memilih unit fisik dan memeriksa jumlah/kondisi tiap komponen sebelum menyerahkan barang.
8. Simpan manifest aktual dan cetak bukti dengan QR transaksi; ringkasan/bukti dapat dikirim ke email aktif peminjam.

Perubahan jadwal/barang pada reservasi memerlukan pemeriksaan ketersediaan ulang oleh petugas dan pencatatan audit, tanpa persetujuan aplikasi. Perpanjangan memeriksa benturan dengan reservasi berikutnya. Keterlambatan dihitung dari tenggat dan sisa kewajiban, bukan status yang harus diubah manual.

### Pengembalian melalui satu QR

1. Operator memindai QR transaksi atau mencari nomor transaksi.
2. Server membuka seluruh daftar barang yang masih menjadi kewajiban.
3. Checkbox awal kosong. Operator memeriksa fisik lalu mencentang barang yang diterima.
4. Untuk stok kuantitas, operator memasukkan jumlah yang diterima.
5. Isi kondisi baik/rusak, catatan dan foto jika diperlukan.
6. Ringkasan menampilkan diterima sekarang, sudah kembali, dan masih di luar.
7. Konfirmasi menyimpan satu peristiwa pengembalian beserta operator dan waktu.

Contoh: 2 kamera, 2 tripod, dan 1 mixer keluar. Ketika 2 kamera dan 1 tripod kembali, hanya 3 unit itu tercatat diterima; 1 tripod dan 1 mixer tetap outstanding dan tetap masuk pengingat. Barang kembali rusak masuk pemeriksaan/perawatan. Barang hilang memerlukan penyelesaian berwenang dan tetap tercatat dalam audit. Transaksi selesai ketika semua kewajiban telah kembali atau terselesaikan secara sah.

Checklist menampilkan kode aset agar dua barang sejenis tidak tertukar. Pilih semua dapat tersedia sebagai bantuan, tetapi tetap memerlukan pemeriksaan dan konfirmasi operator; scan QR saja tidak menyatakan barang kembali.

## 7. QR, dokumen dan printer

| Jenis | Isi label/dokumen yang dibaca manusia | Isi QR dan perilaku |
|---|---|---|
| Label aset | Nama, kode inventaris, identitas organisasi, lokasi opsional | URL/pengenal acak untuk resolusi aset |
| Label transaksi/paket | Nomor transaksi, kegiatan/PIC singkat, jumlah alat, tenggat | Token transaksi membuka manifest setelah pemeriksaan akses |
| Bukti serah terima | PIC, unit, jadwal, daftar rinci, kondisi keluar, operator, nomor/versi dokumen | QR menghubungkan bukti dengan catatan server |
| Bukti pengembalian | Barang diterima, kondisi, sisa, operator dan waktu | Tautan transaksi dan peristiwa pengembalian |

QR tidak menanam seluruh manifest atau kontak pribadi secara terbuka. Daftar rinci dan tindakan memerlukan login. Halaman verifikasi eksternal minimum dapat ditambahkan bila memang dibutuhkan dan diaktifkan pengelola; bukan akses publik bawaan. Token dapat dicabut atau diterbitkan ulang. Token bukan pengganti otorisasi dan tidak merupakan tanda tangan elektronik tersertifikasi.

Dokumen mencantumkan nomor versi dan tanggal penerbitan; halaman server menunjukkan status terbaru ketika cetakan lama dipindai. Label kecil berisi ringkasan serta QR; manifest lengkap dicetak A4 atau dibuka secara digital.

Sediakan profil cetak berukuran mm untuk A4 dan label termal. Ukuran awal kandidat 50×30 mm dan 60×40 mm harus dikalibrasi terhadap printer sebenarnya. QR hitam pada putih, area tenang memadai, tidak memakai efek kaca. Dukungan printer baru dinyatakan lulus setelah uji cetak fisik, skala 100%, margin, resolusi dan pemindaian ulang. Integrasi bahasa printer khusus seperti ZPL/TSPL dilakukan jika model printer memerlukannya.

## 8. Kegiatan dan rekomendasi smart

Versi pertama memakai template kebutuhan yang dapat diedit, sehingga hasil dapat dijelaskan dan tidak membutuhkan layanan AI berbayar.

Input: jenis kegiatan, jumlah peserta, lokasi, kebutuhan siaran/presentasi/suara, waktu persiapan sampai pengembalian. Template menentukan jenis alat, jumlah dasar, komponen wajib, faktor skala dan alternatif.

Contoh template Wisuda dengan kebutuhan siaran: kamera, tripod, mixer audio, capture card, mikrofon, monitor dan kabel pendukung. Jumlahnya ditentukan operator sesuai lokasi dan skala; tidak semua wisuda otomatis memerlukan paket identik.

Setiap rekomendasi menampilkan jumlah dibutuhkan, jumlah tersedia pada jadwal, alasan, kekurangan dan alternatif. Barang rusak, terpesan atau tidak diizinkan tidak ditampilkan seolah siap digunakan. Menambahkan rekomendasi hanya mengisi rancangan kebutuhan; stok baru dipesan setelah validasi dan konfirmasi. Operator dapat menambah, mengganti atau menghapus item.

Histori kegiatan dapat digunakan pada fase berikutnya untuk meningkatkan template. AI generatif opsional membantu menyusun daftar, tetapi keputusan jumlah, kesesuaian teknis dan alokasi tetap divalidasi aturan serta operator.

## 9. Pengingat

Kanal awal: kotak notifikasi aplikasi bagi petugas dan email aktif peminjam yang tercatat pada transaksi. Peminjam menerima email tanpa akun/login. Usulan jadwal yang dapat diatur: H−1, saat jatuh tempo, H+1, kemudian setiap hari pada jam kerja. Semua waktu ditampilkan dalam Asia/Jakarta.

Scheduler mengevaluasi transaksi aktif, worker mengirim pesan melalui antrean. Catatan pengiriman mempunyai kunci unik berdasarkan transaksi, revisi tenggat, tahap, kanal dan penerima. Sebelum mengirim, sistem mengecek kembali sisa barang dan tenggat untuk menghindari pengingat usang.

Pengembalian parsial hanya mengingatkan barang yang belum kembali. Pengembalian penuh menghentikan pengingat berikutnya. Perpanjangan merevisi jadwal. Email gagal dicatat, diulang terbatas dengan jeda, dan ditampilkan kepada admin. Status diterima penyedia email berbeda dari telah masuk inbox penerima. Deduplikasi aplikasi mengurangi kiriman ganda; retry pada kegagalan ambigu provider tetap perlu log dan pengawasan.

Email mencantumkan nomor transaksi, kegiatan, tenggat, sisa alat/komponen dan kontak petugas. Informasi utama terbaca langsung tanpa login. Tautan internal jika ada hanya bagi petugas berotorisasi, bukan syarat membaca pengingat. Tidak perlu melampirkan data pribadi berlebih.

## 10. UI/UX dan struktur layar

Referensi desain terbaru yang ditetapkan pengguna menggantikan referensi Behance sebelumnya:

| Peruntukan | Referensi |
|---|---|
| Navbar HP dalam mode mobile apps | https://www.figma.com/community/file/1285886007707459867 |

### Navbar mobile yang ditetapkan

- Bilah horizontal dengan sudut membulat, lima menu berjarak merata dan ikon bergaris tipis. Ikon dan teks disesuaikan dengan fungsi Nventori, bukan menyalin nama menu contoh.
- Menu aktif berbentuk lingkaran yang terangkat melewati tepi atas bilah. Tepi atas membentuk lekukan melengkung yang mengitari lingkaran tersebut, sesuai screenshot.
- Lingkaran aktif dan lekukan mengikuti menu yang dipilih: Beranda, Inventaris, Pindai, Transaksi atau Lainnya. Posisi menonjol tidak dikhususkan hanya untuk Pindai di tengah.
- Label aktif lebih tegas, label menu lain tetap terbaca. Untuk menu di ujung kiri/kanan, bentuk lekukan tetap mulus dan lingkaran tidak terpotong.
- Pertahankan glassmorphism: permukaan semi-transparan, backdrop blur, garis tepi tipis dan bayangan lembut pada bilah maupun lingkaran aktif. Gambar putih/hitam menjadi acuan siluet; bukan kewajiban memakai isian putih/hitam solid.
- Usulan gerak: perpindahan indikator dan lekukan 160–220 ms tanpa loncatan tata letak. Reduced motion memakai perubahan langsung atau fade singkat. Animasi referensi asli belum diverifikasi.
- Bilah berada tetap di bawah layar dengan margin samping dan jarak aman dari bawah. Konten diberi ruang untuk seluruh tinggi bilah beserta lingkaran aktif, safe area dan bayangan. Aksi konfirmasi pengembalian tidak tertutup navbar.
- Target sentuh minimal 44×44 px, label tetap terlihat, fokus keyboard jelas dan status aktif tersedia bagi pembaca layar. Efek blur memiliki fallback opak.
- Uji bentuk dan interaksi untuk semua lima posisi aktif pada lebar HP 320–390 px, layar landscape, safe area iPhone dan keyboard terbuka. Navbar hanya muncul setelah login petugas.

### Sistem visual usulan sementara

- Dasar putih hangat/abu netral, teks charcoal, aksen hijau tua; status memiliki teks/ikon pendamping.
- Kaca transparan dan blur terbatas pada sidebar, bilah bawah dan panel aksi. Form, tabel dan isi penting memakai permukaan cukup opak.
- Radius 16–24 px, grid dan jarak konsisten, tipografi jelas; tidak menambahkan kartu atau grafik tanpa kebutuhan informasi.
- Gerak singkat 160–220 ms, mendukung reduced motion; fallback opak ketika blur tidak tersedia.
- Kontras teks ditargetkan minimal 4,5:1; fokus keyboard terlihat; target sentuh sekurangnya 44×44 px.

| Layar | Desktop | HP |
|---|---|---|
| Login | Panel identitas sederhana dan form terfokus | Form satu kolom; keyboard tidak menutup aksi |
| Dasbor | Peringatan, kegiatan, ringkasan dan daftar transaksi | Prioritas tindakan di atas, daftar ringkas, aksi cepat |
| Kontak peminjam | Pencarian nama/unit/WA/email, detail dan riwayat | Pilih/tambah kontak langsung dari form transaksi |
| Paket kelengkapan | Editor standar isi dan komponen nyata | Daftar komponen dengan jumlah/kondisi |
| Inventaris | Tabel filter, pencarian, bulk label | Daftar kartu ringkas; filter dalam sheet |
| Detail barang | Foto, status, unit fisik, riwayat | Tab/rangkaian bagian vertikal yang mudah dipindai |
| Transaksi | Tabel dan panel detail | Daftar status; form bertahap; konfirmasi jelas |
| Pemindai | Kamera atau scanner USB; input manual | Kamera belakang, panduan frame, fallback kode manual |
| Pengembalian | Checklist dan ringkasan berdampingan | Checklist vertikal dengan tombol konfirmasi tetap |
| Kegiatan | Kalender dan agenda | Agenda sebagai tampilan awal; kalender alternatif |

Navigasi desktop: Ringkasan, Inventaris (termasuk Paket), Transaksi, Kontak Peminjam, Kegiatan, Laporan, lalu Pengguna/Pengaturan sesuai izin.

Navigasi bawah HP mengikuti referensi navbar Figma pertama. Susunan fungsi Nventori: Beranda, Inventaris, Pindai, Transaksi, Lainnya. Label selalu terlihat; tombol Pindai mudah dijangkau. Perhitungkan safe area iPhone dan keyboard; beri ruang bawah pada konten agar navbar tidak menutupi daftar, checklist atau tombol konfirmasi. Data tidak boleh disembunyikan hanya untuk mengejar tampilan; tabel berubah menjadi daftar/detail yang memuat informasi setara.

Dasbor mengutamakan: (1) alat terlambat dan konflik mendatang, (2) kegiatan terdekat, (3) transaksi aktif dan jadwal pengambilan, (4) total unit unik tersedia/dipakai/perawatan serta stok kuantitas dalam ringkasan terpisah. Jangan menjumlahkan unit fisik dan lembar kertas sebagai satu KPI. Setiap angka membuka daftar dengan filter yang sesuai. Grafik penggunaan ditambahkan hanya bila histori sudah cukup.

Responsif diuji pada 320, 360, 390, 768, 1024 dan 1440 px serta orientasi landscape. Kompatibilitas tidak dijanjikan untuk seluruh perangkat tanpa pengujian; target awal Chrome/Edge desktop, Chrome Android dan Safari iPhone modern.

## 11. Arsitektur usulan

Pilihan awal: Laravel + React/TypeScript + Inertia + PostgreSQL, dalam satu repositori modular. Docker Compose untuk localhost dan server. Versi paket stabil serta kompatibilitasnya dikunci saat bootstrap dan dicatat pada lockfile.

| Komponen | Peran |
|---|---|
| Reverse proxy/web | HTTPS dan penerusan request |
| Laravel | Login, izin, aturan transaksi, layanan dan audit |
| React/Inertia | UI responsif, form, tabel, scan dan interaksi |
| PostgreSQL | Sumber data utama, relasi dan transaksi atomik |
| Worker | Email dan pekerjaan dokumen yang berat |
| Scheduler | Evaluasi tenggat, pengingat, pekerjaan pemeliharaan |
| Private storage | Foto, lampiran dan bukti dengan akses terkontrol |
| SMTP | Penyedia pengiriman email |

Mulai dari antrean database; Redis ditambahkan bila beban membutuhkannya. Tidak diperlukan microservices pada tahap awal. Halaman internal dapat memakai Inertia; layanan domain yang sama dapat diekspos melalui `/api/v1` untuk pemindai/integrasi. Jangan menggandakan aturan stok pada controller web dan API.

### Entitas inti

| Entitas | Hubungan/fungsi |
|---|---|
| users, access_levels, organizational_units | Identitas dengan tepat satu dari tiga level tetap, cakupan unit dan kewenangan |
| borrower_contacts | Kontak peminjam tanpa akun: nama, unit/instansi, HP/WA dan email |
| categories, locations, item_types | Katalog dan pengelompokan dinamis |
| asset_units, stock_pools | Unit unik atau stok kuantitas |
| kit_templates, kit_template_lines | Standar komponen, jumlah dan status wajib/opsional |
| asset_kits, kit_components | Paket fisik dan komponen nyata; tidak menambah stok |
| stock_movements | Pergerakan masuk, keluar, kembali, mutasi, koreksi |
| activities, activity_templates, template_lines | Kegiatan dan kebutuhan rekomendasi |
| transactions, transaction_lines | Referensi kontak, snapshot peminjam/email, petugas pencatat, jenis, jadwal dan kewajiban; kit_instance dan snapshot komponen pada manifest |
| allocations | Reservasi aset/jumlah selama interval |
| request_letters, attachments | Referensi surat antarunit dan arsip pendukung; tanpa entitas persetujuan |
| handover_events, return_events, return_lines | Penyerahan dan pengembalian bertahap |
| verification_tokens | Resolusi QR, pencabutan dan penerbitan ulang |
| notification_outbox, delivery_attempts | Deduplikasi, antrean dan hasil pengiriman |
| audit_logs | Pelaku, waktu, aksi, alasan dan perubahan |

### Layanan/API utama

| Area | Kontrak contoh |
|---|---|
| Identitas | login, logout, profil, reset password |
| Master | CRUD kategori, lokasi, unit, jenis barang, aset, template/paket dan komponen |
| Kontak | Cari/tambah/perbarui/nonaktifkan peminjam; riwayat pinjaman |
| Ketersediaan | pencarian berdasarkan rentang waktu, jenis dan lokasi |
| Transaksi | draft, reserve/allocate, checkout, returns, extend, cancel; tanpa endpoint submit/approve/reject |
| Kegiatan | CRUD agenda, rekomendasi kebutuhan |
| QR/cetak | resolve QR, label aset, manifest, bukti kembali |
| Pengawasan | dasbor, laporan, audit, notifikasi |

### Aturan integritas wajib

1. Aset unik tidak dapat dialokasikan untuk interval aktif yang bertabrakan.
2. Kuantitas tersedia tidak boleh negatif; kapasitas diperiksa sepanjang rentang reservasi.
3. Pengambilan, pengembalian dan koreksi memakai transaksi database dan lock yang sesuai.
4. Penguncian kuantitas mencakup pool yang sama sebelum memeriksa seluruh overlap; dua pemeriksaan paralel tidak boleh sama-sama lolos.
5. Idempotency key menangani klik ganda dan retry jaringan. Hasil request yang sama tidak membuat mutasi kedua.
6. Jumlah kembali kumulatif tidak melebihi jumlah keluar; unit yang sama tidak diterima dua kali.
7. Barang kembali rusak tidak langsung tersedia. Aset terlambat menandai risiko reservasi berikutnya dan memerlukan realokasi operator.
8. Pergerakan dan perubahan status disimpan atomik; kegagalan menggagalkan keseluruhan perubahan.
9. Dokumen dan audit tidak berubah diam-diam ketika master barang diedit; data transaksi menyimpan snapshot penting.
10. Laporan dan dasbor memakai definisi stok yang sama dengan modul transaksi.
11. Kontak peminjam tidak menjadi akun; semua mutasi transaksi menyimpan petugas pelaksana.
12. Alokasi paket dan seluruh komponen atomik; perubahan kelengkapan tidak menulis ulang manifest historis.

## 12. Backlog dan urutan pengerjaan

| ID | Prioritas | Pekerjaan | Ketergantungan | Selesai bila |
|---|---|---|---|---|
| F01 | P0 | Bootstrap aplikasi, database, layout dan environment | — | Localhost berjalan dan migrasi reproducible |
| F02 | P0 | Login, sesi, akun dengan tiga level tetap dan scope unit | F01 | Matriks akses tiga level pada UI/API lulus |
| F03 | P0 | Unit, lokasi dan kategori dinamis | F02 | CRUD dan penonaktifan menjaga riwayat |
| F04 | P0 | Jenis barang, aset unik dan stok jumlah | F03 | Kode unik, kondisi dan pergerakan benar |
| F05 | P0 | Kontak peminjam, pencarian dan snapshot transaksi | F03 | Transaksi ulang memakai kontak tanpa input ulang atau akun |
| F06 | P0 | Template paket, komponen nyata dan manifest | F04 | Jumlah, identitas, kondisi serta alokasi paket benar |
| T01 | P0 | Reservasi dan pemeriksaan ketersediaan | F04,F06 | Uji alokasi bersamaan lulus |
| T02 | P0 | Pencatatan langsung oleh petugas dan referensi surat antarunit | T01,F05 | Internal/antarunit dapat diproses tanpa persetujuan aplikasi |
| T03 | P0 | Penyerahan dan manifest | T02 | Barang keluar sesuai konfirmasi operator |
| T04 | P0 | Pengembalian checklist dan parsial | T03 | Sisa/kondisi benar; retry tidak ganda |
| Q01 | P1 | QR aset, scan, input manual | F04 | QR terbaca dan akses diperiksa |
| Q02 | P1 | QR transaksi, cetak dokumen/label | T03,Q01 | Satu scan membuka daftar; uji cetak lulus |
| A01 | P1 | Kegiatan dan kalender/agenda | T01 | Waktu dan transaksi saling terhubung |
| A02 | P1 | Template rekomendasi dan alternatif | A01,F04 | Ketersediaan dan alasan terlihat |
| N01 | P1 | Notifikasi aplikasi, email, retry | T04 | Pengingat relevan dan tercatat |
| R01 | P1 | Dasbor dan laporan | T04,A01 | Rekonsiliasi ke sumber lulus |
| O01 | P0 | Audit, backup, restore, monitoring | F01, seluruh modul terkait | Pemulihan teruji dan operasional terdokumentasi |
| O02 | P0 | Hardening, uji perangkat dan pilot | Seluruh versi pertama | Gerbang rilis terpenuhi |

P0 berarti integritas/keamanan atau fondasi kritis; P1 tetap termasuk versi pertama lengkap. Prioritas tidak berarti fitur P1 dibatalkan.

### Milestone

| Tahap | Hasil yang dapat ditinjau | Gerbang |
|---|---|---|
| 1. Fondasi | Login petugas, tiga level, shell desktop/HP, kontak peminjam, inventaris dan paket | Hak akses dan model barang tervalidasi |
| 2. Siklus alat | Reservasi langsung, surat antarunit, keluar, kembali sebagian | Tidak ada stok ganda; kondisi akurat |
| 3. QR dan cetak | Label, manifest, scan transaksi, checklist | Cetak dan scan fisik lulus |
| 4. Kegiatan smart | Agenda, template dan rekomendasi tersedia | Konflik dan kekurangan terlihat |
| 5. Operasi | Pengingat, dasbor, laporan dan audit | Retry, rekonsiliasi dan restore lulus |
| 6. Pilot/server | Instalasi, migrasi awal, panduan dan UAT | Operator menerima alur nyata |

Estimasi kalender belum dikomitmenkan karena kapasitas tim belum diketahui. Ukur penyelesaian tahap 1–2 untuk memperkirakan tahap berikutnya. Peran agen dalam rancangan ini tidak digunakan sebagai asumsi enam pengembang manusia penuh waktu.

## 13. Pengujian dan gerbang rilis

| Prioritas | Skenario | Hasil wajib |
|---|---|---|
| P0 | Dua operator memesan/mengeluarkan aset terakhir bersamaan | Hanya satu alokasi valid; tanpa stok negatif atau data setengah tersimpan |
| P0 | Transaksi 5 unit, baru 3 kembali | Tersisa 2; pengingat hanya untuk sisa |
| P0 | Scan transaksi lalu checklist 1 dari 3 unit | Hanya unit terpilih dicatat diterima |
| P0 | Kembali rusak/hilang | Jalur pemeriksaan/penyelesaian, tidak tersedia normal |
| P0 | Klik ganda, koneksi putus setelah commit, retry | Satu mutasi dan satu peristiwa |
| P0 | Role tidak berhak mengganti ID atau memanggil API langsung | Ditolak tanpa membocorkan data |
| P0 | QR palsu/dicabut/transaksi tidak dikenal | Pesan jelas; tidak ada perubahan stok |
| P0 | Scheduler/worker concurrent, tenggat diubah, barang telah kembali | Tidak membuat job aplikasi ganda; pengiriman relevan dengan keadaan terbaru |
| P0 | Logout, akun dinonaktifkan, level diturunkan | Operasi berikutnya tidak memakai hak lama |
| P0 | Matriks Super Admin, Admin Inventaris dan Operator | Hanya tiga level tersedia; Operator tidak dapat mengubah akun/level atau menyesuaikan stok manual |
| P0 | Pemakaian internal dan pinjaman antarunit | Petugas dapat langsung mencatat reservasi/penyerahan; tidak menunggu persetujuan atau akun kepala |
| P1 | Referensi surat pada pinjaman antarunit | Nomor, tanggal, asal unit dan salinan opsional dapat dicatat serta ditelusuri tanpa mengubah stok |
| P0 | Peminjam berulang dipilih dari kontak | Nama/unit/WA/email terisi tanpa akun atau input ulang |
| P0 | Buku kontak diubah setelah transaksi | Manifest/bukti lama tetap memakai snapshot; perubahan penerima aktif diaudit |
| P0 | Drone keluar dengan 3 baterai, kembali 2 | Sisa 1 baterai, transaksi belum selesai dan paket belum siap lengkap |
| P0 | Paket bersamaan dengan pinjaman komponen yang sama | Hanya alokasi yang konsisten dapat disimpan; tidak menghitung stok dua kali |
| P0 | Isi standar paket berubah setelah serah terima | Manifest dan kewajiban transaksi lama tetap sama |
| P1 | Rekomendasi Wisuda saat alat rusak/terpesan | Tidak dianggap tersedia; alternatif/kekurangan ditunjukkan |
| P1 | Scan kamera ditolak/tidak tersedia | Input kode/pencarian manual tetap berfungsi |
| P1 | Printer nyata pada ukuran label yang disepakati | QR terbaca; teks tidak terpotong |
| P1 | HP, tablet, desktop; keyboard dan safe area | Tidak menutupi tombol dan data penting |
| P0 | Restore database dan dokumen pada lingkungan terpisah | Transaksi, stok, lampiran dan audit cocok |

Strategi: unit test aturan status/rekomendasi, integration test dengan PostgreSQL nyata untuk integritas dan race condition, E2E login petugas→pilih/tambah kontak→catat pinjaman paket→keluar→QR→checklist komponen→kembali parsial→selesai, serta uji fisik kamera/printer.

Target desain yang harus dibuktikan, bukan hasil pengujian saat ini: LCP mobile ≤2,5 detik, INP ≤200 ms, CLS ≤0,1 pada kondisi ukur yang disepakati. Modul kamera dimuat ketika diperlukan. Target backup awal RPO 24 jam dan RTO 4 jam hanya dapat disahkan setelah uji pemulihan.

Rilis memerlukan seluruh skenario P0 lulus, alur utama desktop/HP lulus, tidak ada masalah akses/kehilangan data yang terbuka, label fisik terbaca, email serta scheduler/worker diawasi, restore berhasil, dan UAT operator selesai. Belum ada pengujian aplikasi yang dijalankan dalam tahap blueprint.

## 14. Localhost, server dan serah terima

Pengembangan: VSCode, Git, Docker/WSL bila memakai Windows, layanan aplikasi, PostgreSQL, worker dan scheduler. Data contoh hanya untuk pengembangan; tidak dimasukkan diam-diam ke lingkungan produksi.

Pilot server awal dapat mengevaluasi 2 vCPU, RAM 4 GB dan SSD 40 GB sebagai hipotesis kapasitas, bukan spesifikasi final. Ukur kebutuhan file/foto, jumlah pengguna, beban cetak dan retensi sebelum pembelian/penetapan kapasitas.

Yang perlu disiapkan sebelum pemasangan server:

- Server Linux dan akses administrator; domain/subdomain dan HTTPS.
- SMTP serta identitas pengirim; akun uji penerima untuk verifikasi email.
- Penyimpanan persisten database/lampiran; backup di lokasi berbeda.
- Scheduler, worker, log dan health check aktif setelah reboot.
- Identitas organisasi, daftar unit/lokasi, pengguna awal dengan tiga level dan prosedur pencatatan surat antarunit.
- Model printer, lebar label dan contoh hasil cetak untuk kalibrasi.

Kamera web memerlukan secure context seperti HTTPS atau localhost. HP yang membuka alamat IP laptop melalui HTTP tidak dianggap localhost; pengujian kamera dari HP perlu HTTPS. Pencarian manual tetap disediakan.

Paket implementasi yang nantinya harus diserahkan: source repository, lockfile, `.env.example` tanpa rahasia, migrasi, prosedur bootstrap admin, Docker Compose, panduan localhost/server, backup/restore, pembaruan/rollback, matriks izin dan hasil uji. Database serta lampiran tidak boleh hilang ketika container diganti.

## 15. Risiko dan keputusan terbuka

| Risiko | Mitigasi | Pemilik |
|---|---|---|
| Stok tidak cocok karena pendataan awal | Tentukan mode unik/jumlah dan lakukan rekonsiliasi sebelum go-live | Pengelola inventaris |
| Alat sama dipakai pada dua kegiatan | Validasi overlap, locking dan uji concurrent | Backend/QA |
| Barang terlambat mengganggu jadwal berikut | Peringatan benturan dan realokasi operator | Operator |
| Pengembalian dianggap lengkap padahal belum | Checklist kosong di awal dan ringkasan sisa | Frontend/QA |
| QR tersebar mengungkap data PIC | Token acak, otorisasi dan minimisasi data | Backend |
| Pengingat berhenti karena proses mati | Health check dan monitoring worker/scheduler | Admin TI |
| Glassmorphism mengurangi keterbacaan/performa | Blur terbatas, fallback opak dan uji kontras/perangkat | Frontend/QA |
| Printer berbeda ukuran/driver | Profil mm dan uji cetak perangkat nyata | Fullstack/operator |

Keputusan yang masih dapat ditentukan saat implementasi: daftar awal kategori/lokasi, ukuran printer, model server, SMTP, kapasitas pengguna dan aturan buffer jadwal. Tidak diperlukan keputusan tersebut untuk memulai fondasi dengan konfigurasi yang dapat diubah.

## 16. Sumber teknis

- Laravel task scheduling: https://laravel.com/framework/docs/scheduling
- Laravel queues: https://laravel.com/framework/docs/queues
- PostgreSQL constraints: https://www.postgresql.org/docs/current/sql-createtable.html
- MDN kamera dan secure context: https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- Referensi navbar HP dari pengguna, detail visual belum diverifikasi: https://www.figma.com/community/file/1285886007707459867
- Referensi UI keseluruhan dari pengguna, detail visual belum diverifikasi: https://www.figma.com/community/file/1522234175468349854

Blueprint ini menjadi dasar implementasi dan penerimaan. Tidak mengklaim login, email, QR, stok maupun tampilan telah tersedia sebelum kode dan pengujian selesai.
