import { getBills, getBill, checkoutBill } from '../../api/bills.js';
import { getPayments, getPayment, getChainRecord, verifyChainRecord, expirePayment } from '../../api/payments.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, ms, toast, modal, closeModal, mhead, kvs } from '../../components/ui.js';
import { statCard } from '../../components/widgets.js';
import { emptyView, errorView } from '../../components/states.js';
import { esc, rp, tgl, periodeLabel } from '../../utils/format.js';

function formatInvoiceId(b) {
  return `#INV-${b.period ? b.period.replace('-', '') : ''}-${String(b.id || 1).padStart(3, '0')}`;
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

export default async function pembayaran({ user }) {
  let bills = [];
  let payments = [];
  let selectedBill = null;

  try {
    const [billsRes, paymentsRes] = await Promise.allSettled([
      getBills(),
      getPayments(),
    ]);

    if (billsRes.status === 'rejected') {
      throw billsRes.reason || new Error('Gagal memuat data tagihan pembayaran.');
    }

    bills = billsRes.value?.data || billsRes.value || [];
    if (!Array.isArray(bills)) bills = [];

    payments = paymentsRes.status === 'fulfilled' ? (paymentsRes.value?.data || paymentsRes.value || []) : [];
    if (!Array.isArray(payments)) payments = [];
  } catch (err) {
    return {
      html: `
        <div style="padding:16px 0">
          ${pageHead({
            title: 'Pembayaran Sewa Kamar',
            sub: 'Portal pelunasan tagihan sewa dan konfirmasi pembayaran online.',
          })}
          ${errorView(err.message || 'Terjadi kesalahan saat memuat data pembayaran.')}
          <div style="margin-top:16px">
            <button class="btn s" id="btn-retry-pay">${ms('refresh')}Muat Ulang Halaman</button>
          </div>
        </div>
      `,
      after() {
        document.getElementById('btn-retry-pay')?.addEventListener('click', () => go('anggota-pembayaran'));
      },
    };
  }

  // Pisahkan tagihan unpaid dan paid
  const unpaidBills = bills.filter((b) => b.status === 'unpaid');
  const paidBills = bills.filter((b) => b.status === 'paid');

  // Pilih tagihan aktif yang belum lunas (utamakan yang jatuh temponya paling dekat)
  const sortedUnpaid = [...unpaidBills].sort((a, b) => {
    if (!a.due_date) return 1;
    if (!b.due_date) return -1;
    return new Date(a.due_date) - new Date(b.due_date);
  });
  selectedBill = sortedUnpaid[0] || null;

  // Cek apakah tagihan yang dipilih memiliki pembayaran pending aktif
  let activePendingPayment = null;
  if (selectedBill) {
    activePendingPayment = payments.find(
      (p) => p.bill_id === selectedBill.id && p.status === 'pending'
    ) || null;

    // Ambil detail rincian item jika ada
    try {
      const detailed = await getBill(selectedBill.id);
      if (detailed) selectedBill = detailed;
    } catch {
      // Abaikan jika getBill gagal, pakai selectedBill awal
    }
  }

  const roomNumber = selectedBill?.occupancy?.room?.room_number || '-';
  const totalAmount = selectedBill?.total_amount || 0;
  const items = Array.isArray(selectedBill?.items) ? selectedBill.items : [];
  const invId = selectedBill ? formatInvoiceId(selectedBill) : '-';

  const html = `
    <!-- Header Halaman -->
    ${pageHead({
      title: 'Pembayaran Sewa Kamar',
      sub: 'Lakukan pelunasan tagihan sewa bulanan Anda secara instan dengan verifikasi otomatis.',
      acts: `
        <span class="sel">${ms('payments')}${unpaidBills.length} Tagihan Perlu Dibayar</span>
        <button class="btn s" data-go="anggota-tagihan">${ms('receipt_long')}Daftar Tagihan</button>
      `,
    })}

    <!-- Mode Gateway Banner -->
    <div class="sand">
      ${ms('terminal')}
      <b>PORTAL PEMBAYARAN KOSLEDGER</b>
      <span style="flex:1 1 260px">
        Transaksi divalidasi langsung oleh sistem backend dan tercatat permanen pada buku kas operasional.
      </span>
      ${pill('Gateway Otomatis', 'ok dot')}
    </div>

    ${selectedBill ? `
      <!-- Ringkasan Statistik Singkat -->
      <div class="grid g4" style="margin-bottom:20px">
        ${statCard(
          'TAGIHAN DIPILIH',
          invId,
          `<span style="color:var(--text)">Periode ${periodeLabel(selectedBill.period)}</span>`,
          'receipt_long'
        )}

        ${statCard(
          'TOTAL NOMINAL',
          rp(totalAmount),
          `<span style="color:var(--primary-d);font-weight:600">Nominal bersih sewa</span>`,
          'payments'
        )}

        ${statCard(
          'JATUH TEMPO',
          selectedBill.due_date ? tgl(selectedBill.due_date) : 'Tanpa Batas',
          selectedBill.due_date
            ? `<span style="color:var(--err)">Batas waktu pelunasan</span>`
            : 'Tidak ada denda keterlambatan',
          'hourglass_top'
        )}

        ${statCard(
          'STATUS TRANSAKSI',
          activePendingPayment ? 'Ada Sesi Pending' : 'Siap Bayar',
          activePendingPayment
            ? `<span style="color:var(--warn)">Order: ${esc(activePendingPayment.provider_order_id || '-')}</span>`
            : '<span style="color:var(--primary)">✓ Belum ada transaksi pending</span>',
          activePendingPayment ? 'schedule' : 'verified_user'
        )}
      </div>

      <!-- Layout Grid 2 Kolom -->
      <div class="grid g21" style="align-items:start">
        <!-- Kolom Kiri: Rincian Faktur & Metode Pembayaran -->
        <div style="display:grid;gap:16px;min-width:0">
          <!-- Kartu Faktur Tagihan -->
          <div class="card">
            <div class="ctr" style="align-items:flex-start;flex-wrap:wrap;gap:12px">
              <div style="display:flex;gap:14px">
                <span class="stat" style="margin:0">
                  <span class="ic" style="position:static;width:48px;height:48px;border-radius:14px;background:var(--primary);color:#fff">
                    ${ms('receipt_long')}
                  </span>
                </span>
                <div>
                  <small style="color:var(--muted)">Faktur Hunian Aktif</small>
                  <span class="chip mono">${invId}</span>
                  <h2 style="margin:4px 0 2px;font-size:22px;color:var(--primary-d)">
                    Kamar ${esc(roomNumber)}
                  </h2>
                  <small style="color:var(--muted)">Kost Griya Asri • Penyewa: <b>${esc(user.name)}</b></small>
                </div>
              </div>
              <div style="text-align:right">
                <span class="lbl" style="font-size:10px">Periode Penagihan</span><br>
                <b style="font-size:18px">${periodeLabel(selectedBill.period)}</b><br>
                <small style="color:var(--muted)">Jatuh Tempo: ${selectedBill.due_date ? tgl(selectedBill.due_date) : '-'}</small>
              </div>
            </div>

            <!-- Rincian Item Tagihan -->
            <div style="margin-top:16px;border-top:1px solid var(--c1);padding-top:14px">
              <div class="ctr" style="margin-bottom:10px">
                <h4 style="font-size:14px;display:flex;gap:6px;align-items:center;color:var(--primary-d)">
                  ${ms('list')}Rincian Komponen Biaya (${items.length > 0 ? items.length : '1'} Pos)
                </h4>
                ${pill(selectedBill.status === 'paid' ? 'Lunas' : 'Belum Dibayar', selectedBill.status === 'paid' ? 'ok' : 'err')}
              </div>

              ${items.length > 0 ? `
                <div style="display:grid;gap:6px">
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
              ` : `
                <div class="note" style="justify-content:space-between;align-items:center;padding:10px 12px;background:#fff">
                  <span>Sewa Kamar Reguler</span>
                  <b>${rp(totalAmount)}</b>
                </div>
              `}

              <div class="kv" style="margin-top:14px;padding-top:12px;border-top:1px solid var(--c1);align-items:center">
                <b style="font-size:15px">Total yang Harus Dibayar</b>
                <b style="font-size:24px;color:var(--primary-d);white-space:nowrap">${rp(totalAmount)}</b>
              </div>
            </div>
          </div>

          <!-- Kanal Pembayaran Resmi yang Didukung Gateway -->
          <div class="card">
            <div class="ctr" style="margin-bottom:12px">
              <h3 style="font-size:16px;display:flex;gap:8px;align-items:center">
                ${ms('payments')}Metode Pembayaran
              </h3>
              <small style="display:flex;gap:4px;align-items:center;color:var(--muted)">
                ${ms('bolt')}Verifikasi Otomatis
              </small>
            </div>

            <div class="note" style="display:block;background:var(--c1);border:1px solid var(--line);padding:14px;border-radius:var(--r, 8px)">
              <div class="ctr" style="margin-bottom:8px">
                <div style="display:flex;align-items:center;gap:10px">
                  <span class="stat" style="margin:0">
                    <span class="ic" style="position:static;width:38px;height:38px;border-radius:10px;background:var(--primary);color:#fff">
                      ${ms('account_balance_wallet')}
                    </span>
                  </span>
                  <div>
                    <b style="font-size:14px;color:var(--primary-d)">Midtrans Snap Online Gateway</b>
                    <small style="display:block;color:var(--muted)">Gateway Pembayaran Resmi KosLedger</small>
                  </div>
                </div>
                ${pill('Otomatis & Real-time', 'ok')}
              </div>
              <p style="font-size:13px;color:var(--text);margin:8px 0 10px;line-height:1.5">
                Pembayaran sewa diverifikasi secara instan dan otomatis oleh sistem. Pilihan kanal pembayaran (QRIS semua dompet digital, Virtual Account Bank BCA/BNI/BRI/Mandiri, serta e-Wallet) akan tampil langsung di dalam jendela popup Snap setelah Anda menekan tombol Bayar Sekarang.
              </p>
              <div style="display:flex;gap:6px;flex-wrap:wrap">
                <code>QRIS</code><code>BCA VA</code><code>Mandiri Bill</code><code>BNI VA</code><code>BRI VA</code><code>GoPay</code><code>ShopeePay</code>
              </div>
            </div>

            <div class="ctr" style="margin-top:16px;font-size:12px;color:var(--muted);flex-wrap:wrap;gap:8px">
              <span style="display:flex;gap:6px;align-items:center">
                ${ms('sync')}Status otomatis diperbarui setelah pembayaran terkonfirmasi oleh backend
              </span>
              <span style="display:flex;gap:6px;align-items:center">
                ${ms('lock')}TLS 256-bit Encrypted
              </span>
            </div>
          </div>
        </div>

        <!-- Kolom Kanan: Aksi Pembayaran & Konfirmasi -->
        <div style="display:grid;gap:16px;min-width:0">
          <!-- Card Eksekusi Pembayaran -->
          <div class="card">
            <div class="ctr" style="margin-bottom:8px">
              <span class="lbl" style="font-size:11px;color:var(--primary-d)">RINGKASAN PEMBAYARAN</span>
              <small>Faktur: ${invId}</small>
            </div>

            <p style="margin:6px 0 2px;font-size:12px;color:var(--muted)">Total Nominal Tagihan</p>
            <div class="big" style="color:var(--primary-d);margin-bottom:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
              ${rp(totalAmount)}
              <small style="font-size:13px;font-weight:400;color:var(--muted)">/ periode</small>
            </div>

            <div class="note" style="display:block;margin-bottom:16px;background:var(--c1)">
              <div class="kv">
                <span>Unit Hunian</span>
                <b style="font-weight:500">Kamar ${esc(roomNumber)}</b>
              </div>
              <div class="kv">
                <span>Periode Sewa</span>
                <b style="font-weight:500">${periodeLabel(selectedBill.period)}</b>
              </div>
              <div class="kv">
                <span>Biaya Layanan</span>
                <b style="font-weight:500;color:var(--primary)">GRATIS (Disubsidi)</b>
              </div>
              <div class="kv" style="border-top:1px solid var(--c3);padding-top:10px;margin-top:8px">
                <b style="font-weight:600">Batas Waktu</b>
                <b style="color:var(--err)">${selectedBill.due_date ? tgl(selectedBill.due_date) : 'Sesuai Jadwal'}</b>
              </div>
            </div>

            <!-- Indikator Kondisi Pending atau Tombol Bayar -->
            ${activePendingPayment ? `
              <div class="note" style="display:block;background:var(--warn-bg);margin-bottom:14px;padding:12px">
                <b style="color:var(--warn);display:flex;gap:6px;align-items:center;font-size:13px">
                  ${ms('hourglass_bottom')}Ada Sesi Pembayaran Pending
                </b>
                <p style="font-size:12px;color:var(--text);margin:6px 0 10px">
                  Order ID: <span class="mono">${esc(activePendingPayment.provider_order_id || '-')}</span>.
                  Sesi ini sedang menunggu penyelesaian pembayaran. Jika Anda ingin membuat sesi pembayaran baru, batalkan sesi ini terlebih dahulu.
                </p>
                <div style="display:flex;gap:8px">
                  <button class="btn s sm" id="btn-expire-pending" data-payment-id="${activePendingPayment.id}" style="color:var(--err)">
                    ${ms('cancel')}Batalkan Sesi Pending
                  </button>
                  <button class="btn p sm" data-go="anggota-riwayat">
                    ${ms('history')}Cek di Riwayat
                  </button>
                </div>
              </div>
            ` : `
              <button class="btn p" id="btn-start-pay" style="width:100%;padding:14px;font-size:15px">
                ${ms('credit_card')}Bayar Sekarang (Checkout)
              </button>
              <p style="text-align:center;font-size:12px;color:var(--muted);margin:10px 0 0">
                Konfirmasi akan diminta sebelum sesi pembayaran resmi dibuka.
              </p>
            `}
          </div>

          <!-- Jaminan Transparansi & Validasi Ganda -->
          <div class="card">
            <div class="ctr" style="margin-bottom:10px">
              <h3 style="font-size:15px;display:flex;gap:8px;align-items:center">
                ${ms('verified_user')}Validasi Pembayaran KosLedger
              </h3>
              ${pill('Dual-State Check', '')}
            </div>

            <div class="note" style="display:block;margin-bottom:10px;background:var(--c1);font-size:12px">
              <span class="lbl" style="font-size:10px">● Tingkat 1: Pembayaran Operasional</span>
              <p style="margin:4px 0">
                Setelah status pembayaran dikonfirmasi sukses oleh backend / webhook, tagihan otomatis dinyatakan lunas dan hak huni diperpanjang.
              </p>
            </div>

            <div class="note" style="display:block;background:var(--c2);font-size:12px">
              <span class="lbl" style="font-size:10px">● Tingkat 2: Immutability Ledger</span>
              <p style="margin:4px 0">
                Setiap pelunasan sewa yang berhasil akan dijadwalkan untuk dicatat ke smart contract blockchain (Sepolia) untuk integritas audit kuitansi digital.
              </p>
            </div>
          </div>
        </div>
      </div>
    ` : `
      <!-- Kondisi Tidak Ada Tagihan yang Perlu Dibayar -->
      <div class="card" style="padding:40px 20px;text-align:center">
        <div class="seal" style="margin-bottom:16px">
          <i>${ms('task_alt')}</i>
        </div>
        <h2 style="font-size:24px;color:var(--text);margin-bottom:6px">
          Tidak Ada Tagihan yang Perlu Dibayar!
        </h2>
        <p style="color:var(--muted);max-width:480px;margin:0 auto 20px;font-size:14px">
          Seluruh tagihan sewa kamar Anda telah lunas, atau belum ada invoice baru yang diterbitkan oleh pengelola kos.
        </p>
        <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
          <button class="btn s" data-go="anggota-tagihan">${ms('receipt_long')}Lihat Arsip Tagihan</button>
          <button class="btn p" data-go="anggota-riwayat">${ms('history')}Riwayat Pembayaran</button>
        </div>
      </div>
    `}
  `;

  return {
    html,
    after() {
      // Tombol Batalkan Sesi Pending
      const expireBtn = document.getElementById('btn-expire-pending');
      expireBtn?.addEventListener('click', async () => {
        const payId = expireBtn.dataset.paymentId;
        if (!payId) return;

        expireBtn.disabled = true;
        expireBtn.innerHTML = `<span class="spin" style="width:12px;height:12px;border-width:2px;margin-right:4px"></span>Membatalkan...`;

        try {
          await expirePayment(payId);
          toast('Sesi pending berhasil dibatalkan. Anda dapat membuat sesi baru.', 'ok');
          go('anggota-pembayaran');
        } catch (err) {
          toast(apiError(err) || 'Gagal membatalkan sesi pending.', 'err');
          expireBtn.disabled = false;
          expireBtn.innerHTML = `${ms('cancel')}Batalkan Sesi Pending`;
        }
      });

      // Tombol Bayar Sekarang (Buka modal konfirmasi terlebih dahulu)
      const payBtn = document.getElementById('btn-start-pay');
      payBtn?.addEventListener('click', () => {
        if (!selectedBill || payBtn.disabled) return;

        modal(`
          ${mhead('Konfirmasi Pembayaran Sewa', `Faktur: ${invId}`, 'credit_card')}
          <div class="mb">
            <p style="font-size:13px;color:var(--text);margin-bottom:14px">
              Pastikan rincian tagihan sewa kamar Anda sudah sesuai sebelum melanjutkan ke sesi gateway pembayaran Midtrans:
            </p>

            ${kvs([
              ['Unit Kamar', `Kamar ${esc(roomNumber)}`],
              ['Periode Penagihan', periodeLabel(selectedBill.period)],
              ['Nama Penyewa', esc(user.name)],
              ['Metode Gateway', 'Midtrans Snap (QRIS, VA, e-Wallet)'],
              ['Total Tagihan', `<b style="font-size:18px;color:var(--primary-d)">${rp(totalAmount)}</b>`],
            ])}

            <div class="note" style="margin:16px 0;background:var(--c1)">
              ${ms('info')}
              <span style="font-size:12px;color:var(--muted)">
                Sesi pembayaran resmi akan didaftarkan ke server. Transaksi diverifikasi secara otomatis dan tercatat pada buku kas setelah pembayaran diselesaikan di Midtrans.
              </span>
            </div>

            <div class="grid g2" style="margin:0">
              <button class="btn s" onclick="document.getElementById('modal')?.remove()">
                ${ms('close')}Batal
              </button>
              <button class="btn p" id="btn-confirm-checkout">
                ${ms('check_circle')}Lanjutkan Pembayaran
              </button>
            </div>
          </div>
        `);

        // Handler konfirmasi pembayaran di modal
        const confirmBtn = document.getElementById('btn-confirm-checkout');
        confirmBtn?.addEventListener('click', async () => {
          if (confirmBtn.disabled) return;
          confirmBtn.disabled = true;
          confirmBtn.innerHTML = `<span class="spin" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span>Memeriksa Gateway...`;

          try {
            // Pastikan Midtrans Snap JS siap digunakan (cegah race condition)
            const snapReady = await ensureSnapReady();
            if (!snapReady) {
              closeModal();
              toast('Midtrans Snap belum siap atau gagal dimuat. Periksa koneksi internet Anda atau nonaktifkan adblocker.', 'err');
              return;
            }

            confirmBtn.innerHTML = `<span class="spin" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span>Membuat Sesi Checkout...`;

            const res = await checkoutBill(selectedBill.id);
            const data = res?.data || res || {};
            const snapToken = data.snap_token;
            const orderId = data.order_id;
            const paymentId = data.payment_id;

            closeModal();

            // Validasi apakah snap_token benar-benar tersedia
            if (!snapToken) {
              toast('Gagal memperoleh Snap Token dari gateway Midtrans.', 'err');
              modal(`
                ${mhead('Kendala Konfigurasi Gateway', `Faktur: ${invId}`, 'error')}
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

            // Panggil popup Midtrans Snap
            window.snap.pay(snapToken, {
              onSuccess(result) {
                toast('Pembayaran berhasil diproses oleh Midtrans!', 'ok');
                // Refresh data riwayat pembayaran dari backend
                go('anggota-riwayat');
              },
              onPending(result) {
                toast('Sesi pembayaran tercatat (Pending). Silakan selesaikan pembayaran.', 'warn');
                // Refresh data dari backend
                go('anggota-riwayat');
              },
              onError(result) {
                toast('Pembayaran ditolak atau dibatalkan oleh gateway Midtrans.', 'err');
                go('anggota-pembayaran');
              },
              onClose() {
                toast('Jendela pembayaran Snap ditutup sebelum transaksi selesai.', 'warn');
                go('anggota-pembayaran');
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
                      ${esc(backendMsg)} Anda dapat menyelesaikan pembayaran tersebut atau membatalkan sesi pending di halaman Riwayat Pembayaran sebelum membuat sesi baru.
                    </span>
                  </div>
                  <div class="grid g2" style="margin:0">
                    <button class="btn p" data-go="anggota-riwayat" onclick="document.getElementById('modal')?.remove()">
                      ${ms('history')}Buka Riwayat Pembayaran
                    </button>
                    <button class="btn s" onclick="document.getElementById('modal')?.remove(); go('anggota-pembayaran')">
                      ${ms('refresh')}Muat Ulang
                    </button>
                  </div>
                </div>
              `);
            } else {
              const msg = apiError(err) || err.message || 'Gagal memproses checkout tagihan.';
              toast(msg, 'err');
            }
          }
        });
      });
    },
  };
}
