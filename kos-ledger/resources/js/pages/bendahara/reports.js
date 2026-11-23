import { finance, arusKasBulanan } from '../../api/reports.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, avatar, ms, toast, modal, closeModal, mhead, kvs } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { barChart, donut, legend } from '../../components/charts.js';
import { emptyView, errorView } from '../../components/states.js';
import { esc, rp, tgl, rentangBulan, periodeLabel } from '../../utils/format.js';

// State filter yang tersimpan selama navigasi sesi
let currentFilter = {
  key: 'all',
  label: 'Semua Periode',
  start_date: '',
  end_date: '',
  page: 1,
};

function computePeriodRange(type) {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();
  const pad = (n) => String(n).padStart(2, '0');

  if (type === 'this_month') {
    const lastDay = new Date(y, m + 1, 0).getDate();
    return {
      key: 'this_month',
      label: `Bulan Ini (${periodeLabel(`${y}-${pad(m + 1)}`)})`,
      start_date: `${y}-${pad(m + 1)}-01`,
      end_date: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
      page: 1,
    };
  }
  if (type === 'last_month') {
    const prevMonth = new Date(y, m - 1, 1);
    const py = prevMonth.getFullYear();
    const pm = prevMonth.getMonth();
    const lastDay = new Date(py, pm + 1, 0).getDate();
    return {
      key: 'last_month',
      label: `Bulan Lalu (${periodeLabel(`${py}-${pad(pm + 1)}`)})`,
      start_date: `${py}-${pad(pm + 1)}-01`,
      end_date: `${py}-${pad(pm + 1)}-${pad(lastDay)}`,
      page: 1,
    };
  }
  if (type === 'last_3_months') {
    const d3 = new Date(y, m - 2, 1);
    const lastDay = new Date(y, m + 1, 0).getDate();
    return {
      key: 'last_3_months',
      label: '3 Bulan Terakhir',
      start_date: `${d3.getFullYear()}-${pad(d3.getMonth() + 1)}-01`,
      end_date: `${y}-${pad(m + 1)}-${pad(lastDay)}`,
      page: 1,
    };
  }
  if (type === 'this_year') {
    return {
      key: 'this_year',
      label: `Tahun ${y}`,
      start_date: `${y}-01-01`,
      end_date: `${y}-12-31`,
      page: 1,
    };
  }
  return {
    key: 'all',
    label: 'Semua Periode',
    start_date: '',
    end_date: '',
    page: 1,
  };
}

const loadingInline = (text) => `
  <div style="display:flex;align-items:center;gap:12px;color:var(--muted);padding:32px 0;justify-content:center">
    <span class="spin" style="border-color:rgba(23,77,59,.2);border-top-color:var(--primary);margin:0"></span>${esc(text)}
  </div>`;

const dot = (color) =>
  `<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};border:1px solid #96b5a3;margin-right:6px"></i>`;

function renderChartBody(series) {
  if (!series) {
    return `${errorView('Grafik tren arus kas belum bisa dimuat.')}<button class="btn s" id="retry-report-chart">${ms('refresh')}Muat ulang grafik</button>`;
  }
  if (series.every((s) => s.income === 0 && s.expense === 0)) {
    return emptyView('Belum ada riwayat arus kas', 'Grafik tren komparasi muncul setelah ada transaksi kas masuk atau keluar.', 'bar_chart');
  }
  const top = Math.max(...series.map((s) => Math.max(s.income, s.expense)), 1);
  const totalSurplus = series.reduce((acc, s) => acc + (s.income - s.expense), 0);
  const avgSurplus = Math.round(totalSurplus / series.length);

  return `
    <div class="chartbox" style="margin-top:12px">
      ${barChart(series.map((s) => s.label), series.map((s) => s.income), series.map((s) => s.expense), top, 210)}
    </div>
    <div class="note" style="justify-content:space-between;margin-top:10px;align-items:center;flex-wrap:wrap">
      <span style="display:flex;gap:8px;align-items:center">
        ${ms(avgSurplus >= 0 ? 'trending_up' : 'trending_down')}
        <span>Rata-rata surplus bulanan semester ini:</span>
      </span>
      <b style="color:var(--primary-d);font-size:15px">${avgSurplus >= 0 ? '+' : ''}${rp(avgSurplus)}/bln</b>
    </div>
    <div class="foot" style="margin-top:8px"><span>Skala grafik tertinggi: ${rp(top)}</span></div>`;
}

