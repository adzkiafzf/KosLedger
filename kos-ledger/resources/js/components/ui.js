import { esc } from '../utils/format.js';

export const ms = (name) => `<span class="ms">${name}</span>`;
export const pill = (text, cls = '') => `<span class="pill ${cls}">${text}</span>`;
export const avatar = (text, bg) =>
  `<span class="avatar" style="${bg ? `background:${bg};color:#fff` : ''}">${text}</span>`;

// Kepala halaman: breadcrumb / eyebrow, judul, subjudul, dan tombol aksi
export const pageHead = (o) => `
  <div class="hd">
    <div>
      ${o.crumb ? `<div class="crumb">${o.crumb}</div>` : ''}
      ${o.eyebrow ? `<span class="eyebrow ${o.txt ? 'txt' : ''}">${o.dot ? '<i></i>' : ''}${o.eyebrow}</span>` : ''}
      <h1>${o.title}</h1>
      ${o.sub ? `<p>${o.sub}</p>` : ''}
    </div>
    <div class="acts">${o.acts || ''}</div>
  </div>`;

// Toast: toast('Tersimpan', 'ok') — tipe: ok | err | warn | info
let toastTimer;
export function toast(message, type = 'info') {
  const el = document.getElementById('toast');
  if (!el) return;
  const icon = { ok: 'check_circle', err: 'error', warn: 'warning', info: 'info' }[type] || 'info';
  el.className = `toast on ${type}`;
  el.innerHTML = `${ms(icon)}<span>${esc(message)}</span>`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('on'), 3200);
}

// Modal dialog global
export function closeModal() {
  const m = document.getElementById('modal');
  if (m) m.remove();
  document.body.style.overflow = '';
}

export function modal(html, o = {}) {
  closeModal();
  const m = document.createElement('div');
  m.id = 'modal';
  m.className = 'mscrim';
  m.innerHTML = `<div class="mbox ${o.wide ? 'wide' : ''}" role="dialog" aria-modal="true">${html}</div>`;
  m.addEventListener('click', (e) => {
    if (e.target === m || e.target.closest('[data-act="close"]')) {
      closeModal();
    }
  });
  document.body.appendChild(m);
  document.body.style.overflow = 'hidden';
  const f = m.querySelector('input,textarea,select');
  if (f && !o.nofocus) setTimeout(() => f.focus(), 50);
}

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

export const mhead = (title, sub = '', icon = '') => `
  <header class="mh">
    <div style="display:flex;gap:14px;align-items:center;min-width:0">
      ${icon ? `<span class="stat"><span class="ic" style="position:static;width:44px;height:44px">${ms(icon)}</span></span>` : ''}
      <div style="min-width:0">
        <h2>${esc(title)}</h2>
        ${sub ? `<p>${esc(sub)}</p>` : ''}
      </div>
    </div>
    <button class="x" data-act="close" aria-label="Tutup">${ms('close')}</button>
  </header>`;

export const kvs = (rows) =>
  `<div class="kvs">${rows.map(([label, val]) => `<div class="kv"><span>${esc(label)}</span><b>${val}</b></div>`).join('')}</div>`;
