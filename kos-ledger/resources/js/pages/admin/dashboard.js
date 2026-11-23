import { admin } from '../../api/dashboard.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, ms } from '../../components/ui.js';
import { statCard } from '../../components/widgets.js';
import { emptyView, errorView } from '../../components/states.js';
import { esc } from '../../utils/format.js';

export default async function dashboard({ user }) {
  let data = null;

  try {
    data = await admin();
  } catch (err) {
    return {
      html: `
        <div style="padding:16px 0">
          ${pageHead({
            crumb: `KosLedger › <b>Panel Admin</b>`,
            title: 'Dashboard Administrator',
            sub: 'Ringkasan operasional dan kondisi keterisian hunian kost.',
          })}
          ${errorView(apiError(err) || 'Terjadi kesalahan saat memuat data dashboard administrator.')}
          <div style="margin-top:16px">
            <button class="btn s" id="btn-retry-admin">${ms('refresh')}Muat Ulang Halaman</button>
          </div>
        </div>
      `,
      after() {
        document.getElementById('btn-retry-admin')?.addEventListener('click', () => go('admin'));
      },
    };
  }

  const totalRooms = Number(data?.total_rooms) || 0;
  const occupiedRooms = Number(data?.occupied_rooms) || 0;
  const availableRooms = Number(data?.available_rooms) || 0;
  const activeTenants = Number(data?.active_tenants) || 0;
  const activeOccupancies = Number(data?.active_occupancies) || 0;

  // Rasio okupansi (persentase keterisian kamar terhadap total kamar)
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  // Cek apakah data masih kosong (belum ada kamar maupun penghuni)
  const isEmpty = totalRooms === 0 && activeTenants === 0;

  const html = `
    <!-- Header Dashboard Admin -->
    ${pageHead({
      crumb: `KosLedger › <b>Panel Admin</b>`,
      title: `Selamat Datang, ${esc(user.name)}`,
      sub: 'Pusat komando tata kelola unit kamar, alokasi hunian, dan master data pengguna kost.',
      acts: `
        <span class="sel" style="background:var(--c3)">${ms('verified_user')}Administrator</span>
        <button class="btn s" id="btn-refresh-dashboard">${ms('refresh')}Segarkan Data</button>
      `,
    })}

    <!-- Banner Informasi Operasional -->
    <div class="sand">
      ${ms('info')}
      <b>PANEL KENDALI ADMINISTRATOR KOSLEDGER</b>
      <span style="flex:1 1 260px">
        Kelola inventaris kamar fisik, registrasi akun penghuni, dan pastikan alokasi penempatan hunian terdata secara akurat.
      </span>
      ${pill('Sistem Master Data', 'ok dot')}
    </div>

    ${isEmpty ? `
      <!-- Empty State Ketika Belum Ada Data Kamar/Penghuni -->
      <div class="card" style="padding:40px 20px;text-align:center">
        ${emptyView(
          'Belum Ada Data Master Kost',
          'Sistem belum memiliki unit kamar atau penghuni terdaftar. Mulai dengan menambahkan kamar pertama dan mendaftarkan akun penghuni baru.',
          'meeting_room'
        )}
        <div style="display:flex;gap:12px;justify-content:center;margin-top:20px;flex-wrap:wrap">
          <button class="btn p" data-go="admin-kamar">${ms('add')}Kelola Kamar Baru</button>
          <button class="btn s" data-go="admin-users">${ms('person_add')}Daftarkan Penghuni</button>
        </div>
      </div>
    ` : `
      <!-- Ringkasan Statistik Utama -->
      <div class="grid g4" style="margin-bottom:20px">
        ${statCard(
          'TOTAL KAMAR',
          totalRooms,
          `<span style="color:var(--text)">${occupiedRooms} Terisi • ${availableRooms} Kosong</span>`,
          'meeting_room'
        )}

        ${statCard(
          'KAMAR TERISI',
          occupiedRooms,
          `<span style="color:var(--primary-d);font-weight:600">${occupancyRate}% dari Total Unit</span>`,
          'door_front'
        )}

        ${statCard(
          'KAMAR TERSEDIA',
          availableRooms,
          availableRooms > 0
            ? `<span style="color:var(--ok)">Siap Ditempati</span>`
            : `<span style="color:var(--warn)">Kamar Penuh</span>`,
          'door_open'
        )}

        ${statCard(
          'PENGHUNI AKTIF',
          activeTenants,
          `<span style="color:var(--text)">Akun Penyewa Aktif</span>`,
          'group'
        )}
      </div>

      <!-- Kartu Rasio Okupansi Properti & Penempatan Aktif -->
      <div class="grid g2" style="margin-bottom:20px;align-items:stretch">
        <!-- Visual Rasio Okupansi -->
        <div class="card" style="display:flex;flex-direction:column;justify-content:space-between">
          <div>
            <div class="ctr" style="margin-bottom:12px;flex-wrap:wrap;gap:8px">
              <div style="display:flex;gap:12px;align-items:center">
                <span class="stat" style="margin:0">
                  <span class="ic" style="position:static;width:38px;height:38px;border-radius:10px;background:var(--primary);color:#fff">
                    ${ms('analytics')}
                  </span>
                </span>
                <div>
                  <h3 style="font-size:15px;color:var(--primary-d);margin:0">Tingkat Okupansi Kost</h3>
                  <small style="color:var(--muted)">Persentase keterisian unit kamar</small>
                </div>
              </div>
              <div>
                ${pill(
                  occupancyRate >= 80 ? 'Okupansi Tinggi' : (occupancyRate > 0 ? 'Tersedia Sebagian' : 'Unit Kosong'),
                  occupancyRate >= 80 ? 'ok dot' : 'mint dot'
                )}
              </div>
            </div>

            <div class="note" style="margin:14px 0;background:var(--c1);align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px">
              <div>
                <span class="lbl" style="font-size:10px">RASIO TERISI</span>
                <div style="font-size:32px;font-weight:700;color:var(--primary-d);line-height:1.2">
                  ${occupancyRate}%
                </div>
              </div>
              <div style="flex:1 1 200px;max-width:320px">
                <div class="bar" style="height:10px;border-radius:999px;background:var(--line);overflow:hidden">
                  <i style="width:${occupancyRate}%;background:var(--primary);height:100%;display:block;border-radius:999px"></i>
                </div>
                <div class="ctr" style="margin-top:6px;font-size:11px;color:var(--muted)">
                  <span>${occupiedRooms} Unit Terisi</span>
                  <span>${availableRooms} Unit Kosong</span>
                </div>
              </div>
            </div>
          </div>

          <p style="font-size:12px;color:var(--muted);margin:0">
            Perhitungan rasio didasarkan pada kamar yang berstatus terisi terhadap total seluruh unit kamar yang terdaftar.
          </p>
        </div>

        <!-- Penempatan Aktif & Kapasitas -->
        <div class="card" style="display:flex;flex-direction:column;justify-content:space-between">
          <div>
            <div class="ctr" style="margin-bottom:12px;flex-wrap:wrap;gap:8px">
              <div style="display:flex;gap:12px;align-items:center">
                <span class="stat" style="margin:0">
                  <span class="ic" style="position:static;width:38px;height:38px;border-radius:10px;background:var(--primary);color:#fff">
                    ${ms('badge')}
                  </span>
                </span>
                <div>
                  <h3 style="font-size:15px;color:var(--primary-d);margin:0">Alokasi Penempatan Aktif</h3>
                  <small style="color:var(--muted)">Hubungan sewa penghuni dengan unit kamar</small>
                </div>
              </div>
              <div>
                ${pill(`${activeOccupancies} Alokasi Aktif`, 'ok')}
              </div>
            </div>

            <div class="note" style="margin:14px 0;background:var(--c1);display:block">
              <div class="kv">
                <span>Total Penempatan Berjalan</span>
                <b style="font-size:15px;color:var(--primary-d)">${activeOccupancies} Penghuni</b>
              </div>
              <div class="kv">
                <span>Total Penghuni Terdaftar</span>
                <b>${activeTenants} Orang</b>
              </div>
              <div class="kv" style="border-top:1px solid var(--c3);padding-top:8px;margin-top:8px">
                <span>Penghuni Siap Ditempatkan</span>
                <b style="color:var(--primary)">${Math.max(0, activeTenants - activeOccupancies)} Orang</b>
              </div>
            </div>
          </div>

          <div style="display:flex;gap:8px;justify-content:flex-end">
            <button class="btn s sm" data-go="admin-penghuni">
              ${ms('badge')}Buka Penempatan Kamar
            </button>
          </div>
        </div>
      </div>
    `}

    <!-- Bagian Aksi Cepat Operasional -->
    <div style="margin-bottom:20px">
      <div class="ctr" style="margin-bottom:12px">
        <h3 style="font-size:16px;display:flex;gap:8px;align-items:center">
          ${ms('bolt')}Aksi Cepat Manajemen
        </h3>
        <small style="color:var(--muted)">Akses langsung ke modul administrasi utama</small>
      </div>

      <div class="grid g4">
        <!-- Aksi 1: Manajemen Kamar -->
        <div class="card" style="display:flex;flex-direction:column;justify-content:space-between">
          <div>
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
              <span class="ic" style="width:36px;height:36px;border-radius:8px;background:var(--c1);color:var(--primary);display:grid;place-items:center">
                ${ms('meeting_room')}
              </span>
              <b style="font-size:14px;color:var(--primary-d)">Manajemen Kamar</b>
            </div>
            <p style="font-size:12px;color:var(--muted);margin:0 0 14px;line-height:1.4">
              Kelola daftar nomor kamar kost, sesuaikan tarif sewa bulanan, kapasitas, dan status perbaikan.
            </p>
          </div>
          <button class="btn s sm" data-go="admin-kamar" style="width:100%">
            ${ms('arrow_forward')}Buka Kamar (${totalRooms})
          </button>
        </div>

        <!-- Aksi 2: Manajemen Pengguna -->
        <div class="card" style="display:flex;flex-direction:column;justify-content:space-between">
          <div>
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
              <span class="ic" style="width:36px;height:36px;border-radius:8px;background:var(--c1);color:var(--primary);display:grid;place-items:center">
                ${ms('group')}
              </span>
              <b style="font-size:14px;color:var(--primary-d)">Manajemen Pengguna</b>
            </div>
            <p style="font-size:12px;color:var(--muted);margin:0 0 14px;line-height:1.4">
              Daftarkan akun penyewa kamar baru, perbarui informasi kontak nomor telepon, dan nonaktifkan akun.
            </p>
          </div>
          <button class="btn s sm" data-go="admin-users" style="width:100%">
            ${ms('arrow_forward')}Buka Pengguna (${activeTenants})
          </button>
        </div>

        <!-- Aksi 3: Penempatan Penghuni -->
        <div class="card" style="display:flex;flex-direction:column;justify-content:space-between">
          <div>
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
              <span class="ic" style="width:36px;height:36px;border-radius:8px;background:var(--c1);color:var(--primary);display:grid;place-items:center">
                ${ms('badge')}
              </span>
              <b style="font-size:14px;color:var(--primary-d)">Penempatan Penghuni</b>
            </div>
            <p style="font-size:12px;color:var(--muted);margin:0 0 14px;line-height:1.4">
              Alokasikan kamar untuk penghuni yang aktif dengan validasi ketersediaan kapasitas kamar.
            </p>
          </div>
          <button class="btn s sm" data-go="admin-penghuni" style="width:100%">
            ${ms('arrow_forward')}Alokasi Hunian
          </button>
        </div>

        <!-- Aksi 4: Laporan Hunian -->
        <div class="card" style="display:flex;flex-direction:column;justify-content:space-between">
          <div>
            <div style="display:flex;gap:10px;align-items:center;margin-bottom:8px">
              <span class="ic" style="width:36px;height:36px;border-radius:8px;background:var(--c1);color:var(--primary);display:grid;place-items:center">
                ${ms('bar_chart')}
              </span>
              <b style="font-size:14px;color:var(--primary-d)">Laporan Hunian</b>
            </div>
            <p style="font-size:12px;color:var(--muted);margin:0 0 14px;line-height:1.4">
              Periksa log riwayat okupansi kamar, laporan status sewa, dan data penempatan historis.
            </p>
          </div>
          <button class="btn s sm" data-go="admin-laporan" style="width:100%">
            ${ms('arrow_forward')}Buka Laporan
          </button>
        </div>
      </div>
    </div>
  `;

  return {
    html,
    after() {
      // Tombol Segarkan Data
      document.getElementById('btn-refresh-dashboard')?.addEventListener('click', () => {
        go('admin');
      });
    },
  };
}
