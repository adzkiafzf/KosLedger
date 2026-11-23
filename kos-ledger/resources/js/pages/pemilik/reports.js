import { finance, arusKasBulanan } from '../../api/reports.js';
import { owner } from '../../api/dashboard.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, avatar, ms, toast, modal, closeModal, mhead, kvs } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { barChart, donut, legend } from '../../components/charts.js';
import { emptyView, errorView, loadingView } from '../../components/states.js';
import { esc, rp, rpRingkas, tgl, rentangBulan, periodeLabel, initials } from '../../utils/format.js';

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
    return `${errorView('Grafik tren arus kas belum bisa dimuat.')}<button class="btn s" id="retry-owner-report-chart">${ms('refresh')}Muat ulang grafik</button>`;
  }
  if (series.every((s) => s.income === 0 && s.expense === 0)) {
    return emptyView('Belum ada riwayat arus kas', 'Grafik tren komparasi muncul setelah ada transaksi kas masuk atau keluar.', 'bar_chart');
  }
  const top = Math.max(...series.map((s) => Math.max(s.income, s.expense)), 1);
  const totalSurplus = series.reduce((acc, s) => acc + (s.income - s.expense), 0);
  const avgSurplus = Math.round(totalSurplus / series.length);

  return `
    <div class="chartbox" style="margin-top:12px">
      ${barChart(series.map((s) => s.label), series.map((s) => s.income), series.map((s) => s.expense), top, 220)}
    </div>
    <div class="note" style="justify-content:space-between;margin-top:10px;align-items:center;flex-wrap:wrap">
      <span style="display:flex;gap:8px;align-items:center">
        ${ms(avgSurplus >= 0 ? 'trending_up' : 'trending_down')}
        <span>Rata-rata surplus bersih semester berjalan:</span>
      </span>
      <b style="color:var(--primary-d);font-size:15px">${avgSurplus >= 0 ? '+' : ''}${rp(avgSurplus)} / bln</b>
    </div>
    <div class="foot" style="margin-top:8px"><span>Skala grafik maksimum: ${rp(top)}</span></div>`;
}

