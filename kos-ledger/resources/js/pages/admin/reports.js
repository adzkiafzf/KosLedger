import { occupancyReport } from '../../api/reports.js';
import { apiError } from '../../api/client.js';
import { pageHead, pill, avatar, ms, modal, mhead, kvs } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { emptyView, errorView } from '../../components/states.js';
import { esc, tgl, initials } from '../../utils/format.js';

// State filter yang disimpan selama navigasi
let currentFilter = {
  status: '', // '' (semua), 'active', 'ended'
  page: 1,
};

function occupancyRows(occupancies) {
  return occupancies.map((item) => {
    const isAktif = item.status === 'active';
    const isEnded = item.status === 'ended';
    const userName = item.user?.name || 'Penghuni';
    const roomNum = item.room?.room_number ? `Kamar ${esc(item.room.room_number)}` : '–';
    const userInitials = initials(userName);

    const statusLabel = isAktif ? 'Aktif Menempati' : (isEnded ? 'Selesai' : esc(item.status || '-'));
    const statusPillCls = isAktif ? 'ok dot' : (isEnded ? 'warn dot' : '');

    return [
      `<div class="cell">
        ${avatar(esc(userInitials))}
        <div>
          <b>${esc(userName)}</b>
          <small style="color:var(--muted);display:block">ID Penempatan: #${item.id}</small>
        </div>
      </div>`,
      `<span class="chip">● ${roomNum}</span>`,
      `<span><b>${item.start_date ? tgl(item.start_date) : '–'}</b></span>`,
      `<span>${item.end_date ? `<b>${tgl(item.end_date)}</b>` : '<span style="color:var(--muted)">Masih Menempati</span>'}</span>`,
      `<span data-status-val="${esc(item.status)}">${pill(statusLabel, statusPillCls)}</span>`,
      `<div class="acts" style="justify-content:flex-end">
        <button class="btn sm s" data-occ-report-detail="${item.id}" aria-label="Lihat Detail Penempatan">${ms('visibility')} Detail</button>
      </div>`,
    ];
  });
}

