import { esc } from '../utils/format.js';

const COLORS = ['#174d3b', '#4b6453', '#96d6b9', '#cde4d4', '#e1ede4'];

// Grafik batang berpasangan (mis. pemasukan vs pengeluaran per bulan).
// barChart(['Sep','Okt','Nov'], [11, 12, 13], [3, 3, 4]) — max otomatis bila tidak diisi.
export function barChart(labels, a, b, max, h = 200) {
  if (!labels.length) return '';
  const top = max || Math.max(...a, ...b, 1);
  const W = 560;
  const gap = (W - 16) / labels.length;
  let s = `<svg viewBox="0 0 ${W} ${h + 34}" role="img" aria-label="Grafik arus kas">`;
  [0, 0.5, 1].forEach((t) => {
    const y = h - t * (h - 10);
    s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="#dbe6de" stroke-dasharray="4 4"/>`;
  });
  labels.forEach((l, i) => {
    const x = 8 + i * gap + gap / 2 - 22;
    const ha = (a[i] / top) * (h - 10);
    const hb = (b[i] / top) * (h - 10);
    const last = i === labels.length - 1;
    s += `<rect x="${x}" y="${h - ha}" width="26" height="${ha}" rx="3" fill="${last ? '#003526' : '#174d3b'}"/>`;
    s += `<rect x="${x + 28}" y="${h - hb}" width="16" height="${hb}" rx="3" fill="${last ? '#4b6453' : '#dfe9e2'}"/>`;
    s += `<text x="${x + 22}" y="${h + 22}" text-anchor="middle" font-size="12" fill="${last ? '#003526' : '#404944'}" font-weight="${last ? 700 : 400}" font-family="Plus Jakarta Sans,sans-serif">${esc(l)}</text>`;
  });
  return `${s}</svg>`;
}

// Donat + teks tengah. Letakkan di dalam <div class="donutwrap">.
export function donut(vals, center = '') {
  const tot = vals.reduce((x, y) => x + y, 0);
  const R = 42;
  const C = 2 * Math.PI * R;
  let s = `<svg viewBox="0 0 120 120" role="img" aria-label="Grafik distribusi"><g transform="rotate(-90 60 60)">`;
  if (!tot) {
    s += `<circle cx="60" cy="60" r="${R}" fill="none" stroke="#dfebe3" stroke-width="16"/>`;
  } else {
    let off = 0;
    vals.forEach((v, i) => {
      if (v <= 0) return;
      const len = (v / tot) * C;
      s += `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${COLORS[i % COLORS.length]}" stroke-width="16" stroke-dasharray="${Math.max(len - 1.5, 0.01)} ${C - len + 1.5}" stroke-dashoffset="${-off}"/>`;
      off += len;
    });
  }
  return `<div class="dn">${s}</g></svg><div class="c">${center}</div></div>`;
}

// Keterangan warna di samping donat: legend([['Listrik', 'Rp 1.450.000 (44,6%)'], ...])
export const legend = (items) => `
  <div class="legend">${items
    .map(
      ([name, value], i) => `
    <div class="li" style="grid-template-columns:auto 1fr auto">
      <i style="background:${COLORS[i % COLORS.length]}"></i><span>${esc(name)}</span><b style="font-weight:500">${esc(value)}</b>
    </div>`,
    )
    .join('')}</div>`;

// Cincin persen kecil (0 sampai 1)
export const ring = (p) => {
  const R = 26;
  const C = 2 * Math.PI * R;
  const v = Math.min(Math.max(Number(p) || 0, 0), 1);
  return `<svg width="64" height="64" viewBox="0 0 64 64" role="img" aria-label="${Math.round(v * 100)} persen">
    <circle cx="32" cy="32" r="${R}" fill="none" stroke="#dfebe3" stroke-width="7"/>
    <circle cx="32" cy="32" r="${R}" fill="none" stroke="#174d3b" stroke-width="7" stroke-linecap="round" stroke-dasharray="${C * v} ${C}" transform="rotate(-90 32 32)"/>
  </svg>`;
};