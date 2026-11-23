import { me, logout } from '../../api/auth.js';
import { apiError } from '../../api/client.js';
import { getUser, setSession, getToken, clearSession } from '../../core/session.js';
import { go } from '../../core/router.js';
import { pageHead, pill, ms, toast, modal, closeModal, mhead } from '../../components/ui.js';
import { statCard } from '../../components/widgets.js';
import { errorView, loadingView } from '../../components/states.js';
import { esc, periodeSekarang, initials } from '../../utils/format.js';
import { ROLE_LABEL } from '../../core/roles.js';

function avatarBlock(user) {
  const ini = initials(user?.name || 'Admin');
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:28px 20px 20px">
      <span class="avatar-lg">
        ${esc(ini)}
      </span>
      <div style="text-align:center">
        <b style="font-size:20px;color:var(--primary-d);display:block">${esc(user?.name || 'Administrator')}</b>
        ${user?.nickname ? `<span style="color:var(--muted);font-size:13px">"${esc(user.nickname)}"</span>` : ''}
      </div>
      ${pill('Administrator Sistem', 'ok dot')}
    </div>`;
}

function infoRows(user) {
  const rows = [
    ['person', 'Nama Lengkap', user?.name || '–'],
    ['badge', 'Nama Panggilan', user?.nickname ? `"${user.nickname}"` : '–'],
    ['alternate_email', 'Username Akun', user?.username ? `@${user.username}` : '–'],
    ['call', 'Nomor Telepon', user?.phone || '–'],
    ['shield', 'Peran / Hak Akses', ROLE_LABEL[user?.role] || 'Administrator'],
    ['calendar_month', 'Periode Sesi', periodeSekarang()],
  ];

  return rows
    .map(
      ([icon, label, val]) => `
      <div class="kv" style="border-bottom:1px solid var(--c1);padding:12px 0;align-items:center">
        <span style="display:flex;gap:10px;align-items:center;color:var(--muted);min-width:0;flex:1 1 160px">
          ${ms(icon)}
          <span style="font-size:13px">${esc(label)}</span>
        </span>
        <b style="text-align:right;color:var(--text);font-weight:500;font-size:14px">${esc(String(val))}</b>
      </div>`
    )
    .join('');
}

function profileView(user) {
  return `
    ${pageHead({
      crumb: 'KosLedger › <b>Profil Admin</b>',
      title: 'Profil Administrator',
      sub: 'Informasi identitas akun administrator dan kontrol sesi pengelola sistem KosLedger.',
    })}

    <div class="grid g32" style="align-items:start">

      <!-- Kolom Kiri: Avatar & Identitas Akun -->
      <div style="display:grid;gap:16px;min-width:0">

        <div class="card" style="padding:0;overflow:hidden">
          <div style="background:var(--c1);padding:0">
            ${avatarBlock(user)}
          </div>

          <div style="padding:4px 20px 20px">
            ${infoRows(user)}

            <div class="note" style="margin-top:16px">
              ${ms('verified')}
              <span>
                Akun ini memiliki hak akses Administrator untuk mengelola seluruh master data kamar, penghuni, dan laporan hunian kos.
              </span>
            </div>
          </div>
        </div>

        <!-- Kartu Navigasi Cepat Admin -->
        <div class="card">
          <h3 class="sh" style="margin-bottom:14px">Navigasi Operasional Cepat</h3>
          <div style="display:grid;gap:10px">
            <button class="btn s" style="justify-content:flex-start;gap:12px;padding:12px 14px" data-go="admin">
              ${ms('dashboard')}
              <span style="text-align:left">
                <b style="display:block;font-size:13px">Dashboard Admin</b>
                <small style="color:var(--muted)">Kembali ke statistik ringkasan kos</small>
              </span>
            </button>
            <button class="btn s" style="justify-content:flex-start;gap:12px;padding:12px 14px" data-go="admin-users">
              ${ms('group')}
              <span style="text-align:left">
                <b style="display:block;font-size:13px">Manajemen Pengguna</b>
                <small style="color:var(--muted)">Kelola akun dan pendaftaran penghuni</small>
              </span>
            </button>
            <button class="btn s" style="justify-content:flex-start;gap:12px;padding:12px 14px" data-go="admin-kamar">
              ${ms('meeting_room')}
              <span style="text-align:left">
                <b style="display:block;font-size:13px">Manajemen Kamar</b>
                <small style="color:var(--muted)">Kelola unit kamar, tipe, dan kapasitas</small>
              </span>
            </button>
            <button class="btn s" style="justify-content:flex-start;gap:12px;padding:12px 14px" data-go="admin-penghuni">
              ${ms('badge')}
              <span style="text-align:left">
                <b style="display:block;font-size:13px">Penempatan Penghuni</b>
                <small style="color:var(--muted)">Alokasi unit kamar untuk penghuni kos</small>
              </span>
            </button>
            <button class="btn s" style="justify-content:flex-start;gap:12px;padding:12px 14px" data-go="admin-laporan">
              ${ms('bar_chart')}
              <span style="text-align:left">
                <b style="display:block;font-size:13px">Laporan Hunian</b>
                <small style="color:var(--muted)">Rekapitulasi riwayat penempatan & okupansi</small>
              </span>
            </button>
          </div>
        </div>

      </div>

      <!-- Kolom Kanan: Hak Akses & Informasi Sistem -->
      <div style="display:grid;gap:16px;min-width:0">

        <div class="grid g2" style="margin:0">
          ${statCard('Status Akun', 'Aktif', pill('Terverifikasi', 'ok'), 'verified_user')}
          ${statCard('Hak Akses', 'Administrator', pill('Full Access', 'mint'), 'security')}
        </div>

        <!-- Kartu Kapabilitas Hak Akses Sistem -->
        <div class="card">
          <h3 style="font-size:16px;margin-bottom:4px">Otoritas Akses Sistem</h3>
          <p class="sub">Hak operasional yang dimiliki oleh akun Administrator</p>
          <div style="display:grid;gap:8px;margin-top:14px">
            ${[
              ['Mendaftarkan dan menonaktifkan pengguna kos', 'check_circle', 'ok'],
              ['Menambah dan memperbarui data unit kamar', 'check_circle', 'ok'],
              ['Mengalokasikan penempatan kamar untuk penghuni', 'check_circle', 'ok'],
              ['Memantau laporan okupansi dan riwayat hunian', 'check_circle', 'ok'],
              ['Mengakses ringkasan operasional dashboard admin', 'check_circle', 'ok'],
            ]
              .map(
                ([label, icon, type]) => `
              <div style="display:flex;gap:10px;align-items:center;font-size:13px">
                <span class="ms" style="color:var(--${type === 'ok' ? 'primary' : 'err'});flex:none">${icon}</span>
                <span style="color:${type === 'ok' ? 'var(--text)' : 'var(--muted)'}">${esc(label)}</span>
              </div>`
              )
              .join('')}
          </div>
        </div>

        <!-- Kartu Informasi Sistem & Logout -->
        <div class="card">
          <h3 class="sh" style="margin-bottom:14px">Informasi Sistem & Sesi</h3>
          <div class="kv" style="border-bottom:1px solid var(--c1);padding:10px 0">
            <span style="color:var(--muted);font-size:13px">Platform</span>
            <b style="font-weight:500;font-size:13px">KosLedger Management Platform</b>
          </div>
          <div class="kv" style="border-bottom:1px solid var(--c1);padding:10px 0">
            <span style="color:var(--muted);font-size:13px">Properti Kos</span>
            <b style="font-weight:500;font-size:13px">Kost Putri Griya Asri</b>
          </div>
          <div class="kv" style="border-bottom:1px solid var(--c1);padding:10px 0">
            <span style="color:var(--muted);font-size:13px">Autentikasi</span>
            <span>${pill('Laravel Sanctum Token', 'mint')}</span>
          </div>
          <div class="kv" style="padding:10px 0">
            <span style="color:var(--muted);font-size:13px">Otoritas</span>
            <span>${pill('Superuser Admin', 'ok')}</span>
          </div>

          <!-- Aksi Logout -->
          <div style="margin-top:20px;border-top:1px solid var(--c1);padding-top:16px">
            <button class="btn err" id="btn-admin-logout" style="width:100%;justify-content:center;gap:8px">
              ${ms('logout')}Keluar dari Sesi Admin
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}

