import {
  getPayments,
  getPayment,
  getChainRecords,
  getChainRecord,
  verifyChainRecord,
} from '../../api/payments.js';
import { paymentsReport } from '../../api/reports.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, avatar, ms, modal, mhead, kvs } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { emptyView, errorView, loadingView } from '../../components/states.js';
import { esc, tgl, rp, initials } from '../../utils/format.js';

const head = () =>
  pageHead({
    crumb: `Pemantauan › <b>Daftar Pembayaran Sewa</b>`,
    title: 'Monitoring Pembayaran & Audit On-Chain',
    sub: 'Pantau arus setoran sewa kos, kanal pembayaran, dan integritas hash rekaman blockchain.',
    acts: `<span class="ro-badge">${ms('visibility')}Mode Pantau Pemilik</span>`,
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

function paymentDetailModal(p, chain) {
  const orderId = p.provider_order_id || `PAY-${p.id}`;
  const penghuni = esc(p.bill?.occupancy?.user?.name || 'Penyewa');
  const kamar = esc(p.bill?.occupancy?.room?.room_number || '-');
  const recorder = p.recorder?.name ? esc(p.recorder.name) : p.method === 'manual' ? 'Bendahara (Manual)' : 'Gateway Midtrans';
  const metode = p.method === 'manual' ? 'Penerimaan Kas Tunai' : `Gateway Online (${esc(p.payment_type || 'Digital')})`;

  const chainHtml = chain
    ? `<div class="note" style="display:block;margin-top:16px;background:var(--c1)">
        <div class="ctr" style="margin-bottom:8px">
          <b style="display:flex;gap:6px;align-items:center;font-size:13px">${ms('hub')}Integritas Ledger Blockchain Sepolia</b>
          ${chainStatusPill(chain.chain_status)}
        </div>
        <div class="kvs" style="margin:8px 0">
          <div class="kv"><span>Jaringan</span><b>Ethereum Sepolia Testnet</b></div>
          <div class="kv"><span>Status Pencatatan</span><b>${chain.chain_status === 'recorded' ? 'Tervalidasi On-Chain' : esc(chain.chain_status)}</b></div>
          <div class="kv"><span>Payload Hash</span><span class="mono" style="font-size:11px;word-break:break-all">${esc(chain.payload_hash || '-')}</span></div>
          <div class="kv"><span>Tx Hash (TXID)</span><span class="mono" style="font-size:11px;word-break:break-all">${chain.tx_hash ? esc(chain.tx_hash) : '<small style="color:var(--muted)">Menunggu konfirmasi blok transaksi</small>'}</span></div>
          <div class="kv"><span>Waktu Dicatat</span><b>${chain.recorded_at ? tgl(chain.recorded_at) : '–'}</b></div>
          ${chain.error_message ? `<div class="kv"><span style="color:var(--err)">Catatan Kendala</span><b style="color:var(--err)">${esc(chain.error_message)}</b></div>` : ''}
        </div>
        <div class="acts" style="margin-top:10px" id="owner-chain-action-area">
          <button class="btn s sm" id="btn-owner-verify-hash" data-pid="${p.id}">${ms('approval')}Verifikasi Integritas Hash</button>
        </div>
        <div id="owner-verify-result-box" style="margin-top:10px"></div>
      </div>`
    : `<div class="note" style="margin-top:16px;background:var(--c1)">
        ${ms('info')}
        <span style="font-size:12px;color:var(--muted)">
          Pencatatan blockchain dilakukan otomatis pada transaksi berstatus lunas yang tervalidasi sah.
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
          <span class="lbl" style="font-size:11px">STATUS BLOCKCHAIN</span><br>
          ${chainStatusPill(chain?.chain_status)}
        </div>
      </div>

      ${kvs([
        ['ID Referensi', `<span class="mono">${orderId}</span>`],
        ['Nama Penyewa', penghuni],
        ['Unit Kamar', `Kamar ${kamar}`],
        ['Waktu Pembayaran', p.paid_at ? tgl(p.paid_at) : (p.created_at ? tgl(p.created_at) : '–')],
        ['Kanal Pembayaran', metode],
        ['Pencatat / Verifikator', recorder],
        ['Catatan Transaksi', esc(p.note || '–')],
        ['Total Nominal Sah', `<b style="font-size:17px;color:var(--primary-d)">+${rp(p.amount)}</b>`],
      ])}

      ${chainHtml}

      <div class="note" style="margin-top:14px">
        ${ms('shield')}
        <span style="font-size:12px;color:var(--muted)">
          Mode Pantau Pemilik: Transaksi dilindungi stempel audit digital KosLedger. Pemilik memiliki otoritas audit verifikasi hash on-chain.
        </span>
      </div>
    </div>
    <footer class="mf2">
      <button class="btn p" data-act="close">Tutup</button>
    </footer>`;
}

// Modal dan trigger verifikasi hash on-chain
async function showPaymentDetail(paymentData, chainData) {
  modal(`
    ${mhead('Memuat Detail Transaksi…', '', 'payments')}
    <div class="mb">${loadingView('Mengambil rincian pembayaran dan catatan blockchain…')}</div>
    <footer class="mf2"><button class="btn s" data-act="close">Batal</button></footer>
  `);

  let currentPayment = paymentData;
  let currentChain = chainData;

  // Coba ambil chain record detail jika belum ada
  if (!currentChain && currentPayment.id) {
    try {
      currentChain = await getChainRecord(currentPayment.id);
    } catch {
      currentChain = null;
    }
  }

  modal(paymentDetailModal(currentPayment, currentChain));

  // Pasang listener verifikasi hash
  document.getElementById('btn-owner-verify-hash')?.addEventListener('click', async () => {
    const btn = document.getElementById('btn-owner-verify-hash');
    const box = document.getElementById('owner-verify-result-box');
    if (!btn || !box) return;

    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>Memverifikasi hash…';

    try {
      const res = await verifyChainRecord(currentPayment.id);
      const isMatch = res.data?.match;
      box.innerHTML = `
        <div class="note ${isMatch ? '' : 'err2'}" style="margin:0;font-size:12px;display:block">
          <b style="display:flex;gap:6px;align-items:center;color:${isMatch ? 'var(--primary-d)' : 'var(--err)'}">
            ${ms(isMatch ? 'task_alt' : 'warning')} ${isMatch ? 'Verifikasi Hash Cocok (Integritas Sah)' : 'Verifikasi Gagal: Hash Tidak Cocok!'}
          </b>
          <div style="margin-top:6px;font-family:var(--mono);word-break:break-all">
            Hash Tersimpan : ${esc(res.data?.stored_hash || '-')}<br>
            Hash Terhitung : ${esc(res.data?.recomputed_hash || '-')}
          </div>
          <small style="display:block;margin-top:4px;color:var(--muted)">${esc(res.message || '')}</small>
        </div>`;
    } catch (err) {
      box.innerHTML = `
        <div class="note err2" style="margin:0;font-size:12px">
          ${ms('error')} Gagal memverifikasi hash: ${esc(apiError(err))}
        </div>`;
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${ms('approval')}Verifikasi Ulang Hash`;
    }
  });
}

function paymentRows(payments, chainMap) {
  return payments.map((p) => {
    const chain = chainMap.get(p.id) || p.chain_record || p.chainRecord || null;
    const orderId = p.provider_order_id || `PAY-${p.id}`;
    const penghuni = esc(p.bill?.occupancy?.user?.name || 'Penyewa');
    const kamar = esc(p.bill?.occupancy?.room?.room_number || '-');
    const metode = p.method === 'manual' ? 'Kas Tunai' : esc(p.payment_type ? p.payment_type.toUpperCase() : 'Gateway');
    const statusVal = p.status;

    return [
      `<b class="mono" style="font-size:12px">${esc(orderId)}</b><small style="color:var(--muted);display:block">${tgl(p.paid_at || p.created_at)}</small>`,
      `<div class="cell">
        ${avatar(esc(initials(penghuni)))}
        <span>
          <b>${penghuni}</b>
          <small>Kamar ${kamar} • Tagihan #${p.bill_id || '-'}</small>
        </span>
      </div>`,
      `<span class="chip">${ms(p.method === 'manual' ? 'payments' : 'account_balance_wallet')} ${metode}</span>`,
      `<span class="num pos">+${rp(p.amount)}</span>`,
      `<span data-status-val="${statusVal}">${paymentStatusPill(p.status)}</span>`,
      `<span>${chainStatusPill(chain?.chain_status)}</span>`,
      `<div class="acts" style="justify-content:flex-end">
        <button class="btn sm s" data-pay-idx="${p.id}" aria-label="Lihat detail pembayaran">${ms('visibility')} Detail</button>
      </div>`,
    ];
  });
}

export default async function paymentsMonitoringPage() {
  let payments = [];
  let summary = null;
  let chainMap = new Map();
  let fetchError = null;

  try {
    const [reportRes, chainRes] = await Promise.all([
      paymentsReport(),
      getChainRecords().catch(() => ({ data: [] })),
    ]);

    summary = reportRes?.summary || null;
    payments = Array.isArray(reportRes?.payments?.data)
      ? reportRes.payments.data
      : Array.isArray(reportRes?.payments)
      ? reportRes.payments
      : [];

    const chainList = Array.isArray(chainRes?.data) ? chainRes.data : Array.isArray(chainRes) ? chainRes : [];
    chainList.forEach((c) => {
      if (c.payment_id) chainMap.set(c.payment_id, c);
    });
  } catch (err) {
    fetchError = err;
  }

  if (fetchError && !payments.length) {
    return {
      html: `
        ${head()}
        ${errorView(apiError(fetchError))}
        <button class="btn s" id="retry-payments">${ms('refresh')}Coba lagi</button>`,
      after() {
        document.getElementById('retry-payments')?.addEventListener('click', () => go('pemilik-pembayaran'));
      },
    };
  }

  // Statistik pembayaran
  const totalSuccess = Number(summary?.total_success) || payments.filter((p) => p.status === 'success').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const countSuccess = Number(summary?.count_success) ?? payments.filter((p) => p.status === 'success').length;
  const countPending = Number(summary?.count_pending) ?? payments.filter((p) => p.status === 'pending').length;
  const countChainRecorded = Array.from(chainMap.values()).filter((c) => c.chain_status === 'recorded').length;

  return {
    html: `
      ${head()}

      <!-- 4 Kartu KPI Monitoring Pembayaran -->
      <div class="grid g4" style="margin-bottom:16px">
        ${statCard('Total Dana Diterima Sah', rp(totalSuccess), pill(`${countSuccess} Transaksi Lunas`, 'ok'), 'payments')}
        ${statCard('Menunggu Konfirmasi', `${countPending} <small>Transaksi</small>`, pill('Pending Gateway / Kas', 'warn'), 'hourglass_top')}
        ${statCard('Audit On-Chain Sepolia', `${countChainRecorded} <small>Tercatat</small>`, pill('Hash Terverifikasi', 'mint'), 'hub')}
        ${statCard('Total Mutasi Terdata', `${payments.length} <small>Setoran</small>`, '<span class="chip" style="background:var(--c1)">Log Pembayaran</span>', 'receipt_long')}
      </div>

      <div class="info-banner">
        <div class="ctr" style="align-items:flex-start">
          <div>
            <h3 class="sh">Audit Kepatuhan & Jejak Transaksi Digital</h3>
            <p class="sub">Setiap penerimaan sewa kos dipisahkan secara independen antara status penyelesaian finansial dan status catatan kriptografi blockchain (Sepolia Testnet).</p>
          </div>
          <button class="btn s sm" data-go="pemilik-tagihan">${ms('receipt_long')}Monitoring Tagihan</button>
        </div>
      </div>

      <!-- Kartu Tabel Monitoring Pembayaran -->
      <div class="card">
        <div class="filter" style="margin-bottom:14px;flex-wrap:wrap;gap:12px">
          ${searchField('Cari nomor referensi, nama penyewa, kanal...', 'tp-owner-payments')}
          <div class="tabs" id="owner-pay-status-tabs">
            <button class="on" data-status="">Semua Pembayaran</button>
            <button data-status="success">Lunas</button>
            <button data-status="pending">Menunggu</button>
            <button data-status="failed">Gagal / Kedaluwarsa</button>
          </div>
        </div>

        ${dataTable(
          ['No. Referensi', 'Penyewa & Tagihan', 'Kanal Bayar', '>Nominal Sah', 'Status Bayar', 'Status Blockchain', '>Aksi'],
          paymentRows(payments, chainMap),
          {
            id: 'tp-owner-payments',
            min: 880,
            emptyTitle: 'Belum ada data pembayaran',
            emptyText: 'Catatan transaksi pembayaran akan muncul di sini setelah dicatat di buku kas.',
            emptyIcon: 'payments',
          }
        )}

        <div class="foot" style="border-top:1px solid var(--c1);margin-top:14px">
          <span style="display:flex;gap:6px;align-items:center">
            ${ms('shield')}Seluruh mutasi pembayaran dilindungi log audit sistem dan verifikasi hash independen.
          </span>
          <span style="color:var(--muted)">Total ${payments.length} transaksi</span>
        </div>
      </div>
    `,
    after() {
      // Filter status tab
      const tabs = document.querySelectorAll('#owner-pay-status-tabs button');
      tabs.forEach((btn) => {
        btn.addEventListener('click', () => {
          tabs.forEach((b) => b.classList.remove('on'));
          btn.classList.add('on');
          const st = btn.dataset.status;
          document.querySelectorAll('#tp-owner-payments tbody tr').forEach((tr) => {
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

      // Tombol Detail Modal
      document.querySelectorAll('[data-pay-idx]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const pid = Number(btn.dataset.payIdx);
          const targetPay = payments.find((p) => p.id === pid);
          if (targetPay) {
            showPaymentDetail(targetPay, chainMap.get(pid));
          }
        });
      });
    },
  };
}
