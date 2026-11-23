import { occupancyReport } from '../../api/reports.js';
import { owner } from '../../api/dashboard.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, avatar, ms, modal, mhead, kvs } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { emptyView, errorView } from '../../components/states.js';
import { esc, tgl, initials } from '../../utils/format.js';

const head = () =>
  pageHead({
    crumb: `Pemantauan › <b>Direktori Penghuni</b>`,
    title: 'Monitoring Penghuni Kos',
    sub: 'Pantau daftar penyewa aktif, penempatan unit kamar, dan masa sewa properti kos.',
    acts: `<span class="ro-badge">${ms('visibility')}Mode Pantau Pemilik</span>`,
  });

function occupantDetailModal(item) {
  const isAktif = item.status === 'active';
  const kamar = item.room?.room_number ? `Kamar ${esc(item.room.room_number)}` : 'Belum ditentukan';
  const nama = item.user?.name || 'Penghuni';
  const nickname = item.user?.nickname ? esc(item.user.nickname) : null;
  const mulai = item.start_date ? tgl(item.start_date) : '–';
  const selesai = item.end_date ? tgl(item.end_date) : 'Berjalan (Kontrak Aktif)';

  return `
    ${mhead(nama, 'Detail Penyewa & Penempatan Kamar', 'person')}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px">
        <span class="lbl" style="font-size:11px">STATUS PENEMPATAN</span>
        ${pill(isAktif ? 'Aktif Menempati' : 'Selesai', isAktif ? 'ok dot' : 'dot')}
      </div>
      ${kvs([
        ['Nama Lengkap', esc(nama)],
        ['Nama Panggilan', nickname ? nickname : '–'],
        ['Kamar Ditempati', kamar],
        ['Mulai Masuk Sewa', mulai],
        ['Akhir Masa Sewa', selesai],
        ['Status Hunian', isAktif ? 'Aktif' : esc(item.status || 'Nonaktif')],
      ])}
      <div class="note" style="margin-top:14px">
        ${ms('shield')}
        <span style="font-size:12px;color:var(--muted)">
          Mode Pantau Pemilik: Data penyewa disinkronkan langsung dari administrasi kos. Registrasi dan administrasi identitas dikelola oleh pengelola kos.
        </span>
      </div>
    </div>
    <footer class="mf2">
      <button class="btn s" data-go="pemilik-kamar" data-act="close">${ms('meeting_room')}Lihat Katalog Kamar</button>
      <button class="btn p" data-act="close">Tutup</button>
    </footer>`;
}

function occupantRows(list) {
  return list.map((item, idx) => {
    const isAktif = item.status === 'active';
    const kamarStr = item.room?.room_number ? `Kamar ${esc(item.room.room_number)}` : '-';
    const nama = item.user?.name || 'Penghuni';
    const nickname = item.user?.nickname ? `“${esc(item.user.nickname)}”` : '';

    return [
      `<div class="cell">
        ${avatar(esc(initials(nama)))}
        <span>
          <b>${esc(nama)}</b>
          ${nickname ? `<small style="color:var(--muted)">${nickname}</small>` : ''}
        </span>
      </div>`,
      `<span class="chip">● ${kamarStr}</span>`,
      `<span>
        <b>${item.start_date ? tgl(item.start_date) : '–'}</b>
        ${item.end_date ? `<small style="display:block;color:var(--muted)">s/d ${tgl(item.end_date)}</small>` : '<small style="display:block;color:var(--primary)">Aktif Berjalan</small>'}
      </span>`,
      `<span data-status-val="${item.status}">${pill(isAktif ? 'Aktif Menempati' : 'Selesai', isAktif ? 'ok dot' : 'dot')}</span>`,
      `<div class="acts" style="justify-content:flex-end">
        <button class="btn sm s" data-occ-index="${idx}" aria-label="Lihat detail penghuni">${ms('visibility')} Detail</button>
      </div>`,
    ];
  });
}

