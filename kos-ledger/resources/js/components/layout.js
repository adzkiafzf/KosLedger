import { ROLE_LABEL, MENUS } from '../core/roles.js';
import { clearSession } from '../core/session.js';
import { logout } from '../api/auth.js';
import { ms, avatar } from './ui.js';
import { esc, initials, periodeSekarang } from '../utils/format.js';

/* ===== Sidebar ===== */
const SIDE_FOOT = {
  anggota: `<div class="safe"><b>${ms('verified_user')}Pembayaran Aman</b>Sistem otomatisasi tagihan terverifikasi instan.</div>`,
  pemilik: `<div class="note" style="padding:10px 14px">${ms('visibility')}Mode Pantau Pemilik (Read-Only)</div>`,
};

export function sidebar(user, key) {
  const menu = (MENUS[user.role] || [])
    .map(([k, icon, text]) => `<a data-go="${k}" class="${k === key ? 'on' : ''}" tabindex="0">${icon ? ms(icon) : ''}${text}</a>`)
    .join('');

  return `<aside class="side" id="side">
    <div class="logo">
      <span class="lg">${ms('apartment')}</span>
      <div><b>KosLedger</b><span class="badge" style="border-radius:6px;margin-top:2px">Portal ${ROLE_LABEL[user.role]}</span></div>
    </div>
    <div id="side-extra"></div>
    <nav class="menu" aria-label="Menu utama">${menu}</nav>
    <div class="sfoot">${SIDE_FOOT[user.role] || ''}</div>
  </aside>`;
}

/* ===== Navbar ===== */
const crumb = (html) => `<span class="crumb" style="margin:0">${html}</span>`;
const strong = (t) => `<b style="font-weight:500;color:var(--text)">${t}</b>`;

// Isi navbar yang berbeda tiap role: kiri, placeholder pencarian, dan tombol tambahan
const TOPBAR = {
  admin: () => ({
    left: crumb(`${ms('apartment')}KosLedger › ${strong('Panel Admin')}`),
    placeholder: 'Cari pengguna, kamar...',
    extra: '',
  }),
  bendahara: (u) => ({
    left: `<div class="hello"><h2>Halo, ${esc(u.nickname || u.name)} 👋</h2><small>Bendahara Kos • Periode ${periodeSekarang()}</small></div>`,
    placeholder: 'Cari transaksi, kamar, penghuni...',
    extra: `<button class="btn p" data-go="bendahara-pembayaran">${ms('add')}Catat Transaksi</button>`,
  }),
  anggota: () => ({
    left: crumb(`${ms('apartment')}KosLedger › ${strong('Portal Penghuni')}`),
    placeholder: 'Cari tagihan, tiket kendala...',
    extra: `<button class="btn s" data-go="anggota-layanan" style="border-radius:999px">${ms('headset_mic')}Bantuan & CS</button>`,
  }),
  pemilik: () => ({
    left: crumb(`${ms('apartment')}KosLedger › ${strong('Portal Pemilik')}`),
    placeholder: 'Cari laporan, transaksi...',
    extra: `<span class="pill ok" style="padding:6px 12px">${ms('lock_open')}Akses Pemantauan</span>`,
  }),
};

export function topbar(user) {
  const t = (TOPBAR[user.role] || TOPBAR.admin)(user);
  return `<div class="top">
    <button class="menubtn" id="menubtn" aria-label="Buka menu">${ms('menu')}</button>
    ${t.left}
    <label class="search">${ms('search')}<input placeholder="${t.placeholder}" aria-label="Cari"></label>
    <span class="sp"></span>
    ${t.extra}
    <button class="bell" data-go="notifikasi" aria-label="Notifikasi">${ms('notifications')}</button>
    <div class="user" data-act="usermenu" tabindex="0" role="button" aria-label="Menu akun">
      ${avatar(esc(initials(user.name)))}
      <div><b>${esc(user.name)}</b><small>${ROLE_LABEL[user.role]}</small></div>
    </div>
  </div>`;
}

/* ===== Kerangka halaman: sidebar + navbar + area konten (#view) ===== */
export const shell = (user, key) => `
  <div class="app">
    ${sidebar(user, key)}
    <div class="nav-scrim" id="navscrim"></div>
    <main class="main" id="main">
      ${topbar(user)}
      <div id="view"></div>
    </main>
  </div>`;

export function setActiveMenu(key) {
  document.querySelectorAll('.menu a').forEach((a) => a.classList.toggle('on', a.dataset.go === key));
}

/* ===== Popup menu akun ===== */
export const closePop = () => document.getElementById('pop')?.remove();

function userPop(user) {
  closePop();
  const p = document.createElement('div');
  p.id = 'pop';
  p.className = 'pop sm2';
  p.innerHTML = `
    <div class="ph2" style="display:block"><b>${esc(user.name)}</b><br><small style="color:var(--muted)">${ROLE_LABEL[user.role]}</small></div>
    <a class="pm" data-go="${user.role}-profil">${ms('person')}Profil</a>
    <a class="pm" data-go="notifikasi">${ms('notifications')}Notifikasi</a>
    <a class="pm" data-act="logout" style="color:var(--err)">${ms('logout')}Keluar</a>`;
  document.body.appendChild(p);
}

/* ===== Event global (dipasang sekali) ===== */
let bound = false;
export function bindLayoutEvents(getUser) {
  if (bound) return;
  bound = true;

  document.addEventListener('click', (e) => {
    // Pindah halaman: <a data-go="bendahara-tagihan">
    const go = e.target.closest('[data-go]');
    if (go) {
      e.preventDefault();
      closePop();
      const to = go.dataset.go;
      if (location.hash === '#' + to) window.dispatchEvent(new Event('hashchange'));
      else location.hash = to;
      return;
    }
    if (e.target.closest('#menubtn')) return void document.body.classList.add('nav');
    if (e.target.closest('#navscrim')) return void document.body.classList.remove('nav');

    if (e.target.closest('[data-act="usermenu"]')) {
      const user = getUser();
      if (document.getElementById('pop')) closePop();
      else if (user) userPop(user);
      return;
    }
    if (e.target.closest('[data-act="logout"]')) {
      closePop();
      logout().finally(() => {
        clearSession();
        location.hash = 'login';
      });
      return;
    }
    if (!e.target.closest('#pop')) closePop();
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closePop();
    if (e.key === 'Enter' && e.target.matches('.menu a')) e.target.click();
  });
}