async function muatGrafikSemester() {
  const box = document.getElementById('report-chart');
  if (!box) return;
  box.innerHTML = loadingInline('Memuat data arus kas 6 bulan terakhir…');
  let series = null;
  try {
    series = await arusKasBulanan(rentangBulan(6));
  } catch {
    series = null;
  }
  const el = document.getElementById('report-chart');
  if (!el) return;
  el.innerHTML = renderChartBody(series);
  document.getElementById('retry-report-chart')?.addEventListener('click', muatGrafikSemester);
}

function renderExpenseDonut(expenses, totalExpense) {
  if (!expenses.length || totalExpense <= 0) {
    return emptyView('Belum ada data beban', 'Pengeluaran yang tercatat pada periode ini akan muncul distribusinya di sini.', 'pie_chart');
  }

  const catMap = {};
  for (const t of expenses) {
    const c = t.category || 'Lainnya';
    catMap[c] = (catMap[c] || 0) + Number(t.amount || 0);
  }

  const sorted = Object.entries(catMap).sort((a, b) => b[1] - a[1]);
  let items = [];
  if (sorted.length <= 4) {
    items = sorted;
  } else {
    items = sorted.slice(0, 3);
    const otherTotal = sorted.slice(3).reduce((sum, [, amt]) => sum + amt, 0);
    items.push(['Lainnya', otherTotal]);
  }

  const vals = items.map(([, amt]) => amt);
  const legendItems = items.map(([name, amt]) => {
    const pct = totalExpense > 0 ? Math.round((amt / totalExpense) * 100) : 0;
    return [name, `${rp(amt)} (${pct}%)`];
  });

  return `
    <div class="donutwrap" style="margin-top:14px">
      <div style="width:130px;flex:none">
        ${donut(vals, `<b>${Object.keys(catMap).length}</b><span>Pos Biaya</span>`)}
      </div>
      ${legend(legendItems)}
    </div>
    <p style="font-size:12px;color:var(--muted);display:flex;gap:6px;margin:24px 0 0;align-items:center">
      ${ms('task_alt')}Seluruh bukti nota operasional telah terverifikasi bendahara
    </p>`;
}

