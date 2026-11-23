import { getRooms, getRoom } from '../../api/rooms.js';
import { occupancyReport } from '../../api/reports.js';
import { owner } from '../../api/dashboard.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, avatar, ms, modal, mhead, kvs } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { emptyView, errorView, loadingView } from '../../components/states.js';
import { esc, rp, tgl } from '../../utils/format.js';

const STATUS_MAP = {
  available: { label: 'Tersedia', cls: 'mint dot' },
  occupied: { label: 'Terisi', cls: 'ok dot' },
  maintenance: { label: 'Perbaikan', cls: 'warn dot' },
};

const head = () =>
  pageHead({
    crumb: `Pemantauan › <b>Ketersediaan Unit Kamar</b>`,
    title: 'Monitoring Kamar Kos',
    sub: 'Pantau ketersediaan unit kamar kos, kapasitas hunian, tarif sewa, dan status penghuni.',
    acts: `<span class="ro-badge">${ms('visibility')}Mode Pantau Pemilik</span>`,
  });

function detailModalHtml(r) {
  const st = STATUS_MAP[r.status] || { label: r.status, cls: '' };
  const occupancies = Array.isArray(r.active_occupancies) ? r.active_occupancies : [];
  
  let occupantsContent = '<span style="color:var(--muted)">Belum ada penghuni (unit kosong)</span>';
  if (occupancies.length) {
    occupantsContent = occupancies
      .map((o) => {
        const u = o.user || {};
        const nama = esc(u.name || u.nickname || 'Penghuni');
        const periode = o.start_date ? `<small style="display:block;color:var(--muted)">Sejak: ${tgl(o.start_date)}</small>` : '';
        return `<div><b>${nama}</b>${periode}</div>`;
      })
      .join('<hr style="border:0;border-top:1px solid var(--c1);margin:6px 0">');
  } else if (r.occupant_name) {
    occupantsContent = `<b>${esc(r.occupant_name)}</b>`;
  }

  return `
    ${mhead(`Kamar ${esc(r.room_number)}`, 'Detail Spesifikasi & Ketersediaan', 'meeting_room')}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px">
        <span class="lbl" style="font-size:11px">STATUS UNIT</span>
        ${pill(st.label, st.cls)}
      </div>
      ${kvs([
        ['Nomor Unit', `Kamar ${esc(r.room_number)}`],
        ['Kapasitas Standar', `${r.capacity || 1} Orang`],
        ['Keterisian Saat Ini', `${occupancies.length || (r.status === 'occupied' ? 1 : 0)} Orang`],
        ['Tarif Sewa', r.monthly_rate ? `${rp(r.monthly_rate)} / bulan` : '<span style="color:var(--muted)">Mengikuti tarif reguler</span>'],
        ['Penghuni Aktif', occupantsContent],
      ])}
      <div class="note" style="margin-top:14px">
        ${ms('shield')}
        <span style="font-size:12px;color:var(--muted)">
          Mode Pantau Pemilik: Data disinkronkan langsung dari administrasi kos. Perubahan status fisik atau penempatan dikelola pengelola.
        </span>
      </div>
    </div>
    <footer class="mf2">
      <button class="btn p" data-act="close">Tutup</button>
    </footer>`;
}

// Menampilkan modal rincian kamar
async function showRoomDetail(roomData) {
  modal(`
    ${mhead(`Kamar ${esc(roomData.room_number || '')}`, 'Memuat Data…', 'meeting_room')}
    <div class="mb">${loadingView('Mengambil rincian data kamar…')}</div>
    <footer class="mf2"><button class="btn s" data-act="close">Batal</button></footer>
  `);

  if (roomData.id) {
    try {
      const fullRoom = await getRoom(roomData.id);
      modal(detailModalHtml(fullRoom));
      return;
    } catch {
      // Jika endpoint getRoom 403 / gagal, gunakan data yang sudah ada di memori
    }
  }

  modal(detailModalHtml(roomData));
}

function roomRows(rooms) {
  return rooms.map((r) => {
    const st = STATUS_MAP[r.status] || { label: r.status, cls: '' };
    const occupiedCount = Number(r.occupied_count) || (r.status === 'occupied' ? 1 : 0);
    const occupantLabel = r.occupant_name
      ? esc(r.occupant_name)
      : occupiedCount > 0
      ? `<span style="color:var(--primary-d)">${occupiedCount} Penghuni Aktif</span>`
      : `<span style="color:var(--muted)">Kamar Kosong</span>`;

    return [
      `<div class="cell">
        ${avatar(esc(r.room_number.replace('-', '')))}
        <span><b>Kamar ${esc(r.room_number)}</b></span>
      </div>`,
      `<span><b>${r.capacity || 1} Orang</b><small style="color:var(--muted);display:block">Terisi: ${occupiedCount} orang</small></span>`,
      `<span class="num">${r.monthly_rate ? rp(r.monthly_rate) : '<span style="color:var(--muted)">-</span>'}</span>`,
      `<span data-status-val="${r.status}">${pill(st.label, st.cls)}</span>`,
      `<span>${occupantLabel}</span>`,
      `<div class="acts" style="justify-content:flex-end">
        <button class="btn sm s" data-room-idx="${esc(r.room_number)}" aria-label="Lihat detail kamar">${ms('visibility')} Detail</button>
      </div>`,
    ];
  });
}

