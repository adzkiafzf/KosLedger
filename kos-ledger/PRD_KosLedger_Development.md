# PRODUCT REQUIREMENTS DOCUMENT (PRD)
## KosLedger — Platform Manajemen Keuangan Kos Berbasis Web

| Metadata | Nilai |
|---|---|
| Versi | 1.0 |
| Tanggal | 22 November 2026 |
| Status | Baseline pengembangan prototipe akademik |
| Sumber kebutuhan | Proposal KosLedger, Kelompok 4 (`Blockchain.md`) |
| Bahasa aplikasi | Bahasa Indonesia |
| Lingkungan | Development dan demonstrasi |

> Dokumen ini menerjemahkan proposal menjadi spesifikasi implementasi frontend, backend, database, integrasi, keamanan, dan QA. Rekomendasi stack bukan ketentuan proposal dan perlu disepakati tim. Jika terdapat perbedaan, ruang lingkup dan batasan proposal menjadi acuan.

---

# 1. Ringkasan Produk

KosLedger adalah aplikasi web untuk membantu administrasi kos melalui pengelolaan kamar, penghuni, tagihan, pengeluaran bersama, pembayaran, dan laporan keuangan sederhana. Sistem memiliki empat role: **Admin, Bendahara, Anggota/Penghuni, dan Pemilik**.

Integrasi eksternal:
- **Midtrans Sandbox** untuk simulasi checkout dan notifikasi pembayaran.
- **Ethereum Sepolia Testnet** untuk mencatat hash payload transaksi yang telah diverifikasi backend.
- **Telegram Bot API** untuk pengingat jatuh tempo dan notifikasi pembayaran.

Backend adalah *source of truth* untuk autentikasi, otorisasi, nominal tagihan, status pembayaran, perhitungan keuangan, dan pemanggilan layanan eksternal. Frontend tidak boleh menetapkan status pembayaran atau mengirim transaksi blockchain secara langsung.

## 1.1 Tujuan
1. Memusatkan administrasi kamar, penghuni, tagihan, pembayaran, dan pengeluaran.
2. Memberikan informasi tagihan dan status pembayaran kepada penghuni.
3. Menyediakan laporan agregat untuk pemilik.
4. Menguji pembayaran melalui Midtrans Sandbox.
5. Mencatat bukti integritas transaksi melalui hash di Sepolia.
6. Mengirim pengingat dan notifikasi melalui Telegram.

## 1.2 Bukan tujuan produk
KosLedger versi ini bukan sistem akuntansi profesional, bukan dompet digital, bukan layanan penyimpanan dana, dan bukan layanan pembayaran produksi. Blockchain hanya menjadi lapisan pembuktian integritas data, bukan sarana memindahkan uang.

# 2. Ruang Lingkup dan Batasan

## 2.1 Termasuk dalam MVP
- Login, logout, autentikasi, dan otorisasi empat role.
- CRUD penghuni dengan mekanisme nonaktif, bukan hard delete.
- CRUD kamar dan penempatan penghuni.
- Pencatatan pemasukan dan pengeluaran bersama.
- Pembuatan tagihan dengan periode, nominal, rincian, dan jatuh tempo.
- Riwayat pembayaran dan pembayaran manual oleh Bendahara.
- Checkout Midtrans Sandbox.
- Webhook pembayaran dengan verifikasi signature dan idempotensi.
- Pemisahan status pembayaran dan status blockchain.
- Smart contract pencatat hash di Sepolia.
- Verifikasi hash dari data yang tersimpan.
- Dashboard transparansi penghuni dan laporan agregat Pemilik.
- Telegram reminder dan payment notification.
- Log integrasi, validasi input, pengujian, dan dokumentasi API.

## 2.2 Tidak termasuk dalam MVP
- Pembayaran uang sungguhan atau Midtrans Production.
- Penyimpanan saldo pengguna, escrow, transfer, pencairan dana, atau wallet.
- Pinjaman, investasi, token bernilai, atau jual-beli aset kripto.
- Refund otomatis, pembayaran sebagian, cicilan, dan split payment.
- Integrasi langsung ke rekening bank.
- Akuntansi profesional dan perpajakan.
- Multi-property/multi-tenant SaaS kecuali disetujui sebagai perluasan.
- Audit keamanan independen dan penetration test formal.
- Penyimpanan KTP, nomor rekening, atau data identitas sensitif.
- Penyimpanan data pribadi pada blockchain.

## 2.3 Batasan operasional
- Semua akun, penghuni, kamar, tagihan, dan transaksi menggunakan data dummy.
- Pembayaran hanya menggunakan kredensial Midtrans Sandbox.
- Blockchain hanya menggunakan Sepolia testnet dan aset testnet.
- Telegram merupakan kanal notifikasi, bukan sumber status pembayaran.
- Ketersediaan demo bergantung pada Midtrans Sandbox, RPC Sepolia, faucet, dan Telegram API.
- Prototipe tidak memiliki target performa produksi atau uji beban formal.

# 3. Pengguna dan Matriks Hak Akses

| Fitur | Admin | Bendahara | Anggota | Pemilik |
|---|---:|---:|---:|---:|
| Dashboard sesuai role | Ya | Ya | Ya | Ya |
| Lihat data kamar | Ya | Ya | Terbatas | Ringkasan |
| Tambah/ubah kamar | Ya | Tidak | Tidak | Tidak |
| Kelola penghuni | Ya | Tidak | Tidak | Tidak |
| Menempatkan penghuni | Ya | Tidak | Tidak | Tidak |
| Lihat seluruh tagihan | Tidak | Ya | Tidak | Agregat |
| Lihat tagihan sendiri | Tidak | Opsional | Ya | Tidak |
| Buat/ubah tagihan | Tidak | Ya | Tidak | Tidak |
| Catat pemasukan/pengeluaran | Tidak | Ya | Tidak | Tidak |
| Catat pembayaran manual | Tidak | Ya | Tidak | Tidak |
| Checkout sandbox | Tidak | Tidak | Ya | Tidak |
| Lihat histori pembayaran | Tidak | Semua | Milik sendiri | Agregat |
| Dashboard transparansi | Tidak | Ya | Ya, tanpa PII | Ringkasan |
| Laporan keuangan | Tidak | Ya | Ringkasan | Read-only |
| Mengubah transaksi | Tidak | Sesuai aturan | Tidak | Tidak |