function exportCsv(transactions, activeFilter) {
  if (!transactions || !transactions.length) {
    toast('Tidak ada transaksi pada periode ini untuk diekspor', 'warn');
    return;
  }
  const headers = ['ID Transaksi', 'Tanggal', 'Jenis', 'Kategori', 'Deskripsi', 'Dicatat Oleh', 'Nominal (Rp)'];
  const rows = transactions.map((t) => [
    `TRX-${String(t.id).padStart(5, '0')}`,
    t.trx_date || '',
    t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
    t.category || '',
    `"${String(t.description || '').replace(/"/g, '""')}"`,
    t.creator?.name || 'Bendahara',
    (t.type === 'income' ? '' : '-') + String(t.amount || 0),
  ]);

  const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const suffix = activeFilter.start_date ? `${activeFilter.start_date}_sd_${activeFilter.end_date}` : 'semua_periode';
  a.download = `laporan_keuangan_kosledger_${suffix}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('Laporan CSV berhasil diunduh', 'ok');
}

function openFilterModal(onApply) {
  modal(`
    ${mhead('Filter Periode Laporan', 'Pilih rentang waktu pembukuan kas yang ingin dianalisis', 'date_range')}
    <div class="mb">
      <div style="margin-bottom:18px">
        <label class="lbl" style="display:block;margin-bottom:8px">Pilihan Cepat Periode</label>
        <div class="kg" id="quick-periods">
          <button type="button" class="pill ${currentFilter.key === 'all' ? 'dk' : ''}" data-p="all">Semua Periode</button>
          <button type="button" class="pill ${currentFilter.key === 'this_month' ? 'dk' : ''}" data-p="this_month">Bulan Ini</button>
          <button type="button" class="pill ${currentFilter.key === 'last_month' ? 'dk' : ''}" data-p="last_month">Bulan Lalu</button>
          <button type="button" class="pill ${currentFilter.key === 'last_3_months' ? 'dk' : ''}" data-p="last_3_months">3 Bulan Terakhir</button>
          <button type="button" class="pill ${currentFilter.key === 'this_year' ? 'dk' : ''}" data-p="this_year">Tahun Ini</button>
        </div>
      </div>
      <div style="border-top:1px solid var(--c1);padding-top:16px">
        <label class="lbl" style="display:block;margin-bottom:8px">Atau Tentukan Rentang Tanggal Manual</label>
        <div class="two" style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label class="lbl" for="filter-start-date">Tanggal Mulai</label>
            <input type="date" id="filter-start-date" value="${esc(currentFilter.start_date)}" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--c1)">
          </div>
          <div>
            <label class="lbl" for="filter-end-date">Tanggal Akhir</label>
            <input type="date" id="filter-end-date" value="${esc(currentFilter.end_date)}" style="width:100%;padding:10px 14px;border-radius:10px;border:1px solid var(--line);background:var(--c1)">
          </div>
        </div>
      </div>
    </div>
    <footer class="mf2">
      <button type="button" class="btn s" data-act="close">Batal</button>
      <button type="button" class="btn p" id="btn-apply-filter">${ms('filter_alt')}Terapkan Filter</button>
    </footer>
  `);

  const startInput = document.getElementById('filter-start-date');
  const endInput = document.getElementById('filter-end-date');

  document.querySelectorAll('#quick-periods [data-p]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.p;
      const computed = computePeriodRange(p);
      startInput.value = computed.start_date;
      endInput.value = computed.end_date;
      document.querySelectorAll('#quick-periods [data-p]').forEach((b) => b.classList.remove('dk'));
      btn.classList.add('dk');
    });
  });

  document.getElementById('btn-apply-filter')?.addEventListener('click', () => {
    const s = startInput.value;
    const e = endInput.value;
    let label = 'Semua Periode';
    let key = 'custom';
    if (!s && !e) {
      key = 'all';
      label = 'Semua Periode';
    } else if (s && e) {
      label = `${tgl(s)} – ${tgl(e)}`;
    } else if (s) {
      label = `Mulai ${tgl(s)}`;
    } else {
      label = `Hingga ${tgl(e)}`;
    }
    closeModal();
    onApply({ key, label, start_date: s, end_date: e, page: 1 });
  });
}

function showDetailModal(tx) {
  const isIncome = tx.type === 'income';
  const noTrx = `TRX-${String(tx.id).padStart(5, '0')}`;
  modal(`
    ${mhead(`Rincian Transaksi ${noTrx}`, 'Buku jurnal mutasi kas operasional kos', isIncome ? 'south' : 'north')}
    <div class="mb">
      ${kvs([
        ['ID Transaksi', `<span class="mono" style="font-weight:600">${noTrx}</span>`],
        ['Tanggal Transaksi', tgl(tx.trx_date)],
        ['Jenis Kas', isIncome ? pill('↓ Kas Masuk (Income)', 'ok') : pill('↑ Kas Keluar (Expense)', 'err')],
        ['Kategori Pos', `<b style="text-transform:capitalize">${esc(tx.category)}</b>`],
        ['Uraian Transaksi', esc(tx.description)],
        ['Nominal', `<span class="num ${isIncome ? 'pos' : 'neg'}" style="font-size:18px;font-weight:700">${isIncome ? '+' : '−'}${rp(tx.amount)}</span>`],
        ['Dicatat Oleh', esc(tx.creator?.name || 'Sistem')],
        ['ID Pembayaran Terkait', tx.payment_id ? `#${tx.payment_id}` : '– (Pencatatan Operasional Langsung)'],
      ])}
    </div>
    <footer class="mf2">
      <button type="button" class="btn p" data-act="close">${ms('check')}Tutup</button>
    </footer>
  `);
}

export default async function reports() {
  const params = {};
  if (currentFilter.start_date) params.start_date = currentFilter.start_date;
  if (currentFilter.end_date) params.end_date = currentFilter.end_date;
  if (currentFilter.page && currentFilter.page > 1) params.page = currentFilter.page;

  let repData;
  try {
    repData = await finance(params);
  } catch (err) {
    return {
      html: `
        ${pageHead({
          eyebrow: 'Buku Kas & Neraca Operasional',
          txt: 1,
          dot: 1,
          title: 'Laporan Keuangan',
          sub: 'Laporan komprehensif pemasukan, pengeluaran, saldo kas bersih, dan ringkasan audit finansial kos.',
        })}
        ${errorView(apiError(err))}
        <button class="btn s" id="btn-retry-finance">${ms('refresh')}Coba Lagi</button>`,
      after() {
        document.getElementById('btn-retry-finance')?.addEventListener('click', () => go('bendahara-laporan'));
      },
    };
  }

  const income = Number(repData.total_income) || 0;
  const expense = Number(repData.total_expense) || 0;
  const balance = Number(repData.balance) || 0;

  const trxPagination = repData.transactions || { data: [], current_page: 1, last_page: 1, total: 0 };
  const transactions = Array.isArray(trxPagination.data) ? trxPagination.data : [];
  const currentPage = Number(trxPagination.current_page) || 1;
  const lastPage = Number(trxPagination.last_page) || 1;
  const totalTrx = Number(trxPagination.total) || transactions.length;

  const incomeTransactions = transactions.filter((t) => t.type === 'income');
  const expenseTransactions = transactions.filter((t) => t.type === 'expense');

  const margin = income > 0 ? Math.round((balance / income) * 100) : null;
  const isSurplus = balance >= 0;

  const headHtml = pageHead({
    eyebrow: 'Buku Kas & Neraca Operasional',
    txt: 1,
    dot: 1,
    title: 'Laporan Keuangan',
    sub: 'Laporan komprehensif pemasukan, pengeluaran, saldo kas bersih, dan ringkasan audit finansial kos.',
    acts: `
      <button class="btn s" id="btn-period-filter" style="background:#fff;border:1px solid var(--line)" aria-label="Pilih Periode">
        ${ms('calendar_month')}<span id="period-display-label">${esc(currentFilter.label)}</span>${ms('expand_more')}
      </button>
      <button class="btn s" id="btn-export-csv" aria-label="Ekspor CSV">
        ${ms('download')}Ekspor CSV
      </button>
      <button class="btn p" id="btn-print" aria-label="Cetak Laporan">
        ${ms('print')}Cetak Laporan
      </button>`,
  });

  const statCards = `
    <div class="grid g3">
      ${statCard(
        'TOTAL PEMASUKAN',
        rp(income),
        pill(`${incomeTransactions.length} transaksi sewa / kas masuk`, 'ok'),
        'south',
      )}
      ${statCard(
        'TOTAL PENGELUARAN',
        rp(expense),
        pill(`${expenseTransactions.length} pos beban operasional`, '') + ' Terkelola',
        'north',
      )}
      ${statCard(
        `SALDO KAS BERSIH (${isSurplus ? 'SURPLUS' : 'DEFISIT'})`,
        rp(balance),
        margin !== null
          ? pill(`Margin ${margin}%`, isSurplus ? 'mint' : 'err') + ' Likuiditas kas'
          : 'Likuiditas kas kos',
        'account_balance_wallet',
        { cls: 'dark' },
      )}
    </div>`;

  const chartsGrid = `
    <div class="grid g21">
      <div class="card">
        <div class="ctr" style="align-items:flex-start">
          <div>
            <h3>Tren Arus Kas 6 Bulan Terakhir</h3>
            <p class="sub">Komparasi pendapatan sewa vs pengeluaran operasional semester ini</p>
          </div>
          <span style="display:flex;gap:12px;font-size:12px;color:var(--muted)">
            <span>${dot('#174d3b')}Pemasukan</span>
            <span>${dot('#dfe9e2')}Pengeluaran</span>
          </span>
        </div>
        <div id="report-chart">${loadingInline('Memuat grafik tren arus kas…')}</div>
      </div>
      <div class="card">
        <div class="ctr">
          <h3>Distribusi Pengeluaran</h3>
          <small style="color:var(--muted)">Total ${rp(expense)}</small>
        </div>
        <p class="sub">Alokasi beban operasional periode terpilih</p>
        ${renderExpenseDonut(expenseTransactions, expense)}
      </div>
    </div>`;

  const tableRows = transactions.map((t) => {
    const isInc = t.type === 'income';
    const noTrx = `TRX-${String(t.id).padStart(5, '0')}`;
    const pembuat = esc(t.creator?.name || 'Bendahara');
    return [
      tgl(t.trx_date),
      `<span class="mono" style="font-weight:500">${noTrx}</span>`,
      isInc ? pill('↓ Masuk', 'ok') : pill('↑ Keluar', 'err'),
      `<b>${esc(t.category)}</b><br><small style="color:var(--muted)">${esc(t.description)}</small>`,
      `<div class="cell">${avatar(pembuat[0] || 'S')}<span style="font-size:12px">${pembuat}</span></div>`,
      `<span class="num ${isInc ? 'pos' : 'neg'}">${isInc ? '+' : '−'}${rp(t.amount)}</span>`,
      `<button class="btn sm s" data-tx-detail="${t.id}" aria-label="Lihat Detail Transaksi">${ms('visibility')} Detail</button>`,
    ];
  });

  const paginationControls =
    lastPage > 1
      ? `
        <div class="pg" style="display:flex;gap:6px;align-items:center">
          <button class="btn s sm" id="btn-page-prev" ${currentPage <= 1 ? 'disabled' : ''} aria-label="Halaman Sebelumnya">${ms('chevron_left')}</button>
          <span style="font-size:12px;font-weight:600;padding:0 8px">Hal. ${currentPage} dari ${lastPage}</span>
          <button class="btn s sm" id="btn-page-next" ${currentPage >= lastPage ? 'disabled' : ''} aria-label="Halaman Berikutnya">${ms('chevron_right')}</button>
        </div>`
      : '';

  const journalCard = `
    <div class="card">
      <div class="ctr" style="flex-wrap:wrap;gap:12px">
        <div>
          <h3>Buku Jurnal Keuangan</h3>
          <p class="sub">Rincian mutasi kas masuk dan keluar periode <b>${esc(currentFilter.label)}</b></p>
        </div>
        <div class="filter" style="margin:0;flex:0 1 340px">
          ${searchField('Cari tanggal, no. transaksi, uraian...', 'jurnal-table')}
        </div>
      </div>
      <div style="height:12px"></div>
      ${dataTable(
        ['Tanggal', 'No. Transaksi', 'Jenis', 'Kategori & Uraian', 'Dicatat Oleh', '>Nominal', '>Aksi'],
        tableRows,
        {
          id: 'jurnal-table',
          min: 860,
          emptyTitle: 'Belum ada catatan mutasi kas',
          emptyText: 'Tidak ditemukan transaksi kas pada periode yang dipilih.',
          emptyIcon: 'receipt_long',
        },
      )}
      <div class="ctr" style="background:var(--c1);margin:0 -20px;padding:16px 20px;border-radius:0 0 16px 16px;flex-wrap:wrap;gap:12px">
        <b style="font-size:15px;color:var(--primary-d)">Ringkasan Rekonsiliasi Kas Akhir Periode (${esc(currentFilter.label)})</b>
        <span style="display:flex;gap:20px;align-items:center;font-size:13px;flex-wrap:wrap">
          <span>Kas Masuk: <b class="pos">+${rp(income)}</b></span>
          <span>Kas Keluar: <b class="neg">−${rp(expense)}</b></span>
          <span>Total Mutasi Bersih: <b class="${isSurplus ? 'pos' : 'neg'}">${isSurplus ? '+' : ''}${rp(balance)}</b></span>
          <b style="font-size:18px;color:var(--primary-d)">${rp(balance)}</b>
        </span>
      </div>
      <div class="foot">
        <span>Menampilkan <b>${transactions.length}</b> dari <b>${totalTrx}</b> catatan transaksi</span>
        ${paginationControls}
      </div>
    </div>`;

  return {
    html: `
      ${headHtml}
      ${statCards}
      ${chartsGrid}
      ${journalCard}`,
    after() {
      // 1. Muat grafik semester
      muatGrafikSemester();

      // 2. Tombol Filter Periode
      document.getElementById('btn-period-filter')?.addEventListener('click', () => {
        openFilterModal((newFilter) => {
          currentFilter = newFilter;
          go('bendahara-laporan');
        });
      });

      // 3. Tombol Ekspor CSV
      document.getElementById('btn-export-csv')?.addEventListener('click', () => {
        exportCsv(transactions, currentFilter);
      });

      // 4. Tombol Cetak Laporan
      document.getElementById('btn-print')?.addEventListener('click', () => {
        window.print();
      });

      // 5. Tombol Detail Transaksi
      document.querySelectorAll('[data-tx-detail]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = Number(btn.dataset.txDetail);
          const item = transactions.find((x) => x.id === id);
          if (item) showDetailModal(item);
        });
      });

      // 6. Pagination
      document.getElementById('btn-page-prev')?.addEventListener('click', () => {
        if (currentPage > 1) {
          currentFilter.page = currentPage - 1;
          go('bendahara-laporan');
        }
      });
      document.getElementById('btn-page-next')?.addEventListener('click', () => {
        if (currentPage < lastPage) {
          currentFilter.page = currentPage + 1;
          go('bendahara-laporan');
        }
      });
    },
  };
}
