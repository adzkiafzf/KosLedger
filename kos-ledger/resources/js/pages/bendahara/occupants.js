import { getOccupancies } from '../../api/occupancies.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, avatar, ms, modal, mhead, kvs } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { errorView } from '../../components/states.js';
import { esc, tgl, rp, initials } from '../../utils/format.js';

const head = () =>
  pageHead({
    crumb: `Administrasi › <b>Direktori Penghuni</b>`,
    title: 'Manajemen Penghuni',
    sub: 'Data penghuni kost aktif, penempatan unit kamar, dan tanggal mulai huni untuk acuan penagihan.',
    acts: `<span class="pill ok">${ms('verified_user')}Mode Pantau Bendahara</span>`,
  });

function occupantDetailModal(item) {
  const isAktif = item.status === 'active';
  const kamar = item.room?.room_number ? `Kamar ${esc(item.room.room_number)}` : 'Belum ditentukan';
  const tarif = item.room?.monthly_rate ? `${rp(item.room.monthly_rate)} / bulan` : '–';

  return `
    ${mhead(item.user.name, 'Detail Penghuni & Hunian', 'person')}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px">
        <span class="lbl" style="font-size:11px">STATUS HUNIAN</span>
        ${pill(isAktif ? 'Aktif Menempati' : esc(item.status), isAktif ? 'ok dot' : 'warn dot')}
      </div>
      ${kvs([
        ['Nama Lengkap', esc(item.user.name)],
        ['Nama Panggilan', item.user.nickname ? esc(item.user.nickname) : '–'],
        ['Kamar Ditempati', kamar],
        ['Tarif Sewa Kamar', tarif],
        ['Mulai Masuk', item.start_date ? tgl(item.start_date) : '–'],
        ['Status Penempatan', isAktif ? 'Aktif' : esc(item.status)],
      ])}
      <div class="note" style="margin-top:14px">
        ${ms('info')}
        <span style="font-size:12px;color:var(--muted)">
          Pendaftaran penghuni baru, data identitas, dan penempatan kamar dikelola oleh <b>Administrator kos</b>.
        </span>
      </div>
    </div>
    <footer class="mf2">
      <button class="btn s" data-go="bendahara-tagihan" data-act="close">${ms('receipt_long')}Lihat Tagihan</button>
      <button class="btn p" data-act="close">Tutup</button>
    </footer>`;
}

function occupantRows(list) {
  return list.map((item, idx) => {
    const isAktif = item.status === 'active';
    const kamarStr = item.room?.room_number ? `Kamar ${esc(item.room.room_number)}` : '-';
    return [
      `<div class="cell">
        ${avatar(esc(initials(item.user.name)))}
        <span>
          <b>${esc(item.user.name)}</b>
          ${item.user.nickname ? `<small style="color:var(--muted)">“${esc(item.user.nickname)}”</small>` : ''}
        </span>
      </div>`,
      `<span class="chip">● ${kamarStr}</span>`,
      `<span><b>${item.start_date ? tgl(item.start_date) : '–'}</b></span>`,
      `<span data-status-val="${item.status}">${pill(isAktif ? 'Aktif' : esc(item.status), isAktif ? 'ok dot' : 'warn dot')}</span>`,
      `<div class="acts" style="justify-content:flex-end">
        <button class="btn sm s" data-occ-index="${idx}" aria-label="Lihat detail penghuni">${ms('visibility')} Detail</button>
      </div>`,
    ];
  });
}

export default async function occupantsPage() {
  let occupants = [];
  try {
    occupants = await getOccupancies();
  } catch (err) {
    return {
      html: `
        ${head()}
        ${errorView(apiError(err))}
        <button class="btn s" id="retry-occupants">${ms('refresh')}Coba lagi</button>`,
      after() {
        document.getElementById('retry-occupants')?.addEventListener('click', () => go('bendahara-penghuni'));
      },
    };
  }

  const total = occupants.length;
  const activeCount = occupants.filter((o) => o.status === 'active').length;
  const occupiedRooms = new Set(occupants.map((o) => o.room?.id).filter(Boolean)).size;

  return {
    html: `
      ${head()}
      <div class="grid g3">
        ${statCard('Total Penghuni Terdata', `${total} <small>Orang</small>`, '<span class="chip" style="background:var(--c1)">Direktori Penghuni</span>', 'groups')}
        ${statCard('Penghuni Aktif', `${activeCount} <small>Orang</small>`, pill('Status Aktif', 'ok'), 'badge')}
        ${statCard('Kamar Ditempati', `${occupiedRooms} <small>Kamar</small>`, pill('Unit Terisi', 'mint'), 'meeting_room')}
      </div>

      <div class="card" style="background:var(--c1);border-left:4px solid var(--primary);margin-bottom:16px">
        <div class="ctr" style="align-items:flex-start">
          <div>
            <h3 style="margin-bottom:4px">Koneksi Otomatisasi Penagihan Penghuni</h3>
            <p class="sub" style="margin:0">Setiap data penghuni aktif terhubung dengan modul penerbitan tagihan bulanan dan broadcast pengingat otomatis.</p>
          </div>
          <button class="btn p sm" data-go="bendahara-tagihan">${ms('receipt_long')}Kelola Tagihan</button>
        </div>
      </div>

      <div class="card">
        <div class="filter" style="margin-bottom:14px;flex-wrap:wrap;gap:12px">
          ${searchField('Cari nama, panggilan, atau nomor kamar...', 'tp-occupants')}
          <div class="tabs" id="occ-status-tabs">
            <button class="on" data-status="">Semua</button>
            <button data-status="active">Aktif</button>
            <button data-status="completed">Selesai</button>
          </div>
        </div>

        ${dataTable(
          ['Nama Penghuni', 'Kamar Ditempati', 'Mulai Masuk', 'Status Hunian', '>Aksi'],
          occupantRows(occupants),
          {
            id: 'tp-occupants',
            min: 720,
            emptyTitle: 'Belum ada penghuni aktif',
            emptyText: 'Data penempatan penghuni kamar kos akan muncul di sini setelah didaftarkan.',
            emptyIcon: 'groups',
          }
        )}
      </div>`,
    after() {
      // Event listener: Filter status tabs
      const tabs = document.querySelectorAll('#occ-status-tabs button');
      tabs.forEach((btn) => {
        btn.addEventListener('click', () => {
          tabs.forEach((b) => b.classList.remove('on'));
          btn.classList.add('on');
          const st = btn.dataset.status;
          document.querySelectorAll('#tp-occupants tbody tr').forEach((tr) => {
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