**Aturan wajib:**
1. Semua pembatasan ditegakkan di backend. Menyembunyikan menu di frontend saja tidak cukup.
2. Anggota hanya dapat mengakses resource milik user ID-nya sendiri.
3. Pemilik bersifat read-only.
4. Admin mengelola penghuni dan kamar, bukan transaksi keuangan.
5. Bendahara mengelola keuangan dan tagihan, bukan data kamar/penghuni.
6. Mengganti ID pada URL/API tidak boleh membuka data pengguna lain.
7. Penghuni yang keluar dinonaktifkan (`is_active=false`); histori tidak dihapus.

# 4. Rekomendasi Teknologi

Bagian ini adalah rekomendasi implementasi, bukan keputusan eksplisit proposal.

| Lapisan | Rekomendasi | Catatan |
|---|---|---|
| Backend | Laravel | REST API, validation, ORM, migration, queue, scheduler, authorization |
| Database | PostgreSQL (supabase) | Relasional, transaksi ACID, foreign key, unique constraint |
| Alternatif frontend | Blade + Tailwind CSS | Lebih sederhana untuk prototipe; pilih satu pendekatan utama |
| Styling | Tailwind CSS | Konsistensi komponen UI |
| API | REST + JSON | Kontrak frontend/backend |
| Payment | Midtrans Snap Sandbox | Checkout dan webhook |
| Blockchain | Solidity + Ethereum Sepolia | Smart contract pencatat hash |
| Web3 backend | ethers.js atau library kompatibel | Backend menandatangani transaksi kontrak |
| Notifikasi | Telegram Bot API | Reminder dan notifikasi |
| Version control | Git | Riwayat kontribusi |
| API testing | Postman/Insomnia | Pengujian endpoint dan webhook |
| Contract testing | Hardhat atau Foundry | Pengujian lokal sebelum Sepolia |

Jangan membangun dua frontend berbeda untuk fitur yang sama. Sepakati Blade atau Vue/Inertia sebelum implementasi.

## 4.1 Arsitektur

```text
Browser / Frontend
       | HTTPS, REST JSON
       v
Laravel Backend API
  |          |            |
  |          |            +--> Telegram Bot API
  |          +---------------> Ethereum Sepolia RPC
  +--------------------------> Midtrans Sandbox API
       |
       +----------------------> Relational Database

Midtrans webhook ----------------> Backend webhook endpoint
```

- Browser hanya berkomunikasi dengan backend aplikasi.
- Backend memegang seluruh secret dan aturan bisnis.
- Midtrans mengirim webhook langsung ke backend, bukan browser.
- Backend mengirim transaksi ke smart contract setelah pembayaran tervalidasi.
- Frontend membaca status blockchain dari backend.
- Kegagalan Telegram atau blockchain tidak membatalkan pembayaran yang sudah valid.

# 5. Modul dan Kebutuhan Fungsional

## 5.1 Autentikasi dan akun
- Login menggunakan kredensial akun dummy; logout mengakhiri sesi.
- Password disimpan sebagai hash menggunakan mekanisme password hashing framework.
- Pesan gagal login tidak membocorkan apakah username/email atau password yang salah.
- Batasi percobaan login.
- Semua endpoint privat membutuhkan autentikasi.
- Role disimpan di database dan diperiksa di backend.

## 5.2 Manajemen penghuni — Admin
- Menampilkan daftar penghuni.
- Menambah penghuni: nama, nama panggilan, nomor telepon dummy, role anggota.
- Mengubah data penghuni.
- Menonaktifkan penghuni tanpa menghapus histori.
- Menampilkan status aktif/nonaktif.
- Menempatkan penghuni ke kamar dengan tanggal mulai/akhir.

## 5.3 Manajemen kamar — Admin
- Menampilkan, menambah, dan mengubah data kamar.
- Nomor kamar harus unik.
- Data minimal: nomor kamar, tarif bulanan, kapasitas, status.
- Penempatan ditolak jika kapasitas penuh.
- Riwayat penempatan disimpan di `occupancies`.

## 5.4 Keuangan dan pengeluaran — Bendahara
- Mencatat pemasukan atau pengeluaran.
- Data minimal: tipe, kategori, deskripsi, nominal, tanggal, dan pembuat.
- Nominal harus bilangan positif.
- Kategori dapat meliputi listrik, CCTV, air, gas, perbaikan, dan perlengkapan kebersihan.
- Saldo dihitung dari total pemasukan dikurangi total pengeluaran.
- Laporan dihitung dari data transaksi, bukan angka manual di frontend.

## 5.5 Tagihan — Bendahara
- Membuat tagihan untuk penghuni/occupancy.
- Tagihan memiliki periode, jatuh tempo, nominal, rincian item, dan status.
- Rincian dapat memuat sewa dan alokasi biaya bersama.
- Tagihan baru berstatus belum dibayar.
- Cegah tagihan periode sama terbuat ganda untuk occupancy yang sama.
- Anggota hanya dapat melihat tagihan miliknya.

