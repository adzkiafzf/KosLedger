import {
  getPayments,
  getPayment,
  getChainRecords,
  getChainRecord,
  verifyChainRecord,
  retryChainRecord,
} from '../../api/payments.js';
import { paymentsReport } from '../../api/reports.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, avatar, ms, toast, modal, closeModal, mhead, kvs } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { errorView, loadingView } from '../../components/states.js';
import { esc, tgl, rp, initials } from '../../utils/format.js';

const SEPOLIA_EXPLORER = 'https://sepolia.etherscan.io/tx/';

const head = () =>
  pageHead({
    eyebrow: 'AUDIT TRAIL & KAS MASUK',
    txt: 1,
    dot: 1,
    title: 'Manajemen Pembayaran',
    sub: 'Verifikasi arus setoran sewa kos, pelunasan manual, dan audit rekaman blockchain Sepolia.',
    acts: `<button class="btn p" data-go="bendahara-tagihan">${ms('point_of_sale')}Catat Pembayaran Manual</button>`,
  });

function paymentStatusPill(status) {
  const map = {
    success: { label: 'Lunas', cls: 'ok dot' },
    pending: { label: 'Menunggu', cls: 'warn dot' },
    failed: { label: 'Gagal', cls: 'err dot' },
    expired: { label: 'Kedaluwarsa', cls: 'err dot' },
  };
  const st = map[status] || { label: status, cls: '' };
  return pill(st.label, st.cls);
}

function chainStatusPill(status) {
  if (status === 'recorded') {
    return `<span class="pill mint">${ms('verified')}Tercatat On-Chain</span>`;
  }
  if (status === 'pending') {
    return `<span class="pill warn">${ms('hourglass_top')}Antrean Sync</span>`;
  }
  if (status === 'failed') {
    return `<span class="pill err">${ms('error')}Gagal On-Chain</span>`;
  }
  return `<span class="pill" style="color:var(--muted)">Belum Dicatat</span>`;
}

function paymentRows(payments, chainMap) {
  return payments.map((p) => {
    const chain = chainMap.get(p.id) || p.chain_record || p.chainRecord || null;
    const orderId = p.provider_order_id || `PAY-${p.id}`;
    const penghuni = esc(p.bill?.occupancy?.user?.name || 'Penghuni');
    const metode = p.method === 'manual' ? 'Kas Tunai (Manual)' : esc(p.payment_type ? p.payment_type.toUpperCase() : 'Gateway Midtrans');
    const statusVal = p.status;

    return [
      `<b class="mono" style="font-size:12px">${esc(orderId)}</b><small style="color:var(--muted);display:block">${tgl(p.paid_at || p.created_at)}</small>`,
      `<div class="cell">
        ${avatar(esc(initials(penghuni)))}
        <span><b>${penghuni}</b><small>Tagihan #${p.bill_id}</small></span>
      </div>`,
      `<span class="chip">${ms(p.method === 'manual' ? 'payments' : 'account_balance_wallet')} ${metode}</span>`,
      `<span class="num pos">+${rp(p.amount)}</span>`,
      `<span data-status-val="${statusVal}">${paymentStatusPill(p.status)}</span>`,
      `<span>${chainStatusPill(chain?.chain_status)}</span>`,
      `<div class="acts" style="justify-content:flex-end">
        <button class="btn sm s" data-payment-detail="${p.id}" aria-label="Lihat detail pembayaran">${ms('visibility')} Detail</button>
      </div>`,
    ];
  });
}

