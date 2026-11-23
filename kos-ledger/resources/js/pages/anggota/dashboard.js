import { member } from '../../api/dashboard.js';
import { getBills } from '../../api/bills.js';
import { getPayments } from '../../api/payments.js';
import { go } from '../../core/router.js';
import { pageHead, pill, ms } from '../../components/ui.js';
import { statCard } from '../../components/widgets.js';
import { emptyView, errorView } from '../../components/states.js';
import { esc, rp, tgl, periodeLabel, periodeSekarang } from '../../utils/format.js';

export default async function dashboard({ user }) {
  let dash = {};
  let bills = [];
  let payments = [];

  try {
    const [dashRes, billsRes, paymentsRes] = await Promise.allSettled([
      member(),
      getBills(),
      getPayments(),
    ]);

    if (dashRes.status === 'rejected') {
      throw dashRes.reason || new Error('Gagal memuat ringkasan dashboard penghuni.');
    }

    dash = dashRes.value || {};
    bills = billsRes.status === 'fulfilled' ? (billsRes.value?.data || billsRes.value || []) : [];
    payments = paymentsRes.status === 'fulfilled' ? (paymentsRes.value?.data || paymentsRes.value || []) : [];
  } catch (err) {
    return {
      html: `
        <div style="padding:16px 0">
          ${pageHead({
            title: `Halo, ${esc(user.nickname || user.name)} 👋`,
            sub: 'Portal Informasi Penghuni Kos',
          })}
          ${errorView(err.message || 'Terjadi kesalahan saat memuat data dashboard.')}
          <div style="margin-top:16px">
            <button class="btn s" id="btn-retry-dash">${ms('refresh')}Muat Ulang Dashboard</button>
          </div>
        </div>
      `,
      after() {
        document.getElementById('btn-retry-dash')?.addEventListener('click', () => go('anggota'));
      },
    };
  }

  // Cari informasi kamar yang ditempati dari data tagihan
  const billWithRoom = bills.find((b) => b.occupancy?.room?.room_number);
  const roomNumber = billWithRoom?.occupancy?.room?.room_number || null;
  const roomType = billWithRoom?.occupancy?.room?.type || null;

  // Tagihan yang belum dibayar
  const unpaidBills = (dash.recent_bills || []).filter((b) => b.status === 'unpaid');
  const totalUnpaidAmount = unpaidBills.reduce((acc, cur) => acc + (Number(cur.total_amount) || 0), 0);

  // Tagihan utama yang difokuskan (prioritas tagihan belum lunas, atau tagihan terkini jika sudah lunas)
  const primaryBill = unpaidBills[0] || (dash.recent_bills && dash.recent_bills[0]) || null;
  const isPrimaryPaid = primaryBill?.status === 'paid';

  // Daftar pembayaran terbaru
  const recentPayments = Array.isArray(payments) ? payments.slice(0, 3) : [];

  const html = `
    <!-- Header Selamat Datang -->
    <div class="hd">
      <div>
        <h1 style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
          Halo, ${esc(user.nickname || user.name)} <span style="font-size:28px">👋</span>
          <span style="flex-shrink:0">${pill('Sewa Aktif', 'mint dot')}</span>
        </h1>
        <p>Selamat datang di Portal Penghuni Kos • Periode Berjalan ${periodeSekarang()}</p>
      </div>
      <div class="acts">
        <div class="card" style="padding:10px 16px;display:flex;gap:12px;align-items:center">
          ${ms('event')}
          <span>
            <span class="lbl" style="font-size:10px">Jatuh Tempo Terdekat</span><br>
            <b>${dash.nearest_due ? tgl(dash.nearest_due) : 'Semua Tagihan Lunas'}</b>
          </span>
        </div>
        <div class="card" style="padding:10px 16px;display:flex;gap:12px;align-items:center;cursor:pointer" data-go="anggota-kamar">
          ${ms('meeting_room')}
          <span>
            <span class="lbl" style="font-size:10px">Kamar Ditempati</span><br>
            <b>${roomNumber ? 'Kamar ' + esc(roomNumber) : 'Unit Aktif'}</b>
          </span>
        </div>
      </div>
    </div>

    <!-- Banner Pembayaran Otomatis -->
    <div class="paybanner" style="flex-wrap:wrap">
      <span class="ic" style="flex:none">${ms('bolt')}</span>
      <div style="flex:1 1 220px;min-width:0">
        <b>Pembayaran Otomatis QRIS & Virtual Account Siap Digunakan</b>
        <span>Pelunasan sewa instan 24/7 terverifikasi otomatis tanpa perlu konfirmasi manual via chat.</span>
      </div>
      <div class="kg" style="display:flex;gap:6px;flex-wrap:wrap">
        <span class="chip" style="background:#fff;white-space:nowrap">QRIS</span>
        <span class="chip" style="background:#fff;white-space:nowrap">BCA VA</span>
        <span class="chip" style="background:#fff;white-space:nowrap">Mandiri VA</span>
      </div>
    </div>

    <!-- Statistik Ringkasan Utama -->
    <div class="grid g4" style="margin-bottom:20px">
      ${statCard(
        'TAGIHAN BELUM LUNAS',
        `${dash.unpaid_bills || 0} <small style="font-size:14px;font-weight:400;color:var(--muted)">Tagihan</small>`,
        dash.unpaid_bills > 0
          ? `<span style="color:var(--err);font-weight:600">Total ${rp(totalUnpaidAmount)}</span>`
          : '<span style="color:var(--primary);font-weight:600">✓ Semua tagihan lunas</span>',
        'receipt_long'
      )}

      ${statCard(
        'JATUH TEMPO',
        dash.nearest_due ? tgl(dash.nearest_due) : 'Tidak Ada',
        dash.nearest_due
          ? '<span style="color:var(--err)">Batas waktu pembayaran</span>'
          : 'Bebas dari tenggat pembayaran',
        'hourglass_top'
      )}

      ${statCard(
        'INTEGRASI TELEGRAM',
        dash.linked_telegram ? 'Terhubung' : 'Belum Konek',
        dash.linked_telegram
          ? '<span style="color:var(--primary)">✓ Pengingat otomatis aktif</span>'
          : '<span style="color:var(--muted)">Klik Layanan untuk tautkan</span>',
        'send'
      )}

      ${statCard(
        'KAMAR HUNIAN',
        roomNumber ? `Kamar ${esc(roomNumber)}` : 'Kamar Aktif',
        roomType ? `<span style="color:var(--text)">${esc(roomType)}</span>` : 'Hunian penghuni terdaftar',
        'hotel'
      )}
    </div>

    <!-- Layout Grid 2 Kolom -->
    <div class="grid g21" style="align-items:start">
      <!-- Kolom Kiri: Tagihan Berjalan & Layanan -->
      <div style="display:grid;gap:16px;min-width:0">
        <!-- Kartu Tagihan Utama -->
        <div class="card">
          ${primaryBill ? `
            <div class="ctr">
              <span style="display:flex;gap:8px;align-items:center">
                ${pill(`Periode ${periodeLabel(primaryBill.period)}`, '')}
                ${isPrimaryPaid ? pill('● Lunas', 'ok') : pill('● Belum Dibayar', 'err')}
              </span>
              <span style="font-size:12px;display:flex;gap:6px;align-items:center;color:var(--muted)">
                ${ms('event')}
                ${primaryBill.due_date ? `Jatuh tempo: <b style="${!isPrimaryPaid ? 'color:var(--err)' : ''}">${tgl(primaryBill.due_date)}</b>` : 'Tanpa batas tempo'}
              </span>
            </div>

            <div class="ctr" style="margin:20px 0;flex-wrap:wrap;gap:16px">
              <div>
                <span style="color:var(--muted);font-size:13px">Total Tagihan ${isPrimaryPaid ? 'Terbayar' : 'Perlu Dibayar'}</span>
                <div class="big" style="font-size:36px;color:var(--primary-d)">
                  ${rp(primaryBill.total_amount)}
                  <small style="font-size:14px;color:var(--muted);font-weight:400">/ periode</small>
                </div>
              </div>
              <div>
                ${!isPrimaryPaid ? `
                  <button class="btn p" style="padding:12px 20px;font-size:14px" data-go="anggota-tagihan">
                    ${ms('credit_card')}Bayar Tagihan Sekarang
                  </button>
                ` : `
                  <button class="btn s" style="padding:12px 20px;font-size:14px" data-go="anggota-riwayat">
                    ${ms('task_alt')}Lihat Bukti Pembayaran
                  </button>
                `}
              </div>
            </div>

            <!-- Rincian Komponen Biaya Tagihan (jika ada) -->
            ${primaryBill.items && primaryBill.items.length > 0 ? `
              <div class="note" style="display:block;margin-top:14px">
                <b style="display:flex;gap:8px;align-items:center;font-size:13px;margin-bottom:10px">
                  ${ms('list_alt')}Rincian Komponen Tagihan (${primaryBill.items.length} Komponen)
                </b>
                <div class="grid g4" style="margin:0">
                  ${primaryBill.items.map((it) => `
                    <div class="card" style="padding:10px 12px;box-shadow:none;background:#fff;border:1px solid var(--line)">
                      <small style="color:var(--muted);display:block;font-size:11px">${esc(it.description || it.category || 'Biaya')}</small>
                      <b style="font-size:14px;color:var(--text)">${rp(it.amount)}</b>
                    </div>
                  `).join('')}
                </div>
              </div>
            ` : ''}
          ` : `
            <div class="ctr" style="margin-bottom:10px">
              <h3>Tagihan Sewa</h3>
              ${pill('Informasi', '')}
            </div>
            ${emptyView(
              'Belum Ada Tagihan',
              'Tagihan sewa bulanan Anda akan muncul di sini setelah diterbitkan oleh pengelola kos.',
              'receipt_long'
            )}
          `}
        </div>

        <!-- Layanan Penghuni & Pusat Bantuan Cepat -->
        <div>
          <div class="ctr" style="margin-bottom:12px">
            <h3 style="display:flex;gap:8px;align-items:center">
              ${ms('handyman')}Layanan & Pusat Bantuan
            </h3>
            <small style="color:var(--muted)">Pusat Akses Cepat</small>
          </div>
          <div class="grid g4" style="margin:0">
            <div class="svc" data-go="anggota-tagihan" style="cursor:pointer">
              <span class="si">${ms('receipt_long')}</span>
              <b>Tagihan Saya</b>
              <span>Periksa rincian faktur & bayar tagihan via QRIS/VA</span>
              <a data-go="anggota-tagihan">Buka Tagihan →</a>
            </div>

            <div class="svc" data-go="anggota-riwayat" style="cursor:pointer">
              <span class="si">${ms('history')}</span>
              <b>Riwayat Transaksi</b>
              <span>Arsip pelunasan & verifikasi integritas audit blockchain</span>
              <a data-go="anggota-riwayat">Lihat Riwayat →</a>
            </div>

            <div class="svc" data-go="anggota-layanan" style="cursor:pointer">
              <span class="si">${ms('send')}</span>
              <b>Bot Telegram</b>
              <span>Hubungkan akun untuk terima reminder tagihan instan</span>
              <a data-go="anggota-layanan">Tautkan Bot →</a>
            </div>

            <div class="svc red" data-go="anggota-layanan" style="cursor:pointer">
              <span class="si">${ms('support_agent')}</span>
              <b>Bantuan & CS</b>
              <span>Kontak darurat penjaga kos dan bantuan operasional</span>
              <a data-go="anggota-layanan">Pusat Bantuan →</a>
            </div>
          </div>
        </div>

        <!-- Riwayat Pembayaran Terakhir -->
        <div class="card">
          <div class="ctr">
            <div>
              <h3 style="font-size:16px">Riwayat Pembayaran Terakhir</h3>
              <p class="sub">Catatan pelunasan sewa yang telah tercatat di buku kas kos.</p>
            </div>
            <a data-go="anggota-riwayat" style="font-weight:600;color:var(--primary-d);cursor:pointer;font-size:13px">
              Lihat Semua ›
            </a>
          </div>

          <div style="display:grid;gap:10px;margin-top:14px">
            ${recentPayments.length > 0 ? recentPayments.map((p) => `
              <div class="hist">
                <span class="ic">${ms('task_alt')}</span>
                <div class="m">
                  <b>Pembayaran Sewa ${p.bill?.period ? `• Periode ${periodeLabel(p.bill.period)}` : ''}</b>
                  <small>
                    ${p.paid_at ? tgl(p.paid_at) : (p.created_at ? tgl(p.created_at) : '-')} • 
                    Metode: ${p.method === 'gateway' ? 'Online Gateway' : 'Manual / Kasir'}
                  </small>
                </div>
                <div style="text-align:right">
                  <b style="font-size:16px;color:var(--primary-d)">${rp(p.amount)}</b>
                  <div>
                    ${p.status === 'success'
                      ? pill('Lunas', 'ok')
                      : (p.status === 'pending' ? pill('Pending', 'warn') : pill(esc(p.status), ''))}
                  </div>
                </div>
              </div>
            `).join('') : `
              ${emptyView(
                'Belum Ada Riwayat Transaksi',
                'Pembayaran yang telah selesai diverifikasi akan tercatat secara permanen di sini.',
                'history'
              )}
            `}
          </div>
        </div>
      </div>

      <!-- Kolom Kanan: Info Kamar Hunian & Integrasi -->
      <div style="display:grid;gap:16px;min-width:0">
        <!-- Informasi Kamar Hunian -->
        <div class="card">
          <div class="ctr" style="margin-bottom:12px">
            <h3 style="font-size:16px;display:flex;gap:8px;align-items:center">
              ${ms('meeting_room')}Informasi Kamar
            </h3>
            ${pill('Aktif Huni', 'ok')}
          </div>

          <div class="note" style="display:block;margin-bottom:14px;background:var(--c1)">
            <small style="color:var(--muted);text-transform:uppercase;letter-spacing:.05em;font-size:10px">UNIT KAMAR HUNIAN</small>
            <div style="font-size:22px;font-weight:700;color:var(--primary-d);margin:2px 0">
              ${roomNumber ? `Kamar ${esc(roomNumber)}` : 'Kamar Penghuni'}
            </div>
            <small style="color:var(--muted)">${roomType ? esc(roomType) : 'Kamar Kos Standard'}</small>
          </div>

          <div style="display:grid;gap:8px;font-size:13px;margin-bottom:16px">
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--c1)">
              <span style="color:var(--muted)">Nama Penyewa</span>
              <b>${esc(user.name)}</b>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--c1)">
              <span style="color:var(--muted)">Username Akun</span>
              <span class="mono">@${esc(user.username)}</span>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--c1)">
              <span style="color:var(--muted)">Nomor Unit</span>
              <b>${esc(roomNumber || '-')}</b>
            </div>
            <div style="display:flex;justify-content:space-between;padding:6px 0">
              <span style="color:var(--muted)">Status Sewa</span>
              <span style="color:var(--primary);font-weight:600">Aktif Terdaftar</span>
            </div>
          </div>

          <div style="display:grid;gap:8px">
            <a data-go="anggota-kamar" class="linkrow" style="cursor:pointer">
              <span style="display:flex;gap:8px;align-items:center">${ms('meeting_room')}Detail Kamar Saya</span>
              ${ms('chevron_right')}
            </a>
            <a data-go="anggota-tagihan" class="linkrow" style="cursor:pointer">
              <span style="display:flex;gap:8px;align-items:center">${ms('receipt_long')}Daftar Tagihan Saya</span>
              ${ms('chevron_right')}
            </a>
            <a data-go="anggota-riwayat" class="linkrow" style="cursor:pointer">
              <span style="display:flex;gap:8px;align-items:center">${ms('history')}Arsip & Bukti Pembayaran</span>
              ${ms('chevron_right')}
            </a>
            <a data-go="anggota-profil" class="linkrow" style="cursor:pointer">
              <span style="display:flex;gap:8px;align-items:center">${ms('person')}Profil Akun Saya</span>
              ${ms('chevron_right')}
            </a>
          </div>
        </div>

        <!-- Card Notifikasi Telegram -->
        <div class="card">
          <div class="ctr" style="margin-bottom:10px">
            <h3 style="font-size:15px;display:flex;gap:8px;align-items:center">
              ${ms('send')}Notifikasi Telegram
            </h3>
            ${dash.linked_telegram ? pill('Aktif', 'ok') : pill('Belum Aktif', '')}
          </div>

          ${dash.linked_telegram ? `
            <div class="note" style="padding:12px;background:var(--c2)">
              <span style="display:flex;gap:8px;align-items:center;color:var(--primary-d)">
                ${ms('verified')}
                <span>Akun Telegram Anda telah terhubung. Anda akan menerima notifikasi otomatis saat tagihan baru terbit dan pengingat jatuh tempo.</span>
              </span>
            </div>
          ` : `
            <p style="font-size:12px;color:var(--muted);margin:0 0 12px">
              Hubungkan akun Telegram Anda untuk menerima pemberitahuan instan saat tagihan baru terbit dan pengingat sebelum tanggal jatuh tempo.
            </p>
            <button class="btn s sm" style="width:100%" data-go="anggota-layanan">
              ${ms('link')}Hubungkan Bot Telegram
            </button>
          `}
        </div>

        <!-- Jaminan Keamanan & Integritas Data -->
        <div class="note" style="display:flex;gap:12px;padding:16px;background:var(--c2)">
          <span class="ic" style="width:36px;height:36px;border-radius:10px;background:#fff;display:grid;place-items:center;flex:none;color:var(--primary)">
            ${ms('verified_user')}
          </span>
          <div style="font-size:12px">
            <b style="color:var(--primary-d);font-size:13px;display:block;margin-bottom:4px">
              Transparansi KosLedger
            </b>
            <span style="color:var(--muted)">
              Seluruh transaksi sewa divalidasi langsung oleh sistem buku kas terenkripsi untuk kuitansi digital yang bebas manipulasi.
            </span>
          </div>
        </div>
      </div>
    </div>
  `;

  return {
    html,
    after() {
      // Event handling jika diperlukan
    },
  };
}