function renderDetailModal(item) {
  const isAktif = item.status === 'active';
  const isEnded = item.status === 'ended';
  const userName = item.user?.name || '-';
  const roomNum = item.room?.room_number ? `Kamar ${esc(item.room.room_number)}` : 'Belum ditentukan';
  const statusLabel = isAktif ? 'Aktif Menempati' : (isEnded ? 'Selesai' : esc(item.status || '-'));
  const statusPillCls = isAktif ? 'ok dot' : (isEnded ? 'warn dot' : '');

  return `
    ${mhead(userName, `Detail Riwayat ${roomNum}`, 'bar_chart')}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px">
        <span class="lbl" style="font-size:11px">STATUS PENEMPATAN</span>
        ${pill(statusLabel, statusPillCls)}
      </div>

      ${kvs([
        ['ID Penempatan', `#${item.id}`],
        ['Nama Penghuni', esc(userName)],
        ['Nomor Kamar', roomNum],
        ['Tanggal Mulai Menempati', item.start_date ? tgl(item.start_date) : '–'],
        ['Tanggal Selesai', item.end_date ? tgl(item.end_date) : 'Masih aktif menempati'],
        ['Waktu Pencatatan Sistem', item.created_at ? tgl(item.created_at) : '–'],
      ])}
    </div>
    <div class="mfoot" style="justify-content:flex-end">
      <button class="btn p" data-act="close">${ms('close')}Tutup</button>
    </div>
  `;
}

function renderPagination(meta) {
  const currentPage = Number(meta?.current_page) || 1;
  const lastPage = Number(meta?.last_page) || 1;
  const total = Number(meta?.total) || 0;
  const from = meta?.from ?? (total > 0 ? 1 : 0);
  const to = meta?.to ?? (total > 0 ? (meta?.data?.length || 0) : 0);

  return `
    <div class="foot" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px;margin-top:16px">
      <span style="font-size:13px;color:var(--text)">
        Menampilkan <b>${from}–${to}</b> dari <b>${total}</b> riwayat penempatan
      </span>
      ${
        lastPage > 1
          ? `
        <div class="pg" style="display:flex;gap:6px;align-items:center">
          <button class="btn s sm" id="btn-page-prev" ${currentPage <= 1 ? 'disabled' : ''} aria-label="Halaman Sebelumnya">
            ${ms('chevron_left')} Prev
          </button>
          <span style="font-size:12px;font-weight:600;padding:0 8px">Hal. ${currentPage} dari ${lastPage}</span>
          <button class="btn s sm" id="btn-page-next" ${currentPage >= lastPage ? 'disabled' : ''} aria-label="Halaman Berikutnya">
            Next ${ms('chevron_right')}
          </button>
        </div>`
          : ''
      }
    </div>
  `;
}

function renderStatCards(meta, status) {
  const total = Number(meta?.total) || 0;
  const currentPage = Number(meta?.current_page) || 1;
  const lastPage = Number(meta?.last_page) || 1;
  const from = meta?.from ?? (total > 0 ? 1 : 0);
  const to = meta?.to ?? (total > 0 ? (meta?.data?.length || 0) : 0);

  let statusLabel = 'Semua Status';
  let statusBadge = pill('Semua Status', '');
  if (status === 'active') {
    statusLabel = 'Aktif Menempati';
    statusBadge = pill('Aktif Berjalan', 'ok dot');
  } else if (status === 'ended') {
    statusLabel = 'Selesai / Berakhir';
    statusBadge = pill('Telah Berakhir', 'warn dot');
  }

  return `
    <div class="grid g4" style="margin-bottom:20px">
      ${statCard(
        'TOTAL REKAMAN LAPORAN',
        `${total} <small>Data</small>`,
        `<span style="color:var(--text)">Sesuai kriteria filter</span>`,
        'bar_chart'
      )}
      ${statCard(
        'FILTER STATUS',
        `<span style="font-size:18px">${esc(statusLabel)}</span>`,
        statusBadge,
        'filter_alt'
      )}
      ${statCard(
        'POSISI HALAMAN',
        `Hal. ${currentPage} <small>/ ${lastPage}</small>`,
        `<span style="color:var(--text)">${meta?.per_page || 20} data per halaman</span>`,
        'layers'
      )}
      ${statCard(
        'RENTANG ENTRI',
        `${from} – ${to} <small>Baris</small>`,
        pill(`${total} Terdata`, 'mint'),
        'table_rows'
      )}
    </div>
  `;
}

const loadingInline = (text) => `
  <div style="display:flex;align-items:center;gap:12px;color:var(--muted);padding:40px 0;justify-content:center">
    <span class="spin" style="border-color:rgba(23,77,59,.2);border-top-color:var(--primary);margin:0"></span>${esc(text)}
  </div>
