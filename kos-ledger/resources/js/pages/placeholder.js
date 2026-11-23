import { MENUS } from '../core/roles.js';
import { esc } from '../utils/format.js';
import { ms, pageHead } from '../components/ui.js';

// Dipakai untuk halaman yang belum dibuat.
export default function placeholder({ user, key }) {
  const item = (MENUS[user.role] || []).find((m) => m[0] === key);
  const title = item ? item[2] : key === 'notifikasi' ? 'Notifikasi' : 'Halaman';
  return {
    html: `
      ${pageHead({ title: esc(title), sub: 'Halaman ini akan dibuat di bagian berikutnya.' })}
      <div class="card">
        <div class="note">${ms('construction')}<span>Layout sudah jalan. Isi halaman <b>${esc(title)}</b> menyusul.</span></div>
      </div>`,
  };
}
