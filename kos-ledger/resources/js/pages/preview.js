// SEMENTARA: hanya untuk mengecek tampilan komponen dengan data contoh. Hapus setelah Bagian 3 selesai.
import { pageHead, pill, avatar } from '../components/ui.js';
import { statCard, dataTable, searchField } from '../components/widgets.js';
import { barChart, donut, legend } from '../components/charts.js';
import { rp, tgl, periodeLabel } from '../utils/format.js';

export default function preview() {
  const rows = [
    ['Satu', 'A-01', 1500000, '2026-11-10', 'Belum Dibayar'],
    ['Dua', 'A-02', 1500000, '2026-11-10', 'Lunas'],
    ['Tiga', 'B-01', 2000000, '2026-11-10', 'Belum Dibayar'],
  ].map(([n, k, v, d, st]) => ({
    cls: st === 'Lunas' ? '' : 'hl',
    cells: [
      `<div class="cell">${avatar(n[0])}<span><b>Penghuni ${n}</b><small>${periodeLabel('2026-11')}</small></span></div>`,
      `<span class="chip">${k}</span>`,
      `<span class="num">${rp(v)}</span>`,
      tgl(d),
      pill(st, st === 'Lunas' ? 'ok dot' : 'err dot'),
    ],
  }));

  return {
    html: `
      ${pageHead({ eyebrow: 'DATA CONTOH', txt: 1, dot: 1, title: 'Pratinjau Komponen', sub: 'Halaman sementara untuk mengecek kartu angka, tabel, grafik, dan tampilan kosong.' })}
      <div class="grid g4">
        ${statCard('Total Pemasukan', 'Rp 12.500.000', pill('↑ 12,5%', 'ok'), 'payments')}
        ${statCard('Total Pengeluaran', 'Rp 3.250.000', pill('↓ 4,2%'), 'account_balance_wallet')}
        ${statCard('Belum Dibayar', 'Rp 3.500.000', pill('2 Kamar', 'err'), 'assignment_late', { cls: 'red' })}
        ${statCard('Saldo Kas', 'Rp 9.250.000', 'Margin 74%', 'savings', { cls: 'dark' })}
      </div>
      <div class="grid g21">
        <div class="card"><h3>Arus Kas</h3>
          <div class="chartbox" style="margin-top:12px">${barChart(['Sep', 'Okt', 'Nov'], [11.9, 12.3, 12.5], [3.3, 3.7, 3.25])}</div>
        </div>
        <div class="card"><h3>Pengeluaran</h3>
          <div class="donutwrap" style="margin-top:16px;flex-direction:column;align-items:stretch">
            <div style="width:170px;margin:0 auto">${donut([44.6, 24.6, 20, 10.8], '<span>Total</span><b>3,25 Jt</b>')}</div>
            ${legend([['Listrik & Air', '44,6%'], ['Kebersihan', '24,6%'], ['Internet', '20,0%'], ['Perawatan', '10,8%']])}
          </div>
        </div>
      </div>
      <div class="card" style="margin-bottom:16px">
        <div class="filter">${searchField('Cari penghuni atau kamar...', 'tprev')}</div>
        ${dataTable(['Penghuni', 'Kamar', '>Nominal', 'Jatuh Tempo', 'Status'], rows, { id: 'tprev', min: 640 })}
      </div>
      <div class="card">
        <h3>Contoh tampilan kosong</h3>
        ${dataTable(['Penghuni', 'Kamar'], [], { emptyTitle: 'Belum ada tagihan', emptyText: 'Tagihan yang diterbitkan akan muncul di sini.', emptyIcon: 'receipt_long' })}
      </div>`,
  };
}