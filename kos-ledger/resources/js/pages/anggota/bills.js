import { getBills, getBill, checkoutBill } from '../../api/bills.js';
import { getPayment } from '../../api/payments.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, ms, toast, modal, closeModal, mhead, kvs } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { emptyView, errorView } from '../../components/states.js';
import { esc, tgl, rp, periodeLabel } from '../../utils/format.js';

// Polling status pembayaran dari backend sampai status final atau timeout
async function pollPaymentStatus(paymentId, maxAttempts = 12, intervalMs = 5000) {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((r) => setTimeout(r, intervalMs));
    try {
      const p = await getPayment(paymentId);
      if (p.status !== 'pending') return p;
    } catch {
      // Abaikan error sementara, lanjut polling
    }
  }
  return null;
}

function showWaitingModal(paymentId, onDone) {
  modal(`
    ${mhead('Menunggu Konfirmasi Backend', 'Jangan tutup halaman ini', 'hourglass_top')}
    <div class="mb">
      <div style="text-align:center;padding:24px 0">
        <span class="spin" style="width:40px;height:40px;border-width:4px;margin:0 auto 16px;display:block"></span>
        <b style="font-size:15px;color:var(--primary-d)">Memverifikasi Pembayaran…</b>
        <p style="font-size:13px;color:var(--muted);margin:8px 0 0">
          Sistem sedang menunggu konfirmasi dari Midtrans. Proses ini biasanya selesai dalam beberapa detik.
        </p>
      </div>
      <div class="note" style="background:var(--c1)">
        ${ms('info')}
        <span style="font-size:12px;color:var(--muted)">
          Status pembayaran hanya berubah setelah webhook dari Midtrans diterima dan diverifikasi oleh backend.
        </span>
      </div>
    </div>
  `);

  pollPaymentStatus(paymentId).then((result) => {
    closeModal();
    if (!result) {
      toast('Konfirmasi membutuhkan waktu lebih lama. Cek status di Riwayat Pembayaran.', 'warn');
      go('anggota-riwayat');
      return;
    }
    if (typeof onDone === 'function') onDone(result);
  });
}

function formatInvoiceId(b) {
  return `#INV-${b.period ? b.period.replace('-', '') : ''}-${String(b.id || 1).padStart(3, '0')}`;
}

function billStatusPill(status, dueDate) {
  if (status === 'paid') {
    return pill('Lunas', 'ok dot');
  }
  const isOverdue = dueDate && new Date(dueDate) < new Date(new Date().setHours(0, 0, 0, 0));
  if (isOverdue) {
    return pill('Jatuh Tempo', 'err dot');
  }
  return pill('Belum Dibayar', 'warn dot');
}

