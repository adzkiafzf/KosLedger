import { owner } from '../../api/dashboard.js';
import { finance, arusKasBulanan } from '../../api/reports.js';
import { go } from '../../core/router.js';
import { pageHead, pill, avatar, ms } from '../../components/ui.js';
import { statCard, dataTable } from '../../components/widgets.js';
import { barChart, donut, legend } from '../../components/charts.js';
import { emptyView, errorView } from '../../components/states.js';
import { esc, rp, rpRingkas, tgl, rentangBulan, periodeLabel } from '../../utils/format.js';

const dot = (color) =>
  `<i style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color};border:1px solid #96b5a3;margin-right:6px"></i>`;

const loadingInline = (text) => `
  <div style="display:flex;align-items:center;gap:12px;color:var(--muted);padding:28px 0">
    <span class="spin" style="border-color:rgba(23,77,59,.2);border-top-color:var(--primary);margin:0"></span>${esc(text)}
  </div>`;

// Header selamat datang pemilik dengan badge hak pantau aktif
function header(user) {
  return pageHead({
    title: `Selamat Datang, ${esc(user.name)}`,
    sub: 'Ikhtisar eksekutif kinerja operasional & performa finansial kos real-time.',
    acts: `
      <span class="ro-badge">${ms('verified_user')}Hak Pantau Aktif</span>
      <span class="sel">${ms('calendar_month')}${periodeLabel()}</span>
      <button class="btn s" data-go="pemilik-laporan">${ms('bar_chart')}Laporan Lengkap</button>
    `,
  });
}

// Kartu stat tingkat hunian dengan progress bar
function occupancyCard(occupied, total, rate, available) {
  return `
    <div class="card stat">
      <span class="l">TINGKAT HUNIAN</span>
      <span class="ic">${ms('meeting_room')}</span>
      <span class="v sm" style="display:flex;gap:8px;align-items:baseline">${rate}% <small>${occupied}/${total} Kamar</small></span>
      <div class="bar" style="margin-top:auto"><i style="width:${rate}%"></i></div>
      <span class="f" style="font-size:11px;color:var(--muted)">${available} Kamar Kosong Siap Huni</span>
    </div>`;
}

// Isi kartu grafik arus kas 6 bulan
function arusKasBody(series) {
  if (!series) {
    return `${errorView('Grafik tren arus kas belum bisa dimuat.')}<button class="btn s" id="retry-chart">${ms('refresh')}Muat ulang grafik</button>`;
  }
  if (series.every((s) => s.income === 0 && s.expense === 0)) {
    return emptyView('Belum ada transaksi', 'Grafik muncul otomatis setelah buku kas terisi.', 'bar_chart');
  }

  const top = Math.max(...series.map((s) => Math.max(s.income, s.expense)), 1);
  const totalNet = series.reduce((acc, cur) => acc + (cur.income - cur.expense), 0);
  const avgNet = Math.round(totalNet / series.length);
  const currentMonth = series[series.length - 1];
  const currentNet = currentMonth.income - currentMonth.expense;

  return `
    <div class="note" style="margin:14px 0;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px">
      <span style="display:flex;gap:8px;align-items:center">
        ${ms(avgNet >= 0 ? 'trending_up' : 'trending_down')}
        <span>Rata-rata Surplus Bersih Bulanan:</span>
      </span>
      <b style="color:var(--primary-d)">
        ${avgNet >= 0 ? '+' : '−'}${rp(Math.abs(avgNet))} / bln 
        <small style="font-weight:400;color:var(--muted)">(${currentNet >= 0 ? 'Surplus' : 'Defisit'} bulan berjalan: ${rp(Math.abs(currentNet))})</small>
      </b>
    </div>
    <div class="chartbox">${barChart(series.map((s) => s.label), series.map((s) => s.income), series.map((s) => s.expense), top, 240)}</div>
    <div class="foot"><span>Skala data maksimal: ${rp(top)}</span></div>`;
}