## 5.6 Pembayaran manual — Bendahara
- Bendahara dapat mencatat pembayaran di luar gateway.
- Catatan menyimpan `recorded_by` sebagai ID Bendahara.
- Backend memeriksa tagihan belum lunas sebelum mencatat.
- Pembayaran manual dan gateway tidak boleh melunasi tagihan yang sama dua kali.
- Pembayaran kedua ditolak atau ditandai untuk pemeriksaan.

## 5.7 Checkout Midtrans Sandbox — Anggota
- Anggota memilih tagihan miliknya yang belum lunas.
- Frontend meminta backend membuat checkout.
- Backend mengambil nominal dari database, bukan dari request browser.
- Backend membuat `order_id` unik dan transaksi di Midtrans Sandbox.
- Backend mengembalikan URL/token checkout yang diperlukan frontend.
- Redirect browser bukan bukti pembayaran sukses.
- Status final hanya berubah setelah webhook tervalidasi backend.

## 5.8 Webhook pembayaran
- Endpoint webhook dapat diakses Midtrans tanpa sesi login pengguna.
- Backend memverifikasi signature sesuai mekanisme resmi Midtrans.
- Backend mencocokkan order ID, nominal, dan status dengan transaksi internal.
- Event webhook dicatat.
- Pemrosesan idempotent: notifikasi sama tidak menghasilkan pembayaran ganda.
- Status final tidak boleh diturunkan oleh notifikasi lama/tidak sesuai urutan.
- Update status dan pencatatan event dilakukan secara aman dalam transaksi database.
- Webhook invalid tidak boleh mengubah status pembayaran.

## 5.9 Blockchain
- Hanya pembayaran berstatus berhasil yang boleh diajukan untuk pencatatan.
- Backend membentuk payload kanonis dan menghitung hash.
- Backend mengirim `paymentRef` pseudonim dan `payloadHash` ke smart contract Sepolia.
- Status blockchain disimpan terpisah dari status pembayaran.
- Jika RPC gagal, simpan status tertunda/gagal dan sediakan retry.
- Sebelum retry, periksa apakah `paymentRef` sudah tercatat.
- Pengguna berwenang dapat melihat transaction hash dan tautan explorer.
- Verifikasi menghitung ulang hash payload kanonis lalu membandingkannya dengan hash on-chain.

## 5.10 Telegram
- Anggota menautkan Telegram menggunakan kode sekali pakai dengan masa berlaku terbatas.
- Bot menerima `/start <kode>` untuk menautkan chat.
- Backend memvalidasi kode dan menyimpan `telegram_chat_id`.
- Pengingat terjadwal dikirim kepada anggota yang memiliki tagihan belum lunas.
- Notifikasi pembayaran dikirim setelah status valid.
- Kegagalan pengiriman dicatat dan tidak membatalkan pembayaran.
- Pesan tidak memuat nomor telepon, nomor kamar, token, atau data pribadi berlebihan.

# 6. Status dan Aturan Bisnis

## 6.1 Status pembayaran

| Status internal | Makna |
|---|---|
| `pending` | Menunggu hasil pembayaran |
| `success` | Pembayaran berhasil dan tervalidasi |
| `failed` | Pembayaran gagal/ditolak |
| `expired` | Transaksi kedaluwarsa |

Pemetaan status provider dilakukan di backend. Jangan menerima status pembayaran dari frontend sebagai sumber kebenaran.

## 6.2 Status blockchain

| Status internal | Makna |
|---|---|
| `not_submitted` | Belum diajukan ke blockchain |
| `pending` | Menunggu pencatatan/konfirmasi |
| `recorded` | Catatan berhasil tersimpan dan diverifikasi |
| `failed` | Percobaan gagal; dapat dijadwalkan retry |

**Status pembayaran dan blockchain tidak boleh digabung menjadi satu kolom.** Pembayaran `success` dengan blockchain `pending` tetap merupakan pembayaran berhasil.

## 6.3 Aturan transisi
- `pending` dapat berubah menjadi `success`, `failed`, atau `expired` berdasarkan notifikasi valid.
- Status final tidak boleh berubah kembali menjadi `pending` karena webhook terlambat.
- Webhook duplikat tidak mengulang efek samping.
- Pembayaran `failed` atau `expired` tidak memanggil fungsi pencatatan blockchain.
- Blockchain `failed` tidak mengubah pembayaran `success`.
- Telegram gagal tidak mengubah status pembayaran.
- Satu tagihan tidak boleh memiliki lebih dari satu pembayaran sukses.

# 7. Spesifikasi REST API

## 7.1 Konvensi
- Base path: `/api`; format JSON UTF-8.
- Endpoint privat memakai autentikasi aplikasi dan pemeriksaan role/kepemilikan.
- Endpoint webhook tidak memakai login pengguna, tetapi wajib memverifikasi signature/secret provider.
- Gunakan HTTP status yang sesuai: `200`, `201`, `204`, `401`, `403`, `404`, `409`, `422`, `500`.
- ID resource bukan bukti otorisasi.
- Tanggal menggunakan ISO 8601; timestamp disimpan konsisten dalam UTC.
- Nominal rupiah dikirim sebagai integer, bukan floating point.

Contoh respons sukses:

```json
{
  "data": { "id": 101, "status": "pending" },
  "message": "Data berhasil diproses"
}
```

Contoh respons validasi:

```json
{
  "message": "Data tidak valid",
  "errors": { "amount": ["Nominal harus lebih besar dari 0."] }
}
```

## 7.2 Authentication

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| POST | `/api/auth/login` | Publik | Login |
| POST | `/api/auth/logout` | Semua role login | Logout |
| GET | `/api/auth/me` | Semua role login | Profil dan role aktif |

Contoh login:

```json
{ "username": "bendahara", "password": "password-dummy" }
```

Respons tidak boleh memuat password atau hash password.

