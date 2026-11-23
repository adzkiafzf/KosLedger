import { getTransactions, getTransaction } from '../../api/cash-transactions.js';
import { finance } from '../../api/reports.js';
import { owner } from '../../api/dashboard.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, ms, modal, mhead, kvs } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { donut, legend } from '../../components/charts.js';
import { emptyView, errorView, loadingView } from '../../components/states.js';
import { esc, tgl, rp, rpRingkas } from '../../utils/format.js';

const CATEGORIES = [
  'Semua',
  'Listrik',
  'Air',
  'Gas',
  'CCTV',
  'Perbaikan',
  'Peralatan Kebersihan',
  'Internet',
  'Lainnya',
];

const CATEGORY_ICONS = {
  Listrik: 'bolt',
  Air: 'water_drop',
  Gas: 'local_fire_department',
  CCTV: 'videocam',
  Perbaikan: 'build',
  'Peralatan Kebersihan': 'cleaning_services',
  Internet: 'wifi',
  Lainnya: 'more_horiz',
};

const head = () =>
  pageHead({
    crumb: `Pemantauan › <b>Biaya Operasional</b>`,
    title: 'Monitoring Pengeluaran Kos',
    sub: 'Pantau pos beban operasional, utilitas gedung, pemeliharaan kamar, dan rekonsiliasi kas keluar.',
    acts: `<span class="ro-badge">${ms('visibility')}Mode Pantau Pemilik</span>`,
  });

