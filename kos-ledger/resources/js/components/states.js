import { ms } from './ui.js';
import { esc } from '../utils/format.js';

// Spinner bawaan CSS berwarna putih (untuk tombol), jadi di kartu putih diberi warna hijau.
export const loadingView = (text = 'Memuat data…') => `
  <div class="card" style="display:flex;align-items:center;gap:12px;color:var(--muted)">
    <span class="spin" style="border-color:rgba(23,77,59,.2);border-top-color:var(--primary);margin:0"></span>${esc(text)}
  </div>`;

export const errorView = (message) => `
  <div class="note err2">${ms('error')}<span>${esc(message || 'Terjadi kesalahan.')}</span></div>`;

// Tampilan kosong: emptyView('Belum ada tagihan', 'Tagihan akan muncul di sini.', 'receipt_long')
export const emptyView = (title = 'Belum ada data', text = '', icon = 'inbox') => `
  <div class="ph">
    <span class="ms" style="font-size:40px;color:var(--sage)">${esc(icon)}</span>
    <h3 style="color:var(--primary-d);margin:10px 0 4px;font-size:16px">${esc(title)}</h3>
    ${text ? `<p style="margin:0">${esc(text)}</p>` : ''}
  </div>`;