## 7.3 Users/penghuni

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/users` | Admin | Daftar penghuni |
| POST | `/api/users` | Admin | Tambah penghuni |
| GET | `/api/users/{id}` | Admin | Detail penghuni |
| PUT | `/api/users/{id}` | Admin | Ubah penghuni |
| PATCH | `/api/users/{id}/deactivate` | Admin | Nonaktifkan penghuni |

Contoh create user:

```json
{
  "name": "Penghuni Dummy",
  "nickname": "Dina",
  "phone": "081200000001",
  "role": "anggota",
  "password": "password-dummy"
}
```

Endpoint pembuatan penghuni umum tidak boleh membuka pembuatan role Admin/Bendahara/Pemilik. Akun staf dibuat melalui provisioning yang dikendalikan.

## 7.4 Rooms dan occupancies

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/rooms` | Admin, Bendahara | Daftar kamar |
| POST | `/api/rooms` | Admin | Tambah kamar |
| GET | `/api/rooms/{id}` | Admin, Bendahara | Detail kamar |
| PUT | `/api/rooms/{id}` | Admin | Ubah kamar |
| POST | `/api/occupancies` | Admin | Tempatkan penghuni |
| GET | `/api/occupancies` | Admin | Riwayat penempatan |

Contoh kamar:

```json
{ "room_number": "A-01", "monthly_rate": 1500000, "capacity": 2, "status": "available" }
```

Contoh penempatan:

```json
{ "user_id": 21, "room_id": 3, "start_date": "2026-11-01" }
```

Validasi: nomor kamar unik; penghuni aktif; kapasitas belum penuh; tidak ada penempatan aktif yang konflik.

## 7.5 Transactions/pemasukan dan pengeluaran

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/transactions` | Bendahara | Daftar transaksi kas |
| POST | `/api/transactions` | Bendahara | Tambah pemasukan/pengeluaran |
| GET | `/api/transactions/{id}` | Bendahara | Detail transaksi |
| PUT | `/api/transactions/{id}` | Bendahara | Ubah transaksi sesuai aturan |

Contoh:

```json
{
  "type": "expense",
  "category": "listrik",
  "description": "Pembayaran listrik bulan November",
  "amount": 350000,
  "trx_date": "2026-11-10"
}
```

`type` hanya menerima `income` atau `expense`; `amount` harus integer positif.

## 7.6 Bills dan bill items

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/bills` | Bendahara, Anggota | Daftar tagihan sesuai role |
| POST | `/api/bills` | Bendahara | Membuat tagihan |
| GET | `/api/bills/{id}` | Bendahara, pemilik tagihan | Detail tagihan |
| PUT | `/api/bills/{id}` | Bendahara | Ubah tagihan sesuai aturan |
| GET | `/api/bills/{id}/items` | Bendahara, pemilik tagihan | Rincian tagihan |

Contoh:

```json
{
  "occupancy_id": 12,
  "period": "2026-11",
  "due_date": "2026-11-10",
  "items": [
    { "category": "sewa", "description": "Sewa kamar November", "amount": 1500000 },
    { "category": "air", "description": "Alokasi air November", "amount": 50000 }
  ]
}
```

Backend menghitung `total_amount` dari item. Jangan mempercayai total yang dikirim browser.

## 7.7 Payments

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/payments` | Bendahara, Anggota | Riwayat sesuai role |
| GET | `/api/payments/{id}` | Bendahara, pemilik pembayaran | Detail pembayaran |
| POST | `/api/bills/{id}/checkout` | Pemilik tagihan | Membuat checkout Midtrans |
| POST | `/api/bills/{id}/manual-payment` | Bendahara | Mencatat pembayaran manual |

Contoh pembayaran manual:

```json
{
  "amount": 1550000,
  "paid_at": "2026-11-10T09:00:00Z",
  "note": "Pembayaran tunai diterima"
}
```

Backend menentukan `recorded_by` dari sesi Bendahara, bukan dari input browser.

## 7.8 Webhook Midtrans

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| POST | `/api/webhooks/payment` | Midtrans melalui signature validation | Menerima notifikasi pembayaran |

Urutan pemrosesan:
1. Terima payload webhook.
2. Validasi signature sesuai dokumentasi Midtrans.
3. Cari transaksi berdasarkan `order_id`.
4. Cocokkan nominal dan identitas transaksi.
5. Periksa apakah event/order sudah diproses.
6. Validasi transisi status.
7. Update payment dan bill secara atomik.
8. Catat event webhook.
9. Jika pembayaran baru berubah menjadi sukses, jadwalkan notifikasi dan pencatatan blockchain.
10. Berikan respons sesuai ketentuan provider.

Jangan mengandalkan redirect URL atau callback frontend sebagai bukti pembayaran.

## 7.9 Blockchain records

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/chain-records` | Bendahara, Pemilik sesuai cakupan | Daftar bukti on-chain |
| GET | `/api/chain-records/{paymentId}` | Bendahara, pemilik pembayaran | Detail catatan |
| POST | `/api/chain-records/{paymentId}/verify` | Role berwenang | Verifikasi hash |
| POST | `/api/chain-records/{paymentId}/retry` | Bendahara/admin teknis sesuai kebijakan | Retry pencatatan gagal |

Retry harus memastikan pembayaran `success` dan memeriksa `isRecorded(paymentRef)` sebelum mengirim transaksi baru.

