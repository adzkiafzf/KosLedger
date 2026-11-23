import { treasurer } from '../../api/dashboard.js';
import { arusKasBulanan, paymentsReport } from '../../api/reports.js';
import { getBills } from '../../api/bills.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, avatar, ms } from '../../components/ui.js';
import { statCard, dataTable } from '../../components/widgets.js';
import { barChart, donut, legend } from '../../components/charts.js';
import { emptyView, errorView } from '../../components/states.js';
import { esc, rp, rpRingkas, tgl, rentangBulan } from '../../utils/format.js';

const head = () =>
  pageHead({
    eyebrow: 'RINGKASAN KEUANGAN',
    txt: 1,
    dot: 1,
    title: 'Ringkasan Keuangan Kos',
    sub: 'Pantau arus kas, status pelunasan sewa, dan tagihan aktif secara real-time.',
    acts: `<button class="btn p" data-go="bendahara-pembayaran">${ms('add')}Catat Transaksi</button>`,
  });

const dot = (color) =>
  `<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};border:1px solid #96b5a3;margin-right:6px"></i>`;

const loadingInline = (text) => `
  <div style="display:flex;align-items:center;gap:12px;color:var(--muted);padding:28px 0">
    <span class="spin" style="border-color:rgba(23,77,59,.2);border-top-color:var(--primary);margin:0"></span>${esc(text)}
  </div>`;

// Isi kartu grafik. series = null berarti gagal dimuat.
function arusKasBody(series) {
  if (!series) {
    return `${errorView('Grafik arus kas belum bisa dimuat.')}<button class="btn s" id="retry-chart">${ms('refresh')}Muat ulang grafik</button>`;
  }
  if (series.every((s) => s.income === 0 && s.expense === 0)) {
    return emptyView('Belum ada arus kas', 'Grafik muncul setelah ada pemasukan atau pengeluaran.', 'bar_chart');
  }
  const now = series[series.length - 1];
  const net = now.income - now.expense;
  const top = Math.max(...series.map((s) => Math.max(s.income, s.expense)), 1);
  const margin = now.income > 0 ? Math.round((net / now.income) * 100) : null;
  return `
    <div class="note" style="margin:16px 0;justify-content:space-between;align-items:center">
      ${ms(net >= 0 ? 'trending_up' : 'trending_down')}
      <b style="flex:1">${net >= 0 ? 'Surplus' : 'Defisit'} bulan ini: ${rp(Math.abs(net))}</b>
      ${margin === null ? '' : pill(`Margin ${margin}%`, net >= 0 ? 'mint' : 'err')}
    </div>
    <div class="chartbox">${barChart(series.map((s) => s.label), series.map((s) => s.income), series.map((s) => s.expense), top)}</div>
    <div class="foot"><span>Skala maksimal: ${rp(top)}</span></div>`;
}

// Kartu grafik; isinya diisi belakangan lewat muatGrafik() supaya halaman tidak menunggu.
const arusKasCard = () => `
  <div class="card">
    <div class="ctr" style="align-items:flex-start">
      <div><h3>Arus Kas Bulanan</h3><p class="sub">Pemasukan dan pengeluaran 6 bulan terakhir</p></div>
      <span style="display:flex;gap:12px;font-size:12px;color:var(--muted)"><span>${dot('#174d3b')}Pemasukan</span><span>${dot('#dfe9e2')}Pengeluaran</span></span>
    </div>
    <div id="arus-kas">${loadingInline('Memuat grafik…')}</div>
  </div>`;

// Ambil data grafik lalu isi kartunya. Aman bila user sudah pindah halaman.
async function muatGrafik() {
  const box = document.getElementById('arus-kas');
  if (!box) return;
  box.innerHTML = loadingInline('Memuat grafik…');
  let series = null;
  try {
    series = await arusKasBulanan(rentangBulan(6));
  } catch {
    series = null;
  }
  const el = document.getElementById('arus-kas');
  if (!el) return;
  el.innerHTML = arusKasBody(series);
  document.getElementById('retry-chart')?.addEventListener('click', muatGrafik);
}

function transaksiRows(list) {
  return list.map((t) => {
    const masuk = t.type === 'income';
    return [
      tgl(t.trx_date),
      `<div class="cell">${avatar(ms(masuk ? 'south' : 'north'))}<span><b>${esc(t.description)}</b><small style="text-transform:capitalize">${esc(t.category)}</small></span></div>`,
      `<span class="num ${masuk ? 'pos' : 'neg'}">${masuk ? '+' : '−'}${rp(t.amount)}</span>`,
      masuk ? pill('Pemasukan', 'ok') : pill('Pengeluaran', 'err'),
    ];
  });
}

function tagihanTertundaList(list) {
  if (!list.length) return '';
  return list
    .slice(0, 3)
    .map((b) => {
      const penghuni = esc(b.occupancy?.user?.name || 'Penghuni');
      const kamar = esc(b.occupancy?.room?.room_number || '-');
      const jatuhTempo = tgl(b.due_date);
      return `
        <div class="note" style="display:block;margin-bottom:10px">
          <div class="ctr">
            <span>
              <b>${penghuni}</b> <span class="chip" style="background:#fff">Kamar ${kamar}</span><br>
              <small style="color:var(--muted)">Jatuh tempo: ${jatuhTempo}</small>
            </span>
            <span style="text-align:right">
              <b style="font-size:16px;color:var(--primary-d)">${rp(b.total_amount)}</b>
            </span>
          </div>
        </div>`;
    })
    .join('');
}

