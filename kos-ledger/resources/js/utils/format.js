// Escape teks dari API sebelum dimasukkan ke innerHTML (mencegah XSS).
export const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// 1500000 -> "Rp 1.500.000"
export const rp = (n) => {
  const v = Number(n) || 0;
  return (v < 0 ? '−' : '') + 'Rp ' + Math.abs(Math.round(v)).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

// "Siti Rahma" -> "SR"
export const initials = (name = '') =>
  String(name).split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();

const BULAN = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

// "November 2026" (bulan berjalan)
export const periodeSekarang = () => `${BULAN[new Date().getMonth()]} ${new Date().getFullYear()}`;

// "2026-11-10" atau "2026-11-10T00:00:00Z" -> "10 Nov 2026" (dibaca per teks, tidak terpengaruh zona waktu)
export const tgl = (v) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(v ?? ''));
  return m ? `${Number(m[3])} ${BULAN[Number(m[2]) - 1].slice(0, 3)} ${m[1]}` : '–';
};

// "2026-11" -> "November 2026"
export const periodeLabel = (p) => {
  const m = /^(\d{4})-(\d{2})/.exec(String(p ?? ''));
  return m ? `${BULAN[Number(m[2]) - 1]} ${m[1]}` : '–';
};

// 9250000 -> "9,25 Jt", 1500 -> "1,5 Rb" (untuk ruang sempit, mis. tengah donat)
export const rpRingkas = (n) => {
  const v = Number(n) || 0;
  const a = Math.abs(v);
  const f = (x, u) => `${v < 0 ? '−' : ''}${String(Math.round(x * 100) / 100).replace('.', ',')} ${u}`;
  if (a >= 1e9) return f(a / 1e9, 'M');
  if (a >= 1e6) return f(a / 1e6, 'Jt');
  if (a >= 1e3) return f(a / 1e3, 'Rb');
  return f(a, '').trim();
};

const pad2 = (x) => String(x).padStart(2, '0');

// 6 bulan terakhir (termasuk bulan ini), urut dari yang terlama:
// [{ label: 'Jun', start: '2026-06-01', end: '2026-06-30' }, ...]
export const rentangBulan = (n = 6, now = new Date()) => {
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const y = d.getFullYear();
    const m = d.getMonth();
    const lastDay = new Date(y, m + 1, 0).getDate();
    out.push({ label: BULAN[m].slice(0, 3), start: `${y}-${pad2(m + 1)}-01`, end: `${y}-${pad2(m + 1)}-${pad2(lastDay)}` });
  }
  return out;
};