## 7.10 Reports dan dashboard

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| GET | `/api/dashboard/admin` | Admin | Ringkasan penghuni dan kamar |
| GET | `/api/dashboard/treasurer` | Bendahara | Ringkasan keuangan dan tagihan |
| GET | `/api/dashboard/member` | Anggota | Tagihan sendiri dan transparansi agregat |
| GET | `/api/dashboard/owner` | Pemilik | Laporan agregat read-only |
| GET | `/api/reports/finance` | Bendahara, Pemilik | Ringkasan pemasukan/pengeluaran sesuai role |
| GET | `/api/reports/occupancy` | Admin, Pemilik sesuai kebutuhan | Ringkasan hunian |
| GET | `/api/reports/payments` | Bendahara, Pemilik agregat | Ringkasan status pembayaran |

Filter opsional: `start_date`, `end_date`, `period`, `status`, `category`, dan pagination. Backend menerapkan pembatasan data berdasarkan role.

## 7.11 Telegram

| Method | Endpoint | Akses | Fungsi |
|---|---|---|---|
| POST | `/api/telegram/link-code` | Anggota | Membuat kode tautan sekali pakai |
| POST | `/api/webhooks/telegram` | Telegram dengan secret token | Menerima update bot |
| POST | `/api/telegram/reminders/send` | Bendahara | Memicu pengingat manual |
| GET | `/api/notifications` | Pengguna sesuai kepemilikan | Riwayat notifikasi |

Pengingat terjadwal dijalankan melalui scheduler/queue backend, bukan browser yang harus selalu terbuka.

# 8. Frontend Requirements

## 8.1 Struktur layout
- Sidebar navigasi pada desktop.
- Topbar berisi judul halaman, identitas pengguna, dan logout.
- Konten utama memakai card, tabel, filter, form, dan modal konfirmasi.
- Mobile layout menggunakan drawer/bottom navigation yang sesuai.
- Seluruh label dan pesan menggunakan Bahasa Indonesia.
- Nominal ditampilkan dalam format Rupiah.
- Status memakai label teks, bukan warna saja.
- Tabel menyediakan loading, empty state, error state, dan pagination bila diperlukan.

## 8.2 Halaman per role

### Admin
1. Dashboard: jumlah kamar, kamar terisi/kosong, penghuni aktif.
2. Data Kamar: daftar, tambah, edit, status, kapasitas.
3. Data Penghuni: daftar, tambah, edit, nonaktifkan.
4. Penempatan Kamar: menempatkan penghuni dan melihat histori.
5. Profil.

### Bendahara
1. Dashboard: pemasukan, pengeluaran, saldo, tagihan belum lunas, transaksi terbaru.
2. Tagihan: daftar, buat tagihan, detail, filter periode/status.
3. Pembayaran: daftar transaksi, detail status gateway, pembayaran manual.
4. Pengeluaran: tambah, edit, kategori, tanggal.
5. Laporan Keuangan: ringkasan dan filter periode.
6. Integrasi: status webhook, Telegram, dan blockchain.
7. Profil.

### Anggota/Penghuni
1. Dashboard: tagihan aktif, jatuh tempo terdekat, status pembayaran, ringkasan transparansi.
2. Tagihan Saya: daftar tagihan sendiri.
3. Detail Tagihan: item, periode, nominal, jatuh tempo, status.
4. Checkout: instruksi sandbox dan tombol bayar.
5. Riwayat Pembayaran: transaksi sendiri.
6. Detail Bukti Transaksi: status pembayaran, status blockchain, hash, explorer jika tersedia.
7. Pengaturan Telegram.
8. Profil.

### Pemilik
1. Dashboard: penghuni, kamar terisi/kosong, pemasukan, pengeluaran, saldo, tunggakan agregat.
2. Laporan Keuangan: ringkasan berdasarkan periode.
3. Riwayat Transaksi: tampilan baca saja sesuai kebijakan data.
4. Status verifikasi transaksi jika relevan.
5. Profil.

## 8.3 Perilaku frontend
- Route guard berdasarkan role untuk pengalaman pengguna; backend tetap pengaman utama.
- Setelah login, arahkan ke dashboard sesuai role.
- Jangan tampilkan tombol yang tidak sesuai role.
- Form menampilkan validasi backend.
- Tampilkan konfirmasi sebelum tindakan yang mengubah data.
- Setelah mutasi sukses, refresh data terkait.
- Checkout hanya dimulai melalui endpoint backend.
- Setelah redirect Midtrans, tampilkan “Menunggu konfirmasi” sampai backend mengonfirmasi status final.
- Jangan menampilkan “Lunas” hanya karena pengguna kembali dari halaman checkout.
- Tampilkan status blockchain terpisah dari status pembayaran.

# 9. Rancangan Database

Rancangan konseptual awal mengikuti entitas pada proposal. Detail tipe data dan constraint final ditetapkan saat migration.

| Tabel | Kolom utama | Catatan |
|---|---|---|
| `users` | id, name, nickname, phone, role, password_hash, telegram_chat_id, is_active | Role: admin, bendahara, anggota, pemilik |
| `rooms` | id, room_number, monthly_rate, capacity, status | `room_number` unique |
| `occupancies` | id, user_id, room_id, start_date, end_date, status | Riwayat penempatan |
| `bills` | id, occupancy_id, period, due_date, total_amount, status, created_by | Tagihan per periode |
| `bill_items` | id, bill_id, category, description, amount | Rincian tagihan |
| `cash_transactions` | id, type, category, description, amount, trx_date, created_by, payment_id | Pemasukan/pengeluaran |
| `payments` | id, bill_id, method, provider_order_id, provider_transaction_id, amount, status, paid_at, recorded_by | Gateway/manual |
| `webhook_events` | id, provider_event_id, payment_id, signature_valid, received_at, processing_status | Audit dan idempotensi |
| `chain_records` | id, payment_id, payment_ref, payload_hash, contract_address, tx_hash, chain_status, retry_count, recorded_at | Tidak memuat PII |
| `notification_logs` | id, user_id, bill_id, type, status, error_message, sent_at | Riwayat Telegram |

