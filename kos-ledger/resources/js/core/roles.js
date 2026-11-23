// Nama role mengikuti API Laravel: admin, bendahara, pemilik, anggota.
export const ROLE_LABEL = {
  admin: 'Admin',
  bendahara: 'Bendahara',
  pemilik: 'Pemilik',
  anggota: 'Penghuni', // di layar disebut "Penghuni"
};

// Halaman awal tiap role
export const HOME = { admin: 'admin', bendahara: 'bendahara', pemilik: 'pemilik', anggota: 'anggota' };

// Menu sidebar: [kunci halaman, ikon, label]
export const MENUS = {
  admin: [
    ['admin', 'dashboard', 'Dashboard'],
    ['admin-users', 'group', 'Manajemen Pengguna'],
    ['admin-kamar', 'meeting_room', 'Manajemen Kamar'],
    ['admin-penghuni', 'badge', 'Manajemen Penghuni'],
    ['admin-laporan', 'bar_chart', 'Laporan Hunian'],
    ['notifikasi', 'notifications', 'Notifikasi'],
    ['admin-profil', 'manage_accounts', 'Profil'],
  ],
  bendahara: [
    ['bendahara', '', 'Dashboard'],
    ['bendahara-kamar', '', 'Manajemen Kamar'],
    ['bendahara-penghuni', '', 'Manajemen Penghuni'],
    ['bendahara-tagihan', '', 'Manajemen Tagihan'],
    ['bendahara-pembayaran', '', 'Manajemen Pembayaran'],
    ['bendahara-pengeluaran', '', 'Manajemen Pengeluaran'],
    ['bendahara-laporan', '', 'Laporan Keuangan'],
    ['notifikasi', 'notifications', 'Notifikasi'],
    ['bendahara-profil', '', 'Profil'],
  ],
  anggota: [
    ['anggota', 'dashboard', 'Dashboard Penghuni'],
    ['anggota-kamar', 'meeting_room', 'Kamar Saya'],
    ['anggota-tagihan', 'receipt_long', 'Tagihan Saya'],
    ['anggota-pembayaran', 'payments', 'Pembayaran'],
    ['anggota-riwayat', 'history', 'Riwayat Pembayaran'],
    ['anggota-layanan', 'support_agent', 'Layanan & Kendala'],
    ['anggota-profil', 'person', 'Profil Saya'],
  ],
  pemilik: [
    ['pemilik', 'dashboard', 'Dashboard'],
    ['pemilik-kamar', 'meeting_room', 'Monitoring Kamar'],
    ['pemilik-penghuni', 'groups', 'Monitoring Penghuni'],
    ['pemilik-tagihan', 'receipt_long', 'Monitoring Tagihan'],
    ['pemilik-pembayaran', 'payments', 'Monitoring Pembayaran'],
    ['pemilik-pengeluaran', 'trending_down', 'Monitoring Pengeluaran'],
    ['pemilik-laporan', 'bar_chart', 'Laporan Keuangan'],
    ['pemilik-riwayat', 'history', 'Riwayat Transaksi'],
    ['pemilik-profil', 'manage_accounts', 'Profil'],
  ],
};

// Halaman yang boleh dibuka semua role yang sudah login
const COMMON = ['notifikasi'];

// Kunci halaman diawali nama role-nya: "bendahara-tagihan" hanya untuk bendahara.
export const canOpen = (role, key) => COMMON.includes(key) || key.split('-')[0] === role;
