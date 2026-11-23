import { esc } from '../utils/format.js';
import { ms } from './ui.js';

// Kolom form: fieldHtml('f_nama', 'Nama', { req: 1, ph: '...', type: 'text|select|area|...', opts: [] })
export const fieldHtml = (id, label, o = {}) => {
  const ph = esc(o.ph || '');
  let control;
  if (o.type === 'select') {
    control = `<select class="in" id="${id}">${o.opts.map((x) => `<option>${esc(x)}</option>`).join('')}</select>`;
  } else if (o.type === 'area') {
    control = `<textarea class="in" id="${id}" rows="3" placeholder="${ph}"></textarea>`;
  } else {
    control = `<input class="in" id="${id}" type="${o.type || 'text'}" placeholder="${ph}" ${o.max ? `maxlength="${o.max}"` : ''} autocomplete="${o.auto || 'off'}">`;
  }
  return `<label class="mf">${label}${o.req ? ' <i>*</i>' : ''}${control}<span class="fe" id="e_${id}"></span></label>`;
};

// Kolom kata sandi dengan tombol "mata"
export const passwordField = (id, label, o = {}) => `
  <label class="mf">${label}${o.req === false ? '' : ' <i>*</i>'}
    <span class="pwrap">
      <input class="in" id="${id}" type="password" placeholder="${esc(o.ph || '')}" autocomplete="${o.auto || 'current-password'}">
      <button type="button" class="eye" data-eye="${id}" aria-label="Tampilkan kata sandi">${ms('visibility')}</button>
    </span>
    <span class="fe" id="e_${id}"></span>
  </label>`;

// Pasang perilaku tombol mata (panggil sekali setelah HTML tampil)
export function bindPasswordToggles(root = document) {
  root.querySelectorAll('[data-eye]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.eye);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      btn.innerHTML = ms(show ? 'visibility_off' : 'visibility');
    });
  });
}

export function setFieldError(id, message) {
  const er = document.getElementById('e_' + id);
  const el = document.getElementById(id);
  if (er) er.textContent = message || '';
  if (el) el.classList.toggle('bad', Boolean(message));
}

// validate({ id_kolom: aturan }) — aturan: 1 (wajib) | 'email' | 'hp' | 'num' | 'pw'
// Mengisi pesan di <span id="e_id_kolom"> dan mengembalikan true bila semua valid.
export function validate(rules) {
  let ok = true;
  let first = null;
  Object.entries(rules).forEach(([id, rule]) => {
    const el = document.getElementById(id);
    if (!el) return;
    const v = (el.value || '').trim();
    let msg = '';
    if (!v) msg = 'Wajib diisi';
    else if (rule === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(v)) msg = 'Format email belum benar';
    else if (rule === 'hp' && !/^[0-9+\-\s]{9,16}$/.test(v)) msg = 'Nomor HP belum benar';
    else if (rule === 'num' && !(parseInt(v.replace(/\D/g, ''), 10) > 0)) msg = 'Isi angka lebih dari 0';
    else if (rule === 'pw' && v.length < 8) msg = 'Minimal 8 karakter';
    setFieldError(id, msg);
    if (msg) {
      ok = false;
      first = first || el;
    }
  });
  first?.focus();
  return ok;
}