## 9.1 Constraint database penting
- `rooms.room_number` unique.
- `users.role` dibatasi ke nilai yang diizinkan.
- Nominal uang menggunakan integer atau DECIMAL tanpa floating point; konsisten di seluruh aplikasi.
- `payments.provider_order_id` unique jika terisi.
- `webhook_events.provider_event_id` unique jika provider menyediakan event ID stabil; jika tidak, tetapkan strategi deduplikasi lain.
- `chain_records.payment_ref` unique.
- Satu tagihan hanya boleh memiliki satu pembayaran sukses.
- Foreign key menjaga relasi antartabel.
- Penghuni nonaktif tidak dihapus.
- Gunakan database transaction untuk update status pembayaran, tagihan, dan event terkait.

**Catatan desain:** Proposal menyatakan pembayaran sebagian, satu akun untuk beberapa penghuni, dan riwayat perpindahan kamar belum final. Jangan implementasikan fitur tersebut sebelum tim menyepakati aturan dan perubahan ERD.

# 10. Hash dan Smart Contract

## 10.1 Smart contract

Kontrak adalah pencatat bukti integritas, bukan escrow atau pengelola dana.

Rancangan fungsi:
- `recordPayment(bytes32 paymentRef, bytes32 payloadHash)`
- `getRecord(paymentRef)`
- `isRecorded(paymentRef)`
- Event: `PaymentRecorded(paymentRef, payloadHash, recordedAt)`

Aturan kontrak:
1. Hanya alamat backend yang diotorisasi dapat menulis.
2. `paymentRef` dan `payloadHash` tidak boleh kosong.
3. `paymentRef` yang sudah tercatat tidak dapat dicatat ulang.
4. Tidak ada fungsi untuk mengubah atau menghapus catatan.
5. Tidak menerima transfer dana dan tidak menerbitkan token.
6. Tidak menyimpan nama, nomor telepon, nomor kamar, chat ID, rekening, atau rincian tagihan.

## 10.2 Payload kanonis

Proposal menetapkan lima bidang:
- `schema_version`
- `payment_ref` — identifier pseudonim 32 byte acak
- `amount` — nominal rupiah sebagai integer
- `status`
- `verified_at` — UTC ISO 8601, berasal dari `payments.paid_at`

Contoh ilustratif:

```json
{
  "schema_version": "1",
  "payment_ref": "0x...32-byte-random-reference...",
  "amount": 1550000,
  "status": "success",
  "verified_at": "2026-11-10T09:00:00Z"
}
```

Tim harus menetapkan satu aturan serialisasi kanonis sebelum coding: urutan field, encoding UTF-8, format tanggal, representasi angka, dan metode hash (misalnya SHA-256 atau keccak256) harus konsisten antara backend dan proses verifikasi. Jangan mencampur metode hash.

## 10.3 Alur pencatatan
1. Webhook Midtrans valid dan pembayaran berubah menjadi `success`.
2. Backend membentuk payload kanonis.
3. Backend menghitung hash.
4. Backend menyimpan metadata awal pada `chain_records`.
5. Backend memanggil kontrak dari akun pencatat.
6. Backend menyimpan `tx_hash` dan status.
7. Setelah konfirmasi yang ditetapkan, status menjadi `recorded`.
8. Jika gagal, simpan error aman dan jadwalkan retry.
9. Retry memeriksa `isRecorded(paymentRef)` terlebih dahulu.

Jika hash hitung ulang sama dengan hash on-chain, data konsisten dengan payload yang sebelumnya dicatat. Hal ini **tidak** membuktikan informasi awal benar atau pembayaran benar-benar terjadi. Keberhasilan pembayaran tetap ditentukan oleh verifikasi gateway di backend.

# 11. Integrasi Eksternal

## 11.1 Midtrans Sandbox
Konfigurasi: Server Key Sandbox (backend only), Client Key Sandbox bila dibutuhkan frontend, environment sandbox, Notification URL ke backend, dan order ID unik per percobaan.

Keamanan:
- Server Key tidak boleh dikirim ke browser.
- Jangan commit kredensial.
- Validasi signature webhook.
- Cocokkan nominal dan order ID.
- Uji status sukses, gagal, pending, dan expired.
- Jangan gunakan kredensial produksi.

## 11.2 Ethereum Sepolia
Konfigurasi: Chain ID Sepolia, RPC URL, contract address, ABI, private key akun pencatat, dan jumlah konfirmasi yang dianggap cukup untuk demo. Private key hanya berada di backend environment. Frontend tidak memerlukan wallet pengguna pada rancangan ini.

## 11.3 Telegram Bot API
Konfigurasi: bot token, webhook URL HTTPS, secret token webhook, scheduler harian, kode linking sekali pakai, dan penyimpanan `telegram_chat_id`. Kegagalan Telegram hanya menghasilkan log notifikasi gagal.

# 12. Environment Configuration

Buat `.env.example` tanpa nilai secret. Nama variabel dapat disesuaikan dengan framework.

```dotenv
APP_NAME=KosLedger
APP_ENV=local
APP_DEBUG=true
APP_URL=http://localhost

DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=kosledger
DB_USERNAME=root
DB_PASSWORD=

MIDTRANS_IS_PRODUCTION=false
MIDTRANS_SERVER_KEY=
MIDTRANS_CLIENT_KEY=
MIDTRANS_MERCHANT_ID=

ETHEREUM_CHAIN_ID=11155111
ETHEREUM_RPC_URL=
ETHEREUM_CONTRACT_ADDRESS=
ETHEREUM_SIGNER_PRIVATE_KEY=

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=

QUEUE_CONNECTION=database
```

Aturan: `.env` masuk `.gitignore`; `.env.example` hanya placeholder; jangan mencetak secret ke log; jangan simpan private key/token di frontend; gunakan sandbox/testnet; rotasi secret jika pernah ter-commit.