function paymentDetailModal(p) {
  const chain = p.chain_record || p.chainRecord || null;
  const orderId = p.provider_order_id || `PAY-${p.id}`;
  const penghuni = esc(p.bill?.occupancy?.user?.name || 'Penghuni');
  const recorder = p.recorder?.name ? esc(p.recorder.name) : p.method === 'manual' ? 'Bendahara' : 'Webhook Gateway';
  const metode = p.method === 'manual' ? 'Penerimaan Tunai Langsung' : `Gateway Online (${esc(p.payment_type || 'Digital')})`;

  const chainHtml = chain
    ? `<div class="note" style="display:block;margin-top:16px;background:var(--c1)">
        <div class="ctr" style="margin-bottom:8px">
          <b style="display:flex;gap:6px;align-items:center;font-size:13px">${ms('hub')}Integritas Blockchain Sepolia</b>
          ${chainStatusPill(chain.chain_status)}
        </div>
        <div class="kvs" style="margin:8px 0">
          <div class="kv"><span>Jaringan</span><b>Ethereum Sepolia Testnet</b></div>
          <div class="kv"><span>Payload Hash</span><span class="mono" style="font-size:11px;word-break:break-all">${esc(chain.payload_hash || '-')}</span></div>
          <div class="kv"><span>Tx Hash (TXID)</span>
            ${chain.tx_hash
              ? `<a href="${SEPOLIA_EXPLORER}${esc(chain.tx_hash)}" target="_blank" rel="noopener" class="mono" style="font-size:11px;word-break:break-all;color:var(--primary-d)">${esc(chain.tx_hash)} ${ms('open_in_new')}</a>`
              : `<small style="color:var(--muted)">${chain.chain_status === 'pending' ? 'Menunggu konfirmasi blok…' : 'Belum tersedia'}</small>`
            }
          </div>
          <div class="kv"><span>Waktu Dicatat</span><b>${chain.recorded_at ? tgl(chain.recorded_at) : '–'}</b></div>
          ${chain.error_message ? `<div class="kv"><span style="color:var(--err)">Pesan Kendala</span><b style="color:var(--err)">${esc(chain.error_message)}</b></div>` : ''}
        </div>
        <div class="acts" style="margin-top:10px" id="chain-action-area">
          <button class="btn s sm" id="btn-verify-hash" data-pid="${p.id}">${ms('approval')}Verifikasi Integritas Hash</button>
          ${
            chain.chain_status === 'pending'
              ? `<button class="btn s sm" id="btn-refresh-chain-b" data-pid="${p.id}">${ms('refresh')}Refresh Status</button>`
              : ''
          }
          ${
            chain.chain_status === 'failed' && p.status === 'success'
              ? `<button class="btn p sm" id="btn-retry-chain" data-pid="${p.id}">${ms('refresh')}Coba Catat Ulang</button>`
              : ''
          }
        </div>
        <div id="verify-result-box" style="margin-top:10px"></div>
      </div>`
    : `<div class="note" style="margin-top:16px;background:var(--c1)">
        ${ms('info')}
        <span style="font-size:12px;color:var(--muted)">
          Pencatatan hash blockchain dilakukan otomatis oleh backend setelah pembayaran gateway terverifikasi sah.
        </span>
      </div>`;

  return `
    ${mhead(`Pembayaran ${orderId}`, `${penghuni} • Nominal ${rp(p.amount)}`, 'payments')}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px;gap:10px;flex-wrap:wrap">
        <div>
          <span class="lbl" style="font-size:11px">STATUS PEMBAYARAN</span><br>
          ${paymentStatusPill(p.status)}
        </div>
        <div style="text-align:right">
          <span class="lbl" style="font-size:11px">STATUS LEDGER BLOCKCHAIN</span><br>
          ${chainStatusPill(chain?.chain_status)}
        </div>
      </div>

      ${kvs([
        ['ID Referensi', `<span class="mono">${orderId}</span>`],
        ['Nama Penghuni', penghuni],
        ['Waktu Setoran', p.paid_at ? tgl(p.paid_at) : 'Belum selesai'],
        ['Kanal Pembayaran', metode],
        ['Dicatat Oleh', recorder],
        ['Catatan Transaksi', esc(p.note || '–')],
        ['Total Nominal Sah', `<b style="font-size:17px;color:var(--primary-d)">+${rp(p.amount)}</b>`],
      ])}

      ${chainHtml}
    </div>
    <footer class="mf2">
      <button class="btn p" data-act="close">Tutup</button>
    </footer>`;
}