// Komponen kartu grafik arus kas
const arusKasCard = () => `
  <div class="card">
    <div class="ctr" style="align-items:flex-start">
      <div>
        <h3>Tren Arus Kas 6 Bulan ${pill('Historis Bulanan', 'ok')}</h3>
        <p class="sub">Komparasi pendapatan sewa versus biaya operasional bulanan</p>
      </div>
      <span style="display:flex;gap:12px;font-size:12px;color:var(--muted)">
        <span>${dot('#174d3b')}Pemasukan</span>
        <span>${dot('#a0c4ae')}Pengeluaran</span>
      </span>
    </div>
    <div id="owner-arus-kas">${loadingInline('Memuat grafik tren arus kas…')}</div>
  </div>`;

// Muat grafik 6 bulan setelah DOM terpasang
async function muatGrafik() {
  const box = document.getElementById('owner-arus-kas');
  if (!box) return;
  box.innerHTML = loadingInline('Memuat grafik tren arus kas…');
  let series = null;
  try {
    series = await arusKasBulanan(rentangBulan(6));
  } catch {
    series = null;
  }
  const el = document.getElementById('owner-arus-kas');
  if (!el) return;
  el.innerHTML = arusKasBody(series);
  document.getElementById('retry-chart')?.addEventListener('click', muatGrafik);
}

// Donut distribusi pengeluaran berdasarkan transaksi aktual
function donutPengeluaran(transactions) {
  const expenseList = (transactions || []).filter((t) => t.type === 'expense');
  if (!expenseList.length) {
    return emptyView('Belum ada data pengeluaran', 'Beban operasional belum dicatat pada periode ini.', 'pie_chart');
  }

  // Agregasi nominal per kategori
  const catMap = {};
  let totalExpense = 0;
  expenseList.forEach((t) => {
    const cat = (t.category || 'Lainnya').toLowerCase();
    const amt = Number(t.amount) || 0;
    catMap[cat] = (catMap[cat] || 0) + amt;
    totalExpense += amt;
  });

  const categories = Object.keys(catMap);
  const amounts = categories.map((c) => catMap[c]);
  const legendItems = categories.map((c) => {
    const val = catMap[c];
    const pct = totalExpense > 0 ? ((val / totalExpense) * 100).toFixed(1) : 0;
    const catLabel = c.charAt(0).toUpperCase() + c.slice(1);
    return [catLabel, `${rp(val)} (${pct}%)`];
  });

  return `
    <div class="donutwrap" style="margin-top:12px;flex-direction:column;align-items:stretch">
      <div style="width:150px;margin:0 auto">
        ${donut(amounts, `<span>Beban</span><b style="font-size:16px">${rpRingkas(totalExpense)}</b>`)}
      </div>
      ${legend(legendItems)}
    </div>`;
}

// Render baris tabel mutasi transaksi
function renderTransactionRows(list) {
  return list.map((t) => {
    const masuk = t.type === 'income';
    const creatorName = t.creator?.name || 'Sistem / Kas';
    return {
      cells: [
        `<span class="mono" style="font-size:11px">TRX-${String(t.id).padStart(4, '0')}</span>`,
        `${tgl(t.trx_date)}`,
        `<div class="cell">
          ${avatar(ms(masuk ? 'south' : 'north'))}
          <span>
            <b>${esc(t.description || '-')}</b>
            <small>${masuk ? 'Penerimaan Kas' : 'Pengeluaran Kas'}</small>
          </span>
        </div>`,
        `<span class="chip" style="text-transform:capitalize">${esc(t.category || '-')}</span>`,
        `<span class="num ${masuk ? 'pos' : 'neg'}">${masuk ? '+' : '−'}${rp(t.amount)}</span>`,
        masuk ? pill('Pemasukan', 'ok') : pill('Pengeluaran', 'err'),
        `<span style="color:var(--muted);font-size:12px">${esc(creatorName)}</span>`,
      ],
      type: t.type,
    };
  });
}

