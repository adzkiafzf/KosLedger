import { me, logout } from '../../api/auth.js';
import { member } from '../../api/dashboard.js';
import { getBills } from '../../api/bills.js';
import { apiError } from '../../api/client.js';
import { clearSession, setSession, getToken } from '../../core/session.js';
import { go } from '../../core/router.js';
import { pageHead, pill, ms, toast, modal, closeModal, mhead, kvs } from '../../components/ui.js';
import { statCard } from '../../components/widgets.js';
import { errorView } from '../../components/states.js';
import { esc, tgl, periodeSekarang, initials } from '../../utils/format.js';
import { ROLE_LABEL } from '../../core/roles.js';

function avatarBlock(userData) {
  const ini = initials(userData.name || 'Penghuni');
  return `
    <div style="display:flex;flex-direction:column;align-items:center;gap:12px;padding:24px 20px 20px">
      <span class="avatar-lg">
        ${esc(ini)}
      </span>
      <div style="text-align:center">
        <b style="font-size:20px;color:var(--primary-d);display:block">${esc(userData.name)}</b>
        ${userData.nickname ? `<span style="color:var(--muted);font-size:13px">“${esc(userData.nickname)}”</span>` : ''}
      </div>
      ${pill('Penghuni Kos (Occupant)', 'mint dot')}
    </div>
  `;
}