async function showPaymentDetail(id) {
  modal(`
    ${mhead('Memuat Detail Pembayaran…', '', 'payments')}
    <div class="mb">${loadingView('Mengambil rincian transaksi dan audit blockchain…')}</div>
    <footer class="mf2"><button class="btn s" data-act="close">Batal</button></footer>
  `);

  try {
    const payment = await getPayment(id);
    modal(paymentDetailModal(payment));

    // Listener tombol Verifikasi Hash
    document.getElementById('btn-verify-hash')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-verify-hash');
      const box = document.getElementById('verify-result-box');
      btn.disabled = true;
      btn.innerHTML = '<span class="spin"></span>Memverifikasi…';

      try {
        const res = await verifyChainRecord(id);
        const match = res.data?.match;
        box.innerHTML = `
          <div class="note ${match ? '' : 'err2'}" style="margin:0;font-size:12px">
            ${ms(match ? 'check_circle' : 'error')}
            <span><b>${match ? 'Hash Cocok (Valid)' : 'Hash Tidak Cocok'}</b><br>${esc(res.message)}</span>
          </div>`;
      } catch (err) {
        box.innerHTML = `
          <div class="note err2" style="margin:0;font-size:12px">
            ${ms('error')}
            <span>${esc(apiError(err))}</span>
          </div>`;
      } finally {
        btn.disabled = false;
        btn.innerHTML = `${ms('approval')}Verifikasi Integritas Hash`;
      }
    });

    // Listener tombol Retry Chain
    document.getElementById('btn-retry-chain')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-retry-chain');
      btn.disabled = true;
      btn.innerHTML = '<span class="spin"></span>Menjadwalkan…';
      try {
        await retryChainRecord(id);
        toast('Pencatatan ulang ke blockchain berhasil dijadwalkan.', 'ok');
        closeModal();
      } catch (err) {
        toast(apiError(err), 'err');
        btn.disabled = false;
        btn.innerHTML = `${ms('refresh')}Coba Catat Ulang`;
      }
    });

    // Listener tombol Refresh Status Blockchain (saat pending)
    document.getElementById('btn-refresh-chain-b')?.addEventListener('click', async () => {
      const btn = document.getElementById('btn-refresh-chain-b');
      btn.disabled = true;
      btn.innerHTML = '<span class="spin"></span>Memuat…';
      try {
        const updated = await getChainRecord(id);
        if (updated.chain_status !== 'pending') {
          const freshPayment = await getPayment(id);
          freshPayment.chain_record = updated;
          modal(paymentDetailModal(freshPayment));
          // Re-attach semua listener setelah modal di-render ulang
          document.getElementById('btn-verify-hash')?.addEventListener('click', async () => {
            const vBtn = document.getElementById('btn-verify-hash');
            const box = document.getElementById('verify-result-box');
            vBtn.disabled = true;
            vBtn.innerHTML = '<span class="spin"></span>Memverifikasi…';
            try {
              const res = await verifyChainRecord(id);
              const match = res.data?.match;
              box.innerHTML = `<div class="note ${match ? '' : 'err2'}" style="margin:0;font-size:12px">${ms(match ? 'check_circle' : 'error')}<span><b>${match ? 'Hash Cocok (Valid)' : 'Hash Tidak Cocok'}</b><br>${esc(res.message)}</span></div>`;
            } catch (err) {
              box.innerHTML = `<div class="note err2" style="margin:0;font-size:12px">${ms('error')}<span>${esc(apiError(err))}</span></div>`;
            } finally {
              vBtn.disabled = false;
              vBtn.innerHTML = `${ms('approval')}Verifikasi Integritas Hash`;
            }
          });
        } else {
          toast('Status blockchain masih pending. Coba lagi beberapa saat.', 'warn');
          btn.disabled = false;
          btn.innerHTML = `${ms('refresh')}Refresh Status`;
        }
      } catch (err) {
        toast(apiError(err) || 'Gagal memuat status blockchain.', 'err');
        btn.disabled = false;
        btn.innerHTML = `${ms('refresh')}Refresh Status`;
      }
    });
  } catch (err) {
    modal(`
      ${mhead('Gagal Memuat Transaksi', '', 'error')}
      <div class="mb">${errorView(apiError(err))}</div>
      <footer class="mf2"><button class="btn p" data-act="close">Tutup</button></footer>
    `);
  }
}