# 13. Keamanan dan Privasi
1. Password harus di-hash.
2. Backend melakukan autentikasi dan otorisasi pada setiap endpoint privat.
3. Terapkan validasi input dan mass-assignment protection.
4. Terapkan rate limit pada login dan endpoint sensitif.
5. Proteksi CSRF bila menggunakan session-cookie web.
6. Gunakan HTTPS pada deployment/demo publik.
7. Batasi CORS ke origin frontend yang benar.
8. Verifikasi signature webhook Midtrans.
9. Terapkan idempotensi dan unique constraint.
10. Jangan mengirim secret dalam respons API atau log.
11. Jangan menyimpan data pribadi pada blockchain.
12. Gunakan data dummy.
13. Batasi data yang ditampilkan kepada Anggota dan Pemilik.
14. Catat aktivitas penting tanpa password, token, private key, atau PII yang tidak diperlukan.
15. Validasi secret token pada Telegram webhook.

# 14. Error Handling dan Logging
- Semua error API memakai struktur JSON konsisten.
- `401`: belum login/sesi tidak valid.
- `403`: role tidak berwenang.
- `404`: resource tidak ditemukan atau tidak boleh diungkap.
- `409`: konflik status, duplikasi, atau tagihan sudah lunas.
- `422`: validasi input gagal.
- `500`: kesalahan internal; detail sensitif hanya pada server log.
- Log integrasi mencatat correlation ID, resource ID internal, waktu, dan kode error aman.
- Jangan menyimpan secret atau PII yang tidak diperlukan pada log.
- Sediakan status operasional untuk webhook, blockchain retry, dan Telegram delivery.

# 15. Acceptance Criteria

## 15.1 Autentikasi dan akses
- Pengguna dapat login dan logout.
- Pengguna tanpa sesi tidak dapat membuka endpoint privat.
- Keempat role diarahkan ke dashboard sesuai role.
- Akses lintas role ditolak di backend.
- Anggota tidak dapat membaca tagihan anggota lain dengan mengganti ID.
- Pemilik tidak dapat membuat/mengubah transaksi.
- Admin tidak dapat mencatat transaksi keuangan.
- Bendahara tidak dapat mengubah kamar/penghuni.

## 15.2 Data dan keuangan
- Admin dapat mengelola kamar dan penghuni.
- Nomor kamar duplikat ditolak.
- Kamar penuh tidak menerima penempatan baru.
- Penghuni nonaktif tetap memiliki histori.
- Bendahara dapat mencatat pemasukan/pengeluaran.
- Saldo sama dengan total pemasukan dikurangi total pengeluaran.
- Tagihan memiliki periode, nominal, rincian, dan jatuh tempo.
- Anggota hanya melihat tagihan sendiri.

## 15.3 Pembayaran
- Checkout menghasilkan order ID unik.
- Nominal checkout diambil dari database.
- Simulasi sukses mengubah tagihan menjadi lunas setelah webhook valid.
- Simulasi gagal/expired tidak melunasi tagihan.
- Signature salah ditolak.
- Nominal/order ID tidak sesuai ditolak.
- Webhook duplikat tidak membuat pembayaran ganda.
- Webhook terlambat tidak menurunkan status final.
- Pembayaran manual dan gateway tidak melunasi tagihan yang sama dua kali.

## 15.4 Blockchain
- Hanya pembayaran sukses diajukan ke kontrak.
- Hanya signer resmi dapat menulis.
- Referensi pembayaran duplikat ditolak.
- Minimal satu transaksi tercatat di Sepolia.
- Transaction hash dapat diperiksa di explorer.
- Hash hitung ulang cocok untuk data yang tidak berubah.
- Perubahan payload uji terdeteksi sebagai mismatch.
- Kegagalan blockchain tidak mengubah status pembayaran.

## 15.5 Telegram
- Anggota dapat menautkan akun dengan kode sekali pakai.
- Pengingat hanya dikirim untuk tagihan belum lunas.
- Anggota yang sudah lunas tidak menerima reminder.
- Notifikasi pembayaran dikirim setelah status valid.
- Kegagalan pengiriman dicatat dan tidak membatalkan pembayaran.

# 16. Test Plan Minimum

| ID | Skenario | Hasil yang diharapkan |
|---|---|---|
| FN-01 | Login benar | Masuk ke dashboard sesuai role |
| FN-02 | Login salah | Ditolak dengan pesan umum |
| FN-03 | Akses halaman tanpa login | Ditolak/diarahkan login |
| FN-04 | Logout | Sesi berakhir |
| FN-05 | Password tersimpan | Berbentuk hash |
| AC-06 | Anggota mengganti ID tagihan | Akses ditolak |
| AC-09 | Pemilik mencoba mengubah transaksi | Akses ditolak |
| FN-08 | Nomor kamar duplikat | Ditolak |
| FN-09 | Hitung saldo | Sama dengan perhitungan manual |
| PG-02 | Pembayaran sandbox sukses | Tagihan lunas setelah webhook valid |
| PG-03 | Pembayaran gagal | Tagihan tetap belum lunas |
| PG-04 | Pembayaran expired | Tagihan tidak lunas |
| PG-05 | Webhook duplikat | Tidak ada pembayaran ganda |
| PG-06 | Signature salah | Status tidak berubah |
| PG-07 | Nominal/order ID salah | Status tidak berubah |
| PG-09 | Blockchain gagal | Pembayaran tetap sukses; chain status tertunda/gagal |
| PG-10 | Manipulasi nominal browser | Backend memakai nominal database |
| PG-11 | Pembayaran manual | Tercatat atas nama Bendahara |
| PG-12 | Manual dan gateway pada tagihan sama | Pembayaran kedua ditolak/ditinjau |
| SC-02 | Signer tidak sah | Kontrak menolak |
| SC-03 | paymentRef duplikat | Kontrak menolak |
| SC-06 | Hash data tidak berubah | Cocok dengan on-chain |
| SC-07 | Payload diubah | Mismatch terdeteksi |
| SC-08 | Pemeriksaan privasi on-chain | Tidak ada PII |
| SC-10 | Retry pencatatan | Tidak membuat catatan ganda |
| TG-02 | Anggota sudah lunas | Tidak mendapat reminder |
| TG-04 | Telegram gagal | Pembayaran tetap sukses |

