import { getBills, getBill } from '../../api/bills.js';
import { go } from '../../core/router.js';
import { pageHead, pill, ms, kvs } from '../../components/ui.js';
import { statCard } from '../../components/widgets.js';
import { emptyView, errorView } from '../../components/states.js';
import { esc, rp, tgl, periodeLabel } from '../../utils/format.js';

function hitungDurasi(startDate) {
  if (!startDate) return 'Masa tinggal aktif';
  try {
    const start = new Date(startDate);
    const now = new Date();
    let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth());
    if (months <= 0) return 'Bulan pertama';
    const years = Math.floor(months / 12);
    months = months % 12;
    if (years > 0) return `${years} tahun ${months} bulan`;
    return `${months} bulan berjalan`;
  } catch {
    return 'Masa tinggal aktif';
  }
}

export default async function rooms({ user }) {
  let bills = [];
  let detailedBill = null;

  try {
    const res = await getBills();
    bills = res?.data || res || [];
    if (!Array.isArray(bills)) bills = [];

    // Cari tagihan yang memuat relasi occupancy kamar
    const billWithRoom = bills.find((b) => b.occupancy?.room?.room_number) || bills[0];
    if (billWithRoom?.id) {
      try {
        detailedBill = await getBill(billWithRoom.id);
      } catch {
        detailedBill = billWithRoom;
      }
    }
  } catch (err) {
    return {
      html: `
        <div style="padding:16px 0">
          ${pageHead({
            title: 'Informasi Kamar Saya',
            sub: 'Detail spesifikasi unit kamar dan masa sewa penghuni.',
          })}
          ${errorView(err.message || 'Gagal memuat data kamar Anda.')}
          <div style="margin-top:16px">
            <button class="btn s" id="btn-retry-room">${ms('refresh')}Muat Ulang Halaman</button>
          </div>
        </div>
      `,
      after() {
        document.getElementById('btn-retry-room')?.addEventListener('click', () => go('anggota-kamar'));
      },
    };
  }

  // Jika penghuni belum memiliki data tagihan / penempatan kamar
  const occupancy = detailedBill?.occupancy || null;
  const room = occupancy?.room || null;

  if (!occupancy && !room) {
    return {
      html: `
        <div style="padding:16px 0">
          ${pageHead({
            title: 'Informasi Kamar Saya',
            sub: 'Detail spesifikasi unit kamar dan masa sewa penghuni.',
          })}
          ${emptyView(
            'Belum Ada Data Penempatan Kamar',
            'Informasi kamar hunian Anda belum terdaftar di sistem. Silakan konfirmasi penempatan ke pengelola atau bendahara kos.',
            'meeting_room'
          )}
          <div style="margin-top:16px;text-align:center">
            <button class="btn s" data-go="anggota">${ms('dashboard')}Kembali ke Dashboard</button>
          </div>
        </div>
      `,
      after() {},
    };
  }

  const roomNumber = room?.room_number || '-';
  const roomType = room?.type || 'Reguler';
  const startDate = occupancy?.start_date || null;
  const endDate = occupancy?.end_date || null;
  const occStatus = occupancy?.status || 'active';
  const durasiText = hitungDurasi(startDate);

  // Cari item sewa pokok pada items tagihan jika tersedia
  const items = detailedBill?.items || [];
  const sewaItem = items.find(
    (it) => it.category?.toLowerCase() === 'sewa' || it.description?.toLowerCase().includes('sewa')
  );
  const monthlyRate = sewaItem?.amount || detailedBill?.total_amount || 0;

  const html = `
    <!-- Header Halaman -->
    ${pageHead({
      title: 'Informasi Kamar Saya',
      sub: 'Detail spesifikasi unit kamar hunian, periode masa sewa, dan fasilitas terdaftar.',
      acts: `
        <span class="pill ok dot">${ms('check_circle')}Status: ${occStatus === 'active' ? 'Sewa Aktif' : esc(occStatus)}</span>
        <button class="btn s" data-go="anggota-tagihan">${ms('receipt_long')}Tagihan Kamar</button>
      `,
    })}

    <!-- Banner Cover Kamar Hunian -->
    <div class="card" style="margin-bottom:16px;padding:20px 24px;background:linear-gradient(135deg, var(--c2) 0%, var(--c1) 100%);border:1px solid var(--c3)">
      <div class="ctr" style="align-items:flex-start;flex-wrap:wrap;gap:16px">
        <div style="display:flex;gap:16px;align-items:center">
          <span class="stat" style="margin:0">
            <span class="ic" style="position:static;width:56px;height:56px;border-radius:16px;background:var(--primary);color:#fff">
              ${ms('meeting_room')}
            </span>
          </span>
          <div>
            <span class="lbl" style="font-size:11px;color:var(--primary-d)">KAMAR HUNIAN TERDAFTAR</span>
            <h1 style="margin:2px 0;font-size:26px;color:var(--text)">Kamar ${esc(roomNumber)}</h1>
            <small style="color:var(--muted)">Kost Griya Asri • ${esc(roomType)} • Penghuni: <b>${esc(user.name)}</b></small>
          </div>
        </div>
        <div style="text-align:right;min-width:0">
          <span class="lbl" style="font-size:11px">TARIF SEWA BERJALAN</span><br>
          <b style="font-size:24px;color:var(--primary-d);white-space:nowrap">${rp(monthlyRate)}</b>
          <small style="color:var(--muted);display:block">/ periode bulan</small>
        </div>
      </div>
    </div>

    <!-- Statistik Ringkasan Kamar -->
    <div class="grid g4" style="margin-bottom:20px">
      ${statCard(
        'NOMOR UNIT',
        `Kamar ${esc(roomNumber)}`,
        `<span style="color:var(--primary);font-weight:600">✓ Unit Terverifikasi</span>`,
        'meeting_room'
      )}

      ${statCard(
        'TARIF SEWA',
        rp(monthlyRate),
        `<span style="color:var(--muted)">Tagihan reguler bulanan</span>`,
        'payments'
      )}

      ${statCard(
        'MULAI SEWA',
        startDate ? tgl(startDate) : '-',
        `<span style="color:var(--text);font-weight:500">${durasiText}</span>`,
        'calendar_month'
      )}

      ${statCard(
        'STATUS HUNIAN',
        occStatus === 'active' ? 'Aktif Menempati' : esc(occStatus),
        endDate ? `<span style="color:var(--err)">s.d. ${tgl(endDate)}</span>` : '<span style="color:var(--primary)">Sewa Berkelanjutan</span>',
        'verified_user'
      )}
    </div>

    <!-- Layout Grid 2 Kolom -->
    <div class="grid g21" style="align-items:start">
      <!-- Kolom Kiri: Spesifikasi & Fasilitas Kamar -->
      <div style="display:grid;gap:16px;min-width:0">
        <!-- Kartu Spesifikasi Kamar -->
        <div class="card">
          <div class="ctr" style="margin-bottom:14px">
            <h3 style="display:flex;gap:8px;align-items:center">
              ${ms('inventory_2')}Spesifikasi & Detail Hunian
            </h3>
            ${pill('Data Administrasi', '')}
          </div>

          <div class="tiles" style="margin-bottom:16px">
            <div class="tile">
              ${ms('meeting_room')}
              <span>Nomor Kamar<b>Kamar ${esc(roomNumber)}</b></span>
            </div>
            <div class="tile">
              ${ms('badge')}
              <span>Tipe Hunian<b>${esc(roomType)}</b></span>
            </div>
            <div class="tile">
              ${ms('event')}
              <span>Tanggal Masuk<b>${startDate ? tgl(startDate) : '-'}</b></span>
            </div>
            <div class="tile">
              ${ms('hourglass_bottom')}
              <span>Durasi Menempati<b>${durasiText}</b></span>
            </div>
          </div>

          <div style="border-top:1px solid var(--c1);padding-top:14px">
            <h4 style="font-size:14px;margin-bottom:10px;color:var(--primary-d)">Parameter Sewa Terdaftar</h4>
            ${kvs([
              ['Nama Penyewa Terdaftar', esc(user.name)],
              ['Username Akun', `@${esc(user.username)}`],
              ['Unit Kamar', `Kamar ${esc(roomNumber)} (${esc(roomType)})`],
              ['Status Penempatan', `<span style="color:var(--primary);font-weight:600">● ${occStatus === 'active' ? 'Aktif Terverifikasi' : esc(occStatus)}</span>`],
              ['Tanggal Mulai Kontrak', startDate ? tgl(startDate) : '-'],
              ['Batas Akhir Kontrak', endDate ? tgl(endDate) : 'Tidak dibatasi (Bulanan Teratur)'],
              ['Tarif Pokok Sewa', rp(monthlyRate)],
            ])}
          </div>
        </div>

        <!-- Kartu Rincian Komponen Biaya Kamar -->
        <div class="card">
          <div class="ctr" style="margin-bottom:12px">
            <div>
              <h3 style="font-size:16px;display:flex;gap:8px;align-items:center">
                ${ms('list_alt')}Komponen Biaya & Fasilitas Terkait
              </h3>
              <p class="sub">Rincian komponen biaya yang melekat pada tagihan kamar Anda.</p>
            </div>
            ${detailedBill?.period ? pill(`Periode ${periodeLabel(detailedBill.period)}`, '') : ''}
          </div>

          ${items.length > 0 ? `
            <div style="display:grid;gap:8px;margin-top:10px">
              ${items.map((it) => `
                <div class="note" style="justify-content:space-between;align-items:center;padding:12px 14px">
                  <div style="display:flex;gap:10px;align-items:center">
                    <span class="ic" style="width:36px;height:36px;border-radius:10px;background:#fff;display:grid;place-items:center;color:var(--primary);flex:none">
                      ${ms('check')}
                    </span>
                    <div>
                      <b style="font-size:14px;color:var(--text)">${esc(it.description || it.category || 'Biaya')}</b>
                      <small style="color:var(--muted);display:block">Kategori: ${esc(it.category || 'Operasional')}</small>
                    </div>
                  </div>
                  <b style="font-size:15px;color:var(--primary-d)">${rp(it.amount)}</b>
                </div>
              `).join('')}
            </div>

            <div class="note" style="margin-top:14px;justify-content:space-between;align-items:center;background:var(--c1)">
              <b>Total Komponen Tagihan Berjalan</b>
              <b style="font-size:18px;color:var(--primary-d)">${rp(detailedBill?.total_amount || monthlyRate)}</b>
            </div>
          ` : `
            <div class="note" style="padding:14px;background:var(--c1)">
              ${ms('info')}
              <span>Fasilitas standar kamar mencakup sewa kamar pokok sebesar <b>${rp(monthlyRate)}</b> per periode. Rincian item rinci akan ditampilkan otomatis mengikuti invoice aktif.</span>
            </div>
          `}
        </div>
      </div>

      <!-- Kolom Kanan: Panduan & Pintasan Cepat -->
      <div style="display:grid;gap:16px;min-width:0">
        <!-- Ketentuan Sewa & Tata Tertib -->
        <div class="card">
          <div class="ctr" style="margin-bottom:10px">
            <h3 style="font-size:15px;display:flex;gap:8px;align-items:center">
              ${ms('gavel')}Ketentuan & Hak Huni
            </h3>
            ${pill('Tata Tertib', '')}
          </div>

          <p style="font-size:12px;color:var(--muted);line-height:1.5;margin:0 0 12px">
            Hak menempati Kamar ${esc(roomNumber)} berlaku selama Anda terdaftar sebagai penghuni aktif dan menyelesaikan pembayaran sewa sebelum tanggal jatuh tempo setiap bulannya.
          </p>

          <div class="note" style="display:block;margin-bottom:12px;font-size:12px">
            <span style="font-weight:600;display:block;margin-bottom:4px;color:var(--primary-d)">
              ${ms('verified')} Jaminan Hak Penghuni:
            </span>
            <span>Kamar tidak dapat dialihkan atau disewakan ke pihak lain tanpa persetujuan tertulis dari pemilik kos.</span>
          </div>

          <div style="display:grid;gap:8px">
            <a data-go="anggota-tagihan" class="linkrow" style="cursor:pointer">
              <span style="display:flex;gap:8px;align-items:center">${ms('receipt_long')}Tagihan Sewa Kamar Ini</span>
              ${ms('chevron_right')}
            </a>
            <a data-go="anggota-riwayat" class="linkrow" style="cursor:pointer">
              <span style="display:flex;gap:8px;align-items:center">${ms('history')}Histori Pembayaran Kamar</span>
              ${ms('chevron_right')}
            </a>
            <a data-go="anggota-layanan" class="linkrow" style="cursor:pointer">
              <span style="display:flex;gap:8px;align-items:center">${ms('support_agent')}Layanan & Lapor Kendala</span>
              ${ms('chevron_right')}
            </a>
          </div>
        </div>

        <!-- Bantuan Kendala Kamar -->
        <div class="card">
          <div class="ctr" style="margin-bottom:10px">
            <h3 style="font-size:15px;display:flex;gap:8px;align-items:center">
              ${ms('handyman')}Pusat Bantuan Cepat
            </h3>
          </div>
          <p style="font-size:12px;color:var(--muted);margin:0 0 12px">
            Jika terjadi kendala pada unit Kamar ${esc(roomNumber)} seperti kebocoran kran, perbaikan listrik, atau kendala fasilitas lainnya, laporkan segera melalui layanan bantuan.
          </p>
          <button class="btn s" style="width:100%" data-go="anggota-layanan">
            ${ms('support_agent')}Hubungi Pengelola Kos
          </button>
        </div>

        <!-- Keamanan & Transparansi Data -->
        <div class="note" style="display:flex;gap:12px;padding:16px;background:var(--c2)">
          <span class="ic" style="width:36px;height:36px;border-radius:10px;background:#fff;display:grid;place-items:center;flex:none;color:var(--primary)">
            ${ms('lock')}
          </span>
          <div style="font-size:12px">
            <b style="color:var(--primary-d);font-size:13px;display:block;margin-bottom:4px">
              Privasi & Isolasi Data
            </b>
            <span style="color:var(--muted)">
              Data penempatan kamar terisolasi secara ketat dan hanya dapat diakses oleh akun penghuni yang bersangkutan.
            </span>
          </div>
        </div>
      </div>
    </div>
  `;

  return {
    html,
    after() {},
  };
}
