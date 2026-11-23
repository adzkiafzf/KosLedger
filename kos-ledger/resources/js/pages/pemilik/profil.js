import { me, logout } from '../../api/auth.js';
import { apiError } from '../../api/client.js';
import { getUser, setSession, getToken, clearSession } from '../../core/session.js';
import { go } from '../../core/router.js';
import { pageHead, pill, ms, toast } from '../../components/ui.js';
import { statCard } from '../../components/widgets.js';
import { errorView, loadingView } from '../../components/states.js';
import { esc, periodeSekarang, initials } from '../../utils/format.js';
import { ROLE_LABEL } from '../../core/roles.js';

const ROLE_DESC = {
  pemilik: 'Pemilik Properti (Owner)',
  bendahara: 'Bendahara Kos',
  admin: 'Administrator',
  anggota: 'Penghuni Kos',
};

function avatarBlock(user) {
  const ini = initials(user.name);
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:28px 20px 20px">
      <span class="avatar-lg">
        ${esc(ini)}
      </span>
      <div style="text-align:center">
        <b style="font-size:20px;color:var(--primary-d);display:block">${esc(user.name)}</b>
        ${user.nickname ? `<span style="color:var(--muted);font-size:13px">“${esc(user.nickname)}”</span>` : ''}
      </div>
      ${pill(ROLE_DESC[user.role] || ROLE_LABEL[user.role] || esc(user.role), 'ok')}
    </div>`;
}

function infoGrid(user) {
  const rows = [
    ['person', 'Nama Lengkap', user.name],
    ['badge', 'Nama Panggilan', user.nickname || '–'],
    ['alternate_email', 'Username Akun', user.username],
    ['shield', 'Peran / Hak Akses', ROLE_DESC[user.role] || ROLE_LABEL[user.role] || user.role],
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
      eyebrow: 'AKUN SAYA',
      txt: 1,
      dot: 1,
      title: 'Profil Pemilik (Owner)',
      sub: 'Informasi identitas akun dan hak pemantauan eksekutif properti kos.',
    })}

    <div class="grid g32" style="align-items:start">

      <!-- Kolom Kiri: Avatar & Identitas Akun -->
      <div style="display:grid;gap:16px;min-width:0">

        <div class="card" style="padding:0;overflow:hidden">
          <div style="background:var(--c1);padding:0">
            ${avatarBlock(user)}
          </div>

          <div style="padding:4px 20px 20px">
            ${infoGrid(user)}

            <div class="note" style="margin-top:16px">
              ${ms('info')}
              <span>
                Pengaturan kredensial akun, penggantian username, dan perubahan kata sandi dikelola secara terpusat oleh <b>Administrator sistem</b>.
              </span>
            </div>
          </div>
        </div>

        <!-- Kartu Navigasi Monitoring Cepat -->
        <div class="card">
          <h3 class="sh" style="margin-bottom:14px">Navigasi Monitoring Cepat</h3>
          <div style="display:grid;gap:10px">
            <button class="btn s" style="justify-content:flex-start;gap:12px;padding:12px 14px" data-go="pemilik">
              ${ms('dashboard')}
              <span style="text-align:left">
                <b style="display:block;font-size:13px">Dashboard Eksekutif</b>
                <small style="color:var(--muted)">Kembali ke ikhtisar kondisi kos</small>
              </span>
            </button>
            <button class="btn s" style="justify-content:flex-start;gap:12px;padding:12px 14px" data-go="pemilik-laporan">
              ${ms('bar_chart')}
              <span style="text-align:left">
                <b style="display:block;font-size:13px">Laporan Keuangan</b>
                <small style="color:var(--muted)">Analisis arus kas & ekspor CSV</small>
              </span>
            </button>
            <button class="btn s" style="justify-content:flex-start;gap:12px;padding:12px 14px" data-go="pemilik-pembayaran">
              ${ms('payments')}
              <span style="text-align:left">
                <b style="display:block;font-size:13px">Monitoring Pembayaran</b>
                <small style="color:var(--muted)">Audit transaksi & hash blockchain</small>
              </span>
            </button>
          </div>
        </div>

      </div>

      <!-- Kolom Kanan: Status & Hak Akses Sistem -->
      <div style="display:grid;gap:16px;min-width:0">

        <div class="grid g2" style="margin:0">
          ${statCard('Status Akun', 'Aktif', pill('Terverifikasi', 'ok'), 'verified_user')}
          ${statCard('Hak Akses', 'Pemilik', 'Mode Pantau (Read-Only)', 'lock_open')}
        </div>

        <!-- Cakupan Wewenang Pemilik -->
        <div class="card">
          <h3 class="sh" style="margin-bottom:4px">Wewenang & Hak Akses Pemilik</h3>
          <p class="sub">Fitur dan kapabilitas yang aktif untuk peran ini</p>
          <div style="display:grid;gap:10px;margin-top:14px">
            ${[
              ['Memonitor KPI dan kondisi finansial kos secara real-time', 'check_circle', 'ok'],
              ['Memantau ketersediaan unit kamar & tingkat okupansi', 'check_circle', 'ok'],
              ['Memantau direktori penyewa & riwayat penempatan kamar', 'check_circle', 'ok'],
              ['Memantau status tagihan sewa & daftar tunggakan', 'check_circle', 'ok'],
              ['Memantau arus pembayaran & verifikasi hash blockchain', 'check_circle', 'ok'],
              ['Memantau pos beban operasional & pengeluaran kas', 'check_circle', 'ok'],
              ['Menganalisis laporan keuangan & mengekspor data CSV', 'check_circle', 'ok'],
              ['Mengubah data master kamar atau tarif sewa dasar', 'cancel', 'err'],
              ['Mencatat mutasi kas harian atau menerbitkan tagihan', 'cancel', 'err'],
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

        <!-- Info Sistem & Properti -->
        <div class="card">
          <h3 class="sh" style="margin-bottom:14px">Informasi Sistem Properti</h3>
          <div class="kv" style="border-bottom:1px solid var(--c1);padding:10px 0">
            <span style="color:var(--muted);font-size:13px">Platform</span>
            <b style="font-weight:500;font-size:13px">KosLedger Executive Portal</b>
          </div>
          <div class="kv" style="border-bottom:1px solid var(--c1);padding:10px 0">
            <span style="color:var(--muted);font-size:13px">Properti Kos</span>
            <b style="font-weight:500;font-size:13px">Kost Putri Griya Asri</b>
          </div>
          <div class="kv" style="border-bottom:1px solid var(--c1);padding:10px 0">
            <span style="color:var(--muted);font-size:13px">Keamanan Audit</span>
            <span>${pill('Blockchain Sepolia Ready', 'mint')}</span>
          </div>
          <div class="kv" style="padding:10px 0">
            <span style="color:var(--muted);font-size:13px">Hak Operasional</span>
            <span>${pill('Read-Only Certified', 'ok')}</span>
          </div>

          <div style="margin-top:20px;border-top:1px solid var(--c1);padding-top:16px">
            <button class="btn err" id="btn-owner-logout" style="width:100%;justify-content:center;gap:8px">
              ${ms('logout')}Keluar dari Sesi Pemilik
            </button>
          </div>
        </div>

      </div>
    </div>`;
}

export default async function ownerProfilePage({ user: sessionUser }) {
  const cached = sessionUser || getUser();

  async function fetchAndRefresh() {
    try {
      const fresh = await me();
      setSession(fresh, getToken(), Boolean(localStorage.getItem('kosledger.token')));
      return fresh;
    } catch {
      return null;
    }
  }

  if (!cached) {
    const view = document.getElementById('view');
    if (view) view.innerHTML = loadingView('Memuat profil pemilik…');
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
          ${pageHead({ title: 'Profil Pemilik' })}
          ${errorView(apiError(err))}
          <button class="btn s" id="retry-owner-profil">${ms('refresh')}Coba lagi</button>`,
        after() {
          document.getElementById('retry-owner-profil')?.addEventListener('click', () => go('pemilik-profil'));
        },
      };
    }
  }

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

function bindProfileEvents() {
  document.getElementById('btn-owner-logout')?.addEventListener('click', async () => {
    try {
      await logout();
    } catch {
      // Abaikan jika token sudah tidak valid
    }
    clearSession();
    toast('Anda telah berhasil keluar.', 'ok');
    go('login');
  });
}