export default async function profil({ user }) {
  let userData = user;
  let roomNumber = null;
  let startDate = null;
  let linkedTelegram = false;

  try {
    const [meRes, dashRes, billsRes] = await Promise.allSettled([
      me(),
      member(),
      getBills(),
    ]);

    if (meRes.status === 'fulfilled' && meRes.value) {
      userData = { ...user, ...meRes.value };
      // Perbarui session lokal dengan data profil terbaru
      const token = getToken();
      if (token) setSession(userData, token, true);
    }

    if (dashRes.status === 'fulfilled' && dashRes.value) {
      linkedTelegram = Boolean(dashRes.value.linked_telegram);
    }

    if (billsRes.status === 'fulfilled') {
      const bList = billsRes.value?.data || billsRes.value || [];
      const billWithRoom = Array.isArray(bList) ? bList.find((b) => b.occupancy?.room?.room_number) : null;
      if (billWithRoom) {
        roomNumber = billWithRoom.occupancy?.room?.room_number || null;
        startDate = billWithRoom.occupancy?.start_date || null;
      }
    }
  } catch (err) {
    return {
      html: `
        <div style="padding:16px 0">
          ${pageHead({
            title: 'Profil Saya',
            sub: 'Informasi identitas akun penghuni dan status keanggotaan.',
          })}
          ${errorView(err.message || 'Gagal memuat informasi profil.')}
          <div style="margin-top:16px">
            <button class="btn s" id="btn-retry-profile">${ms('refresh')}Muat Ulang Profil</button>
          </div>
        </div>
      `,
      after() {
        document.getElementById('btn-retry-profile')?.addEventListener('click', () => go('anggota-profil'));
      },
    };
  }

  const html = `
    <!-- Header Halaman -->
    ${pageHead({
      title: 'Profil Saya',
      sub: 'Informasi akun personal, hak akses penghuni, dan status sewa terverifikasi.',
      acts: `
        <span class="ro-badge">${ms('verified_user')}Akun Penghuni Terverifikasi</span>
        <button class="btn s" data-go="anggota-kamar">${ms('meeting_room')}Informasi Kamar</button>
      `,
    })}

    <!-- Statistik Ringkasan Akun -->
    <div class="grid g4" style="margin-bottom:20px">
      ${statCard(
        'IDENTITAS AKUN',
        esc(userData.username),
        `<span style="color:var(--text)">User ID #${userData.id || '-'}</span>`,
        'alternate_email'
      )}

      ${statCard(
        'KAMAR DITEMPATI',
        roomNumber ? `Kamar ${esc(roomNumber)}` : 'Unit Terdaftar',
        `<span style="color:var(--primary);font-weight:600">✓ Hunian Aktif</span>`,
        'meeting_room'
      )}

      ${statCard(
        'STATUS TELEGRAM',
        linkedTelegram ? 'Terhubung' : 'Belum Konek',
        linkedTelegram
          ? '<span style="color:var(--primary)">✓ Notifikasi bot aktif</span>'
          : '<span style="color:var(--muted)">Belum ditautkan</span>',
        'send'
      )}

      ${statCard(
        'HAK AKSES',
        'Penghuni',
        `<span style="color:var(--text)">Portal Occupant</span>`,
        'badge'
      )}
    </div>

    <!-- Layout Grid 2 Kolom -->
    <div class="grid g32" style="align-items:start">
      <!-- Kolom Kiri: Avatar & Rincian Identitas -->
      <div style="display:grid;gap:16px;min-width:0">
        <!-- Kartu Avatar & Biodata -->
        <div class="card" style="padding:0;overflow:hidden">
          ${avatarBlock(userData)}

          <div style="padding:0 24px 24px">
            <h4 style="font-size:14px;color:var(--primary-d);margin-bottom:12px;border-bottom:1px solid var(--c1);padding-bottom:8px">
              Data Identitas Penghuni
            </h4>

            ${kvs([
              ['Nama Lengkap', esc(userData.name)],
              ['Nama Panggilan', esc(userData.nickname || '–')],
              ['Username Akun', `<span class="mono">@${esc(userData.username)}</span>`],
              ['Nomor Telepon / HP', userData.phone ? esc(userData.phone) : '<span style="color:var(--muted)">–</span>'],
              ['Hak Akses / Peran', 'Penghuni Kos (Occupant)'],
              ['Unit Kamar', roomNumber ? `Kamar ${esc(roomNumber)}` : 'Unit Terdaftar'],
              ['Mulai Menempati', startDate ? tgl(startDate) : '-'],
              ['Status Telegram Bot', linkedTelegram ? '<span class="pill ok dot">Terhubung</span>' : '<span class="pill warn dot">Belum Terhubung</span>'],
              ['Status Akun', '<span class="pill ok dot">Aktif</span>'],
              ['Sesi Berjalan', periodeSekarang()],
            ])}
          </div>
        </div>

        <!-- Kartu Hubungan Data Sewa -->
        <div class="card">
          <div class="ctr" style="margin-bottom:10px">
            <h3 style="font-size:15px;display:flex;gap:8px;align-items:center">
              ${ms('vpn_key')}Akses & Layanan Cepat
            </h3>
            ${pill('Tautan Akun', '')}
          </div>

          <div style="display:grid;gap:8px">
            <a data-go="anggota-kamar" class="linkrow" style="cursor:pointer">
              <span style="display:flex;gap:8px;align-items:center">${ms('meeting_room')}Detail Kamar Saya</span>
              ${ms('chevron_right')}
            </a>
            <a data-go="anggota-tagihan" class="linkrow" style="cursor:pointer">
              <span style="display:flex;gap:8px;align-items:center">${ms('receipt_long')}Kelola Tagihan Sewa</span>
              ${ms('chevron_right')}
            </a>
            <a data-go="anggota-riwayat" class="linkrow" style="cursor:pointer">
              <span style="display:flex;gap:8px;align-items:center">${ms('history')}Histori Pelunasan & Audit</span>
              ${ms('chevron_right')}
            </a>
            <a data-go="anggota-layanan" class="linkrow" style="cursor:pointer">
              <span style="display:flex;gap:8px;align-items:center">${ms('support_agent')}Layanan & Hubungkan Telegram</span>
              ${ms('chevron_right')}
            </a>
          </div>
        </div>
      </div>

      <!-- Kolom Kanan: Kebijakan Keamanan & Sesi Logout -->
      <div style="display:grid;gap:16px;min-width:0">
        <!-- Informasi Keamanan & Perubahan Profil -->
        <div class="card">
          <div class="ctr" style="margin-bottom:12px">
            <h3 style="font-size:15px;display:flex;gap:8px;align-items:center">
              ${ms('security')}Keamanan & Perubahan Data
            </h3>
            ${pill('Kebijakan Kos', '')}
          </div>

          <div class="note" style="display:block;margin-bottom:14px;background:var(--c1);font-size:12px">
            <b style="color:var(--primary-d);display:block;margin-bottom:4px">
              Pengelolaan Data Terpusat
            </b>
            <span style="color:var(--muted)">
              Untuk menjamin keabsahan hukum perjanjian sewa dan integritas pencatatan buku kas, perubahan data identitas (Nama KTP, nomor telepon, kamar sewa) dan pembaruan password dikelola melalui Administrator atau Bendahara Kos.
            </span>
          </div>

          <p style="font-size:12px;color:var(--muted);margin:0 0 14px">
            Jika terdapat kesalahan penulisan nama atau Anda membutuhkan reset kredensial akun, silakan hubungi pengelola melalui pusat bantuan.
          </p>

          <button class="btn s" style="width:100%" data-go="anggota-layanan">
            ${ms('support_agent')}Hubungi Pengelola / CS
          </button>
        </div>

        <!-- Sesi & Logout Akun -->
        <div class="card">
          <div class="ctr" style="margin-bottom:10px">
            <h3 style="font-size:15px;display:flex;gap:8px;align-items:center">
              ${ms('manage_accounts')}Manajemen Sesi
            </h3>
          </div>

          <p style="font-size:12px;color:var(--muted);margin:0 0 16px">
            Keluar dari sesi saat ini jika Anda menggunakan perangkat bersama demi menjaga keamanan data pribadi dan catatan finansial Anda.
          </p>

          <button class="btn s" id="btn-profile-logout" style="width:100%;color:var(--err);border-color:var(--err-line, #ffdad6)">
            ${ms('logout')}Keluar dari Akun (Logout)
          </button>
        </div>

        <!-- Jaminan Privasi Data -->
        <div class="note" style="display:flex;gap:12px;padding:16px;background:var(--c2)">
          <span class="ic" style="width:36px;height:36px;border-radius:10px;background:#fff;display:grid;place-items:center;flex:none;color:var(--primary)">
            ${ms('lock')}
          </span>
          <div style="font-size:12px">
            <b style="color:var(--primary-d);font-size:13px;display:block;margin-bottom:2px">
              Privasi Akun Penghuni
            </b>
            <span style="color:var(--muted)">
              Akun Anda diproteksi dengan otentikasi Bearer Token Sanctum. Data keuangan dan penempatan Anda diisolasi dari penghuni lain.
            </span>
          </div>
        </div>
      </div>
    </div>
  `;

  return {
    html,
    after() {
      // Handler Logout dengan modal konfirmasi
      const logoutBtn = document.getElementById('btn-profile-logout');
      logoutBtn?.addEventListener('click', () => {
        modal(`
          ${mhead('Konfirmasi Keluar', 'Sesi Akun Penghuni', 'logout')}
          <div class="mb">
            <p style="font-size:13px;color:var(--text);margin-bottom:16px">
              Apakah Anda yakin ingin keluar dari Portal Penghuni KosLedger? Token sesi lokal akan dibersihkan.
            </p>
            <div class="grid g2" style="margin:0">
              <button class="btn s" onclick="document.getElementById('modal')?.remove()">
                ${ms('close')}Batal
              </button>
              <button class="btn p" id="btn-confirm-logout" style="background:var(--err);border-color:var(--err)">
                ${ms('logout')}Ya, Keluar
              </button>
            </div>
          </div>
        `);

        document.getElementById('btn-confirm-logout')?.addEventListener('click', async () => {
          closeModal();
          try {
            await logout();
          } finally {
            clearSession();
            location.hash = 'login';
          }
        });
      });
    },
  };
}
