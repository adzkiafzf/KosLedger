import { getUser, isLoggedIn, clearSession } from './session.js';
import { HOME, canOpen } from './roles.js';
import { shell, setActiveMenu, bindLayoutEvents, closePop } from '../components/layout.js';
import { loadingView, errorView } from '../components/states.js';
import { toast } from '../components/ui.js';
import { routes } from '../pages/index.js';
import placeholder from '../pages/placeholder.js';

let renderId = 0;

// Pindah halaman lewat kode: go('bendahara-tagihan')
export function go(key) {
  if (location.hash === '#' + key) render();
  else location.hash = key;
}

// Setiap halaman adalah fungsi: ({ user, key }) => ({ html, after? })
async function loadPage(key, ctx) {
  const loader = routes[key];
  const page = loader ? (await loader()).default : placeholder;
  return page(ctx);
}

export async function render() {
  const id = ++renderId; // untuk membatalkan render lama kalau user pindah halaman cepat
  const key = (location.hash || '').slice(1);
  const user = isLoggedIn() ? getUser() : null;

  // --- Penjaga akses ---
  if (!user) {
    if (key !== 'login') return void (location.hash = 'login');
  } else {
    if (!HOME[user.role]) {
      clearSession();
      return void (location.hash = 'login');
    }
    if (key === 'login' || !key) return void (location.hash = HOME[user.role]);
    if (!canOpen(user.role, key)) {
      toast('Anda tidak punya akses ke halaman itu.', 'err');
      return void (location.hash = HOME[user.role]);
    }
  }

  document.body.classList.remove('nav');
  closePop();
  const root = document.getElementById('app');

  // --- Belum login: halaman tanpa sidebar (login) ---
  if (!user) {
    root.dataset.role = '';
    try {
      const page = await loadPage('login', { user: null, key });
      if (id !== renderId) return;
      root.innerHTML = page.html;
      page.after?.();
    } catch (e) {
      root.innerHTML = errorView(e.message);
    }
    return;
  }

  // --- Sudah login: sidebar + navbar + konten ---
  if (root.dataset.role !== user.role) {
    root.innerHTML = shell(user, key);
    root.dataset.role = user.role;
  }
  setActiveMenu(key);

  const view = document.getElementById('view');
  view.innerHTML = loadingView();
  try {
    const page = await loadPage(key, { user, key });
    if (id !== renderId) return;
    view.innerHTML = page.html;
    window.scrollTo(0, 0);
    page.after?.();
  } catch (e) {
    if (id !== renderId) return;
    view.innerHTML = errorView(e.message);
  }
}

export function startRouter() {
  bindLayoutEvents(getUser);
  window.addEventListener('hashchange', render);
  render();
}
