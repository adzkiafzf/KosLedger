import axios from 'axios';
import { getToken, clearSession } from '../core/session.js';
import { toast } from '../components/ui.js';

// Semua panggilan ke Laravel lewat instance ini: base URL /api + token Sanctum otomatis.
export const api = axios.create({
  baseURL: '/api',
  headers: { Accept: 'application/json' }, // supaya Laravel membalas JSON (bukan redirect HTML)
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const url = err.config?.url || '';
    const publik = url.includes('/auth/login') || url.includes('/auth/logout');
    // Token kedaluwarsa / dicabut: bersihkan sesi dan kembali ke login.
    if (err.response?.status === 401 && !publik) {
      clearSession();
      toast('Sesi berakhir, silakan masuk lagi.', 'warn');
      if (location.hash !== '#login') location.hash = 'login';
    }
    return Promise.reject(err);
  },
);

// Ubah error axios jadi satu kalimat yang aman ditampilkan ke user.
export function apiError(err) {
  const res = err?.response;
  if (!res) return 'Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.';
  const d = res.data || {};
  if (res.status === 422 && d.errors) return Object.values(d.errors).flat()[0] || d.message || 'Data belum valid.';
  if (res.status === 403) return d.message || 'Anda tidak punya akses untuk tindakan ini.';
  if (res.status === 404) return d.message || 'Data tidak ditemukan.';
  if (res.status >= 500) return 'Terjadi kesalahan di server. Coba lagi nanti.';
  return d.message || 'Terjadi kesalahan.';
}

// Error per kolom dari Laravel (422): { username: ['...'], password: ['...'] }
export const fieldErrors = (err) => (err?.response?.status === 422 ? err.response.data?.errors || {} : {});