function bindProfileEvents() {
  document.getElementById('btn-admin-logout')?.addEventListener('click', () => {
    modal(`
      ${mhead('Konfirmasi Keluar', 'Sesi Administrator', 'logout')}
      <div class="mb">
        <p style="font-size:13px;color:var(--text);margin-bottom:16px">
          Apakah Anda yakin ingin mengakhiri sesi Administrator KosLedger? Anda harus memasukkan username dan kata sandi kembali untuk mengelola sistem.
        </p>
        <div class="grid g2" style="margin:0">
          <button class="btn s" data-act="close">
            ${ms('close')}Batal
          </button>
          <button class="btn p" id="btn-confirm-logout" style="background:var(--err);border-color:var(--err)">
            ${ms('logout')}Ya, Keluar
          </button>
        </div>
      </div>
    `);

    document.getElementById('btn-confirm-logout')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-confirm-logout');
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<span class="spin"></span> Keluar…`;
      }
      try {
        await logout();
        toast('Anda telah berhasil keluar dari sistem.', 'ok');
      } catch (err) {
        toast(apiError(err) || 'Sesi lokal dibersihkan.', 'info');
      } finally {
        clearSession();
        closeModal();
        go('login');
      }
    });
  });
}

export default async function adminProfilePage({ user: sessionUser }) {
  const cached = sessionUser || getUser();

  async function fetchAndRefresh() {
    try {
      const fresh = await me();
      if (fresh) {
        setSession(fresh, getToken(), Boolean(localStorage.getItem('kosledger.token')));
      }
      return fresh;
    } catch {
      return null;
    }
  }

  // Jika belum ada data di cache sesi, fetch dari endpoint /api/auth/me
  if (!cached) {
    const view = document.getElementById('view');
    if (view) view.innerHTML = loadingView('Memuat profil administrator…');

    try {
      const fresh = await me();
      setSession(fresh, getToken(), Boolean(localStorage.getItem('kosledger.token')));
      return {
        html: profileView(fresh),
        after: bindProfileEvents,
      };
    } catch (err) {
      return {
        html: `
          <div style="padding:16px 0">
            ${pageHead({ title: 'Profil Administrator' })}
            ${errorView(apiError(err) || 'Gagal memuat informasi profil admin dari server.')}
            <div style="margin-top:16px">
              <button class="btn s" id="btn-retry-admin-profil">${ms('refresh')}Coba Lagi</button>
            </div>
          </div>
        `,
        after() {
          document.getElementById('btn-retry-admin-profil')?.addEventListener('click', () => go('admin-profil'));
        },
      };
    }
  }

  // Tampilkan data cache langsung, lalu perbarui di latar belakang jika ada perubahan
  return {
    html: profileView(cached),
    after() {
      bindProfileEvents();

      fetchAndRefresh().then((fresh) => {
        if (!fresh) return;
        if (fresh.name !== cached.name || fresh.nickname !== cached.nickname || fresh.username !== cached.username) {
          const view = document.getElementById('view');
          if (view) {
            view.innerHTML = profileView(fresh);
            bindProfileEvents();
          }
        }
      });
    },
  };
}
