import {
  getPayments,
  getPayment,
  verifyChainRecord,
  expirePayment,
} from '../../api/payments.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, ms, toast, modal, closeModal, mhead, kvs } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { emptyView, errorView } from '../../components/states.js';
import { esc, tgl, rp, periodeLabel } from '../../utils/format.js';

function paymentStatusPill(status) {
  const map = {
    success: { label: 'Lunas / Berhasil', cls: 'ok dot' },
    pending: { label: 'Menunggu (Pending)', cls: 'warn dot' },
    failed: { label: 'Gagal', cls: 'err dot' },
    expired: { label: 'Kedaluwarsa', cls: 'err dot' },
  };
  const st = map[status] || { label: status, cls: '' };
  return pill(st.label, st.cls);
}

function chainStatusPill(status) {
  if (status === 'recorded') {
    return `<span class="chain-ok">${ms('verified')}Tercatat On-Chain</span>`;
  }
  if (status === 'pending') {
    return `<span class="chain-pending">${ms('hourglass_top')}Antrean Sync</span>`;
  }
  if (status === 'failed') {
    return `<span class="chain-err">${ms('error')}Gagal On-Chain</span>`;
  }
  return `<span class="pill" style="color:var(--muted)">Belum Dicatat</span>`;
}

function renderPaymentDetailModal(p, user) {
  const orderId = p.provider_order_id || `TRX-${p.id}`;
  const invId = p.bill ? `#INV-${p.bill.period ? p.bill.period.replace('-', '') : ''}-${String(p.bill.id).padStart(3, '0')}` : '-';
  const kamar = esc(p.bill?.occupancy?.room?.room_number || '-');
  const recorder = p.recorder?.name ? esc(p.recorder.name) : (p.method === 'manual' ? 'Bendahara (Manual Kasir)' : 'Gateway Midtrans');
  const metode = p.method === 'manual' ? 'Manual / Kasir' : `Online Gateway (${esc(p.payment_type || 'Midtrans')})`;
  const chain = p.chain_record || p.chainRecord || null;
  const items = Array.isArray(p.bill?.items) ? p.bill.items : [];

  const itemsHtml = items.length > 0 ? `
    <div style="margin:14px 0 6px">
      <b style="font-size:13px;display:flex;gap:6px;align-items:center;color:var(--primary-d)">
        ${ms('list_alt')}Pos Rincian Tagihan Terkait
      </b>
    </div>
    <div style="display:grid;gap:6px;margin-bottom:14px">
      ${items.map((it) => `
        <div class="note" style="justify-content:space-between;align-items:center;padding:8px 12px;background:#fff;border:1px solid var(--line)">
          <div>
            <b style="font-size:12px;color:var(--text)">${esc(it.description || it.category || 'Biaya')}</b>
            <small style="color:var(--muted);display:block">Kategori: ${esc(it.category || 'Operasional')}</small>
          </div>
          <b style="font-size:13px;color:var(--primary-d)">${rp(it.amount)}</b>
        </div>
      `).join('')}
    </div>
  ` : '';

  const chainHtml = chain ? `
    <div class="note" style="display:block;margin-top:16px;background:var(--c2);padding:16px">
      <div class="ctr" style="margin-bottom:10px">
        <b style="display:flex;gap:6px;align-items:center;font-size:13px;color:var(--primary-d)">
          ${ms('hub')}Integritas Ledger Blockchain (Ethereum Sepolia)
        </b>
        ${chainStatusPill(chain.chain_status)}
      </div>

      <div class="kvs" style="margin:8px 0;font-size:12px">
        <div class="kv"><span>Jaringan Distributed</span><b>Ethereum Sepolia Testnet</b></div>
        <div class="kv"><span>Status Pencatatan</span><b>${chain.chain_status === 'recorded' ? 'Tervalidasi On-Chain' : esc(chain.chain_status)}</b></div>
        <div class="kv"><span>Payload Hash SHA-256</span><span class="mono" style="font-size:11px;word-break:break-all">${esc(chain.payload_hash || '-')}</span></div>
        <div class="kv"><span>Tx Hash (TXID)</span><span class="mono" style="font-size:11px;word-break:break-all">${chain.tx_hash ? esc(chain.tx_hash) : '<small style="color:var(--muted)">Menunggu konfirmasi blok transaksi</small>'}</span></div>
        <div class="kv"><span>Waktu Dicatat</span><b>${chain.recorded_at ? tgl(chain.recorded_at) : '–'}</b></div>
        ${chain.error_message ? `<div class="kv"><span style="color:var(--err)">Catatan Kendala</span><b style="color:var(--err)">${esc(chain.error_message)}</b></div>` : ''}
      </div>

      <div class="acts" style="margin-top:12px">
        <button class="btn s sm" id="btn-verify-chain" data-pid="${p.id}">
          ${ms('approval')}Verifikasi Integritas Hash
        </button>
      </div>
      <div id="verify-result-box" style="margin-top:10px"></div>
    </div>
  ` : `
    <div class="note" style="margin-top:16px;background:var(--c1);padding:14px">
      ${ms('info')}
      <span style="font-size:12px;color:var(--muted)">
        Catatan Blockchain: Transaksi yang berhasil diverifikasi akan otomatis dijadwalkan untuk pencatatan on-chain sebagai jaminan kuitansi digital bebas manipulasi.
      </span>
    </div>
  `;

  return `
    ${mhead(`Detail Transaksi ${orderId}`, `Kamar ${kamar} • Faktur ${invId}`, 'receipt_long')}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div>
          <span class="lbl" style="font-size:10px">STATUS PEMBAYARAN</span>
          <div>${paymentStatusPill(p.status)}</div>
        </div>
        <div style="text-align:right">
          <span class="lbl" style="font-size:10px">STATUS BLOCKCHAIN</span>
          <div>${chainStatusPill(chain?.chain_status)}</div>
        </div>
      </div>

      ${kvs([
        ['ID Order / Referensi', `<span class="mono">${orderId}</span>`],
        ['ID Gateway Transaksi', p.provider_transaction_id ? `<span class="mono">${esc(p.provider_transaction_id)}</span>` : '<span style="color:var(--muted)">-</span>'],
        ['ID Faktur / Tagihan', invId],
        ['Nama Penyewa', esc(user.name)],
        ['Unit Kamar', `Kamar ${kamar}`],
        ['Periode Tagihan', p.bill?.period ? periodeLabel(p.bill.period) : 'Bulan Berjalan'],
        ['Metode Pembayaran', metode],
        ['Waktu Transaksi', p.paid_at ? tgl(p.paid_at) : (p.created_at ? tgl(p.created_at) : '-')],
        ['Pencatat / Verifikator', recorder],
        ['Total Nominal', `<b style="font-size:18px;color:var(--primary-d)">${rp(p.amount)}</b>`],
      ])}

      ${itemsHtml}
      ${chainHtml}

      <div style="margin-top:18px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
        ${p.status === 'pending' ? `
          <button class="btn s sm" id="btn-modal-expire" data-pid="${p.id}" style="color:var(--err)">
            ${ms('cancel')}Batalkan Sesi Pending
          </button>
        ` : ''}
        <button class="btn s" onclick="document.getElementById('modal')?.remove()">
          ${ms('close')}Tutup
        </button>
      </div>
    </div>
  `;
}