# 17. Urutan Implementasi
1. **Fondasi:** repository, Laravel, database, `.env`, migration, seed data.
2. **Auth dan RBAC:** login, logout, role middleware/policy, uji akses API langsung.
3. **Admin:** CRUD kamar, penghuni, occupancy, validasi kapasitas.
4. **Keuangan:** cash transactions, kategori, perhitungan saldo.
5. **Tagihan:** bills, bill items, daftar dan detail.
6. **Anggota:** dashboard, tagihan sendiri, riwayat.
7. **Pembayaran manual:** pencatatan Bendahara dan pencegahan pembayaran ganda.
8. **Midtrans:** checkout, webhook, signature validation, idempotensi.
9. **Laporan Pemilik:** agregasi read-only.
10. **Blockchain:** kontrak lokal, test, deploy Sepolia, pencatatan hash, retry, verifikasi.
11. **Telegram:** linking, webhook, reminder scheduler, notifikasi.
12. **QA dan deployment:** test end-to-end, pemeriksaan keamanan, dokumentasi, demo.

**Jangan mulai integrasi blockchain sebelum status pembayaran dan webhook benar.** Blockchain bergantung pada hasil verifikasi backend; menjadikannya fondasi lebih awal menambah kompleksitas sebelum alur transaksi stabil.

# 18. Definition of Done
Sebuah fitur dianggap selesai apabila:
- Kebutuhan dan role aksesnya jelas.
- Endpoint/backend validation selesai.
- Frontend terhubung ke API nyata, bukan hanya data statis.
- Loading, empty, success, dan error state tersedia.
- Test case positif dan negatif dijalankan.
- Tidak ada secret pada repository.
- Perubahan database memakai migration.
- Kode masuk Git dengan commit yang dapat ditelusuri.
- Dokumentasi endpoint/konfigurasi diperbarui.
- Tidak ada bug kritis terbuka pada fitur tersebut.

# 19. Keputusan yang Harus Dikunci Tim Sebelum Coding
Proposal belum menetapkan semua keputusan implementasi. Tim harus menyepakati:
1. **Frontend final:** Blade atau Vue + Inertia. Pilih satu.
2. **Database final:** MySQL atau PostgreSQL.
3. **Autentikasi:** session-cookie atau token. Untuk satu aplikasi Laravel monolitik, session-cookie biasanya lebih sederhana.
4. **Hash algorithm:** SHA-256 atau keccak256; pilih satu dan dokumentasikan.
5. **Canonical serialization:** urutan field, encoding, timestamp, dan versi skema.
6. **Aturan tagihan:** biaya bersama dibagi rata, berdasarkan kamar, atau input manual per penghuni.
7. **Periode tagihan:** satu tagihan per penghuni per bulan? Bagaimana jika pindah kamar di tengah periode?
8. **Perubahan tagihan:** apakah tagihan yang diterbitkan boleh diedit dan bagaimana audit trail-nya?
9. **Pembayaran manual:** bagaimana konflik dengan checkout yang sedang pending ditangani?
10. **Privasi Pemilik:** boleh melihat rincian transaksi individual atau hanya agregat?
11. **Blockchain finality:** berapa konfirmasi Sepolia sebelum status `recorded`?
12. **Telegram:** kapan reminder dikirim (misalnya H-3/H-1) dan zona waktu scheduler?
13. **Akun staf:** bagaimana akun Admin, Bendahara, dan Pemilik dibuat? Jangan membuka registrasi publik untuk role istimewa.
14. **Multi-kos:** apakah prototipe hanya menangani satu properti? Proposal belum menetapkan isolasi multi-tenant.

---

# Lampiran A — Checklist API
- [ ] Auth login/logout/me
- [ ] Middleware autentikasi
- [ ] Middleware/policy role
- [ ] Users CRUD/deactivate
- [ ] Rooms CRUD
- [ ] Occupancies create/list
- [ ] Transactions CRUD
- [ ] Bills create/list/detail
- [ ] Bill items
- [ ] Manual payment
- [ ] Midtrans checkout
- [ ] Midtrans webhook
- [ ] Webhook idempotency
- [ ] Payment history
- [ ] Chain record list/detail
- [ ] Chain verify/retry
- [ ] Dashboard per role
- [ ] Reports
- [ ] Telegram linking
- [ ] Telegram webhook
- [ ] Telegram reminders
- [ ] Notification logs

# Lampiran B — Prinsip yang Tidak Boleh Dilanggar
1. Frontend bukan sumber kebenaran status pembayaran.
2. Nominal checkout selalu berasal dari database/backend.
3. Webhook harus diverifikasi sebelum mengubah status.
4. Webhook duplikat tidak boleh menghasilkan efek ganda.
5. Pembayaran dan blockchain memiliki status terpisah.
6. Blockchain hanya mencatat hash dan referensi pseudonim.
7. Tidak ada data pribadi atau secret di blockchain.
8. Telegram bukan sumber status pembayaran.
9. Hak akses diperiksa di backend untuk setiap endpoint.
10. Prototipe hanya menggunakan data dummy, sandbox, dan testnet.