export default async function dashboard() {
  let d;
  let paySummary = null;
  let unpaidBillsList = [];

  try {
    const [dashRes, payRes, billsRes] = await Promise.all([
      treasurer(),
      paymentsReport().catch(() => null),
      getBills({ status: 'unpaid' }).catch(() => null),
    ]);
    d = dashRes;
    paySummary = payRes?.summary || null;
    unpaidBillsList = Array.isArray(billsRes?.data) ? billsRes.data : [];
  } catch (err) {
    return {
      html: `${head()}${errorView(apiError(err))}<button class="btn s" id="retry">${ms('refresh')}Coba lagi</button>`,
      after() {
        document.getElementById('retry')?.addEventListener('click', () => go('bendahara'));
      },
    };
  }

  const income = Number(d.total_income) || 0;
  const expense = Number(d.total_expense) || 0;
  const balance = Number(d.balance) || 0;
  const unpaidN = Number(d.unpaid_bills) || 0;
  const unpaidAmt = Number(d.unpaid_amount) || 0;
  const paidCount = Number(paySummary?.count_success) || 0;
  const paidTotal = Number(paySummary?.total_success) || 0;
  const recent = Array.isArray(d.recent_transactions) ? d.recent_transactions : [];
  const margin = income > 0 ? Math.round((balance / income) * 100) : null;

  const komposisi =
    income + expense > 0
      ? `<div class="donutwrap" style="margin-top:16px;flex-direction:column;align-items:stretch">
          <div style="width:170px;margin:0 auto">${donut([income, expense], `<span>Saldo</span><b>${rpRingkas(balance)}</b>`)}</div>
          ${legend([['Pemasukan', rp(income)], ['Pengeluaran', rp(expense)]])}
        </div>`
      : emptyView('Belum ada transaksi kas', 'Pemasukan dan pengeluaran akan tampil di sini setelah dicatat.', 'account_balance_wallet');

  const infoPelunasan =
    paidCount > 0
      ? `<div class="note" style="margin-top:14px;justify-content:space-between;align-items:center">
          <span style="display:flex;gap:8px;align-items:center">
            ${ms('task_alt')}
            <span><b>Tagihan Terbayar (Lunas)</b><br><small style="color:var(--muted)">${paidCount} tagihan berhasil lunas</small></span>
          </span>
          <b style="color:var(--primary-d);font-size:15px">${rp(paidTotal)}</b>
        </div>`
      : '';

  const tunggakan =
    unpaidN > 0
      ? `<div class="note" style="margin:16px 0;align-items:center;justify-content:space-between">
          <span style="display:flex;gap:10px;align-items:center">
            ${ms('notifications_active')}
            <span>Total Belum Dibayar<br><b style="font-size:20px;color:var(--primary-d)">${rp(unpaidAmt)}</b></span>
          </span>
          <small style="color:var(--muted)">${unpaidN} Tagihan Terbuka</small>
        </div>
        ${tagihanTertundaList(unpaidBillsList)}
        <button class="btn s" style="width:100%;margin-top:6px" data-go="bendahara-tagihan">${ms('receipt_long')}Kelola Semua Tagihan</button>`
      : `${emptyView('Semua tagihan sudah lunas', 'Tidak ada tagihan yang menunggu pembayaran.', 'task_alt')}
         <button class="btn s" style="width:100%;margin-top:12px" data-go="bendahara-tagihan">${ms('receipt_long')}Lihat Arsip Tagihan</button>`;

  return {
    html: `
      ${head()}
      <div class="grid g4">
        ${statCard('Total Pemasukan', rp(income), 'Semua kas masuk tercatat', 'payments')}
        ${statCard('Total Pengeluaran', rp(expense), 'Beban operasional & utilitas', 'account_balance_wallet')}
        ${statCard('Tagihan Belum Dibayar', rp(unpaidAmt), pill(`${unpaidN} Tagihan`, unpaidN ? 'err' : 'ok'), 'assignment_late', { cls: unpaidN ? 'red' : '' })}
        ${statCard('Saldo Kas Bersih', rp(balance), margin === null ? 'Belum ada pemasukan' : `${margin >= 0 ? 'Surplus' : 'Defisit'} ${Math.abs(margin)}% dari pemasukan`, 'savings', { cls: 'dark' })}
      </div>
      <div class="grid g21">
        ${arusKasCard()}
        <div class="card">
          <h3>Komposisi Kas</h3>
          <p class="sub">Total pemasukan dibanding pengeluaran</p>
          ${komposisi}
          ${infoPelunasan}
        </div>
      </div>
      <div class="grid g21">
        <div class="card">
          <h3>Transaksi Kas Terkini</h3>
          <p class="sub">Pencatatan kas masuk dan keluar operasional terbaru</p>
          ${dataTable(['Tanggal', 'Keterangan', '>Nominal', 'Jenis'], transaksiRows(recent), { min: 520, emptyTitle: 'Belum ada transaksi', emptyText: 'Transaksi kas yang dicatat akan muncul di sini.', emptyIcon: 'receipt_long' })}
          ${recent.length ? `<div class="foot"><span>Menampilkan ${recent.length} transaksi terbaru</span><a data-go="bendahara-laporan" style="font-weight:600;color:var(--primary-d);cursor:pointer;display:flex;gap:4px;align-items:center">Lihat Semua ${ms('arrow_forward')}</a></div>` : ''}
        </div>
        <div class="card">
          <div class="ctr">
            <div><h3>Tagihan Tertunda</h3><p class="sub">Daftar kamar belum melunasi kewajiban</p></div>
            ${pill(`${unpaidN} Tagihan`, unpaidN ? 'err' : 'ok')}
          </div>
          ${tunggakan}
        </div>
      </div>`,
    after: muatGrafik,
  };
}
