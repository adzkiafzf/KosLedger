import { ms } from './ui.js';
import { emptyView } from './states.js';
import { esc } from '../utils/format.js';

// Catatan: label, value, foot, dan isi sel tabel berupa HTML.
// Data dari API WAJIB dibungkus esc() sebelum dimasukkan ke sini.

// Kartu angka. o.cls: 'red' | 'dark', o.sm: angka lebih kecil
export const statCard = (label, value, foot = '', icon = '', o = {}) => `
  <div class="card stat ${o.cls || ''}">
    <span class="l">${label}</span>
    <span class="v ${o.sm ? 'sm' : ''}">${value}</span>
    <span class="f">${foot}</span>
    ${icon ? `<span class="ic">${ms(icon)}</span>` : ''}
  </div>`;

// Tabel. Kolom berawalan ">" rata kanan.
// rows: array sel, atau { cells: [...], cls: 'hl' } untuk menandai baris (merah muda).
// Bila rows kosong, otomatis tampil empty state.
export function dataTable(cols, rows, o = {}) {
  if (!rows.length) return emptyView(o.emptyTitle, o.emptyText, o.emptyIcon);
  const right = cols.map((c) => c[0] === '>');
  const head = cols.map((c, i) => `<th${right[i] ? ' class="r"' : ''}>${right[i] ? c.slice(1) : c}</th>`).join('');
  const body = rows
    .map((r) => {
      const cells = Array.isArray(r) ? r : r.cells;
      const cls = Array.isArray(r) ? '' : r.cls || '';
      return `<tr${cls ? ` class="${cls}"` : ''}>${cells.map((c, i) => `<td${right[i] ? ' class="r"' : ''}>${c}</td>`).join('')}</tr>`;
    })
    .join('');
  return `<div class="tw"><table${o.id ? ` id="${o.id}"` : ''} style="min-width:${o.min || 720}px"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

// Kolom cari yang menyaring baris tabel ber-id tableId (tanpa panggilan API)
export const searchField = (placeholder, tableId) =>
  `<label class="field">${ms('search')}<input placeholder="${esc(placeholder)}" data-filter="${esc(tableId)}" aria-label="${esc(placeholder)}"></label>`;

// Dipasang otomatis sekali saat file ini dimuat
document.addEventListener('input', (e) => {
  const id = e.target.dataset?.filter;
  if (!id) return;
  const q = e.target.value.toLowerCase();
  document.querySelectorAll(`#${id} tbody tr`).forEach((tr) => {
    tr.hidden = !tr.textContent.toLowerCase().includes(q);
  });
});