function renderBillDetailModal(b, user) {
  const invId = formatInvoiceId(b);
  const isOverdue = b.status === 'unpaid' && b.due_date && new Date(b.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
  const items = Array.isArray(b.items) ? b.items : [];
  const payments = Array.isArray(b.payments) ? b.payments : [];
  const successPay = payments.find((p) => p.status === 'success');
  const pendingPay = payments.find((p) => p.status === 'pending');
  const roomNumber = b.occupancy?.room?.room_number || '-';

  const itemsHtml = items.length > 0 ? `
    <div style="margin:16px 0 8px">
      <b style="font-size:13px;display:flex;gap:6px;align-items:center;color:var(--primary-d)">
        ${ms('list_alt')}Rincian Komponen Biaya (${items.length} Item)
      </b>
    </div>
    <div style="display:grid;gap:6px;margin-bottom:14px">
      ${items.map((it) => `
        <div class="note" style="justify-content:space-between;align-items:center;padding:10px 12px;background:#fff;border:1px solid var(--line)">
          <div>
            <b style="font-size:13px;color:var(--text)">${esc(it.description || it.category || 'Biaya')}</b>
            <small style="color:var(--muted);display:block">Kategori: ${esc(it.category || 'Operasional')}</small>
          </div>
          <b style="font-size:14px;color:var(--primary-d)">${rp(it.amount)}</b>
        </div>
      `).join('')}
    </div>
  ` : '';

  const paymentSection = successPay ? `
    <div class="note" style="margin-top:14px;background:var(--c2);padding:14px">
      ${ms('task_alt')}
      <div>
        <b style="font-size:14px;color:var(--primary-d)">Pembayaran Lunas Terverifikasi</b>
        <small style="display:block;color:var(--muted)">
          Metode: ${successPay.method === 'gateway' ? 'Online Gateway' : 'Manual Kasir'} • 
          ${successPay.paid_at ? tgl(successPay.paid_at) : (successPay.created_at ? tgl(successPay.created_at) : '-')}
        </small>
      </div>
    </div>
  ` : (pendingPay ? `
    <div class="note" style="margin-top:14px;background:var(--warn-bg);padding:14px">
      ${ms('hourglass_bottom')}
      <div>
        <b style="font-size:14px;color:var(--warn)">Transaksi Sedang Diproses (Pending)</b>
        <small style="display:block;color:var(--muted)">
          Order ID: <span class="mono">${esc(pendingPay.provider_order_id || '-')}</span>. 
          Anda dapat memeriksa status atau membatalkannya di Riwayat Pembayaran.
        </small>
      </div>
    </div>
  ` : '');

  return `
    ${mhead(`Tagihan ${invId}`, `Kamar ${esc(roomNumber)} • Periode ${periodeLabel(b.period)}`, 'receipt_long')}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px">
        <span class="lbl" style="font-size:11px">STATUS FAKTUR</span>
        ${billStatusPill(b.status, b.due_date)}
      </div>

      ${kvs([
        ['Nomor Invoice', `<span class="mono">${invId}</span>`],
        ['Nama Penghuni', esc(user.name)],
        ['Unit Kamar', `Kamar ${esc(roomNumber)}`],
        ['Periode Tagihan', periodeLabel(b.period)],
        ['Tanggal Diterbitkan', b.created_at ? tgl(b.created_at) : '-'],
        ['Batas Jatuh Tempo', b.due_date ? `${tgl(b.due_date)} ${isOverdue ? '<span style="color:var(--err)">(Terlambat)</span>' : ''}` : '-'],
        ['Total Tagihan', `<b style="font-size:18px;color:var(--primary-d)">${rp(b.total_amount)}</b>`],
      ])}

      ${itemsHtml}
      ${paymentSection}

      <div style="margin-top:18px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
        ${b.status === 'unpaid' ? `
          <button class="btn p" id="btn-modal-checkout" data-bill-id="${b.id}" style="padding:10px 20px">
            ${ms('credit_card')}Bayar Sekarang (Checkout)
          </button>
        ` : `
          <button class="btn s" data-go="anggota-riwayat" onclick="document.getElementById('modal')?.remove()">
            ${ms('history')}Lihat di Riwayat Pembayaran
          </button>
        `}
        <button class="btn s" onclick="document.getElementById('modal')?.remove()">
          ${ms('close')}Tutup
        </button>
      </div>
    </div>
  `;
}

/**
 * Memastikan library Midtrans Snap JS siap digunakan.
 * Menghindari race condition jika pengguna menekan tombol saat script masih dalam proses loading.
 */
async function ensureSnapReady(timeoutMs = 5000) {
  if (typeof window.snap !== 'undefined' && typeof window.snap.pay === 'function') {
    return true;
  }
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    if (typeof window.snap !== 'undefined' && typeof window.snap.pay === 'function') {
      return true;
    }
  }
  return false;
}