export default async function paymentsPage() {
  let payments = [];
  let summary = { total_success: 0, count_success: 0, count_pending: 0, count_failed: 0 };
  let chainRecords = [];

  try {
    const [paysRes, repRes, chainRes] = await Promise.all([
      getPayments(),
      paymentsReport().catch(() => null),
      getChainRecords().catch(() => null),
    ]);

    payments = Array.isArray(paysRes?.data) ? paysRes.data : Array.isArray(paysRes) ? paysRes : [];
    if (repRes?.summary) summary = repRes.summary;
    chainRecords = Array.isArray(chainRes?.data) ? chainRes.data : Array.isArray(chainRes) ? chainRes : [];
  } catch (err) {
    return {
      html: `
        ${head()}
        ${errorView(apiError(err))}
        <button class="btn s" id="retry-pays">${ms('refresh')}Coba lagi</button>`,
      after() {
        document.getElementById('retry-pays')?.addEventListener('click', () => go('bendahara-pembayaran'));
      },
    };
  }

  const chainMap = new Map();
  chainRecords.forEach((c) => {
    if (c.payment_id) chainMap.set(c.payment_id, c);
  });

  const recordedChainCount = chainRecords.filter((c) => c.chain_status === 'recorded').length;
  const pendingChainCount = chainRecords.filter((c) => c.chain_status === 'pending').length;

  return {
    html: `
      ${head()}
      <div class="grid g4">
        ${statCard('Total Kas Masuk Terverifikasi', rp(summary.total_success), pill('Lunas Sah', 'ok'), 'payments')}
        ${statCard('Pembayaran Sukses', `${summary.count_success} Transaksi`, '<span class="chip" style="background:var(--c1)">Gateway & Manual</span>', 'task_alt')}
        ${statCard('Menunggu Verifikasi', `${summary.count_pending} Transaksi`, pill('Dalam Proses', summary.count_pending ? 'warn' : ''), 'schedule')}
        ${statCard('Ledger Immutability', `${recordedChainCount} On-Chain`, `<span style="font-size:12px;color:var(--muted)">${pendingChainCount} antrean sync</span>`, 'shield')}
      </div>

      <div class="grid g21" style="align-items:start">
        <div class="card">
          <div class="ctr" style="margin-bottom:12px">
            <div>
              <h3>Jurnal Mutasi Pembayaran</h3>
              <p class="sub">Catatan transaksi pembayaran tagihan kos via payment gateway dan penerimaan tunai</p>
            </div>
            <span class="chip" style="background:var(--c1)">Total ${payments.length} Entri</span>
          </div>

          <div class="filter" style="margin-bottom:14px;flex-wrap:wrap;gap:12px">
            ${searchField('Cari order ID, nama penghuni, metode...', 'tb-payments')}
            <div class="tabs" id="pay-status-tabs">
              <button class="on" data-status="">Semua</button>
              <button data-status="success">Sukses</button>
              <button data-status="pending">Menunggu</button>
              <button data-status="failed">Gagal / Expired</button>
            </div>
          </div>

          ${dataTable(
            ['ID Order / Ref', 'Penghuni & Tagihan', 'Metode Bayar', '>Nominal', 'Status Bayar', 'Status Blockchain', '>Aksi'],
            paymentRows(payments, chainMap),
            {
              id: 'tb-payments',
              min: 880,
              emptyTitle: 'Belum ada transaksi pembayaran tercatat',
              emptyText: 'Seluruh pembayaran dari gateway atau penerimaan manual akan muncul di sini.',
              emptyIcon: 'payments',
            }
          )}
        </div>

        <div style="display:grid;gap:16px;min-width:0">
          <div class="card">
            <div class="ctr" style="margin-bottom:8px">
              <h3 style="font-size:18px">Validasi Status Ganda</h3>
              ${pill('Dual-State Protocol', '')}
            </div>
            <p class="sub" style="margin-bottom:12px">Sistem KosLedger memisahkan verifikasi pembayaran operasional kos dengan pencatatan hash di blockchain.</p>

            <div class="note" style="display:block;background:var(--c1);margin-bottom:10px">
              <div class="ctr"><span class="lbl" style="font-size:10px">TINGKAT 1: KEUANGAN KOS</span>${pill('Operasional', 'ok')}</div>
              <p style="margin:6px 0;font-size:12px">Pembayaran yang berstatus <b>Lunas</b> sah secara operasional perikatan sewa kos tanpa menunggu konfirmasi block Sepolia.</p>
            </div>

            <div class="note" style="display:block;background:var(--c2)">
              <div class="ctr"><span class="lbl" style="font-size:10px">TINGKAT 2: IMMUTABLE AUDIT</span>${pill('Sepolia Testnet', 'mint')}</div>
              <p style="margin:6px 0;font-size:12px">Hash payload SHA-256 dicatat ke smart contract Ethereum Sepolia sebagai bukti digital bebas manipulasi.</p>
              <div class="kv" style="margin-top:6px"><span>Tercatat Sepolia</span><b>${recordedChainCount} Transaksi</b></div>
            </div>
          </div>

          <div class="card">
            <h3 style="font-size:16px;margin-bottom:4px">Buku Kas & Pelaporan</h3>
            <p class="sub" style="margin-bottom:12px">Periksa laporan keuangan menyeluruh dan mutasi kas pengeluaran kos.</p>
            <div style="display:grid;gap:8px">
              <button class="btn s" data-go="bendahara-pengeluaran" style="width:100%">${ms('account_balance_wallet')}Manajemen Pengeluaran</button>
              <button class="btn s" data-go="bendahara-laporan" style="width:100%">${ms('bar_chart')}Laporan Keuangan</button>
            </div>
          </div>
        </div>
      </div>`,
    after() {
      // Event listener: Filter status tabs
      const tabs = document.querySelectorAll('#pay-status-tabs button');
      tabs.forEach((btn) => {
        btn.addEventListener('click', () => {
          tabs.forEach((b) => b.classList.remove('on'));
          btn.classList.add('on');
          const st = btn.dataset.status;
          document.querySelectorAll('#tb-payments tbody tr').forEach((tr) => {
            if (!st) {
              tr.hidden = false;
            } else if (st === 'failed') {
              const val = tr.querySelector('[data-status-val]')?.dataset?.statusVal;
              tr.hidden = val !== 'failed' && val !== 'expired';
            } else {
              const val = tr.querySelector('[data-status-val]')?.dataset?.statusVal;
              tr.hidden = val !== st;
            }
          });
        });
      });

      // Event listener: Detail pembayaran
      document.querySelectorAll('[data-payment-detail]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.paymentDetail;
          if (id) showPaymentDetail(id);
        });
      });
    },
  };
}