export default async function payments({ user }) {
  let paymentList = [];

  try {
    const res = await getPayments();
    paymentList = res?.data || res || [];
    if (!Array.isArray(paymentList)) paymentList = [];
  } catch (err) {
    return {
      html: `
        <div style="padding:16px 0">
          ${pageHead({
            title: 'Riwayat Pembayaran',
            sub: 'Arsip setoran sewa kamar dan integritas audit transaksi.',
          })}
          ${errorView(err.message || 'Gagal memuat riwayat pembayaran.')}
          <div style="margin-top:16px">
            <button class="btn s" id="btn-retry-pays">${ms('refresh')}Muat Ulang Halaman</button>
          </div>
        </div>
      `,
      after() {
        document.getElementById('btn-retry-pays')?.addEventListener('click', () => go('anggota-riwayat'));
      },
    };
  }

  // Statistik ringkasan
  const totalTrx = paymentList.length;
  const successList = paymentList.filter((p) => p.status === 'success');
  const pendingList = paymentList.filter((p) => p.status === 'pending');
  const failedList = paymentList.filter((p) => p.status === 'failed' || p.status === 'expired');
  const totalPaidNominal = successList.reduce((acc, cur) => acc + (Number(cur.amount) || 0), 0);

  // Siapkan data baris tabel
  const tableRows = paymentList.map((p) => {
    const orderId = p.provider_order_id || `TRX-${p.id}`;
    const invId = p.bill ? `#INV-${p.bill.period ? p.bill.period.replace('-', '') : ''}-${String(p.bill.id).padStart(3, '0')}` : '-';
    const periodText = p.bill?.period ? periodeLabel(p.bill.period) : '-';
    const metode = p.method === 'manual' ? 'Manual Kasir' : (p.payment_type ? esc(p.payment_type.toUpperCase()) : 'Gateway');
    const dateText = p.paid_at ? tgl(p.paid_at) : (p.created_at ? tgl(p.created_at) : '-');
    const statusVal = p.status;
    const chainStatus = p.chain_record?.chain_status || p.chainRecord?.chain_status || null;

    return {
      cells: [
        `<b class="mono" style="font-size:12px;color:var(--primary-d)">${esc(orderId)}</b><br><small style="color:var(--muted)">${invId}</small>`,
        `<span style="font-weight:500;color:var(--text)">${periodText}</span>`,
        `<span>${dateText}</span>`,
        `<span class="chip" style="font-size:11px">${metode}</span>`,
        `<b class="num" style="font-size:14px;color:var(--primary-d);white-space:nowrap">${rp(p.amount)}</b>`,
        `<span data-pay-status="${statusVal}">${paymentStatusPill(p.status)}</span>`,
        `<span>${chainStatusPill(chainStatus)}</span>`,
        `<div class="acts" style="justify-content:flex-end;gap:6px">
          <button class="btn sm s" data-view-pay="${p.id}" aria-label="Lihat Detail Transaksi">
            ${ms('visibility')} Detail
          </button>
          ${p.status === 'pending' ? `
            <button class="btn sm s" data-expire-pay="${p.id}" style="color:var(--err)" aria-label="Batalkan Sesi Pending">
              ${ms('cancel')}
            </button>
          ` : ''}
        </div>`,
      ],
    };
  });

  const html = `
    <!-- Header Halaman -->
    ${pageHead({
      title: 'Riwayat Pembayaran',
      sub: 'Seluruh rekaman pelunasan sewa kos diverifikasi otomatis dan terlindungi integritas on-chain.',
      acts: `
        <span class="sel">${ms('history')}Total ${totalTrx} Transaksi</span>
        <button class="btn p" data-go="anggota-pembayaran">${ms('payments')}Bayar Tagihan</button>
      `,
    })}

    <!-- Statistik Ringkasan -->
    <div class="grid g4" style="margin-bottom:20px">
      ${statCard(
        'TOTAL PELUNASAN',
        rp(totalPaidNominal),
        `<span style="color:var(--primary);font-weight:600">✓ ${successList.length} Transaksi Sukses</span>`,
        'account_balance_wallet'
      )}

      ${statCard(
        'TRANSAKSI SUKSES',
        `${successList.length} <small style="font-size:14px;font-weight:400;color:var(--muted)">Lunas</small>`,
        `<span style="color:var(--text)">Tervalidasi buku kas</span>`,
        'task_alt'
      )}

      ${statCard(
        'MENUNGGU / PENDING',
        `${pendingList.length} <small style="font-size:14px;font-weight:400;color:var(--muted)">Sesi</small>`,
        pendingList.length > 0
          ? `<span style="color:var(--warn);font-weight:600">Menunggu pelunasan</span>`
          : 'Tidak ada sesi tertunda',
        'hourglass_top'
      )}

      ${statCard(
        'INTEGRITAS LEDGER',
        'Dual-State',
        `<span style="color:var(--primary)">✓ Kuitansi terproteksi kriptografi</span>`,
        'verified'
      )}
    </div>

    <!-- Filter Tab & Pencarian -->
    <div class="card" style="margin-bottom:16px">
      <div class="ctr" style="flex-wrap:wrap;gap:12px">
        <div class="tabs" id="pay-status-tabs" style="margin:0">
          <button class="on" data-pay-filter="all">Semua Status (${totalTrx})</button>
          <button data-pay-filter="success">Lunas (${successList.length})</button>
          <button data-pay-filter="pending">Pending (${pendingList.length})</button>
          <button data-pay-filter="failed">Gagal / Expired (${failedList.length})</button>
        </div>
        <div style="flex:1 1 240px;display:flex;justify-content:flex-end">
          ${searchField('Cari order ID, periode, nominal...', 'my-pays-table')}
        </div>
      </div>
    </div>

    <!-- Tabel Daftar Pembayaran -->
    <div class="card" style="padding:0;overflow:hidden">
      ${totalTrx > 0 ? `
        ${dataTable(
          ['ID Transaksi / Faktur', 'Periode', 'Tgl Pelunasan', 'Metode', '>Nominal', 'Status Kasir', 'Status Blockchain', '>Aksi'],
          tableRows,
          { id: 'my-pays-table', min: 860 }
        )}
        <div class="foot" style="padding:14px 20px;display:flex;justify-content:space-between;align-items:center;background:var(--c1)">
          <span style="font-size:12px;color:var(--muted)">
            Menampilkan ${totalTrx} riwayat transaksi pembayaran terdaftar milik akun Anda
          </span>
          <span style="font-size:12px;color:var(--muted);display:flex;gap:6px;align-items:center">
            ${ms('lock')}Catatan audit transparan KosLedger
          </span>
        </div>
      ` : `
        <div style="padding:32px 20px">
          ${emptyView(
            'Belum Ada Riwayat Pembayaran',
            'Riwayat transaksi pelunasan sewa kos Anda akan tercatat secara permanen di sini setelah pembayaran diselesaikan.',
            'history'
          )}
        </div>
      `}
    </div>

    <!-- Banner Edukasi Integritas Blockchain -->
    <div class="note" style="margin-top:16px;display:flex;gap:14px;padding:16px;background:var(--c2)">
      <span class="ic" style="width:40px;height:40px;border-radius:12px;background:#fff;display:grid;place-items:center;flex:none;color:var(--primary)">
        ${ms('approval')}
      </span>
      <div style="font-size:12px">
        <b style="color:var(--primary-d);font-size:13px;display:block;margin-bottom:2px">
          Prinsip Audit Bebas Manipulasi
        </b>
        <span style="color:var(--muted)">
          Status pembayaran operasional dan status pencatatan blockchain dipisahkan dengan jelas. Pembayaran yang sah mengonfirmasi perpanjangan sewa Anda, sedangkan pencatatan on-chain menjamin kuitansi digital tidak dapat diubah sepihak di kemudian hari.
        </span>
      </div>
    </div>
  `;

  return {
    html,
    after() {
      // Filter tab status
      const tabContainer = document.getElementById('pay-status-tabs');
      tabContainer?.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-pay-filter]');
        if (!btn) return;
        tabContainer.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
        btn.classList.add('on');

        const filter = btn.dataset.payFilter;
        const rows = document.querySelectorAll('#my-pays-table tbody tr');

        rows.forEach((tr) => {
          const statusCell = tr.querySelector('[data-pay-status]');
          const st = statusCell ? statusCell.dataset.payStatus : '';

          if (filter === 'all') {
            tr.hidden = false;
          } else if (filter === 'success') {
            tr.hidden = st !== 'success';
          } else if (filter === 'pending') {
            tr.hidden = st !== 'pending';
          } else if (filter === 'failed') {
            tr.hidden = !(st === 'failed' || st === 'expired');
          }
        });
      });

      // Event listener: Klik tombol Detail Transaksi
      document.addEventListener('click', async (e) => {
        const viewBtn = e.target.closest('[data-view-pay]');
        if (viewBtn) {
          const payId = viewBtn.dataset.viewPay;
          viewBtn.disabled = true;
          try {
            const payData = await getPayment(payId);
            modal(renderPaymentDetailModal(payData, user));

            // Handler tombol verifikasi hash on-chain di dalam modal
            const verifyBtn = document.getElementById('btn-verify-chain');
            verifyBtn?.addEventListener('click', async () => {
              verifyBtn.disabled = true;
              verifyBtn.innerHTML = `<span class="spin" style="width:12px;height:12px;border-width:2px;margin-right:4px"></span>Memverifikasi di Jaringan Sepolia...`;

              const resBox = document.getElementById('verify-result-box');
              try {
                const vRes = await verifyChainRecord(payId);
                const data = vRes?.data || {};
                const isMatch = Boolean(data.match);

                resBox.innerHTML = `
                  <div class="note" style="padding:12px;background:${isMatch ? 'var(--c2)' : 'var(--err-bg)'};border:1px solid ${isMatch ? 'var(--primary)' : 'var(--err)'}">
                    <b style="color:${isMatch ? 'var(--primary-d)' : 'var(--err)'};display:flex;gap:6px;align-items:center;font-size:13px">
                      ${ms(isMatch ? 'verified' : 'error')}
                      ${isMatch ? 'Hash Cocok! Data Integritas Terverifikasi' : 'Peringatan: Hash Tidak Cocok'}
                    </b>
                    <small style="display:block;margin-top:6px;color:var(--text);font-family:var(--mono);font-size:11px;word-break:break-all">
                      Stored: ${esc(data.stored_hash || '-')}<br>
                      Recomputed: ${esc(data.recomputed_hash || '-')}
                    </small>
                    <small style="color:var(--muted);display:block;margin-top:4px">
                      ${esc(vRes.message || 'Verifikasi selesai.')}
                    </small>
                  </div>
                `;
              } catch (vErr) {
                resBox.innerHTML = `
                  <div class="note" style="padding:10px;background:var(--err-bg);color:var(--err);font-size:12px">
                    ${ms('error')} ${esc(apiError(vErr) || 'Gagal memverifikasi catatan blockchain.')}
                  </div>
                `;
              } finally {
                verifyBtn.disabled = false;
                verifyBtn.innerHTML = `${ms('approval')}Verifikasi Ulang Hash`;
              }
            });

            // Handler tombol batalkan sesi pending di dalam modal
            const modalExpireBtn = document.getElementById('btn-modal-expire');
            modalExpireBtn?.addEventListener('click', async () => {
              modalExpireBtn.disabled = true;
              try {
                await expirePayment(payId);
                toast('Sesi pending berhasil dibatalkan.', 'ok');
                closeModal();
                go('anggota-riwayat');
              } catch (exErr) {
                toast(apiError(exErr) || 'Gagal membatalkan sesi.', 'err');
                modalExpireBtn.disabled = false;
              }
            });
          } catch (err) {
            toast(apiError(err) || 'Gagal memuat detail transaksi.', 'err');
          } finally {
            viewBtn.disabled = false;
          }
          return;
        }

        // Event listener: Klik tombol Expire langsung dari tabel
        const expireBtn = e.target.closest('[data-expire-pay]');
        if (expireBtn) {
          const payId = expireBtn.dataset.expirePay;
          if (!confirm('Apakah Anda yakin ingin membatalkan sesi pembayaran pending ini?')) return;

          expireBtn.disabled = true;
          try {
            await expirePayment(payId);
            toast('Sesi pending berhasil dibatalkan.', 'ok');
            go('anggota-riwayat');
          } catch (err) {
            toast(apiError(err) || 'Gagal membatalkan sesi.', 'err');
            expireBtn.disabled = false;
          }
        }
      });
    },
  };
}
