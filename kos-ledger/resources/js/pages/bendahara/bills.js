import {
  getBills,
  getBill,
  createBill,
  recordManualPayment,
  sendTelegramReminders,
} from '../../api/bills.js';
import { getOccupancies } from '../../api/occupancies.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, avatar, ms, toast, modal, closeModal, mhead, kvs } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { errorView, loadingView } from '../../components/states.js';
import { esc, tgl, rp, periodeLabel, initials } from '../../utils/format.js';

const head = () =>
  pageHead({
    crumb: `Keuangan › <b>Manajemen Tagihan</b>`,
    title: 'Manajemen Tagihan',
    sub: 'Kelola tagihan sewa kamar bulanan, kontrol jatuh tempo, dan catat pelunasan sewa penghuni.',
    acts: `<button class="btn p" id="btn-create-bill">${ms('add_circle')}Buat Tagihan</button>`,
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

function billRows(bills) {
  return bills.map((b) => {
    const isOverdue = b.status === 'unpaid' && b.due_date && new Date(b.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
    const invId = `#INV-${b.period ? b.period.replace('-', '') : ''}-${String(b.id).padStart(3, '0')}`;
    const penghuni = esc(b.occupancy?.user?.name || 'Penghuni');
    const kamar = esc(b.occupancy?.room?.room_number || '-');
    const statusVal = b.status === 'paid' ? 'paid' : isOverdue ? 'overdue' : 'pending';

    return [
      `<b class="mono" style="font-size:12px">${invId}</b>`,
      `<div class="cell">
        ${avatar(esc(initials(penghuni)))}
        <span><b>${penghuni}</b></span>
      </div>`,
      `<span class="chip">Kamar ${kamar}</span>`,
      `<span style="color:var(--text);font-weight:500;font-size:13px">${periodeLabel(b.period)}</span>`,
      `<span class="num ${isOverdue ? 'neg' : ''}">${rp(b.total_amount)}</span>`,
      `<span>${tgl(b.due_date)}${isOverdue ? `<br><small style="color:var(--err)">Lewat jatuh tempo</small>` : ''}</span>`,
      `<span data-status-val="${statusVal}">${billStatusPill(b.status, b.due_date)}</span>`,
      `<div class="acts" style="justify-content:flex-end">
        <button class="btn sm s" data-bill-detail="${b.id}" aria-label="Lihat detail tagihan">${ms('visibility')} Detail</button>
      </div>`,
    ];
  });
}

function billDetailModal(b) {
  const isOverdue = b.status === 'unpaid' && b.due_date && new Date(b.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
  const invId = `#INV-${b.period ? b.period.replace('-', '') : ''}-${String(b.id).padStart(3, '0')}`;
  const penghuni = esc(b.occupancy?.user?.name || 'Penghuni');
  const kamar = esc(b.occupancy?.room?.room_number || '-');
  const items = Array.isArray(b.items) ? b.items : [];
  const payments = Array.isArray(b.payments) ? b.payments : [];
  const successPay = payments.find((p) => p.status === 'success');

  const itemsHtml = items.length
    ? `<div style="margin:14px 0 6px;font-weight:600;font-size:13px">Komponen Tagihan</div>
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
        <span><b>Lunas Terverifikasi</b><br><small style="color:var(--muted)">Metode: ${successPay.method === 'manual' ? 'Kas Tunai (Manual)' : 'Gateway'} • ${tgl(successPay.paid_at || successPay.created_at)}</small></span>
      </div>`
    : '';

  return `
    ${mhead(`Tagihan ${invId}`, `${penghuni} • Kamar ${kamar}`, 'receipt_long')}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px">
        <span class="lbl" style="font-size:11px">STATUS TAGIHAN</span>
        ${billStatusPill(b.status, b.due_date)}
      </div>
      ${kvs([
        ['ID Invoice', `<span class="mono">${invId}</span>`],
        ['Penghuni', penghuni],
        ['Unit Kamar', `Kamar ${kamar}`],
        ['Periode Sewa', periodeLabel(b.period)],
        ['Batas Jatuh Tempo', tgl(b.due_date)],
        ['Total Tagihan', `<b style="font-size:16px;color:var(--primary-d)">${rp(b.total_amount)}</b>`],
      ])}
      ${itemsHtml}
      ${paymentInfo}
    </div>
    <footer class="mf2">
      <button class="btn" data-act="close">Tutup</button>
      ${
        b.status === 'unpaid'
          ? `<button class="btn p" id="btn-manual-pay" data-bill-id="${b.id}">${ms('point_of_sale')}Catat Lunas Manual</button>`
          : ''
      }
    </footer>`;
}

async function showBillDetail(id) {
  modal(`
    ${mhead('Memuat Detail Tagihan…', '', 'receipt_long')}
    <div class="mb">${loadingView('Mengambil rincian tagihan dari server…')}</div>
    <footer class="mf2"><button class="btn s" data-act="close">Batal</button></footer>
  `);

  try {
    const bill = await getBill(id);
    modal(billDetailModal(bill));

    document.getElementById('btn-manual-pay')?.addEventListener('click', () => {
      openManualPaymentModal(bill);
    });
  } catch (err) {
    modal(`
      ${mhead('Gagal Memuat Tagihan', '', 'error')}
      <div class="mb">${errorView(apiError(err))}</div>
      <footer class="mf2"><button class="btn p" data-act="close">Tutup</button></footer>
    `);
  }
}

function openManualPaymentModal(bill) {
  const today = new Date().toISOString().split('T')[0];
  const penghuni = esc(bill.occupancy?.user?.name || 'Penghuni');
  const kamar = esc(bill.occupancy?.room?.room_number || '-');

  modal(`
    ${mhead('Konfirmasi Pembayaran Manual', `${penghuni} • Kamar ${kamar}`, 'point_of_sale')}
    <form id="f-manual-pay" class="mb">
      <div class="note" style="margin-bottom:14px;background:var(--c1)">
        ${ms('info')}
        <span style="font-size:12px;color:var(--muted)">
          Pencatatan pembayaran manual digunakan saat penghuni menyetor uang tunai langsung ke Bendahara atau transfer bank di luar gateway.
        </span>
      </div>
      <div class="kvs" style="margin-bottom:14px">
        <div class="kv"><span>Total Tagihan</span><b style="font-size:16px;color:var(--primary-d)">${rp(bill.total_amount)}</b></div>
      </div>
      <label class="mf">
        Tanggal Pembayaran <i>*</i>
        <input class="in" type="date" id="m-pay-date" value="${today}" required>
      </label>
      <label class="mf" style="margin-top:12px">
        Catatan Tambahan (Opsional)
        <input class="in" type="text" id="m-pay-note" placeholder="Contoh: Diterima tunai di kantor pengelola">
      </label>
    </form>
    <footer class="mf2">
      <button class="btn" data-act="close">Batal</button>
      <button class="btn p" id="btn-submit-manual-pay">${ms('check')}Tandai Lunas</button>
    </footer>
  `);

  document.getElementById('btn-submit-manual-pay')?.addEventListener('click', async () => {
    const paidAt = document.getElementById('m-pay-date')?.value;
    const note = document.getElementById('m-pay-note')?.value;
    const btn = document.getElementById('btn-submit-manual-pay');

    if (!paidAt) {
      toast('Tanggal pembayaran wajib diisi.', 'err');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>Memproses…';

    try {
      await recordManualPayment(bill.id, {
        amount: Number(bill.total_amount),
        paid_at: paidAt,
        note: note || 'Pembayaran manual bendahara',
      });
      closeModal();
      toast('Pembayaran manual berhasil dicatat. Tagihan kini telah lunas.', 'ok');
      go('bendahara-tagihan');
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `${ms('check')}Tandai Lunas`;
      toast(apiError(err), 'err');
    }
  });
}

async function openCreateBillModal() {
  modal(`
    ${mhead('Memuat Formulir Tagihan…', '', 'receipt_long')}
    <div class="mb">${loadingView('Memuat daftar penempatan penghuni aktif…')}</div>
    <footer class="mf2"><button class="btn s" data-act="close">Batal</button></footer>
  `);

  let occupancies = [];
  try {
    occupancies = await getOccupancies();
  } catch (err) {
    modal(`
      ${mhead('Gagal Memuat Formulir', '', 'error')}
      <div class="mb">${errorView(apiError(err))}</div>
      <footer class="mf2"><button class="btn p" data-act="close">Tutup</button></footer>
    `);
    return;
  }

  const activeOccs = occupancies.filter((o) => o.status === 'active');
  if (!activeOccs.length) {
    modal(`
      ${mhead('Tidak Ada Penghuni Aktif', '', 'info')}
      <div class="mb">
        <p style="color:var(--muted);margin:0">Belum ada penempatan penghuni kamar aktif untuk dibuatkan tagihan sewa.</p>
      </div>
      <footer class="mf2"><button class="btn p" data-act="close">Tutup</button></footer>
    `);
    return;
  }

  const now = new Date();
  const curPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const defaultDue = new Date(now.getFullYear(), now.getMonth(), 10).toISOString().split('T')[0];

  const occOptions = activeOccs
    .map(
      (o) =>
        `<option value="${o.id}" data-rate="${o.room?.monthly_rate || 0}">
          ${esc(o.user?.name || 'Penghuni')} — Kamar ${esc(o.room?.room_number || '-')} (${rp(o.room?.monthly_rate || 0)})
        </option>`
    )
    .join('');

  modal(`
    ${mhead('Buat Tagihan Sewa Baru', 'Terbitkan faktur tagihan bulanan penghuni kos.', 'receipt_long')}
    <form id="f-new-bill" class="mb">
      <label class="mf">
        Pilih Penghuni & Unit Kamar <i>*</i>
        <select class="in" id="nb-occ" required>
          <option value="">Pilih salah satu penghuni aktif…</option>
          ${occOptions}
        </select>
      </label>

      <div class="two" style="margin-top:12px">
        <label class="mf">
          Periode Tagihan <i>*</i>
          <input class="in" type="text" id="nb-period" placeholder="YYYY-MM (Contoh: ${curPeriod})" value="${curPeriod}" required>
        </label>
        <label class="mf">
          Batas Jatuh Tempo <i>*</i>
          <input class="in" type="date" id="nb-due" value="${defaultDue}" required>
        </label>
      </div>

      <div class="two" style="margin-top:12px">
        <label class="mf">
          Sewa Pokok Kamar (Rp) <i>*</i>
          <input class="in" type="number" id="nb-sewa" min="1" placeholder="Nominal sewa pokok" required>
        </label>
        <label class="mf">
          Biaya Fasilitas / Utilitas (Rp)
          <input class="in" type="number" id="nb-util" min="0" value="0" placeholder="Biaya tambahan">
        </label>
      </div>
    </form>
    <footer class="mf2">
      <button class="btn" data-act="close">Batal</button>
      <button class="btn p" id="btn-save-bill">${ms('save')}Terbitkan Tagihan</button>
    </footer>
  `);

  // Auto-fill nominal sewa pokok saat memilih penghuni
  const selOcc = document.getElementById('nb-occ');
  selOcc?.addEventListener('change', () => {
    const selected = selOcc.selectedOptions[0];
    const rate = selected?.dataset?.rate;
    if (rate && Number(rate) > 0) {
      const inSewa = document.getElementById('nb-sewa');
      if (inSewa) inSewa.value = rate;
    }
  });

  // Listener simpan tagihan
  document.getElementById('btn-save-bill')?.addEventListener('click', async () => {
    const occId = document.getElementById('nb-occ')?.value;
    const period = (document.getElementById('nb-period')?.value || '').trim();
    const dueDate = document.getElementById('nb-due')?.value;
    const sewa = Number(document.getElementById('nb-sewa')?.value);
    const util = Number(document.getElementById('nb-util')?.value) || 0;
    const btn = document.getElementById('btn-save-bill');

    if (!occId) {
      toast('Silakan pilih penghuni kamar.', 'err');
      return;
    }
    if (!/^\d{4}-\d{2}$/.test(period)) {
      toast('Format periode harus YYYY-MM (misal: 2026-11).', 'err');
      return;
    }
    if (!dueDate) {
      toast('Tanggal jatuh tempo wajib diisi.', 'err');
      return;
    }
    if (!sewa || sewa <= 0) {
      toast('Nominal sewa pokok harus lebih dari 0.', 'err');
      return;
    }

    const items = [
      {
        category: 'sewa',
        description: `Sewa kamar periode ${periodeLabel(period)}`,
        amount: sewa,
      },
    ];

    if (util > 0) {
      items.push({
        category: 'utilitas',
        description: `Iuran utilitas & fasilitas ${periodeLabel(period)}`,
        amount: util,
      });
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>Menerbitkan…';

    try {
      await createBill({
        occupancy_id: Number(occId),
        period,
        due_date: dueDate,
        items,
      });
      closeModal();
      toast('Tagihan sewa berhasil diterbitkan.', 'ok');
      go('bendahara-tagihan');
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `${ms('save')}Terbitkan Tagihan`;
      toast(apiError(err), 'err');
    }
  });
}

export default async function billsPage() {
  let bills = [];
  try {
    const res = await getBills();
    bills = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  } catch (err) {
    return {
      html: `
        ${head()}
        ${errorView(apiError(err))}
        <button class="btn s" id="retry-bills">${ms('refresh')}Coba lagi</button>`,
      after() {
        document.getElementById('retry-bills')?.addEventListener('click', () => go('bendahara-tagihan'));
      },
    };
  }

  const totalCount = bills.length;
  const totalAmount = bills.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
  const paidBills = bills.filter((b) => b.status === 'paid');
  const paidCount = paidBills.length;
  const paidAmount = paidBills.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
  const unpaidBills = bills.filter((b) => b.status === 'unpaid');
  const unpaidCount = unpaidBills.length;
  const unpaidAmount = unpaidBills.reduce((sum, b) => sum + (Number(b.total_amount) || 0), 0);
  const overdueBills = unpaidBills.filter(
    (b) => b.due_date && new Date(b.due_date) < new Date(new Date().setHours(0, 0, 0, 0))
  );
  const overdueCount = overdueBills.length;
  const complianceRate = totalCount > 0 ? Math.round((paidCount / totalCount) * 100) : 0;

  return {
    html: `
      ${head()}
      <div class="grid g4">
        ${statCard('Total Tagihan Terbit', rp(totalAmount), pill(`${totalCount} Tagihan`, ''), 'receipt_long')}
        ${statCard('Tagihan Lunas', rp(paidAmount), pill(`${complianceRate}% Lunas`, 'ok'), 'check_circle')}
        ${statCard('Belum Dibayar', rp(unpaidAmount), pill(`${unpaidCount} Tagihan`, unpaidCount ? 'err dot' : 'ok'), 'assignment_late', { cls: unpaidCount ? 'red' : '' })}
        ${statCard('Status Jatuh Tempo', `${overdueCount} Terlambat`, overdueCount ? pill(`${overdueCount} Overdue`, 'err') : pill('Tepat Waktu', 'ok'), 'speed')}
      </div>

      <div class="card" style="background:var(--c1);box-shadow:none;margin-bottom:16px">
        <div class="ctr" style="flex-wrap:wrap;gap:14px">
          <div style="display:flex;gap:14px;align-items:center">
            <span class="stat"><span class="ic" style="position:static;width:44px;height:44px;background:var(--active);color:var(--primary-d)">${ms('campaign')}</span></span>
            <div>
              <h3 style="margin:0 0 2px">Broadcast Pengingat Tagihan (Telegram)</h3>
              <p class="sub" style="margin:0">Kirim notifikasi pengingat jatuh tempo via Bot Telegram ke ${unpaidCount} penghuni yang memiliki tagihan belum lunas.</p>
            </div>
          </div>
          <button class="btn p" id="btn-broadcast-telegram">${ms('send')}Kirim Pengingat (${unpaidCount} Penghuni)</button>
        </div>
      </div>

      <div class="card">
        <div class="filter" style="margin-bottom:14px;flex-wrap:wrap;gap:12px">
          ${searchField('Cari invoice, nama penghuni, atau kamar...', 'tb-bills')}
          <div class="tabs" id="bill-status-tabs">
            <button class="on" data-status="">Semua Status</button>
            <button data-status="paid">Lunas</button>
            <button data-status="pending">Menunggu</button>
            <button data-status="overdue">Jatuh Tempo</button>
          </div>
        </div>

        ${dataTable(
          ['ID Tagihan', 'Nama Penghuni', 'Nomor Kamar', 'Periode', '>Nominal Tagihan', 'Jatuh Tempo', 'Status', '>Aksi'],
          billRows(bills),
          {
            id: 'tb-bills',
            min: 880,
            emptyTitle: 'Belum ada tagihan sewa diterbitkan',
            emptyText: 'Tekan tombol "Buat Tagihan" di atas untuk menerbitkan faktur tagihan kamar bulanan.',
            emptyIcon: 'receipt_long',
          }
        )}
      </div>`,
    after() {
      // Event listener: Buat Tagihan
      document.getElementById('btn-create-bill')?.addEventListener('click', openCreateBillModal);

      // Event listener: Broadcast Pengingat Telegram
      document.getElementById('btn-broadcast-telegram')?.addEventListener('click', async () => {
        const btn = document.getElementById('btn-broadcast-telegram');
        btn.disabled = true;
        btn.innerHTML = '<span class="spin"></span>Mengirim…';
        try {
          await sendTelegramReminders();
          toast('Pengingat tagihan sedang diproses dan dikirimkan via Bot Telegram.', 'ok');
        } catch (err) {
          toast(apiError(err), 'err');
        } finally {
          btn.disabled = false;
          btn.innerHTML = `${ms('send')}Kirim Pengingat (${unpaidCount} Penghuni)`;
        }
      });

      // Event listener: Filter tabs
      const tabs = document.querySelectorAll('#bill-status-tabs button');
      tabs.forEach((btn) => {
        btn.addEventListener('click', () => {
          tabs.forEach((b) => b.classList.remove('on'));
          btn.classList.add('on');
          const st = btn.dataset.status;
          document.querySelectorAll('#tb-bills tbody tr').forEach((tr) => {
            if (!st) {
              tr.hidden = false;
            } else {
              const val = tr.querySelector('[data-status-val]')?.dataset?.statusVal;
              tr.hidden = val !== st;
            }
          });
        });
      });

      // Event listener: Detail tagihan
      document.querySelectorAll('[data-bill-detail]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.billDetail;
          if (id) showBillDetail(id);
        });
      });
    },
  };
}