function expenseDetailModal(t) {
  const icon = CATEGORY_ICONS[t.category] || 'more_horiz';
  return `
    ${mhead(`Pengeluaran #${t.id}`, esc(t.description), icon)}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px">
        <span class="lbl" style="font-size:11px">KATEGORI BIAYA</span>
        <span class="pill ok">${ms(icon)} ${esc(t.category)}</span>
      </div>
      ${kvs([
        ['ID Transaksi', `<span class="mono">TRX-EXP-${String(t.id).padStart(4, '0')}</span>`],
        ['Kategori Beban', esc(t.category)],
        ['Deskripsi / Uraian', esc(t.description)],
        ['Nominal Pengeluaran', `<b style="font-size:17px;color:var(--err)">−${rp(t.amount)}</b>`],
        ['Tanggal Transaksi', tgl(t.trx_date)],
        ['Dicatat Oleh', esc(t.creator?.name || 'Bendahara Kas')],
      ])}
      <div class="note" style="margin-top:14px">
        ${ms('shield')}
        <span style="font-size:12px;color:var(--muted)">
          Mode Pantau Pemilik: Seluruh catatan pengeluaran disinkronkan langsung dari buku kas pengelola. Penambahan atau koreksi dilakukan oleh Bendahara.
        </span>
      </div>
    </div>
    <footer class="mf2">
      <button class="btn p" data-act="close">Tutup</button>
    </footer>`;
}

// Menampilkan modal detail pengeluaran
async function showExpenseDetail(item) {
  modal(`
    ${mhead('Memuat Detail Pengeluaran…', '', 'receipt_long')}
    <div class="mb">${loadingView('Mengambil rincian pengeluaran…')}</div>
    <footer class="mf2"><button class="btn s" data-act="close">Batal</button></footer>
  `);

  if (item.id) {
    try {
      const full = await getTransaction(item.id);
      modal(expenseDetailModal(full));
      return;
    } catch {
      // Jika endpoint getTransaction 403 / dibatasi, gunakan data yang sudah ada di memori
    }
  }

  modal(expenseDetailModal(item));
}

function expenseRows(list) {
  return list.map((x) => {
    const icon = CATEGORY_ICONS[x.category] || 'more_horiz';
    return [
      `<span class="pill ok" data-cat-val="${esc(x.category)}">${ms(icon)} ${esc(x.category)}</span>`,
      `<b>${esc(x.description)}</b>`,
      `<span class="num neg">−${rp(x.amount)}</span>`,
      `<span>${tgl(x.trx_date)}</span>`,
      `<span>${esc(x.creator?.name || 'Bendahara')}</span>`,
      `<div class="acts" style="justify-content:flex-end">
        <button class="btn sm s" data-exp-detail="${x.id}" aria-label="Lihat detail pengeluaran">${ms('visibility')} Detail</button>
      </div>`,
    ];
  });
}

function expenseDistributionDonut(expenses, totalAmount) {
  if (!expenses.length || totalAmount <= 0) {
    return emptyView('Belum ada distribusi', 'Grafik muncul setelah terdapat transaksi pengeluaran.', 'pie_chart');
  }

  const catMap = {};
  expenses.forEach((x) => {
    const cat = x.category || 'Lainnya';
    catMap[cat] = (catMap[cat] || 0) + (Number(x.amount) || 0);
  });

  const cats = Object.keys(catMap);
  const amounts = cats.map((c) => catMap[c]);
  const legendItems = cats.map((c) => {
    const val = catMap[c];
    const pct = totalAmount > 0 ? ((val / totalAmount) * 100).toFixed(1) : 0;
    return [c, `${rp(val)} (${pct}%)`];
  });

  return `
    <div class="donutwrap" style="flex-direction:column;align-items:stretch">
      <div style="width:150px;margin:0 auto">
        ${donut(amounts, `<span>Total</span><b style="font-size:16px">${rpRingkas(totalAmount)}</b>`)}
      </div>
      ${legend(legendItems)}
    </div>`;
}

export default async function expensesMonitoringPage() {
  let expenses = [];
  let dashboardStats = null;
  let isFallback = false;
  let fetchError = null;

  // 1. Ambil ringkasan dashboard owner untuk metrik keuangan resmi
  try {
    dashboardStats = await owner();
  } catch {
    dashboardStats = null;
  }

  // 2. Ambil data pengeluaran (coba GET /transactions?type=expense, bila 403 fallback ke GET /reports/finance)
  try {
    const res = await getTransactions({ type: 'expense' });
    const list = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
    expenses = list.filter((t) => t.type === 'expense');
  } catch (err) {
    if (err.response?.status === 403) {
      isFallback = true;
      try {
        const finRes = await finance();
        const trxList = Array.isArray(finRes?.transactions?.data)
          ? finRes.transactions.data
          : Array.isArray(finRes?.transactions)
          ? finRes.transactions
          : [];
        expenses = trxList.filter((t) => t.type === 'expense');
      } catch (fallbackErr) {
        fetchError = fallbackErr;
      }
    } else {
      fetchError = err;
    }
  }

  if (fetchError && !expenses.length && !dashboardStats) {
    return {
      html: `
        ${head()}
        ${errorView(apiError(fetchError))}
        <button class="btn s" id="retry-expenses">${ms('refresh')}Coba lagi</button>`,
      after() {
        document.getElementById('retry-expenses')?.addEventListener('click', () => go('pemilik-pengeluaran'));
      },
    };
  }

  // Perhitungan statistik pengeluaran
  const totalFromList = expenses.reduce((acc, x) => acc + (Number(x.amount) || 0), 0);
  const totalExpense = dashboardStats?.total_expense ? Number(dashboardStats.total_expense) : totalFromList;
  const avgExpense = expenses.length > 0 ? Math.round(totalFromList / expenses.length) : 0;

  // Cari kategori beban terbesar
  const catSums = {};
  expenses.forEach((x) => {
    const cat = x.category || 'Lainnya';
    catSums[cat] = (catSums[cat] || 0) + (Number(x.amount) || 0);
  });
  let topCategory = { name: 'Belum Ada', amount: 0, icon: 'receipt_long' };
  Object.keys(catSums).forEach((cat) => {
    if (catSums[cat] > topCategory.amount) {
      topCategory = { name: cat, amount: catSums[cat], icon: CATEGORY_ICONS[cat] || 'receipt_long' };
    }
  });

  const balance = Number(dashboardStats?.balance) || 0;

  return {
    html: `
      ${head()}

      <!-- 4 Kartu KPI Monitoring Pengeluaran -->
      <div class="grid g4" style="margin-bottom:16px">
        ${statCard('Total Beban Operasional', rp(totalExpense), pill('Beban Kas Keluar', 'err'), 'receipt_long', { cls: 'red' })}
        ${statCard('Rata-rata per Transaksi', rp(avgExpense), `<span class="chip" style="background:var(--c1)">${expenses.length} Pos Biaya</span>`, 'trending_down')}
        ${statCard('Pos Biaya Terbesar', topCategory.name, topCategory.amount > 0 ? pill(rp(topCategory.amount), 'warn') : '', topCategory.icon)}
        ${statCard(
          'Saldo Kas Bersih Properti',
          rp(balance),
          pill(balance >= 0 ? 'Surplus Likuiditas' : 'Defisit', balance >= 0 ? 'mint' : 'err'),
          'account_balance_wallet',
          { cls: balance >= 0 ? 'dark' : 'red' }
        )}
      </div>

      ${
        isFallback
          ? `<div class="info-banner">
              <div class="ctr">
                ${ms('info')}
                <span style="font-size:13px">Menampilkan data pengeluaran disinkronkan dari buku kas keuangan (<code>/reports/finance</code>). Pencatatan dan klasifikasi pos biaya dikelola oleh tim Bendahara.</span>
              </div>
            </div>`
          : ''
      }

      <!-- Layout Dua Kolom: Tabel Monitoring Pengeluaran (2fr) & Distribusi Beban Donut (1fr) -->
      <div class="grid g21" style="align-items:start">
        
        <!-- Kolom Kiri: Tabel Pengeluaran -->
        <div class="card">
          <div class="filter" style="margin-bottom:14px;flex-wrap:wrap;gap:12px">
            ${searchField('Cari kategori, uraian pengeluaran...', 'tp-owner-expenses')}
            <div class="scroll-tabs" id="owner-exp-cat-tabs">
              ${CATEGORIES.map((c) => `<button class="${c === 'Semua' ? 'on' : ''}" data-cat="${c === 'Semua' ? '' : c}">${c}</button>`).join('')}
            </div>
          </div>

          ${dataTable(
            ['Kategori Biaya', 'Deskripsi / Uraian', '>Nominal Beban', 'Tanggal', 'Pencatat', '>Aksi'],
            expenseRows(expenses),
            {
              id: 'tp-owner-expenses',
              min: 720,
              emptyTitle: 'Belum ada catatan pengeluaran',
              emptyText: 'Seluruh pos pengeluaran operasional akan muncul di sini setelah dicatat bendahara.',
              emptyIcon: 'receipt_long',
            }
          )}

          <div class="foot" style="border-top:1px solid var(--c1);margin-top:14px">
            <span style="display:flex;gap:6px;align-items:center">
              ${ms('verified')}Data pengeluaran diverifikasi dari buku besar operasional kas.
            </span>
            <span style="color:var(--muted)">Total ${expenses.length} mutasi pengeluaran</span>
          </div>
        </div>

        <!-- Kolom Kanan: Distribusi Kategori Pengeluaran -->
        <div class="card">
          <div class="ctr" style="margin-bottom:8px">
            <h3 style="font-size:17px">Distribusi Beban</h3>
            ${ms('pie_chart')}
          </div>
          <p class="sub" style="margin-bottom:14px">Proporsi pengeluaran operasional berdasarkan kategori</p>
          ${expenseDistributionDonut(expenses, totalFromList)}
        </div>

      </div>
    `,
    after() {
      // Filter kategori tab
      const tabs = document.querySelectorAll('#owner-exp-cat-tabs button');
      tabs.forEach((btn) => {
        btn.addEventListener('click', () => {
          tabs.forEach((b) => b.classList.remove('on'));
          btn.classList.add('on');
          const cat = btn.dataset.cat;
          document.querySelectorAll('#tp-owner-expenses tbody tr').forEach((tr) => {
            if (!cat) {
              tr.hidden = false;
            } else {
              const val = tr.querySelector('[data-cat-val]')?.dataset?.catVal;
              tr.hidden = val !== cat;
            }
          });
        });
      });

      // Tombol Detail Modal
      document.querySelectorAll('[data-exp-detail]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = Number(btn.dataset.expDetail);
          const item = expenses.find((x) => x.id === id);
          if (item) {
            showExpenseDetail(item);
          }
        });
      });
    },
  };
}
