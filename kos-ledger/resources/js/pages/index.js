import { getUser } from '../core/session.js';

// Daftar halaman: kunci hash -> fungsi yang memuat file halamannya.
// Halaman yang belum terdaftar di sini otomatis memakai placeholder.
export const routes = {
  login: () => import('./login.js'),
  admin: () => import('./admin/dashboard.js'),
  'admin-kamar': () => import('./admin/rooms.js'),
  'admin-users': () => import('./admin/users.js'),
  'admin-penghuni': () => import('./admin/occupants.js'),
  'admin-laporan': () => import('./admin/reports.js'),
  'admin-profil': () => import('./admin/profil.js'),
  bendahara: () => import('./bendahara/dashboard.js'),
  'bendahara-kamar': () => import('./bendahara/rooms.js'),
  'bendahara-penghuni': () => import('./bendahara/occupants.js'),
  'bendahara-tagihan': () => import('./bendahara/bills.js'),
  'bendahara-pembayaran': () => import('./bendahara/payments.js'),
  'bendahara-pengeluaran': () => import('./bendahara/expenses.js'),
  'bendahara-laporan': () => import('./bendahara/reports.js'),
  'bendahara-profil': () => import('./bendahara/profil.js'),
  'notifikasi': () => {
    const u = getUser();
    if (u?.role === 'pemilik') return import('./pemilik/notifikasi.js');
    if (u?.role === 'anggota') return import('./anggota/notifikasi.js');
    // admin dan bendahara menggunakan implementasi notifikasi yang sama
    return import('./bendahara/notifikasi.js');
  },
  pemilik: () => import('./pemilik/dashboard.js'),
  'pemilik-kamar': () => import('./pemilik/rooms.js'),
  'pemilik-penghuni': () => import('./pemilik/occupants.js'),
  'pemilik-tagihan': () => import('./pemilik/bills.js'),
  'pemilik-pembayaran': () => import('./pemilik/payments.js'),
  'pemilik-riwayat': () => import('./pemilik/payments.js'),
  'pemilik-pengeluaran': () => import('./pemilik/expenses.js'),
  'pemilik-laporan': () => import('./pemilik/reports.js'),
  'pemilik-profil': () => import('./pemilik/profil.js'),
  'pemilik-notifikasi': () => import('./pemilik/notifikasi.js'),
  'bendahara-preview': () => import('./preview.js'), // SEMENTARA, hapus nanti
  anggota: () => import('./anggota/dashboard.js'),
  'anggota-kamar': () => import('./anggota/rooms.js'),
  'anggota-tagihan': () => import('./anggota/bills.js'),
  'anggota-pembayaran': () => import('./anggota/pembayaran.js'),
  'anggota-riwayat': () => import('./anggota/payments.js'),
  'anggota-layanan': () => import('./anggota/layanan.js'),
  'anggota-profil': () => import('./anggota/profil.js'),
  'anggota-notifikasi': () => import('./anggota/notifikasi.js'),
};