export default async function occupantsMonitoringPage() {
  let occupants = [];
  let dashboardStats = null;
  let fetchError = null;

  try {
    const [dashRes, occRes] = await Promise.all([
      owner().catch(() => null),
      occupancyReport(),
    ]);
    dashboardStats = dashRes;
    occupants = Array.isArray(occRes?.data) ? occRes.data : Array.isArray(occRes) ? occRes : [];
  } catch (err) {
    fetchError = err;
  }

  if (fetchError && !occupants.length) {
    return {
      html: `
        ${head()}
        ${errorView(apiError(fetchError))}
        <button class="btn s" id="retry-occupants">${ms('refresh')}Coba lagi</button>`,
      after() {
        document.getElementById('retry-occupants')?.addEventListener('click', () => go('pemilik-penghuni'));
      },
    };
  }

  // Statistik hunian
  const totalOccupants = occupants.length;
  const activeCount = dashboardStats?.active_tenants ?? occupants.filter((o) => o.status === 'active').length;
  const occupiedRooms = dashboardStats?.occupied_rooms ?? new Set(occupants.filter((o) => o.status === 'active').map((o) => o.room?.id).filter(Boolean)).size;
  const totalRooms = dashboardStats?.total_rooms ?? (occupiedRooms || 1);
  const occRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  return {
    html: `
      ${head()}

      <!-- 4 Kartu KPI Monitoring Penghuni -->
      <div class="grid g4" style="margin-bottom:16px">
        ${statCard('Penghuni Aktif', `${activeCount} <small>Orang</small>`, pill('Penyewa Terdaftar', 'ok'), 'groups')}
        ${statCard('Kamar Terisi', `${occupiedRooms} <small>Unit</small>`, pill(`${occRate}% Okupansi`, 'mint'), 'meeting_room')}
        ${statCard('Kapasitas Kamar', `${totalRooms} <small>Unit</small>`, '<span class="chip" style="background:var(--c1)">Total Properti</span>', 'domain')}
        ${statCard('Total Riwayat Huni', `${totalOccupants} <small>Catatan</small>`, '<span class="chip" style="background:var(--c1)">Log Penempatan</span>', 'badge')}
      </div>

      <div class="info-banner">
        <div class="ctr" style="align-items:flex-start">
          <div>
            <h3 class="sh">Direktori Pemantauan Penyewa Kos</h3>
            <p class="sub">Informasi penempatan unit kamar, tanggal mulai sewa, dan status hunian disinkronkan langsung dari laporan operasional (<code>/reports/occupancy</code>).</p>
          </div>
          <button class="btn s sm" data-go="pemilik-kamar">${ms('meeting_room')}Monitoring Kamar</button>
        </div>
      </div>

      <div class="card">
        <div class="filter" style="margin-bottom:14px;flex-wrap:wrap;gap:12px">
          ${searchField('Cari nama penyewa, nomor kamar...', 'tp-owner-occupants')}
          <div class="tabs" id="owner-occ-status-tabs">
            <button class="on" data-status="">Semua Penyewa</button>
            <button data-status="active">Aktif</button>
            <button data-status="completed">Selesai</button>
          </div>
        </div>

        ${dataTable(
          ['Nama Penyewa', 'Kamar Ditempati', 'Periode Sewa', 'Status Hunian', '>Aksi'],
          occupantRows(occupants),
          {
            id: 'tp-owner-occupants',
            min: 740,
            emptyTitle: 'Belum ada penghuni terdata',
            emptyText: 'Data penempatan penyewa kamar kos akan muncul di sini setelah dicatat di sistem.',
            emptyIcon: 'groups',
          }
        )}

        <div class="foot" style="border-top:1px solid var(--c1);margin-top:14px">
          <span style="display:flex;gap:6px;align-items:center">
            ${ms('verified')}Data penyewa disinkronkan real-time dari buku penempatan hunian kos.
          </span>
          <span style="color:var(--muted)">Total ${totalOccupants} data hunian</span>
        </div>
      </div>
    `,
    after() {
      // Event listener: Filter tabs
      const tabs = document.querySelectorAll('#owner-occ-status-tabs button');
      tabs.forEach((btn) => {
        btn.addEventListener('click', () => {
          tabs.forEach((b) => b.classList.remove('on'));
          btn.classList.add('on');
          const st = btn.dataset.status;
          document.querySelectorAll('#tp-owner-occupants tbody tr').forEach((tr) => {
            if (!st) {
              tr.hidden = false;
            } else {
              const val = tr.querySelector('[data-status-val]')?.dataset?.statusVal;
              tr.hidden = val !== st;
            }
          });
        });
      });

      // Event listener: Detail modal
      document.querySelectorAll('[data-occ-index]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.occIndex);
          const item = occupants[idx];
          if (item) {
            modal(occupantDetailModal(item));
          }
        });
      });
    },
  };
}
