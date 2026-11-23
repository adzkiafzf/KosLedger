import { getRooms, getRoom } from '../../api/rooms.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, avatar, ms, modal, mhead, kvs } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { emptyView, errorView, loadingView } from '../../components/states.js';
import { esc, rp } from '../../utils/format.js';

const STATUS_MAP = {
  available: { label: 'Tersedia', cls: 'mint dot' },
  occupied: { label: 'Terisi', cls: 'ok dot' },
  maintenance: { label: 'Perbaikan', cls: 'warn dot' },
};

const head = () =>
  pageHead({
    crumb: `Administrasi › <b>Katalog Kamar</b>`,
    title: 'Manajemen Kamar',
    sub: 'Pantau ketersediaan unit kamar kos, kapasitas hunian, dan tarif sewa bulanan.',
    acts: `<span class="pill ok">${ms('visibility')}Mode Pantau Bendahara</span>`,
  });

function detailModalHtml(r) {
  const st = STATUS_MAP[r.status] || { label: r.status, cls: '' };
  const occupancies = Array.isArray(r.active_occupancies) ? r.active_occupancies : [];
  const occupantsText = occupancies.length
    ? occupancies.map((o) => esc(o.user?.name || o.user?.nickname || 'Penghuni')).join(', ')
    : '<span style="color:var(--muted)">Belum ada penghuni (kamar kosong)</span>';

  return `
    ${mhead(`Kamar ${r.room_number}`, 'Detail Spesifikasi & Ketersediaan', 'meeting_room')}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px">
        <span class="lbl" style="font-size:11px">STATUS OPERASIONAL</span>
        ${pill(st.label, st.cls)}
      </div>
      ${kvs([
        ['Nomor Unit', `Kamar ${esc(r.room_number)}`],
        ['Kapasitas Maksimal', `${r.capacity} Orang`],
        ['Terisi Saat Ini', `${occupancies.length} Orang`],
        ['Tarif Sewa', `${rp(r.monthly_rate)} / bulan`],
        ['Penghuni Aktif', occupantsText],
      ])}
      <div class="note" style="margin-top:14px">
        ${ms('info')}
        <span style="font-size:12px;color:var(--muted)">
          Penambahan kamar, penyesuaian tarif dasar, dan penempatan penghuni dikelola oleh <b>Admin kos</b>.
        </span>
      </div>
    </div>
    <footer class="mf2">
      <button class="btn p" data-act="close">Tutup</button>
    </footer>`;
}

async function showRoomDetail(id) {
  modal(`
    ${mhead('Memuat Detail Kamar…', '', 'meeting_room')}
    <div class="mb">${loadingView('Mengambil data kamar dari server…')}</div>
    <footer class="mf2"><button class="btn s" data-act="close">Batal</button></footer>
  `);

  try {
    const room = await getRoom(id);
    modal(detailModalHtml(room));
  } catch (err) {
    modal(`
      ${mhead('Gagal Memuat Kamar', '', 'error')}
      <div class="mb">${errorView(apiError(err))}</div>
      <footer class="mf2"><button class="btn p" data-act="close">Tutup</button></footer>
    `);
  }
}

function roomRows(rooms) {
  return rooms.map((r) => {
    const st = STATUS_MAP[r.status] || { label: r.status, cls: '' };
    const occupiedCount = Number(r.occupied_count) || 0;
    return [
      `<div class="cell">${avatar(esc(r.room_number.replace('-', '')))}<span><b>Kamar ${esc(r.room_number)}</b></span></div>`,
      `<span><b>${r.capacity} Orang</b><small style="color:var(--muted);display:block">Terisi: ${occupiedCount} orang</small></span>`,
      `<span class="num">${rp(r.monthly_rate)}</span>`,
      `<span data-status-val="${r.status}">${pill(st.label, st.cls)}</span>`,
      `<div class="acts" style="justify-content:flex-end">
        <button class="btn sm s" data-room-detail="${r.id}" aria-label="Lihat detail kamar">${ms('visibility')} Detail</button>
      </div>`,
    ];
  });
}

export default async function roomsPage() {
  let rooms = [];
  try {
    rooms = await getRooms();
  } catch (err) {
    return {
      html: `
        ${head()}
        ${errorView(apiError(err))}
        <button class="btn s" id="retry-rooms">${ms('refresh')}Coba lagi</button>`,
      after() {
        document.getElementById('retry-rooms')?.addEventListener('click', () => go('bendahara-kamar'));
      },
    };
  }

  const total = rooms.length;
  const occupied = rooms.filter((r) => r.status === 'occupied' || Number(r.occupied_count) > 0).length;
  const available = rooms.filter((r) => r.status === 'available').length;
  const occRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

  return {
    html: `
      ${head()}
      <div class="grid g3">
        ${statCard('Total Kapasitas', `${total} <small>Unit</small>`, '<span class="chip" style="background:var(--c1)">Unit Kamar Terdata</span>', 'domain')}
        ${statCard('Kamar Terisi', `${occupied} <small>Unit</small>`, pill(`${occRate}% Okupansi`, 'ok'), 'meeting_room')}
        ${statCard('Kamar Tersedia', `${available} <small>Unit</small>`, pill(`${available} Kosong`, available > 0 ? 'mint dot' : 'warn dot'), 'event_available')}
      </div>

      <div class="card" style="background:var(--c1);border-left:4px solid var(--primary);margin-bottom:16px">
        <div class="ctr" style="align-items:flex-start">
          <div>
            <h3 style="margin-bottom:4px">Katalog Ketersediaan & Fasilitas Kamar</h3>
            <p class="sub" style="margin:0">Data spesifikasi unit disinkronkan langsung dari administrasi kos untuk referensi penerbitan tagihan sewa.</p>
          </div>
          <span class="pill mint">${ms('task_alt')}Sinkron</span>
        </div>
      </div>

      <div class="card">
        <div class="filter" style="margin-bottom:14px;flex-wrap:wrap;gap:12px">
          ${searchField('Cari nomor kamar, kapasitas...', 'tk-rooms')}
          <div class="tabs" id="room-status-tabs">
            <button class="on" data-status="">Semua</button>
            <button data-status="available">Tersedia</button>
            <button data-status="occupied">Terisi</button>
            <button data-status="maintenance">Perbaikan</button>
          </div>
        </div>

        ${dataTable(['Nomor Kamar', 'Kapasitas & Hunian', '>Tarif Sewa / Bln', 'Status', '>Aksi'], roomRows(rooms), {
          id: 'tk-rooms',
          min: 680,
          emptyTitle: 'Belum ada kamar terdaftar',
          emptyText: 'Data kamar akan muncul di sini setelah didaftarkan oleh admin.',
          emptyIcon: 'meeting_room',
        })}
      </div>`,
    after() {
      // Event listener: Filter tabs
      const tabs = document.querySelectorAll('#room-status-tabs button');
      tabs.forEach((btn) => {
        btn.addEventListener('click', () => {
          tabs.forEach((b) => b.classList.remove('on'));
          btn.classList.add('on');
          const st = btn.dataset.status;
          document.querySelectorAll('#tk-rooms tbody tr').forEach((tr) => {
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
      document.querySelectorAll('[data-room-detail]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.roomDetail;
          if (id) showRoomDetail(id);
        });
      });
    },
  };
}