async function muatGrafikSemester() {
  const box = document.getElementById('owner-report-chart');
  if (!box) return;
  box.innerHTML = loadingInline('Memuat data komparasi arus kas 6 bulan terakhir…');
  let series = null;
  try {
    series = await arusKasBulanan(rentangBulan(6));
  } catch {
    series = null;
  }
  const el = document.getElementById('owner-report-chart');
  if (!el) return;
  el.innerHTML = renderChartBody(series);
  document.getElementById('retry-owner-report-chart')?.addEventListener('click', muatGrafikSemester);
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
    <div class="donutwrap" style="margin-top:14px;flex-direction:column;align-items:stretch">
      <div style="width:140px;margin:0 auto">
        ${donut(vals, `<b>${Object.keys(catMap).length}</b><span>Pos Biaya</span>`)}
      </div>
      ${legend(legendItems)}
    </div>`;
}

function exportCsv(transactions, activeFilter) {
  if (!transactions || !transactions.length) {
    toast('Tidak ada transaksi pada periode ini untuk diekspor', 'warn');
    return;
  }
  const headers = ['ID Transaksi', 'Tanggal', 'Jenis', 'Kategori', 'Deskripsi', 'Pencatat', 'Nominal (Rp)'];
  const rows = transactions.map((t) => [
    `TRX-${String(t.id).padStart(5, '0')}`,
    t.trx_date || '',
    t.type === 'income' ? 'Pemasukan' : 'Pengeluaran',
    t.category || '',
    `"${String(t.description || '').replace(/"/g, '""')}"`,
    t.creator?.name || 'Kas',
    (t.type === 'income' ? '' : '-') + String(t.amount || 0),
  ]);

  const csv = '\uFEFF' + [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const suffix = activeFilter.start_date ? `${activeFilter.start_date}_sd_${activeFilter.end_date}` : 'semua_periode';
  a.download = `laporan_keuangan_pemilik_kosledger_${suffix}.csv`;
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
      <button class="btn s" data-act="close">Batal</button>
      <button class="btn p" id="btn-apply-filter">${ms('check')}Terapkan Filter</button>
    </footer>`);

  const quickBtns = document.querySelectorAll('#quick-periods button');
  quickBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const p = btn.dataset.p;
      const range = computePeriodRange(p);
      currentFilter = range;
      closeModal();
      onApply();
    });
  });

  document.getElementById('btn-apply-filter')?.addEventListener('click', () => {
    const s = document.getElementById('filter-start-date')?.value || '';
    const e = document.getElementById('filter-end-date')?.value || '';
    if (s && e && s > e) {
      toast('Tanggal mulai tidak boleh lebih besar dari tanggal akhir', 'warn');
      return;
    }
    currentFilter = {
      key: 'custom',
      label: s && e ? `${tgl(s)} – ${tgl(e)}` : s ? `Sejak ${tgl(s)}` : e ? `Hingga ${tgl(e)}` : 'Semua Periode',
      start_date: s,
      end_date: e,
      page: 1,
    };
    closeModal();
    onApply();
  });
}

function transactionRows(list) {
  return list.map((t) => {
    const masuk = t.type === 'income';
    const nominalHtml = `<span class="num ${masuk ? 'pos' : 'neg'}">${masuk ? '+' : '−'}${rp(t.amount)}</span>`;
    const jenisBadge = masuk ? pill('Pemasukan', 'ok') : pill('Pengeluaran', 'err');

    return {
      cells: [
        `<b>${tgl(t.trx_date)}</b>`,
        `<span class="mono" style="font-size:11px">TRX-${String(t.id).padStart(5, '0')}</span>`,
        jenisBadge,
        `<div><b>${esc(t.description || '-')}</b><small style="color:var(--muted);display:block;text-transform:capitalize">${esc(t.category || '-')}</small></div>`,
        nominalHtml,
        `<span>${esc(t.creator?.name || 'Kas')}</span>`,
        `<div class="acts" style="justify-content:flex-end">
          <button class="btn sm s" data-report-trx="${t.id}" aria-label="Lihat detail">${ms('visibility')} Detail</button>
        </div>`,
      ],
      type: t.type,
    };
  });
}

function transactionDetailModal(t) {
  const masuk = t.type === 'income';
  return `
    ${mhead(`Mutasi #TRX-${String(t.id).padStart(5, '0')}`, esc(t.description), masuk ? 'south' : 'north')}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px">
        <span class="lbl" style="font-size:11px">JENIS MUTASI</span>
        ${masuk ? pill('Pemasukan Kas', 'ok') : pill('Pengeluaran Kas', 'err')}
      </div>
      ${kvs([
        ['ID Transaksi', `<span class="mono">TRX-${String(t.id).padStart(5, '0')}</span>`],
        ['Tanggal Pembukuan', tgl(t.trx_date)],
        ['Kategori Biaya', `<span class="chip" style="text-transform:capitalize">${esc(t.category || '-')}</span>`],
        ['Uraian Transaksi', esc(t.description || '-')],
        ['Nominal Mutasi', `<b style="font-size:17px;color:${masuk ? 'var(--primary-d)' : 'var(--err)'}">${masuk ? '+' : '−'}${rp(t.amount)}</b>`],
        ['Dicatat Oleh', esc(t.creator?.name || 'Kas')],
      ])}
    </div>
    <footer class="mf2">
      <button class="btn p" data-act="close">Tutup</button>
    </footer>`;
}

export default async function ownerReportsPage() {
  let reportData = null;
  let dashboardStats = null;
  let fetchError = null;

  const params = { page: currentFilter.page || 1 };
  if (currentFilter.start_date) params.start_date = currentFilter.start_date;
  if (currentFilter.end_date) params.end_date = currentFilter.end_date;

  try {
    const [finRes, dashRes] = await Promise.all([
      finance(params),
      owner().catch(() => null),
    ]);
    reportData = finRes;
    dashboardStats = dashRes;
  } catch (err) {
    fetchError = err;
  }

  if (fetchError && !reportData) {
    return {
      html: `
        ${pageHead({
          crumb: `Eksekutif › <b>Audit Finansial Properti</b>`,
          title: 'Laporan Keuangan & Kinerja Kos',
          sub: 'Laporan komprehensif penerimaan sewa, beban operasional, neraca surplus bersih, dan tren kinerja kos.',
        })}
        ${errorView(apiError(fetchError))}
        <button class="btn s" id="retry-owner-report">${ms('refresh')}Coba lagi</button>`,
      after() {
        document.getElementById('retry-owner-report')?.addEventListener('click', () => go('pemilik-laporan'));
      },
    };
  }

  // Data finansial periode ini
  const totalIncome = Number(reportData?.total_income) || 0;
  const totalExpense = Number(reportData?.total_expense) || 0;
  const balance = Number(reportData?.balance) || 0;
  const unpaidAmount = Number(dashboardStats?.unpaid_amount) || 0;

  // Rasio finansial
  const margin = totalIncome > 0 ? ((balance / totalIncome) * 100).toFixed(1) : '0';
  const expenseRatio = totalIncome > 0 ? ((totalExpense / totalIncome) * 100).toFixed(1) : '0';

  // Daftar mutasi transaksi
  const rawTrx = Array.isArray(reportData?.transactions?.data)
    ? reportData.transactions.data
    : Array.isArray(reportData?.transactions)
    ? reportData.transactions
    : [];

  const trxRows = transactionRows(rawTrx);
  const expenseList = rawTrx.filter((t) => t.type === 'expense');

  const html = `
    ${pageHead({
      crumb: `Eksekutif › <b>Audit Finansial Properti</b>`,
      title: 'Laporan Keuangan & Kinerja Kos',
      sub: 'Laporan komprehensif penerimaan sewa, beban operasional, neraca surplus bersih, dan tren kinerja kos.',
      acts: `
        <button class="btn s" id="btn-owner-report-filter" aria-label="Filter periode laporan">${ms('calendar_month')}${esc(currentFilter.label)}</button>
        <button class="btn s" id="btn-owner-report-export" aria-label="Ekspor data ke CSV">${ms('download')}Ekspor CSV</button>
      `,
    })}

    <!-- Banner Sertifikasi Konsol Pemilik -->
    <div class="info-banner" style="margin-bottom:16px">
      <div class="ctr">
        <span style="display:flex;gap:12px;align-items:center">
          ${ms('shield')}
          <span>
            <b>Konsol Laporan Pemilik (Read-Only Certified)</b><br>
            <small style="color:var(--muted)">Laporan ini disinkronkan otomatis dari buku kas pengelola kos dan disahkan dengan jejak audit nir-modifikasi.</small>
          </span>
        </span>
        ${pill('Audit Kinerja Sah', 'ok dot')}
      </div>
    </div>

    ${
      unpaidAmount > 0
        ? `<div class="note err2" style="margin-bottom:16px">
            ${ms('warning')}
            <span style="flex:1">Terdapat piutang sewa belum lunas sebesar <b>${rp(unpaidAmount)}</b> pada catatan tagihan aktif penghuni.</span>
            <button class="btn s sm" data-go="pemilik-tagihan" style="color:var(--err)">Lihat Tagihan &raquo;</button>
          </div>`
        : ''
    }

    <!-- 3 Kartu Ringkasan Finansial Utama -->
    <div class="grid g3" style="margin-bottom:16px">
      ${statCard(
        'TOTAL PEMASUKAN SEWA',
        rp(totalIncome),
        pill('Penerimaan Kas Masuk', 'ok'),
        'payments'
      )}
      ${statCard(
        'BEBAN OPERASIONAL KOS',
        rp(totalExpense),
        pill(`Rasio Beban: ${expenseRatio}%`, 'err'),
        'receipt_long'
      )}
      ${statCard(
        'SURPLUS BERSIH (NET PROFIT)',
        rp(balance),
        pill(`Margin: ${margin}%`, balance >= 0 ? 'mint' : 'err'),
        'account_balance_wallet',
        { cls: balance >= 0 ? 'dark' : 'red' }
      )}
    </div>

    <!-- Grid Dua Kolom: Kiri (Grafik Tren Finansial 6 Bulan) | Kanan (Distribusi Beban) -->
    <div class="grid g21" style="align-items:start;margin-bottom:16px">
      
      <!-- Kolom Kiri: Tren Finansial -->
      <div class="card">
        <div class="ctr" style="align-items:flex-start">
          <div>
            <h3>Tren Kinerja Finansial 6 Bulan Terakhir</h3>
            <p class="sub">Komparasi pendapatan sewa versus pengeluaran operasional kos bulanan</p>
          </div>
          <span style="display:flex;gap:12px;font-size:12px;color:var(--muted)">
            <span>${dot('#174d3b')}Pemasukan</span>
            <span>${dot('#dfe9e2')}Pengeluaran</span>
          </span>
        </div>
        <div id="owner-report-chart">${loadingInline('Memuat data grafik tren arus kas…')}</div>
      </div>

      <!-- Kolom Kanan: Distribusi Beban -->
      <div class="card">
        <div class="ctr">
          <h3>Distribusi Pos Beban</h3>
          ${ms('pie_chart')}
        </div>
        <p class="sub">Alokasi biaya periode: <b style="color:var(--text)">${rp(totalExpense)}</b></p>
        ${renderExpenseDonut(expenseList, totalExpense)}
      </div>

    </div>

    <!-- Buku Jurnal Mutasi Finansial -->
    <div class="card" style="margin-bottom:16px">
      <div class="ctr" style="margin-bottom:12px">
        <div>
          <h3>Buku Jurnal Mutasi Finansial ${pill('Tervalidasi', 'ok')}</h3>
          <p class="sub">Catatan mutasi debit dan kredit periode berjalan yang tervalidasi buku kas pengelola.</p>
        </div>
        <div class="tabs" id="owner-report-trx-tabs">
          <button data-type="all" class="on">Semua Mutasi</button>
          <button data-type="income">Pemasukan</button>
          <button data-type="expense">Pengeluaran</button>
        </div>
      </div>

      <div style="margin-bottom:14px">
        ${searchField('Cari tanggal, uraian mutasi, kategori...', 'tbl-owner-report-jurnal')}
      </div>

      <div id="owner-report-table-wrap">
        ${
          trxRows.length
            ? `<div class="tw">
                <table id="tbl-owner-report-jurnal" style="min-width:780px">
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>No. Transaksi</th>
                      <th>Jenis Mutasi</th>
                      <th>Uraian / Kategori</th>
                      <th class="r">Nominal</th>
                      <th>Pencatat</th>
                      <th class="r">Aksi</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${trxRows
                      .map(
                        (r) => `
                      <tr data-type="${esc(r.type)}">
                        ${r.cells.map((c, i) => `<td${i === 4 || i === 6 ? ' class="r"' : ''}>${c}</td>`).join('')}
                      </tr>`
                      )
                      .join('')}
                  </tbody>
                </table>
              </div>`
            : emptyView('Belum ada transaksi', 'Tidak ditemukan catatan transaksi pada periode yang dipilih.', 'receipt_long')
        }
      </div>

      <div class="foot" style="border-top:1px solid var(--c1);margin-top:14px">
        <span style="display:flex;gap:6px;align-items:center">
          ${ms('verified')}Data laporan terverifikasi sinkron dengan buku besar transaksi KosLedger.
        </span>
        <span style="color:var(--muted)">Menampilkan ${rawTrx.length} catatan mutasi</span>
      </div>
    </div>

    <!-- 2 Kartu Info Pajak & Penyaluran -->
    <div class="grid g2">
      <div class="card" style="display:flex;gap:14px;align-items:flex-start">
        <span class="stat" style="margin:0">
          <span class="ic" style="position:static;width:40px;height:40px;border-radius:10px">${ms('description')}</span>
        </span>
        <div>
          <b>Kesiapan Dokumen Pajak Penghasilan (PPh Sewa Kos)</b>
          <p class="sub" style="margin-top:4px">Seluruh data pendapatan sewa telah dikompilasi sesuai format pembukuan standar. Unduh dokumen rekapitulasi via tombol Ekspor CSV di atas.</p>
        </div>
      </div>
      <div class="card" style="display:flex;gap:14px;align-items:flex-start">
        <span class="stat" style="margin:0">
          <span class="ic" style="position:static;width:40px;height:40px;border-radius:10px">${ms('account_balance')}</span>
        </span>
        <div>
          <b>Rekonsiliasi Penyaluran Surplus Bersih</b>
          <p class="sub" style="margin-top:4px">Akumulasi surplus bersih siap dialokasikan sesuai ketentuan rekening pemilik terdaftar setelah verifikasi tutup buku periode berjalan.</p>
        </div>
      </div>
    </div>
  `;

  return {
    html,
    after() {
      // 1. Muat grafik komparasi 6 bulan secara asinkron
      muatGrafikSemester();

      // 2. Tombol Filter Periode
      document.getElementById('btn-owner-report-filter')?.addEventListener('click', () => {
        openFilterModal(() => go('pemilik-laporan'));
      });

      // 3. Tombol Ekspor CSV
      document.getElementById('btn-owner-report-export')?.addEventListener('click', () => {
        exportCsv(rawTrx, currentFilter);
      });

      // 4. Tab filter jenis mutasi (Semua, Pemasukan, Pengeluaran)
      const tabBtns = document.querySelectorAll('#owner-report-trx-tabs button');
      tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          tabBtns.forEach((b) => b.classList.remove('on'));
          btn.classList.add('on');
          const filterType = btn.dataset.type;
          const rows = document.querySelectorAll('#tbl-owner-report-jurnal tbody tr');
          rows.forEach((row) => {
            if (filterType === 'all' || row.dataset.type === filterType) {
              row.hidden = false;
            } else {
              row.hidden = true;
            }
          });
        });
      });

      // 5. Tombol Detail Mutasi Transaksi
      document.querySelectorAll('[data-report-trx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = Number(btn.dataset.reportTrx);
          const item = rawTrx.find((t) => t.id === id);
          if (item) {
            modal(transactionDetailModal(item));
          }
        });
      });
    },
  };
}