async function startCheckout(billId, btn) {
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spin" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span>Memeriksa Gateway...`;
  }

  try {
    const snapReady = await ensureSnapReady();
    if (!snapReady) {
      closeModal();
      toast('Midtrans Snap belum siap atau gagal dimuat. Periksa koneksi internet Anda atau nonaktifkan adblocker.', 'err');
      return;
    }

    if (btn) {
      btn.innerHTML = `<span class="spin" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span>Membuat Sesi Checkout...`;
    }

    const res = await checkoutBill(billId);
    const data = res?.data || res || {};
    const snapToken = data.snap_token;
    const orderId = data.order_id;
    const paymentId = data.payment_id;
    closeModal();

    if (!snapToken) {
      toast('Gagal memperoleh Snap Token dari gateway Midtrans.', 'err');
      modal(`
        ${mhead('Kendala Konfigurasi Gateway', `Tagihan #${billId}`, 'error')}
        <div class="mb">
          <div class="note" style="background:var(--err-bg, #fee2e2);padding:14px;margin-bottom:14px">
            ${ms('error')}
            <div>
              <b style="color:var(--err);display:block;font-size:13px">Token Pembayaran Tidak Diterima</b>
              <span style="font-size:12px;color:var(--text)">
                Server tidak dapat menghasilkan Snap Token dari Midtrans. Pastikan MIDTRANS_SERVER_KEY telah dikonfigurasi dengan benar di server backend.
              </span>
            </div>
          </div>
          <div style="display:flex;justify-content:flex-end">
            <button class="btn s" onclick="document.getElementById('modal')?.remove()">${ms('close')}Tutup</button>
          </div>
        </div>
      `);
      return;
    }

    window.snap.pay(snapToken, {
      onSuccess() {
        // Snap callback bukan bukti final — tunggu konfirmasi webhook backend
        showWaitingModal(paymentId, (finalPayment) => {
          if (finalPayment.status === 'success') {
            toast('Pembayaran berhasil dikonfirmasi oleh sistem!', 'ok');
          } else {
            toast(`Status pembayaran: ${finalPayment.status}. Cek riwayat untuk detail.`, 'warn');
          }
          go('anggota-riwayat');
        });
      },
      onPending() {
        toast('Sesi pembayaran tercatat. Menunggu penyelesaian dari penyedia layanan.', 'warn');
        go('anggota-riwayat');
      },
      onError() {
        toast('Pembayaran ditolak atau gagal di gateway Midtrans.', 'err');
        go('anggota-tagihan');
      },
      onClose() {
        toast('Jendela pembayaran ditutup sebelum transaksi selesai.', 'warn');
        go('anggota-tagihan');
      },
    });
  } catch (err) {
    closeModal();
    if (err?.response?.status === 409) {
      const backendMsg = err.response.data?.message || 'Sudah ada transaksi pending untuk tagihan ini.';
      toast(backendMsg, 'warn');
      modal(`
        ${mhead('Transaksi Pending Ditemukan', 'Sesi Pembayaran Masih Aktif', 'warning')}
        <div class="mb">
          <div class="note" style="background:var(--warn-bg);padding:14px;margin-bottom:14px">
            ${ms('hourglass_bottom')}
            <span style="font-size:13px;color:var(--text)">
              ${esc(backendMsg)} Anda dapat menyelesaikan pembayaran tersebut atau membatalkannya di halaman Riwayat Pembayaran sebelum membuat sesi baru.
            </span>
          </div>
          <div class="grid g2" style="margin:0">
            <button class="btn p" data-go="anggota-riwayat" onclick="document.getElementById('modal')?.remove()">
              ${ms('history')}Buka Riwayat Pembayaran
            </button>
            <button class="btn s" onclick="document.getElementById('modal')?.remove()">
              ${ms('close')}Tutup
            </button>
          </div>
        </div>
      `);
    } else {
      const msg = apiError(err) || err.message || 'Gagal memproses checkout tagihan.';
      toast(msg, 'err');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `${ms('credit_card')}Bayar Sekarang (Checkout)`;
    }
  }
}

export default async function bills({ user }) {
  let billList = [];

  try {
    const res = await getBills();
    billList = res?.data || res || [];
    if (!Array.isArray(billList)) billList = [];
  } catch (err) {
    return {
      html: `
        <div style="padding:16px 0">
          ${pageHead({
            title: 'Tagihan Saya',
            sub: 'Daftar invoice dan kewajiban sewa kamar Anda.',
          })}
          ${errorView(err.message || 'Gagal memuat data tagihan.')}
          <div style="margin-top:16px">
            <button class="btn s" id="btn-retry-bills">${ms('refresh')}Muat Ulang Tagihan</button>
          </div>
        </div>
      `,
      after() {
        document.getElementById('btn-retry-bills')?.addEventListener('click', () => go('anggota-tagihan'));
      },
    };
  }

  // Hitung ringkasan statistik
  const totalBills = billList.length;
  const unpaidBills = billList.filter((b) => b.status === 'unpaid');
  const paidBills = billList.filter((b) => b.status === 'paid');
  const totalUnpaidNominal = unpaidBills.reduce((acc, cur) => acc + (Number(cur.total_amount) || 0), 0);
  const totalPaidNominal = paidBills.reduce((acc, cur) => acc + (Number(cur.total_amount) || 0), 0);

  // Cari jatuh tempo terdekat dari tagihan yang belum lunas
  const nearestDue = unpaidBills
    .filter((b) => b.due_date)
    .sort((a, b) => new Date(a.due_date) - new Date(b.due_date))[0]?.due_date || null;

  // Siapkan data baris tabel
  const tableRows = billList.map((b) => {
    const invId = formatInvoiceId(b);
    const isOverdue = b.status === 'unpaid' && b.due_date && new Date(b.due_date) < new Date(new Date().setHours(0, 0, 0, 0));
    const statusVal = b.status === 'paid' ? 'paid' : (isOverdue ? 'overdue' : 'unpaid');

    return {
      cls: isOverdue ? 'hl' : '',
      cells: [
        `<b class="mono" style="font-size:12px;color:var(--primary-d)">${invId}</b>`,
        `<b style="font-size:13px;color:var(--text)">${periodeLabel(b.period)}</b>`,
        `<span class="num ${isOverdue ? 'neg' : ''}" style="font-weight:600;white-space:nowrap">${rp(b.total_amount)}</span>`,
        `<span>${b.created_at ? tgl(b.created_at) : '-'}</span>`,
        `<span>${b.due_date ? tgl(b.due_date) : '-'}${isOverdue ? '<br><small style="color:var(--err);font-weight:600">Lewat Jatuh Tempo</small>' : ''}</span>`,
        `<span data-status-cell="${statusVal}">${billStatusPill(b.status, b.due_date)}</span>`,
        `<div class="acts" style="justify-content:flex-end;gap:6px">
          <button class="btn sm s" data-view-bill="${b.id}" aria-label="Lihat Rincian Tagihan">
            ${ms('visibility')} Rincian
          </button>
          ${b.status === 'unpaid' ? `
            <button class="btn sm p" data-checkout-bill="${b.id}" aria-label="Bayar Sekarang">
              ${ms('credit_card')} Bayar
            </button>
          ` : ''}
        </div>`,
      ],
    };
  });

  const html = `
    <!-- Header Halaman -->
    ${pageHead({
      title: 'Tagihan Saya',
      sub: 'Pantau daftar tagihan sewa kamar, rincian komponen biaya, dan status pelunasan invoice.',
      acts: `
        <span class="sel">${ms('calendar_month')}Total ${totalBills} Tagihan Terdaftar</span>
        <button class="btn s" data-go="anggota-riwayat">${ms('history')}Riwayat Pembayaran</button>
      `,
    })}

    <!-- Statistik Ringkasan Tagihan -->
    <div class="grid g4" style="margin-bottom:20px">
      ${statCard(
        'TOTAL TAGIHAN',
        `${totalBills} <small style="font-size:14px;font-weight:400;color:var(--muted)">Periode</small>`,
        `<span style="color:var(--text)">Akumulasi seluruh invoice</span>`,
        'receipt_long'
      )}

      ${statCard(
        'BELUM DIBAYAR',
        `${unpaidBills.length} <small style="font-size:14px;font-weight:400;color:var(--muted)">Tagihan</small>`,
        unpaidBills.length > 0
          ? `<span style="color:var(--err);font-weight:600">Total ${rp(totalUnpaidNominal)}</span>`
          : '<span style="color:var(--primary);font-weight:600">✓ Semua tagihan lunas</span>',
        'hourglass_top'
      )}

      ${statCard(
        'JATUH TEMPO TERDEKAT',
        nearestDue ? tgl(nearestDue) : 'Tidak Ada',
        nearestDue
          ? '<span style="color:var(--err)">Batas waktu pelunasan</span>'
          : 'Bebas tunggakan sewa',
        'event_busy'
      )}

      ${statCard(
        'SUDAH DILUNASI',
        `${paidBills.length} <small style="font-size:14px;font-weight:400;color:var(--muted)">Lunas</small>`,
        `<span style="color:var(--primary);font-weight:600">Total ${rp(totalPaidNominal)}</span>`,
        'task_alt'
      )}
    </div>

    <!-- Filter & Pencarian Bar -->
    <div class="card" style="margin-bottom:16px">
      <div class="ctr" style="flex-wrap:wrap;gap:12px">
        <div class="tabs" id="bill-status-tabs" style="margin:0">
          <button class="on" data-status-filter="all">Semua Status (${totalBills})</button>
          <button data-status-filter="unpaid">Belum Dibayar (${unpaidBills.length})</button>
          <button data-status-filter="paid">Sudah Lunas (${paidBills.length})</button>
        </div>
        <div style="flex:1 1 240px;display:flex;justify-content:flex-end">
          ${searchField('Cari ID tagihan, periode, nominal...', 'my-bills-table')}
        </div>
      </div>
    </div>

    <!-- Tabel Daftar Tagihan -->
    <div class="card" style="padding:0;overflow:hidden">
      ${totalBills > 0 ? `
        ${dataTable(
          ['No. Invoice', 'Periode', '>Nominal Tagihan', 'Tgl Terbit', 'Jatuh Tempo', 'Status', '>Aksi'],
          tableRows,
          { id: 'my-bills-table', min: 780 }
        )}
        <div class="foot" style="padding:14px 20px;display:flex;justify-content:space-between;align-items:center;background:var(--c1)">
          <span style="font-size:12px;color:var(--muted)">
            Menampilkan ${totalBills} data tagihan resmi milik akun Anda
          </span>
          <span style="font-size:12px;color:var(--muted);display:flex;gap:6px;align-items:center">
            ${ms('lock')}Data terverifikasi buku kas KosLedger
          </span>
        </div>
      ` : `
        <div style="padding:32px 20px">
          ${emptyView(
            'Belum Ada Tagihan',
            'Tidak ada tagihan sewa yang diterbitkan untuk akun Anda saat ini. Tagihan baru akan muncul di sini secara berkala.',
            'receipt_long'
          )}
        </div>
      `}
    </div>

    <!-- Jaminan & Catatan Pembayaran -->
    <div class="note" style="margin-top:16px;display:flex;gap:14px;padding:16px;background:var(--c2)">
      <span class="ic" style="width:40px;height:40px;border-radius:12px;background:#fff;display:grid;place-items:center;flex:none;color:var(--primary)">
        ${ms('verified')}
      </span>
      <div style="font-size:12px">
        <b style="color:var(--primary-d);font-size:13px;display:block;margin-bottom:2px">
          Sistem Penagihan Resmi & Otomatis
        </b>
        <span style="color:var(--muted)">
          Pembayaran via checkout online akan diverifikasi instan secara otomatis oleh gateway. Jika Anda membayar secara tunai atau transfer ke kasir, bendahara kos akan mencatat status pelunasan di sistem.
        </span>
      </div>
    </div>
  `;

  return {
    html,
    after() {
      // Filter status tab
      const tabContainer = document.getElementById('bill-status-tabs');
      tabContainer?.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-status-filter]');
        if (!btn) return;
        tabContainer.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
        btn.classList.add('on');

        const filter = btn.dataset.statusFilter;
        const rows = document.querySelectorAll('#my-bills-table tbody tr');

        rows.forEach((tr) => {
          const statusCell = tr.querySelector('[data-status-cell]');
          const st = statusCell ? statusCell.dataset.statusCell : '';

          if (filter === 'all') {
            tr.hidden = false;
          } else if (filter === 'unpaid') {
            tr.hidden = !(st === 'unpaid' || st === 'overdue');
          } else if (filter === 'paid') {
            tr.hidden = st !== 'paid';
          }
        });
      });

      // Event listener: Klik tombol Rincian Tagihan
      document.addEventListener('click', async (e) => {
        const viewBtn = e.target.closest('[data-view-bill]');
        if (viewBtn) {
          const billId = viewBtn.dataset.viewBill;
          viewBtn.disabled = true;
          try {
            const billData = await getBill(billId);
            modal(renderBillDetailModal(billData, user));
          } catch (err) {
            toast(apiError(err) || 'Gagal memuat rincian tagihan.', 'err');
          } finally {
            viewBtn.disabled = false;
          }
          return;
        }

        // Event listener: Klik tombol Checkout dari tabel atau dari modal
        const checkoutBtn = e.target.closest('[data-checkout-bill]') || e.target.closest('#btn-modal-checkout');
        if (checkoutBtn) {
          const billId = checkoutBtn.dataset.checkoutBill || checkoutBtn.dataset.billId;
          if (billId) {
            startCheckout(billId, checkoutBtn);
          }
        }
      });
    },
  };
}
