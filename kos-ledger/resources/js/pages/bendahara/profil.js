import { me } from '../../api/auth.js';
import { apiError } from '../../api/client.js';
import { getUser, setSession, getToken } from '../../core/session.js';
import { go } from '../../core/router.js';
import { pageHead, pill, ms } from '../../components/ui.js';
import { statCard } from '../../components/widgets.js';
import { errorView, loadingView } from '../../components/states.js';
import { esc, periodeSekarang } from '../../utils/format.js';
import { ROLE_LABEL } from '../../core/roles.js';

// Label role yang lebih deskriptif untuk tampilan profil
const ROLE_DESC = {
  bendahara: 'Bendahara Kos',
  admin: 'Administrator',
  pemilik: 'Pemilik Properti',
  anggota: 'Penghuni Kos',
};

// Inisial dari nama (maks 2 huruf)
const initials = (name = '') =>
  String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((x) => x[0].toUpperCase())
    .join('');

function avatarBlock(user) {
  const ini = initials(user.name);
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:28px 20px 20px">
      <span class="avatar" style="width:80px;height:80px;font-size:28px;font-weight:700;background:var(--active);color:var(--primary-d);border-radius:50%;display:grid;place-items:center;flex:none">
        ${esc(ini)}
      </span>
      <div style="text-align:center">
        <b style="font-size:20px;color:var(--primary-d);display:block">${esc(user.name)}</b>
        ${user.nickname ? `<span style="color:var(--muted);font-size:13px">"${esc(user.nickname)}"</span>` : ''}
      </div>
      ${pill(ROLE_DESC[user.role] || ROLE_LABEL[user.role] || esc(user.role), 'ok')}
    </div>`;
}

function infoGrid(user) {
  const rows = [
    ['person', 'Nama Lengkap', user.name],
    ['badge', 'Nama Panggilan', user.nickname || null],
    ['alternate_email', 'Username', user.username],
    ['shield', 'Role / Jabatan', ROLE_DESC[user.role] || ROLE_LABEL[user.role] || user.role],
    ['calendar_month', 'Periode Aktif', periodeSekarang()],
  ];

  return rows
    .filter(([, , val]) => val !== null && val !== undefined)
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

function noticeBlock() {
  return `
    <div class="note" style="margin-top:16px">
      ${ms('info')}
      <span>Untuk mengubah nama, kata sandi, atau data akun lainnya, hubungi Administrator sistem.</span>
    </div>`;
}

function profileView(user) {
  return `
    ${pageHead({
      eyebrow: 'AKUN SAYA',
      txt: 1,
      dot: 1,
      title: 'Profil Bendahara',
      sub: 'Informasi akun yang terdaftar di sistem KosLedger.',
    })}

    <div class="grid g32" style="align-items:start">

      <!-- Kolom kiri: avatar + ringkasan -->
      <div style="display:grid;gap:16px;min-width:0">

        <div class="card" style="padding:0;overflow:hidden">
          <!-- Avatar header -->
          <div style="background:var(--c1);padding:0">
            ${avatarBlock(user)}
          </div>

          <!-- Data detail -->
          <div style="padding:4px 20px 20px">
            ${infoGrid(user)}
            ${noticeBlock()}
          </div>
        </div>

        <!-- Kartu aksi cepat -->
        <div class="card">
          <h3 style="font-size:16px;margin-bottom:14px">Aksi Cepat</h3>
          <div style="display:grid;gap:10px">
            <button class="btn s" style="justify-content:flex-start;gap:12px;padding:12px 14px" data-go="bendahara">
              ${ms('dashboard')}
              <span style="text-align:left"><b style="display:block;font-size:13px">Dashboard</b><small style="color:var(--muted)">Kembali ke ringkasan keuangan</small></span>
            </button>
            <button class="btn s" style="justify-content:flex-start;gap:12px;padding:12px 14px" data-go="bendahara-laporan">
              ${ms('bar_chart')}
              <span style="text-align:left"><b style="display:block;font-size:13px">Laporan Keuangan</b><small style="color:var(--muted)">Lihat arus kas dan jurnal</small></span>
            </button>
            <button class="btn s" style="justify-content:flex-start;gap:12px;padding:12px 14px" data-go="bendahara-tagihan">
              ${ms('receipt_long')}
              <span style="text-align:left"><b style="display:block;font-size:13px">Manajemen Tagihan</b><small style="color:var(--muted)">Kelola tagihan sewa penghuni</small></span>
            </button>
          </div>
        </div>

      </div>

      <!-- Kolom kanan: stat dan info sistem -->
      <div style="display:grid;gap:16px;min-width:0">

        <div class="grid g2" style="margin:0">
          ${statCard('Status Akun', 'Aktif', pill('Terverifikasi', 'ok'), 'verified_user')}
          ${statCard('Hak Akses', ROLE_LABEL[user.role] || esc(user.role), 'Kas & Tagihan Kos', 'lock_open')}
        </div>

        <!-- Kapabilitas akun -->
        <div class="card">
          <h3 style="font-size:16px;margin-bottom:4px">Hak Akses Sistem</h3>
          <p class="sub">Fitur yang dapat diakses dengan peran ini</p>
          <div style="display:grid;gap:8px;margin-top:14px">
            ${[
              ['Mencatat pemasukan dan pengeluaran kas', 'check_circle', 'ok'],
              ['Menerbitkan dan mengelola tagihan sewa', 'check_circle', 'ok'],
              ['Memverifikasi pembayaran manual penghuni', 'check_circle', 'ok'],
              ['Melihat laporan keuangan bulanan', 'check_circle', 'ok'],
              ['Melihat data kamar dan penghuni', 'check_circle', 'ok'],
              ['Mengubah data kamar atau pengguna', 'cancel', 'err'],
              ['Mengakses panel Admin atau Pemilik', 'cancel', 'err'],
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

        <!-- Info sistem -->
        <div class="card">
          <h3 style="font-size:16px;margin-bottom:14px">Informasi Sistem</h3>
          <div class="kv" style="border-bottom:1px solid var(--c1);padding:10px 0">
            <span style="color:var(--muted);font-size:13px">Aplikasi</span>
            <b style="font-weight:500;font-size:13px">KosLedger</b>
          </div>
          <div class="kv" style="border-bottom:1px solid var(--c1);padding:10px 0">
            <span style="color:var(--muted);font-size:13px">Versi</span>
            <b style="font-weight:500;font-size:13px">1.0.0</b>
          </div>
          <div class="kv" style="padding:10px 0">
            <span style="color:var(--muted);font-size:13px">Mode</span>
            <span>${pill('Sandbox', 'warn')}</span>
          </div>
          <div class="note" style="margin-top:14px;background:var(--c2)">
            ${ms('apartment')}
            <span style="font-size:12px">Properti: <b>Kost Putri Griya Asri</b> — data terhubung ke Supabase.</span>
          </div>
        </div>

      </div>
    </div>`;
}

export default async function profilPage({ user: sessionUser }) {
  // Gunakan data sesi sebagai tampilan awal (cepat)
  const cached = sessionUser || getUser();

  // Ambil data terbaru dari server di background, lalu perbarui sesi
  async function fetchAndRefresh() {
    try {
      const fresh = await me();
      // Perbarui sesi agar nama/nickname terbaru tersimpan lokal
      setSession(fresh, getToken(), Boolean(localStorage.getItem('kosledger.token')));
      return fresh;
    } catch {
      return null;
    }
  }

  // Kalau tidak ada data sama sekali di sesi (edge case), tunggu server
  if (!cached) {
    const view = document.getElementById('view');
    if (view) view.innerHTML = loadingView('Memuat profil…');
    try {
      const fresh = await me();
      setSession(fresh, getToken(), Boolean(localStorage.getItem('kosledger.token')));
      return { html: profileView(fresh) };
    } catch (err) {
      return {
        html: `
          ${pageHead({ title: 'Profil Bendahara' })}
          ${errorView(apiError(err))}
          <button class="btn s" id="retry-profil">${ms('refresh')}Coba lagi</button>`,
        after() {
          document.getElementById('retry-profil')?.addEventListener('click', () => go('bendahara-profil'));
        },
      };
    }
  }

  // Render langsung dari cache, lalu refresh di background
  return {
    html: profileView(cached),
    after() {
      fetchAndRefresh().then((fresh) => {
        if (!fresh) return;
        // Hanya re-render jika ada perubahan data
        if (fresh.name !== cached.name || fresh.nickname !== cached.nickname || fresh.username !== cached.username) {
          const view = document.getElementById('view');
          if (view) view.innerHTML = profileView(fresh);
        }
      });
    },
  };
}
