import { getBills, getBill } from '../../api/bills.js';
import { paymentsReport } from '../../api/reports.js';
import { owner } from '../../api/dashboard.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, avatar, ms, modal, mhead, kvs } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { emptyView, errorView, loadingView } from '../../components/states.js';
import { esc, tgl, rp, periodeLabel, initials } from '../../utils/format.js';

const head = () =>
  pageHead({
    crumb: `Pemantauan › <b>Daftar Tagihan Sewa</b>`,
    title: 'Monitoring Tagihan Kos',
    sub: 'Pantau status penagihan sewa kamar, batas jatuh tempo, dan rincian pelunasan penghuni.',
    acts: `<span class="ro-badge">${ms('visibility')}Mode Pantau Pemilik</span>`,
  });

function billStatusPill(status, dueDate) {
  if (status === 'paid') {
    return pill('Lunas', 'ok dot');
  }
  const isOverdue = dueDate && new Date(dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
  if (isOverdue) {
    return pill('Jatuh Tempo', 'err dot');
  }
  return pill('Menunggu Pembayaran', 'warn dot');
}

function billDetailModal(b) {
  const isOverdue = b.status === 'unpaid' && b.due_date && new Date(b.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
  const invId = b.invoice_number || `#INV-${b.period ? b.period.replace('-', '') : ''}-${String(b.id || 1).padStart(3, '0')}`;
  const penghuni = esc(b.occupant_name || b.occupancy?.user?.name || 'Penghuni');
  const kamar = esc(b.room_number || b.occupancy?.room?.room_number || '-');
  const items = Array.isArray(b.items) ? b.items : [];
  const payments = Array.isArray(b.payments) ? b.payments : [];
  const successPay = payments.find((p) => p.status === 'success') || (b.payment_info ? b.payment_info : null);

  const itemsHtml = items.length
    ? `<div style="margin:14px 0 6px;font-weight:600;font-size:13px">Rincian Pos Tagihan</div>
       <div class="kvs" style="margin-bottom:12px">
         ${items
           .map(
             (it) =>
               `<div class="kv"><span>${esc(it.description || it.category)}</span><b>${rp(it.amount)}</b></div>`
           )
           .join('')}
       </div>`
    : '';

  const paymentInfo = successPay
    ? `<div class="note" style="margin-top:14px;background:var(--c1)">
        ${ms('verified_user')}
        <span><b>Lunas Terverifikasi</b><br><small style="color:var(--muted)">Metode: ${esc(successPay.method || successPay.payment_method || 'Transfer / Kas')} • ${tgl(successPay.paid_at || successPay.created_at)}</small></span>
      </div>`
    : '';

  return `
    ${mhead(`Tagihan ${invId}`, `${penghuni} • Kamar ${kamar}`, 'receipt_long')}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px">
        <span class="lbl" style="font-size:11px">STATUS PEMBAYARAN</span>
        ${billStatusPill(b.status, b.due_date)}
      </div>
      ${kvs([
        ['ID Tagihan / Invoice', `<span class="mono">${invId}</span>`],
        ['Nama Penyewa', penghuni],
        ['Unit Kamar', `Kamar ${kamar}`],
        ['Periode Sewa', b.period ? periodeLabel(b.period) : 'Bulan Berjalan'],
        ['Batas Jatuh Tempo', b.due_date ? tgl(b.due_date) : '–'],
        ['Total Tagihan', `<b style="font-size:16px;color:var(--primary-d)">${rp(b.total_amount)}</b>`],
      ])}
      ${itemsHtml}
      ${paymentInfo}
      <div class="note" style="margin-top:14px">
        ${ms('shield')}
        <span style="font-size:12px;color:var(--muted)">
          Mode Pantau Pemilik: Penerbitan tagihan, penyesuaian nominal, dan pencatatan kas masuk dikelola oleh Bendahara.
        </span>
      </div>
    </div>
    <footer class="mf2">
      <button class="btn p" data-act="close">Tutup</button>
    </footer>`;
}

// Tampilkan modal rincian tagihan
async function showBillDetail(billData) {
  modal(`
    ${mhead('Memuat Detail Tagihan…', '', 'receipt_long')}
    <div class="mb">${loadingView('Mengambil rincian pos tagihan dari server…')}</div>
    <footer class="mf2"><button class="btn s" data-act="close">Batal</button></footer>
  `);

  if (billData.id) {
    try {
      const fullBill = await getBill(billData.id);
      modal(billDetailModal(fullBill));
      return;
    } catch {
      // Jika endpoint getBill dibatasi / 403, gunakan data yang sudah ada di memori
    }
  }

  modal(billDetailModal(billData));
}

function billRows(bills) {
  return bills.map((b) => {
    const isOverdue = b.status === 'unpaid' && b.due_date && new Date(b.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
    const invId = b.invoice_number || `#INV-${b.period ? b.period.replace('-', '') : ''}-${String(b.id || 1).padStart(3, '0')}`;
    const penghuni = esc(b.occupant_name || b.occupancy?.user?.name || 'Penghuni');
    const kamar = esc(b.room_number || b.occupancy?.room?.room_number || '-');
    const statusVal = b.status === 'paid' ? 'paid' : isOverdue ? 'overdue' : 'pending';

    return [
      `<b class="mono" style="font-size:12px">${invId}</b>`,
      `<div class="cell">
        ${avatar(esc(initials(penghuni)))}
        <span><b>${penghuni}</b></span>
      </div>`,
      `<span class="chip">● Kamar ${kamar}</span>`,
      `<span style="color:var(--text);font-weight:500;font-size:13px">${b.period ? periodeLabel(b.period) : 'Bulan Berjalan'}</span>`,
      `<span class="num ${isOverdue ? 'neg' : ''}">${rp(b.total_amount)}</span>`,
      `<span>${b.due_date ? tgl(b.due_date) : '–'}${isOverdue ? `<br><small style="color:var(--err);font-weight:600">Lewat jatuh tempo</small>` : ''}</span>`,
      `<span data-status-val="${statusVal}">${billStatusPill(b.status, b.due_date)}</span>`,
      `<div class="acts" style="justify-content:flex-end">
        <button class="btn sm s" data-bill-idx="${b.id || invId}" aria-label="Lihat detail tagihan">${ms('visibility')} Detail</button>
      </div>`,
    ];
  });
}

export default async function billsMonitoringPage() {
  let bills = [];
  let dashboardStats = null;
  let isFallback = false;
  let fetchError = null;

  // 1. Ambil ringkasan dashboard owner untuk data agregat KPI resmi
  try {
    dashboardStats = await owner();
  } catch {
    dashboardStats = null;
  }

  // 2. Ambil daftar tagihan (coba GET /bills, bila 403 fallback ke GET /reports/payments)
  try {
    const res = await getBills();
    bills = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  } catch (err) {
    if (err.response?.status === 403) {
      isFallback = true;
      try {
        const payReport = await paymentsReport();
        const payList = Array.isArray(payReport?.payments?.data)
          ? payReport.payments.data
          : Array.isArray(payReport?.payments)
          ? payReport.payments
          : [];

        // Rekonstruksi catatan tagihan dari laporan pembayaran
        bills = payList.map((p) => ({
          id: p.bill_id || p.id,
          invoice_number: p.bill_id ? `#INV-B${p.bill_id}` : `#PAY-${p.id}`,
          period: null,
          due_date: p.paid_at || p.created_at,
          total_amount: Number(p.amount) || 0,
          status: p.status === 'success' ? 'paid' : 'unpaid',
          occupant_name: p.bill?.occupancy?.user?.name || 'Penyewa',
          room_number: p.bill?.occupancy?.room?.room_number || '-',
          payment_info: p,
        }));
      } catch (fallbackErr) {
        fetchError = fallbackErr;
      }
    } else {
      fetchError = err;
    }
  }

  if (fetchError && !bills.length && !dashboardStats) {
    return {
      html: `
        ${head()}
        ${errorView(apiError(fetchError))}
        <button class="btn s" id="retry-bills">${ms('refresh')}Coba lagi</button>`,
      after() {
        document.getElementById('retry-bills')?.addEventListener('click', () => go('pemilik-tagihan'));
      },
    };
  }

  // Perhitungan statistik tagihan
  const totalNominal = bills.reduce((acc, b) => acc + (Number(b.total_amount) || 0), 0);
  const paidBills = bills.filter((b) => b.status === 'paid');
  const paidNominal = paidBills.reduce((acc, b) => acc + (Number(b.total_amount) || 0), 0);
  
  const overdueBills = bills.filter(
    (b) => b.status === 'unpaid' && b.due_date && new Date(b.due_date) < new Date(new Date().setHours(0, 0, 0, 0))
  );
  const overdueNominal = overdueBills.reduce((acc, b) => acc + (Number(b.total_amount) || 0), 0);

  const pendingBills = bills.filter((b) => b.status === 'unpaid' && !overdueBills.includes(b));
  const pendingNominal = pendingBills.reduce((acc, b) => acc + (Number(b.total_amount) || 0), 0);

  const unpaidTotalAmount = dashboardStats?.unpaid_amount ?? (overdueNominal + pendingNominal);

  return {
    html: `
      ${head()}

      <!-- 4 Kartu KPI Monitoring Tagihan -->
      <div class="grid g4" style="margin-bottom:16px">
        ${statCard(
          'Total Nilai Tagihan',
          rp(totalNominal || dashboardStats?.total_income || 0),
          `<span class="chip" style="background:var(--c1)">${bills.length} Tagihan Terdata</span>`,
          'receipt_long'
        )}
        ${statCard(
          'Tagihan Lunas',
          rp(paidNominal || dashboardStats?.total_income || 0),
          pill(`${paidBills.length} Tagihan Terbayar`, 'ok'),
          'task_alt'
        )}
        ${statCard(
          'Menunggu Pembayaran',
          rp(pendingNominal),
          pill(`${pendingBills.length} Tagihan Berjalan`, 'warn'),
          'hourglass_top'
        )}
        ${statCard(
          'Tunggakan Belum Lunas',
          rp(unpaidTotalAmount),
          pill(unpaidTotalAmount > 0 ? 'Perlu Pemantauan' : 'Nihil Tunggakan', unpaidTotalAmount > 0 ? 'err' : 'mint'),
          'assignment_late',
          { cls: unpaidTotalAmount > 0 ? 'red' : '' }
        )}
      </div>

      ${
        isFallback
          ? `<div class="info-banner">
              <div class="ctr">
                ${ms('info')}
                <span style="font-size:13px">Menampilkan data penagihan disinkronkan dari rekapitulasi pembayaran (<code>/reports/payments</code>). Pembuatan dan administrasi tagihan dikelola oleh tim Bendahara.</span>
              </div>
            </div>`
          : ''
      }

      <!-- Kartu Tabel Monitoring Tagihan -->
      <div class="card">
        <div class="filter" style="margin-bottom:14px;flex-wrap:wrap;gap:12px">
          ${searchField('Cari nomor invoice, penghuni, kamar...', 'tp-owner-bills')}
          <div class="tabs" id="bill-status-tabs">
            <button class="on" data-status="">Semua Tagihan</button>
            <button data-status="paid">Lunas</button>
            <button data-status="pending">Menunggu Bayar</button>
            <button data-status="overdue">Jatuh Tempo</button>
          </div>
        </div>

        ${dataTable(
          ['No. Invoice', 'Nama Penyewa', 'Unit Kamar', 'Periode', '>Nominal', 'Jatuh Tempo', 'Status Tagihan', '>Aksi'],
          billRows(bills),
          {
            id: 'tp-owner-bills',
            min: 800,
            emptyTitle: 'Belum ada data tagihan',
            emptyText: 'Tagihan sewa akan ditampilkan di sini setelah diterbitkan oleh pengelola.',
            emptyIcon: 'receipt_long',
          }
        )}

        <div class="foot" style="border-top:1px solid var(--c1);margin-top:14px">
          <span style="display:flex;gap:6px;align-items:center">
            ${ms('verified')}Data penagihan disinkronkan real-time dari buku kas kos.
          </span>
          <span style="color:var(--muted)">Total ${bills.length} tagihan tercatat</span>
        </div>
      </div>
    `,
    after() {
      // Filter status tab
      const tabs = document.querySelectorAll('#bill-status-tabs button');
      tabs.forEach((btn) => {
        btn.addEventListener('click', () => {
          tabs.forEach((b) => b.classList.remove('on'));
          btn.classList.add('on');
          const st = btn.dataset.status;
          document.querySelectorAll('#tp-owner-bills tbody tr').forEach((tr) => {
            if (!st) {
              tr.hidden = false;
            } else {
              const val = tr.querySelector('[data-status-val]')?.dataset?.statusVal;
              tr.hidden = val !== st;
            }
          });
        });
      });

      // Tombol Detail Modal
      document.querySelectorAll('[data-bill-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const bId = btn.dataset.billIdx;
          const targetBill = bills.find((b) => String(b.id) === bId || b.invoice_number === bId);
          if (targetBill) {
            showBillDetail(targetBill);
          }
        });
      });
    },
  };
}