export default async function roomsMonitoringPage() {
  let rooms = [];
  let dashboardStats = null;
  let isFallback = false;
  let fetchError = null;

  // 1. Ambil ringkasan dashboard owner untuk data agregat KPI resmi
  try {
    dashboardStats = await owner();
  } catch {
    dashboardStats = null;
  }

  // 2. Ambil daftar kamar (coba GET /rooms, bila 403 fallback ke GET /reports/occupancy)
  try {
    rooms = await getRooms();
  } catch (err) {
    if (err.response?.status === 403) {
      isFallback = true;
      try {
        const occRes = await occupancyReport();
        const occList = Array.isArray(occRes?.data) ? occRes.data : Array.isArray(occRes) ? occRes : [];
        
        // Rekonstruksi data kamar dari penempatan hunian aktif
        rooms = occList.map((occ) => ({
          id: occ.room?.id || null,
          room_number: occ.room?.room_number || `Unit #${occ.room_id}`,
          capacity: 1,
          monthly_rate: null,
          status: occ.status === 'active' ? 'occupied' : 'available',
          occupied_count: occ.status === 'active' ? 1 : 0,
          occupant_name: occ.user?.name || occ.user?.nickname || 'Penghuni',
          active_occupancies: [occ],
        }));
      } catch (fallbackErr) {
        fetchError = fallbackErr;
      }
    } else {
      fetchError = err;
    }
  }

  if (fetchError && !rooms.length && !dashboardStats) {
    return {
      html: `
        ${head()}
        ${errorView(apiError(fetchError))}
        <button class="btn s" id="retry-rooms">${ms('refresh')}Coba lagi</button>`,
      after() {
        document.getElementById('retry-rooms')?.addEventListener('click', () => go('pemilik-kamar'));
      },
    };
  }

  // Perhitungan statistik unit
  const total = dashboardStats?.total_rooms ?? rooms.length;
  const occupied = dashboardStats?.occupied_rooms ?? rooms.filter((r) => r.status === 'occupied' || Number(r.occupied_count) > 0).length;
  const available = Math.max(0, total - occupied);
  const occRate = total > 0 ? Math.round((occupied / total) * 100) : 0;
  const activeTenants = dashboardStats?.active_tenants ?? occupied;

  return {
    html: `
      ${head()}

      <!-- 4 Kartu KPI Monitoring Kamar -->
      <div class="grid g4" style="margin-bottom:16px">
        ${statCard('Total Kapasitas Unit', `${total} <small>Kamar</small>`, '<span class="chip" style="background:var(--c1)">Seluruh Unit Kos</span>', 'domain')}
        ${statCard('Kamar Terhuni', `${occupied} <small>Kamar</small>`, pill(`${occRate}% Okupansi`, 'ok'), 'meeting_room')}
        ${statCard('Kamar Siap Huni', `${available} <small>Kamar</small>`, pill(`${available} Unit Kosong`, available > 0 ? 'mint dot' : 'warn dot'), 'event_available')}
        ${statCard('Penghuni Terdaftar', `${activeTenants} <small>Orang</small>`, pill('Penyewa Aktif', 'ok'), 'groups')}
      </div>

      ${
        isFallback
          ? `<div class="info-banner">
              <div class="ctr">
                ${ms('info')}
                <span style="font-size:13px">Menampilkan data kamar aktif berdasarkan rekapitulasi hunian (<code>/reports/occupancy</code>). Data operasional master kamar dikelola oleh tim administrasi kos.</span>
              </div>
            </div>`
          : ''
      }

      <!-- Kartu Tabel Monitoring Kamar -->
      <div class="card">
        <div class="filter" style="margin-bottom:14px;flex-wrap:wrap;gap:12px">
          ${searchField('Cari nomor kamar, penghuni...', 'tk-owner-rooms')}
          <div class="tabs" id="room-status-tabs">
            <button class="on" data-status="">Semua Unit</button>
            <button data-status="available">Tersedia</button>
            <button data-status="occupied">Terisi</button>
            <button data-status="maintenance">Perbaikan</button>
          </div>
        </div>

        ${dataTable(['Nomor Kamar', 'Kapasitas & Hunian', '>Tarif Sewa / Bln', 'Status', 'Penghuni Aktif', '>Aksi'], roomRows(rooms), {
          id: 'tk-owner-rooms',
          min: 780,
          emptyTitle: 'Belum ada data kamar',
          emptyText: 'Data unit kamar akan muncul di sini setelah disinkronkan dengan server.',
          emptyIcon: 'meeting_room',
        })}

        <div class="foot" style="border-top:1px solid var(--c1);margin-top:14px">
          <span style="display:flex;gap:6px;align-items:center">
            ${ms('verified')} Data monitoring kamar disinkronkan real-time dari buku operasional properti.
          </span>
          <span style="color:var(--muted)">Total ${rooms.length} catatan unit terdata</span>
        </div>
      </div>
    `,
    after() {
      // Filter status tab client-side
      const tabs = document.querySelectorAll('#room-status-tabs button');
      tabs.forEach((btn) => {
        btn.addEventListener('click', () => {
          tabs.forEach((b) => b.classList.remove('on'));
          btn.classList.add('on');
          const st = btn.dataset.status;
          document.querySelectorAll('#tk-owner-rooms tbody tr').forEach((tr) => {
            if (!st) {
              tr.hidden = false;
            } else {
              const val = tr.querySelector('[data-status-val]')?.dataset?.statusVal;
              tr.hidden = val !== st;
            }
          });
        });
      });

      // Tombol Detail Kamar
      document.querySelectorAll('[data-room-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const roomNum = btn.dataset.roomIdx;
          const targetRoom = rooms.find((r) => r.room_number === roomNum);
          if (targetRoom) {
            showRoomDetail(targetRoom);
          }
        });
      });
    },
  };
}