export default async function ({ user }) {
  // Panggil data ringkasan dashboard owner dan transaksi terkini secara paralel
  let dashData = null;
  let financeData = null;
  let fetchError = null;

  try {
    const [dashRes, finRes] = await Promise.all([
      owner(),
      finance().catch(() => ({ total_income: 0, total_expense: 0, balance: 0, transactions: { data: [] } })),
    ]);
    dashData = dashRes;
    financeData = finRes;
  } catch (err) {
    fetchError = err;
  }

  if (fetchError || !dashData) {
    return {
      html: `
        ${header(user)}
        ${errorView('Gagal memuat data Dashboard Pemilik. Pastikan koneksi dan hak akses aktif.')}
        <button class="btn p" onclick="location.reload()" style="margin-top:14px">${ms('refresh')}Coba Lagi</button>
      `,
    };
  }

  // Perhitungan metrik hunian
  const totalRooms = Number(dashData.total_rooms) || 0;
  const occupiedRooms = Number(dashData.occupied_rooms) || 0;
  const activeTenants = Number(dashData.active_tenants) || 0;
  const availableRooms = Math.max(0, totalRooms - occupiedRooms);
  const occupancyRate = totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 100) : 0;

  // Data finansial
  const totalIncome = Number(dashData.total_income) || 0;
  const totalExpense = Number(dashData.total_expense) || 0;
  const balance = Number(dashData.balance) || 0;
  const unpaidAmount = Number(dashData.unpaid_amount) || 0;

  // Transaksi terkini
  const rawTrx = Array.isArray(financeData?.transactions?.data)
    ? financeData.transactions.data
    : Array.isArray(financeData?.transactions)
    ? financeData.transactions
    : [];

  const trxRows = renderTransactionRows(rawTrx);

  const html = `
    ${header(user)}

    ${
      unpaidAmount > 0
        ? `<div class="note err2" style="margin-bottom:16px">
            ${ms('warning')}
            <span style="flex:1">Terdapat <b>${rp(unpaidAmount)}</b> tagihan sewa berstatus belum lunas yang perlu dipantau.</span>
            <button class="btn s sm" data-go="pemilik-laporan" style="color:var(--err)">Lihat Laporan &raquo;</button>
          </div>`
        : ''
    }

    <!-- 5 Kartu KPI Eksekutif -->
    <div class="grid g5" style="margin-bottom:16px">
      ${statCard('TOTAL PEMASUKAN', rp(totalIncome), pill('Kas Masuk Terverifikasi', 'ok'), 'account_balance_wallet', { sm: true })}
      ${statCard('TOTAL PENGELUARAN', rp(totalExpense), pill('Pos Beban Terbuku', ''), 'receipt_long', { sm: true })}
      ${statCard(
        'SURPLUS BERSIH (NET)',
        rp(balance),
        pill(balance >= 0 ? 'Likuiditas Aman' : 'Defisit', balance >= 0 ? 'mint' : 'err'),
        'savings',
        { cls: balance >= 0 ? 'dark' : 'red', sm: true }
      )}
      ${statCard('JUMLAH PENGHUNI', `${activeTenants} <small>Orang</small>`, pill('Aktif Terdaftar', 'ok'), 'groups', { sm: true })}
      ${occupancyCard(occupiedRooms, totalRooms, occupancyRate, availableRooms)}
    </div>

    <!-- Layout Dua Kolom: Kiri (Grafik & Feed Mutasi) | Kanan (Distribusi Beban & Okupansi) -->
    <div class="grid g21" style="align-items:start">
      
      <!-- Kolom Kiri -->
      <div style="display:grid;gap:16px;min-width:0">
        
        <!-- Tren Arus Kas -->
        ${arusKasCard()}

        <!-- Feed Mutasi Transaksi Terkini -->
        <div class="card">
          <div class="ctr" style="margin-bottom:12px">
            <div>
              <h3>Arus Transaksi Terkini ${pill('Live Mutasi', 'ok')}</h3>
              <p class="sub">Mutasi keuangan buku kas kos yang tercatat real-time.</p>
            </div>
            <div class="tabs" id="owner-ftabs">
              <button data-type="all" class="on">Semua Mutasi</button>
              <button data-type="income">Pemasukan</button>
              <button data-type="expense">Pengeluaran</button>
            </div>
          </div>

          <div id="owner-trx-table-wrap">
            ${
              trxRows.length
                ? `<div class="tw">
                    <table id="tbl-owner-feed" style="min-width:760px">
                      <thead>
                        <tr>
                          <th>No. Transaksi</th>
                          <th>Tanggal</th>
                          <th>Uraian Transaksi</th>
                          <th>Kategori</th>
                          <th class="r">Nominal</th>
                          <th>Tipe</th>
                          <th>Pencatat</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${trxRows
                          .map(
                            (r) => `
                          <tr data-type="${esc(r.type)}">
                            ${r.cells.map((c, i) => `<td${i === 4 ? ' class="r"' : ''}>${c}</td>`).join('')}
                          </tr>`
                          )
                          .join('')}
                      </tbody>
                    </table>
                  </div>`
                : emptyView('Belum ada transaksi', 'Belum ada transaksi kas yang dicatat.', 'receipt_long')
            }
          </div>

          <div class="foot" style="border-top:1px solid var(--c1);margin-top:12px">
            <span style="display:flex;gap:6px;align-items:center">
              ${ms('shield')}Akses hanya-lihat: Seluruh transaksi dilindungi stempel audit buku kas KosLedger.
            </span>
            <a data-go="pemilik-riwayat" style="font-weight:600;color:var(--primary-d);cursor:pointer;display:inline-flex;gap:4px;align-items:center">
              Buka Riwayat Lengkap ${ms('arrow_forward')}
            </a>
          </div>
        </div>
      </div>

      <!-- Kolom Kanan -->
      <div style="display:grid;gap:16px;min-width:0">
        
        <!-- Distribusi Beban Operasional -->
        <div class="card">
          <div class="ctr">
            <h3>Distribusi Pengeluaran</h3>
            ${ms('pie_chart')}
          </div>
          <p class="sub">Total Beban Operasional: <b style="color:var(--text)">${rp(totalExpense)}</b></p>
          ${donutPengeluaran(rawTrx)}
        </div>

        <!-- Status & Rincian Okupansi Kamar -->
        <div class="card">
          <div class="ctr">
            <h3>Ketersediaan Unit Kamar</h3>
            ${ms('meeting_room')}
          </div>
          <p class="sub">Pantauan keterisian kos & unit siap huni</p>
          
          <div class="tiles" style="margin:14px 0 10px">
            <div class="tile">
              <span class="ms" style="font-size:24px;color:var(--primary)">meeting_room</span>
              <div>
                <small>Unit Terisi</small>
                <b>${occupiedRooms} / ${totalRooms} Kamar</b>
              </div>
            </div>
            <div class="tile">
              <span class="ms" style="font-size:24px;color:var(--muted)">door_front</span>
              <div>
                <small>Unit Kosong</small>
                <b>${availableRooms} Unit Siap Huni</b>
              </div>
            </div>
          </div>

          <div class="note" style="margin-top:8px">
            ${ms('info')}
            <span>Tingkat hunian kos saat ini berada pada <b>${occupancyRate}%</b> dengan total <b>${activeTenants}</b> penghuni aktif terdaftar.</span>
          </div>
        </div>

      </div>
    </div>
  `;

  return {
    html,
    after() {
      // Muat grafik historis bulanan secara asinkron
      muatGrafik();

      // Filter tab mutasi (Semua, Pemasukan, Pengeluaran)
      const tabBtns = document.querySelectorAll('#owner-ftabs button');
      tabBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          tabBtns.forEach((b) => b.classList.remove('on'));
          btn.classList.add('on');
          const filterType = btn.dataset.type;
          const rows = document.querySelectorAll('#tbl-owner-feed tbody tr');
          rows.forEach((row) => {
            if (filterType === 'all' || row.dataset.type === filterType) {
              row.hidden = false;
            } else {
              row.hidden = true;
            }
          });
        });
      });
    },
  };
}