`;

export default async function adminReportsPage() {
  const headHtml = pageHead({
    crumb: `KosLedger › <b>Laporan Hunian</b>`,
    title: 'Laporan Hunian & Okupansi',
    sub: 'Rekapitulasi riwayat penempatan kamar kos, masa tinggal penghuni, dan status okupansi unit.',
  });

  return {
    html: `
      ${headHtml}

      <!-- Ringkasan Statistik Laporan -->
      <div id="admin-reports-stats">
        <div class="grid g4" style="margin-bottom:20px">
          ${statCard('TOTAL REKAMAN LAPORAN', '–', '<span style="color:var(--muted)">Memuat…</span>', 'bar_chart')}
          ${statCard('FILTER STATUS', '–', '<span style="color:var(--muted)">Memuat…</span>', 'filter_alt')}
          ${statCard('POSISI HALAMAN', '–', '<span style="color:var(--muted)">Memuat…</span>', 'layers')}
          ${statCard('RENTANG ENTRI', '–', '<span style="color:var(--muted)">Memuat…</span>', 'table_rows')}
        </div>
      </div>

      <!-- Card Tabel dan Filter -->
      <div class="card">
        <div class="filter" style="margin-bottom:14px;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between">
          <div style="display:flex;gap:10px;flex:1 1 280px;align-items:center">
            ${searchField('Cari nama penghuni atau nomor kamar di halaman ini...', 'table-admin-reports')}
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
            <div class="tabs" id="report-status-tabs">
              <button class="${currentFilter.status === '' ? 'on' : ''}" data-status="">Semua Status</button>
              <button class="${currentFilter.status === 'active' ? 'on' : ''}" data-status="active">Aktif Menempati</button>
              <button class="${currentFilter.status === 'ended' ? 'on' : ''}" data-status="ended">Selesai / Berakhir</button>
            </div>
          </div>
        </div>

        <div id="admin-reports-table-container">
          ${loadingInline('Memuat data laporan hunian…')}
        </div>
      </div>
    `,
    async after() {
      async function fetchAndRender() {
        const statsEl = document.getElementById('admin-reports-stats');
        const container = document.getElementById('admin-reports-table-container');
        if (!container) return;

        container.innerHTML = loadingInline('Memuat data laporan hunian…');

        const params = {
          page: currentFilter.page,
        };
        if (currentFilter.status) {
          params.status = currentFilter.status;
        }

        let meta = null;
        try {
          meta = await occupancyReport(params);
        } catch (err) {
          container.innerHTML = `
            <div style="padding:20px 0">
              ${errorView(apiError(err) || 'Gagal memuat laporan hunian dari server.')}
              <div style="margin-top:12px;text-align:center">
                <button class="btn s" id="btn-retry-report">${ms('refresh')}Coba Lagi</button>
              </div>
            </div>
          `;
          document.getElementById('btn-retry-report')?.addEventListener('click', fetchAndRender);
          return;
        }

        const occupancies = Array.isArray(meta?.data) ? meta.data : [];

        // 1. Update Kartu Statistik
        if (statsEl) {
          statsEl.innerHTML = renderStatCards(meta, currentFilter.status);
        }

        // 2. Update Tabs Status Aktif
        document.querySelectorAll('#report-status-tabs button').forEach((btn) => {
          btn.classList.toggle('on', btn.dataset.status === currentFilter.status);
        });

        // 3. Render Tabel Data
        const rows = occupancyRows(occupancies);
        const emptyTitle = currentFilter.status ? 'Tidak ada data penempatan' : 'Belum ada riwayat penempatan';
        const emptyText = currentFilter.status
          ? `Tidak ditemukan riwayat penempatan dengan status "${currentFilter.status}".`
          : 'Belum ada riwayat hunian kamar yang tercatat pada sistem.';
        const emptyIcon = currentFilter.status ? 'search_off' : 'bar_chart';

        const tableHtml = dataTable(
          ['Penghuni', 'Nomor Kamar', 'Mulai Menempati', 'Selesai Menempati', 'Status', '>Aksi'],
          rows,
          {
            id: 'table-admin-reports',
            min: 760,
            emptyTitle,
            emptyText,
            emptyIcon,
          }
        );

        const paginationHtml = renderPagination(meta);
        container.innerHTML = `${tableHtml}${paginationHtml}`;

        // 4. Pasang Event Listener Tombol Detail
        container.querySelectorAll('[data-occ-report-detail]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const id = btn.dataset.occReportDetail;
            const target = occupancies.find((o) => String(o.id) === String(id));
            if (target) {
              modal(renderDetailModal(target));
            }
          });
        });

        // 5. Pasang Event Listener Pagination
        document.getElementById('btn-page-prev')?.addEventListener('click', () => {
          if (currentFilter.page > 1) {
            currentFilter.page--;
            fetchAndRender();
          }
        });

        document.getElementById('btn-page-next')?.addEventListener('click', () => {
          const lastPage = Number(meta?.last_page) || 1;
          if (currentFilter.page < lastPage) {
            currentFilter.page++;
            fetchAndRender();
          }
        });
      }

      // Event Listener Tab Filter Status
      document.querySelectorAll('#report-status-tabs button').forEach((btn) => {
        btn.addEventListener('click', () => {
          const newStatus = btn.dataset.status ?? '';
          if (currentFilter.status !== newStatus) {
            currentFilter.status = newStatus;
            currentFilter.page = 1; // reset ke halaman pertama saat ganti filter
            fetchAndRender();
          }
        });
      });

      // Panggilan pertama saat halaman dimuat
      await fetchAndRender();
    },
  };
}
