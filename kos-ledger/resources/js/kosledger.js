// ===== KosLedger SPA Engine =====

// --- Helpers ---
const $ = s => document.querySelector(s);
const ms = n => `<span class="ms">${n}</span>`;
const rp = n => (n < 0 ? '−' : '') + 'Rp ' + Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
const pill = (t, c = '') => `<span class="pill ${c}">${t}</span>`;
const COLORS = ['#174d3b', '#4b6453', '#96d6b9', '#cde4d4', '#e1ede4'];
const av = (t, bg) => `<span class="avatar" style="${bg ? `background:${bg};color:#fff` : ''}">${t}</span>`;
const initials = n => n.split(/\s+/).slice(0, 2).map(x => x[0]).join('').toUpperCase();
const numfmt = v => parseInt(String(v).replace(/\D/g, '')) || 0;
const fsize = b => b > 1e6 ? (b / 1e6).toFixed(1) + ' MB' : Math.round(b / 1e3) + ' KB';

function tbl(cols, rows, min = 720, id = '') {
  return `<div class="tw"><table${id ? ` id="${id}"` : ''} style="min-width:${min}px">
    <thead><tr>${cols.map(c => `<th${c[0] === '>' ? ' class="r"' : ''}>${c.replace(/^>/, '')}</th>`).join('')}</tr></thead>
    <tbody>${rows.map(r => `<tr${r.cls ? ` class="${r.cls}"` : ''}>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>`;
}

const stat = (l, v, f, ic, o = {}) =>
  `<div class="card stat ${o.cls || ''}">
    <span class="l">${l}</span>
    <span class="v ${o.sm ? 'sm' : ''}">${v}</span>
    <span class="f">${f || ''}</span>
    ${ic ? `<span class="ic">${ms(ic)}</span>` : ''}
  </div>`;

const sel = (t, ic) => `<span class="sel">${ic ? ms(ic) : ''}${t}${ms('expand_more')}</span>`;
const pager = txt => `<div class="foot"><span>${txt}</span><div class="pg">
  <button>${ms('chevron_left')}</button>
  <button class="on">1</button><button>2</button><button>3</button>
  <button>${ms('chevron_right')}</button>
</div></div>`;
const searchField = (ph, tid) => `<label class="field">${ms('search')}<input placeholder="${ph}" data-filter="${tid}" aria-label="${ph}"></label>`;


// --- Charts ---
function bars(labels, a, b, max, h = 200) {
  const W = 560, pl = 8, gap = (W - pl * 2) / labels.length;
  let s = `<svg viewBox="0 0 ${W} ${h + 34}" role="img" aria-label="Grafik arus kas">`;
  [0, .5, 1].forEach(t => {
    const y = h - t * (h - 10);
    s += `<line x1="0" x2="${W}" y1="${y}" y2="${y}" stroke="#dbe6de" stroke-dasharray="4 4"/>`;
  });
  labels.forEach((l, i) => {
    const x = pl + i * gap + gap / 2 - 22;
    const ha = a[i] / max * (h - 10), hb = b[i] / max * (h - 10);
    const last = i === labels.length - 1;
    s += `<rect x="${x}" y="${h - ha}" width="26" height="${ha}" rx="3" fill="${last ? '#003526' : '#174d3b'}"/>`;
    s += `<rect x="${x + 28}" y="${h - hb}" width="16" height="${hb}" rx="3" fill="${last ? '#4b6453' : '#dfe9e2'}"/>`;
    s += `<text x="${x + 22}" y="${h + 22}" text-anchor="middle" font-size="12" fill="${last ? '#003526' : '#404944'}" font-weight="${last ? 700 : 400}" font-family="Plus Jakarta Sans,sans-serif">${l}</text>`;
  });
  return s + '</svg>';
}

function donut(vals, center) {
  const tot = vals.reduce((x, y) => x + y, 0);
  const R = 42, C = 2 * Math.PI * R;
  let off = 0, s = `<svg viewBox="0 0 120 120" role="img"><g transform="rotate(-90 60 60)">`;
  vals.forEach((v, i) => {
    const len = v / tot * C;
    s += `<circle cx="60" cy="60" r="${R}" fill="none" stroke="${COLORS[i]}" stroke-width="16" stroke-dasharray="${len - 1.5} ${C - len + 1.5}" stroke-dashoffset="${-off}"/>`;
    off += len;
  });
  return `<div class="dn">${s}</g></svg><div class="c">${center}</div></div>`;
}

function legendHtml(items) {
  return `<div class="legend">${items.map((it, i) =>
    `<div class="li" style="grid-template-columns:auto 1fr auto">
      <i style="background:${COLORS[i]}"></i>
      <span>${it[0]}</span>
      <b style="font-weight:500">${it[1]}</b>
    </div>`
  ).join('')}</div>`;
}

const ring = p => {
  const R = 26, C = 2 * Math.PI * R;
  return `<svg width="64" height="64" viewBox="0 0 64 64">
    <circle cx="32" cy="32" r="${R}" fill="none" stroke="#dfebe3" stroke-width="7"/>
    <circle cx="32" cy="32" r="${R}" fill="none" stroke="#174d3b" stroke-width="7" stroke-linecap="round"
      stroke-dasharray="${C * p} ${C}" transform="rotate(-90 32 32)"/>
  </svg>`;
};


// --- State ---
const S = { role: null, paid: false, user: null };
const ACCOUNTS = {
  'bendahara@kosledger.id': { pw: 'kos12345', role: 'bendahara', name: 'Siti Rahma' },
  'penghuni@kosledger.id':  { pw: 'kos12345', role: 'penghuni',  name: 'Andi Pratama' },
  'pemilik@kosledger.id':   { pw: 'kos12345', role: 'pemilik',   name: 'Bpk. H. Rahmat Santoso' }
};
const ROLENAME = { bendahara: 'Bendahara', penghuni: 'Penghuni', pemilik: 'Pemilik' };
const HOME     = { bendahara: 'bendahara', penghuni: 'penghuni', pemilik: 'pemilik' };
let   LR       = 'bendahara';
let   payChoice = 'qris';
let   stTab    = 'ok';
let   nTab     = 'all';
let   feedTab  = 'Semua Mutasi';
let   rwySel   = 0;
let   curForm  = null;
const UP       = {};
let   NID      = 100;
let   R        = { step: 1, d: {} };

// --- Data ---
const kamarRows = [
  ['A-01','Kamar A-01','Lt. 1 • Depan Taman','Deluxe AC','3 x 4 Meter • KM Dalam',1500000,'Terisi'],
  ['A-02','Kamar A-02','Lt. 1 • Rangin','Deluxe AC','3 x 4 Meter • KM Dalam',1500000,'Terisi'],
  ['A-03','Kamar A-03','Lt. 1 • Sudut Tenang','Reguler AC','3 x 3 Meter • KM Dalam',1450000,'Terisi'],
  ['B-01','Kamar B-01','Lt. 2 • Balkon Depan','Deluxe AC','3 x 4 Meter • KM Dalam • Balkon',1750000,'Terisi'],
  ['B-02','Kamar B-02','Lt. 2 • Rangin','Reguler AC','3 x 3 Meter • KM Dalam',1200000,'Terisi'],
  ['B-05','Kamar B-05','Lt. 2 • Atas Rooftop','Reguler AC','3 x 3 Meter • KM Dalam',1450000,'Tersedia'],
  ['C-01','Kamar C-01','Lt. 3 • Depan Parkir','Standar Non-AC','3 x 3 Meter • Exhaust Fan',1350000,'Terisi']
];

const penghuniRows = [
  ['NW','#174d3b','Nabila Putri Wardani','"Nabila" • Mahasiswi UI','0812-3456-7890','Kamar A-02','Deluxe AC • Lantai 1','10 Jan 2023','1 thn 4 bln','Aktif'],
  ['RM','#4b6453','Riska Maharani Dewi','"Riska" • Karyawan Swasta','0821-9876-5432','Kamar B-02','Reguler AC • Lantai 2','15 Mar 2024','2 bln','Aktif'],
  ['FU','#ffdad6','Farida Utami','"Farida" • Bekerja di BUMN','0857-1122-3344','Kamar B-04','Reguler AC • Lantai 2','01 Jun 2023','11 bln','Akan Keluar'],
  ['DK','#cbe7d0','Dinda Kirana Maharani','"Dinda" • Mahasiswi Kedokteran','0813-7788-9900','Kamar A-01','Deluxe AC • Lantai 1','20 Agu 2023','9 bln','Aktif'],
  ['AZ','#3a3f3c','Annisa Zahra Almira','"Zahra" • Freelance Designer','0819-0123-4567','Kamar B-01','Reguler AC • Lantai 2','02 Mei 2024','20 hari','Aktif'],
  ['TL','#174d3b','Tiara Larasati','"Tiara" • Guru Les Privat','0878-4321-9876','Kamar A-03','Deluxe AC • Lantai 1','12 Des 2023','5 bln','Aktif'],
  ['PA','#cbe7d0','Putri Ayu Lestari','"Ayu" • Staff Administrasi','0896-5544-3322','Kamar B-03','Reguler AC • Lantai 2','10 Mei 2024','12 hari','Aktif']
];

const tagihanRows = [
  ['001','NP','Nabila Putri Wardani','0812-3849-2091','A-02','1.500.000','10 Mei 2024','Dibayar 08 Mei','Lunas'],
  ['002','RM','Riska Maharani Dewi','0857-1920-4412','B-02','1.200.000','10 Mei 2024','Terlambat 3 hari','Jatuh Tempo'],
  ['003','FU','Farida Utami','0813-9821-0021','B-04','1.200.000','15 Mei 2024','Tersisa 2 hari','Menunggu Pembayaran'],
  ['004','DA','Dinda Ayu Lestari','0821-4432-1100','A-01','1.500.000','10 Mei 2024','Dibayar 05 Mei','Lunas'],
  ['005','SA','Salma Aulia Rachman','0819-7782-9934','C-01','1.350.000','12 Mei 2024','Dibayar 10 Mei','Lunas']
];

const PAYS = [
  { id:'TRX-202405-091', t:'18 Mei, 09:42 WIB', n:'Nabila Putri', kamar:'A-02', kanal:'QRIS BCA', ic:'qr_code_2', nom:1500000, ket:'Biaya Sewa', st:'ok', hash:'0x8f...2a' },
  { id:'TRX-202405-084', t:'17 Mei, 14:15 WIB', n:'Anisa Wijaya', kamar:'B-01', kanal:'Transfer BNI', ic:'account_balance', nom:1200000, ket:'Biaya Sewa', st:'ok', hash:'0x4e...f2' },
  { id:'TRX-202405-079', t:'16 Mei, 18:30 WIB', n:'Dewi Lestari', kamar:'A-05', kanal:'Mandiri Livin', ic:'smartphone', nom:1800000, ket:'Sewa + Listrik', st:'wait', hash:'', bukti:'bukti-transfer-dewi.jpg' },
  { id:'TRX-202405-062', t:'15 Mei, 11:05 WIB', n:'Rina Ramadhani', kamar:'C-03', kanal:'Kas Tunai', ic:'payments', nom:1100000, ket:'Biaya Sewa', st:'ok', hash:'0x1c...4c' }
];

const keluarRows = [
  ['Listrik','bolt','Token Listrik Utama Rumah Kost 3500 VA','No Meter: 3214-9981-2231',1450000,'17 Mei 2024','Siti Rahma (Bendahara)'],
  ['Perbaikan','build','Service Rutin AC Kamar A-04 & Cuci Filter','Vendor: Berkah Tehnik Mandiri',350000,'15 Mei 2024','Pak Joko (Pengelola)'],
  ['Air','water_drop','Tagihan PDAM Air Bersih Bulan Mei','ID Pelanggan: 0910-821-4432',280000,'12 Mei 2024','Siti Rahma (Bendahara)'],
  ['Gas','local_fire_department','Isi Ulang 2 Tabung Gas Dapur Bersama','Pangkalan Gas Barokah',44000,'10 Mei 2024','Pak Joko (Pengelola)'],
  ['Peralatan Kebersihan','cleaning_services','Pembersih Lantai, Karbol, & Sabun Dapur','Stok bulanan lantai 1 & 2',326000,'07 Mei 2024','Siti Rahma (Bendahara)'],
  ['CCTV','videocam','Pergantian Adaptor & Kabel Kamera Gerbang','Maintenance sistem pengawasan kos',150000,'05 Mei 2024','Pak Joko (Pengelola)'],
  ['Lainnya','more_horiz','Iuran Kebersihan Lingkungan RW & Keamanan RT','Iuran bulanan perumahan Griya Asri',100000,'02 Mei 2024','Siti Rahma (Bendahara)']
];

const rwyData = [
  ['TRX-202405-091','Mei 2024','02 Mei 2024','QRIS (Midtrans)','qr_code_2','#10492','0x8f4c...421c'],
  ['TRX-202404-063','April 2024','01 Apr 2024','BCA VA','account_balance','#9821','0x2ab7...3290'],
  ['TRX-202403-014','Maret 2024','03 Mar 2024','Mandiri VA','account_balance_wallet','#9102','0xdf69...1b84']
];

const jurnalRows = [
  ['02 Mei 2024','001','Masuk','Sewa Kamar A-01 (Nadia Utami)','Pembayaran sewa Mei 2024','account_balance','BCA Virtual Account',1450000,1450000],
  ['03 Mei 2024','002','Masuk','Sewa Kamar B-04 (Clarissa)','Pembayaran sewa Mei 2024','qr_code_2','QRIS Mandiri',1350000,2800000],
  ['05 Mei 2024','003','Keluar','Langganan Internet 100 Mbps','Fasilitas WiFi lantai 1 & 2','payments','Autodebet Mandiri',-650000,2150000],
  ['08 Mei 2024','004','Masuk','Sewa Kamar VIP A-07 & A-08','Pelunasan dua kamar AC','account_balance','BCA Transfer',3600000,5750000],
  ['10 Mei 2024','005','Keluar','Tagihan Listrik & Air PDAM','Idpel: 538200192801'  ,'smartphone','M-Banking BCA',-1450000,4300000],
  ['14 Mei 2024','006','Keluar','Servis AC Kamar A-02 & B-01','Teknisi Jaya Sejuk Teknik','payments','Kas Tunai',-350000,3950000],
  ['25 Mei 2024','007','Keluar','Honor Kebersihan & Keamanan','Pak Slamet (Petugas Piket)','payments','Kas Tunai',-800000,3150000],
  ['28 Mei 2024','008','Masuk','Pelunasan 14 Kamar Batch','Kolektif Host-to-Host','sync_alt','Payment Gateway',17700000,20850000]
];

const feedData = [
  ['AN','24 Mei 2024','09:42 WIB','Anisa Nurul – Sewa Kamar A-02','Periode Juni 2024','Sewa Kamar',1400000,'qr_code_2','QRIS BCA','TRX-2024-0518'],
  ['PL','22 Mei 2024','14:15 WIB','Token Listrik Utama & Pompa Air','PLN Pasca Bayar','Utilitas PLN',-650000,'payments','Kas Operasional','TRX-2024-0517'],
  ['DF','20 Mei 2024','18:05 WIB','Dewi Fatimah – Sewa Kamar B-05','Periode Juni 2024','Sewa Kamar',1650000,'account_balance','Transfer BNI','TRX-2024-0516'],
  ['WF','15 Mei 2024','10:30 WIB','Langganan Internet Biznet','Paket 150 Mbps','Internet / Wifi',-650000,'credit_card','Mandiri Auto-Debit','TRX-2024-0515'],
  ['RP','12 Mei 2024','11:10 WIB','Rina Puspita – Sewa Kamar A-07','Periode Mei 2024','Sewa Kamar',1400000,'account_balance','Mandiri VA','TRX-2024-0514']
];


// --- Notifikasi ---
let NID_CTR = 100;
const pushNotif = n => { NID_CTR++; NOTIFS.unshift(Object.assign({ id: NID_CTR, read: false, time: new Date().toLocaleString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).replace(',',' •'), detail: [] }, n)); };
const unread = r => NOTIFS.filter(n => n.roles.includes(r) && !n.read).length;
const NIC = {
  ok:   ['check_circle','#174d3b','#cbe7d0'],
  err:  ['error','#a01b23','#ffdad6'],
  warn: ['warning','#5b4300','#fff1c4'],
  info: ['info','#174d3b','#e4f1e9']
};
const nIcon = t => `<span class="nic" style="background:${NIC[t][2]};color:${NIC[t][1]}">${ms(NIC[t][0])}</span>`;

const NOTIFS = [
  { id:1, roles:['bendahara','pemilik'], type:'ok', title:'Pembayaran diterima', text:'Nabila Putri (A-02) membayar Rp 1.500.000 via QRIS BCA.', time:'18 Mei • 09:42', read:false, detail:[['No. Transaksi','TRX-202405-091'],['Nominal','Rp 1.500.000'],['Status','Lunas']], cta:['Buka Manajemen Pembayaran','bendahara-pembayaran'] },
  { id:2, roles:['bendahara'], type:'err', title:'Pembayaran gagal', text:'Rina Ramadhani (C-03): sesi QRIS kedaluwarsa.', time:'17 Mei • 20:15', read:false, detail:[['Penyewa','Rina Ramadhani • Kamar C-03'],['Status','Gagal']], act:['Kirim Pengingat','remind:Rina Ramadhani'] },
  { id:3, roles:['bendahara'], type:'warn', title:'Tagihan jatuh tempo', text:'Riska Maharani (B-02) telat 3 hari. Tunggakan Rp 1.200.000.', time:'13 Mei • 08:00', read:false, detail:[['Tagihan','#INV-2024-05-002'],['Keterlambatan','3 hari']], act:['Kirim Pengingat','remind:Riska Maharani'] },
  { id:4, roles:['bendahara'], type:'info', title:'Bukti transfer menunggu verifikasi', text:'Dewi Lestari (A-05) mengunggah bukti transfer Rp 1.800.000.', time:'16 Mei • 18:30', read:false, detail:[['Penyewa','Dewi Lestari • A-05']], act:['Periksa & Verifikasi','verify79'] },
  { id:5, roles:['bendahara','pemilik','penghuni'], type:'ok', title:'Bukti blockchain tercatat', text:'TRX-202405-091 tercatat di Sepolia, Block #10492.', time:'18 Mei • 09:42', read:true, detail:[['Block','#10492'],['TXID','0x8f4c...421c']], cta:['Lihat Riwayat Audit','penghuni-riwayat'] },
  { id:6, roles:['penghuni'], type:'warn', title:'Tagihan Juni 2024 segera jatuh tempo', text:'Rp 1.500.000 jatuh tempo 10 Juni 2024 (5 hari lagi).', time:'5 Jun • 08:00', read:false, detail:[['Nominal','Rp 1.500.000'],['Jatuh tempo','10 Juni 2024']], cta:['Bayar Sekarang','penghuni-tagihan'] },
  { id:7, roles:['penghuni'], type:'ok', title:'Pembayaran Mei 2024 lunas', text:'Kuitansi Mei 2024 sudah tersedia.', time:'8 Mei • 14:22', read:true, detail:[['Periode','Mei 2024'],['Nominal','Rp 1.500.000']], cta:['Lihat Riwayat','penghuni-riwayat'] },
  { id:8, roles:['pemilik'], type:'ok', title:'Laporan Mei 2024 siap', text:'Surplus bersih Rp 20.850.000. Rekonsiliasi 100% klop.', time:'31 Mei • 23:59', read:false, detail:[['Surplus bersih','Rp 20.850.000']], cta:['Buka Laporan','pemilik-laporan'] }
];


// --- Sidebar & Topbar ---
const MENUS = {
  bendahara: [
    ['bendahara','dashboard','Dashboard'],
    ['bendahara-kamar','meeting_room','Manajemen Kamar'],
    ['bendahara-penghuni','groups','Manajemen Penghuni'],
    ['bendahara-tagihan','receipt_long','Manajemen Tagihan'],
    ['bendahara-pembayaran','payments','Manajemen Pembayaran'],
    ['bendahara-pengeluaran','account_balance_wallet','Manajemen Pengeluaran'],
    ['bendahara-laporan','bar_chart','Laporan Keuangan'],
    ['bendahara-profil','manage_accounts','Profil']
  ],
  penghuni: [
    ['penghuni','dashboard','Dashboard Penghuni'],
    ['penghuni-tagihan','receipt_long','Tagihan Saya'],
    ['penghuni-riwayat','history','Riwayat Pembayaran'],
    ['penghuni-layanan','support_agent','Layanan & Kendala'],
    ['penghuni-profil','person','Profil Saya']
  ],
  pemilik: [
    ['pemilik','dashboard','Dashboard'],
    ['pemilik-laporan','bar_chart','Laporan Keuangan'],
    ['pemilik-riwayat','receipt_long','Riwayat Transaksi'],
    ['pemilik-profil','manage_accounts','Profil']
  ]
};

function sidebar(role, key) {
  let head, mid = '', foot;
  if (role === 'bendahara') {
    head = `<div class="logo"><span class="lg">${ms('apartment')}</span><b>KosLedger</b></div>
      <span class="badge"><i></i>Kost Putri Griya Asri</span>`;
    foot = `<div class="occ">
      <div class="r"><span>Okupansi Kos</span><b>90%</b></div>
      <div class="bar"><i style="width:90%"></i></div>
      <div class="r"><span>18/20 Kamar Terisi</span>${ms('apartment')}</div>
    </div>`;
  } else if (role === 'penghuni') {
    head = `<div class="logo"><span class="lg">${ms('apartment')}</span><div>
      <b>KosLedger</b>
      <span class="badge" style="border-radius:6px;margin-top:2px">Portal Penghuni</span>
    </div></div>`;
    mid = `<div class="sbox">
      <small>Kamar Terdaftar ${pill('Aktif','ok')}</small>
      <strong>Kamar A-04</strong>
      <span style="font-size:12px;color:var(--muted)">Kost Putri Griya Asri</span>
    </div>`;
    foot = `<div class="safe"><b>${ms('verified_user')}Pembayaran Aman</b>Sistem otomatisasi tagihan terverifikasi instan.</div>`;
  } else {
    head = `<div class="logo"><span class="lg">${ms('apartment')}</span><div>
      <b>KosLedger</b>
      <span class="badge" style="border-radius:6px;margin-top:2px">Portal Pemilik</span>
    </div></div>
    <span class="pill ok">Owner</span>`;
    mid = `<div class="sel" style="width:100%;justify-content:space-between;background:var(--c1)">${ms('location_on')}<span style="flex:1">Kost Putri Griya Asri</span>${ms('unfold_more')}</div>`;
    foot = `<div class="occ">
      <div class="r"><span class="lbl">Status Hunian</span><b>90%</b></div>
      <div class="bar"><i style="width:90%"></i></div>
      <div class="r"><span>18/20 Kamar Terisi</span><span>2 Kosong</span></div>
    </div>
    <div class="note" style="margin-top:12px;padding:10px 14px">${ms('visibility')}Mode Pantau Pemilik (Read-Only)</div>`;
  }

  const menuKey = key === 'bendahara-kamar-form' ? 'bendahara-kamar' : key;
  const menu = MENUS[role].map(m =>
    `<a data-go="${m[0]}" class="${m[0] === menuKey ? 'on' : ''}" tabindex="0">${ms(m[1])} ${m[2]}</a>`
  ).join('');

  const unr = unread(role);
  return `<aside class="side" id="side">
    ${head}${mid}
    <nav class="menu" aria-label="Menu utama">${menu}</nav>
    <div class="sfoot">${foot}</div>
  </aside>`;
}

function topbar(role) {
  const mb = `<button class="menubtn" id="menubtn" aria-label="Buka menu">${ms('menu')}</button>`;
  const bellHas = unread(role) > 0 ? 'has' : '';
  const bell = `<button class="bell ${bellHas}" data-act="notif" aria-label="Notifikasi">${ms('notifications')}</button>`;

  if (role === 'bendahara') return `<div class="top">
    ${mb}
    <div class="hello"><h2>Halo, Siti Rahma 👋</h2><small>Bendahara Kos • Periode Mei 2024</small></div>
    <label class="search">${ms('search')}<input placeholder="Cari transaksi, kamar, penghuni..." aria-label="Cari"></label>
    <span class="sp"></span>
    <button class="btn p" data-go="bendahara-pembayaran">${ms('add')}Catat Transaksi</button>
    ${bell}
    <div class="user" data-act="usermenu" tabindex="0" role="button" aria-label="Menu akun">
      <span class="avatar" style="background:var(--active)">SR</span>
      <div><b>Siti Rahma</b><small>Bendahara Kost</small></div>
    </div>
  </div>`;

  if (role === 'penghuni') return `<div class="top">
    ${mb}
    <span class="crumb" style="margin:0">${ms('apartment')}Griya Asri › <b style="font-weight:500;color:var(--text)">Portal Penghuni</b></span>
    <label class="search">${ms('search')}<input placeholder="Cari tagihan, riwayat..." aria-label="Cari"></label>
    <span class="sp"></span>
    <button class="btn s" style="border-radius:999px">${ms('headset_mic')}Bantuan & CS</button>
    ${bell}
    <div class="user" data-act="usermenu" tabindex="0" role="button" aria-label="Menu akun">
      <span class="avatar" style="background:var(--c1)">${ms('person')}</span>
      <div><b>Andi Pratama</b><small>Kamar A-04</small></div>
    </div>
  </div>`;

  return `<div class="top">
    ${mb}
    <span class="crumb" style="margin:0"><b style="font-weight:500;color:var(--text)">Kost Putri Griya Asri</b> • Portal Pemilik</span>
    <span class="sel" style="border-radius:999px;padding:5px 12px">${ms('calendar_month')}Mei 2024</span>
    <label class="search">${ms('search')}<input placeholder="Cari laporan, transaksi..." aria-label="Cari"></label>
    <span class="sp"></span>
    <span class="pill ok" style="padding:6px 12px">${ms('lock_open')}Akses Pemantauan</span>
    ${bell}
    <div class="user" data-act="usermenu" tabindex="0" role="button" aria-label="Menu akun">
      <div style="text-align:right"><b>Bpk. H. Rahmat Santoso</b><small>Pemilik Properti</small></div>
      <span class="avatar" style="background:var(--primary-d);color:#fff">HR</span>
    </div>
  </div>`;
}

function head(o) {
  return `<div class="hd"><div>
    ${o.crumb ? `<div class="crumb">${o.crumb}</div>` : ''}
    ${o.eyebrow ? `<span class="eyebrow ${o.txt ? 'txt' : ''}">${o.dot ? '<i></i>' : ''}${o.eyebrow}</span>` : ''}
    <h1>${o.title}</h1>
    ${o.sub ? `<p>${o.sub}</p>` : ''}
  </div><div class="acts">${o.acts || ''}</div></div>`;
}


// --- Pages Object ---
const P = {};

// ===== AUTH PAGES =====
const brandHTML = `<aside class="brand">
  <div class="logo"><span class="lg" style="background:#b7eed5;color:#003526">${ms('apartment')}</span><b style="color:#fff">KosLedger</b></div>
  <div>
    <h2>Keuangan kos yang rapi, terbuka, dan bisa dibuktikan.</h2>
    <p>Tagihan, pembayaran, dan laporan kas dalam satu tempat. Bukti pembayaran dicatat di blockchain supaya tidak bisa diubah-ubah.</p>
    <ul>
      <li>${ms('receipt_long')}<span>Tagihan otomatis dan pengingat tepat waktu</span></li>
      <li>${ms('qr_code_2')}<span>Bayar lewat QRIS, VA, atau transfer</span></li>
      <li>${ms('verified_user')}<span>Bukti pembayaran tercatat di Sepolia</span></li>
    </ul>
  </div>
  <small>Prototipe • Mode simulasi Midtrans Sandbox</small>
</aside>`;

const fld = (id, label, o = {}) => `<label class="mf">${label}${o.req ? ' <i>*</i>' : ''}
  ${o.type === 'select'
    ? `<select class="in" id="${id}">${o.opts.map(x => `<option>${x}</option>`).join('')}</select>`
    : o.type === 'area'
    ? `<textarea class="in" id="${id}" rows="3" placeholder="${o.ph || ''}"></textarea>`
    : `<input class="in" id="${id}" type="${o.type || 'text'}" placeholder="${o.ph || ''}" ${o.max ? `maxlength="${o.max}"` : ''} autocomplete="off">`
  }
  <span class="fe" id="e_${id}"></span>
</label>`;

P['login'] = () => ({ bare: 1, body: `<div class="auth">
  ${brandHTML}
  <main class="authm"><div class="authc">
    <h1>Masuk ke KosLedger</h1>
    <p class="sub" style="margin:8px 0 0">Pilih peran, lalu masuk dengan akun kamu.</p>
    <div class="tabs" id="lrole" style="margin:20px 0">
      ${['bendahara','penghuni','pemilik'].map(r => `<button type="button" data-lr="${r}" class="${LR===r?'on':''}">${ROLENAME[r]}</button>`).join('')}
    </div>
    <div id="lbanner"></div>
    <form id="lf" novalidate>
      ${fld('l_email','Email',{req:1,type:'email',ph:'nama@email.com'})}
      <label class="mf">Kata sandi <i>*</i>
        <span class="pwrap">
          <input class="in" id="l_pw" type="password" placeholder="Minimal 8 karakter" autocomplete="off">
          <button type="button" class="eye" data-act="eye:l_pw" aria-label="Tampilkan">${ms('visibility')}</button>
        </span>
        <span class="fe" id="e_l_pw"></span>
      </label>
      <div class="ctr" style="font-size:13px;margin:4px 0 18px">
        <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="l_rem" checked style="accent-color:var(--primary)">Ingat saya</label>
        <a data-act="forgot" style="font-weight:600;color:var(--primary);cursor:pointer">Lupa kata sandi?</a>
      </div>
      <button class="btn p" id="lbtn" type="submit" style="width:100%;padding:14px;font-size:14px">Masuk</button>
    </form>
    <button class="btn s" data-act="login-demo" style="width:100%;margin-top:10px">${ms('auto_awesome')}Isi akun contoh ${ROLENAME[LR]}</button>
    <p style="text-align:center;font-size:13px;color:var(--muted);margin:22px 0 0">
      Belum punya akun? <a data-go="register" style="font-weight:700;color:var(--primary);cursor:pointer">Daftar sekarang</a>
    </p>
  </div></main>
</div>` });

const regSteps = ['Akun', 'Peran & Kos', 'Verifikasi'];
const stepper = () => `<ol class="steps">${regSteps.map((s, i) =>
  `<li class="${R.step===i+1?'on':R.step>i+1?'done':''}">
    <span>${R.step > i + 1 ? ms('check') : i + 1}</span>${s}
  </li>`).join('')}</ol>`;

function regBody() {
  if (R.step === 1) return `
    <div class="ctr"><h3>Data akun</h3><button type="button" class="btn s sm" data-act="reg-demo">${ms('auto_awesome')}Isi data contoh</button></div>
    <div style="height:12px"></div>
    ${fld('r_name','Nama lengkap',{req:1,ph:'Contoh: Raka Aditya Putra'})}
    ${fld('r_email','Email',{req:1,type:'email',ph:'nama@email.com'})}
    ${fld('r_hp','Nomor HP',{req:1,ph:'08xx-xxxx-xxxx'})}
    <label class="mf">Kata sandi <i>*</i>
      <span class="pwrap">
        <input class="in" id="r_pw" type="password" placeholder="Minimal 8 karakter" autocomplete="off">
        <button type="button" class="eye" data-act="eye:r_pw" aria-label="Tampilkan">${ms('visibility')}</button>
      </span>
      <span class="meter"><i id="pwm"></i></span>
      <small id="pwt" style="color:var(--muted)">Kekuatan kata sandi</small>
      <span class="fe" id="e_r_pw"></span>
    </label>
    <label class="mf">Ulangi kata sandi <i>*</i>
      <input class="in" id="r_pw2" type="password" placeholder="Ketik ulang kata sandi" autocomplete="off">
      <span class="fe" id="e_r_pw2"></span>
    </label>`;

  if (R.step === 2) {
    const rl = R.d.role || '';
    return `
      <div class="ctr"><h3>Peran & data kos</h3><button type="button" class="btn s sm" data-act="reg-demo">${ms('auto_awesome')}Isi data contoh</button></div>
      <div style="height:12px"></div>
      <div class="mf">Kamu mendaftar sebagai <i>*</i></div>
      <div class="rolecards">
        ${[['pemilik','Pemilik','Memantau laporan','real_estate_agent'],['bendahara','Bendahara','Mengelola tagihan','account_balance_wallet'],['penghuni','Penghuni','Membayar tagihan','person']].map(r =>
          `<button type="button" class="rc ${rl===r[0]?'on':''}" data-rrole="${r[0]}">${ms(r[3])}<b>${r[1]}</b><small>${r[2]}</small></button>`
        ).join('')}
      </div>
      <span class="fe" id="e_role"></span>
      ${rl === 'penghuni'
        ? fld('r_code','Kode undangan kos',{req:1,ph:'GRIYA-ASRI-0604'}) + fld('r_room','Nomor kamar',{req:1,ph:'A-05'})
        : rl
        ? fld('r_kos','Nama kos',{req:1,ph:'Kost Putri Griya Asri'}) + fld('r_addr','Alamat kos',{req:1,type:'area',ph:'Jl. Sumbersari...'}) + fld('r_rooms','Jumlah kamar',{req:1,ph:'20'})
        : ''}`;
  }

  return `
    <div class="ctr"><h3>Verifikasi akun</h3><button type="button" class="btn s sm" data-act="reg-demo">${ms('auto_awesome')}Isi kode contoh</button></div>
    <p class="sub" style="margin:8px 0 18px">Kami mengirim kode 6 angka ke <b>${R.d.r_email || 'email kamu'}</b>.</p>
    <div class="otp" id="otp">${[0,1,2,3,4,5].map(i => `<input inputmode="numeric" maxlength="1" data-otp="${i}" aria-label="Digit ${i+1}">`).join('')}</div>
    <span class="fe" id="e_otp" style="display:block;text-align:center"></span>
    <p style="text-align:center;font-size:13px;color:var(--muted)">Belum menerima kode? <a data-act="resend" style="font-weight:700;color:var(--primary);cursor:pointer">Kirim ulang</a> <span id="otpt"></span></p>
    <label style="display:flex;gap:10px;align-items:flex-start;font-size:13px;margin-top:14px">
      <input type="checkbox" id="r_tos" style="accent-color:var(--primary);margin-top:3px">
      Saya setuju dengan Syarat Layanan dan Kebijakan Privasi KosLedger.
    </label>
    <span class="fe" id="e_r_tos"></span>`;
}

const regPage = () => `<div class="auth">
  ${brandHTML}
  <main class="authm"><div class="authc" style="max-width:520px">
    <h1>Buat akun KosLedger</h1>
    <p class="sub">Selesai dalam 3 langkah singkat.</p>
    ${stepper()}
    <form id="rf" novalidate>
      ${regBody()}
      <div class="ctr" style="margin-top:22px;gap:10px">
        <button type="button" class="btn" data-act="reg-back" ${R.step===1?'style="visibility:hidden"':''}}>${ms('arrow_back')}Kembali</button>
        <button class="btn p" type="submit" style="padding:12px 22px">${R.step===3?'Buat Akun':'Lanjut'}${ms(R.step===3?'check':'arrow_forward')}</button>
      </div>
    </form>
    <p style="text-align:center;font-size:13px;color:var(--muted);margin:20px 0 0">
      Sudah punya akun? <a data-go="login" style="font-weight:700;color:var(--primary);cursor:pointer">Masuk</a>
    </p>
  </div></main>
</div>`;

const regDone = () => `<div class="auth">
  ${brandHTML}
  <main class="authm"><div class="authc center" style="max-width:480px">
    <div class="seal"><i>${ms('check').replace('class="ms"','class="ms" style="font-size:36px"')}</i></div>
    <h1>Akun berhasil dibuat</h1>
    <p class="sub" style="margin:8px 0 20px">Selamat datang, <b>${R.d.r_name||''}</b>. Akunmu terdaftar sebagai <b>${ROLENAME[R.d.role]||''}</b>.</p>
    <button class="btn p" style="width:100%;padding:14px" data-act="reg-login">Masuk ke Akun</button>
  </div></main>
</div>`;

P['register'] = () => ({ bare: 1, body: R.done ? regDone() : regPage(), after: () => { if (R.step === 3 && !R.done) startOtpTimer(); } });


// ===== BENDAHARA PAGES =====

P['bendahara'] = () => ({ role: 'bendahara', body: `
${head({eyebrow:'KOST PUTRI GRIYA ASRI • FINANSIAL',txt:1,dot:1,title:'Ringkasan Keuangan Kos',sub:'Pantau arus kas, tagihan sewa kamar, dan operasional kos secara real-time',acts:`
  <span class="sel">${ms('calendar_month')}Mei 2024${ms('expand_more')}</span>
  <button class="btn">${ms('download')}Ekspor PDF/Excel</button>
  <button class="btn p" data-go="bendahara-pembayaran">${ms('add_circle')}Catat Transaksi</button>`})}
<div class="grid g4">
  ${stat('Total Pemasukan','Rp 12.500.000',pill('↑ 12,5%','ok')+'<br>18 kamar telah lunas','payments')}
  ${stat('Total Pengeluaran','Rp 3.250.000',pill('↓ -4,2%')+'<br>Efisiensi utilitas kos','account_balance_wallet')}
  ${stat('Tagihan Belum Dibayar','Rp 2.400.000',pill('2 Kamar','err')+'<br>Jatuh tempo 3 hari lagi','assignment_late',{cls:'red'})}
  ${stat('Tingkat Pelunasan','18 / 20 Kamar',pill('90% Lunas','ok')+'<br>QRIS & Transfer Bank','task_alt')}
</div>
<div class="grid g21">
  <div class="card">
    <h3>Arus Kas Bulanan</h3>
    <p class="sub">Komparasi pemasukan sewa dan pengeluaran 6 bulan terakhir</p>
    <div class="note" style="margin:16px 0;justify-content:space-between;align-items:center">
      ${ms('trending_up')}<b style="flex:1">Surplus Bersih Bulan Ini: Rp 9.250.000</b>${pill('Margin 74,0%','mint')}
    </div>
    <div class="chartbox">${bars(['Des','Jan','Feb','Mar','Apr','Mei'],[11.2,11.9,11.4,12.3,11.8,12.5],[3.7,3.3,3.9,3.7,3.3,3.25],15)}</div>
    <div class="foot"><span>Skala Maksimal: Rp 15.000.000</span><span>Rata-rata okupansi 6 bln: 88,3%</span></div>
  </div>
  <div class="card">
    <h3>Rincian Pengeluaran</h3>
    <p class="sub">Distribusi operasional bulan berjalan</p>
    <div class="donutwrap" style="margin-top:16px;flex-direction:column;align-items:stretch">
      <div style="width:170px;margin:0 auto">${donut([44.6,24.6,20,10.8],'<span>Total</span><b>3.25 Jt</b>')}</div>
      ${legendHtml([['Listrik & Air PLN/PDAM','Rp 1.450.000 (44.6%)'],['Gaji Kebersihan & Jaga','Rp 800.000 (24.6%)'],['WiFi & Internet','Rp 650.000 (20.0%)'],['Perawatan & Pompa Air','Rp 350.000 (10.8%)']])}
    </div>
  </div>
</div>
<div class="grid g21">
  <div class="card">
    <h3>Riwayat Transaksi Terkini</h3>
    <p class="sub">Pencatatan kas masuk dan keluar aktual periode Mei</p>
    ${tbl(['Tanggal','Keterangan / Penghuni','Kamar','Metode','>Nominal','Status'],[
      ['18 Mei 2024',`<div class="cell">${av('NP')}<span><b>Nabila Putri</b><small>Sewa Bulanan</small></span></div>`,`<span class="chip">A-02</span>`,'QRIS BCA',`<span class="num pos">+Rp 1.500.000</span>`,pill('Berhasil','ok')],
      ['17 Mei 2024',`<div class="cell">${av(ms('bolt'))}<span><b>Token Listrik Utama</b><small>Beban Operasional</small></span></div>`,'–','Mandiri Livin',`<span class="num neg">−Rp 500.000</span>`,pill('Keluar','err')],
      ['16 Mei 2024',`<div class="cell">${av('DK')}<span><b>Dinda Kirana</b><small>Sewa + Laundry</small></span></div>`,`<span class="chip">B-05</span>`,'Transfer BNI',`<span class="num pos">+Rp 1.650.000</span>`,pill('Berhasil','ok')],
      ['15 Mei 2024',`<div class="cell">${av(ms('build'))}<span><b>Servis AC & Filter</b><small>Maintenance</small></span></div>`,`<span class="chip">A-04</span>`,'Kas Tunai',`<span class="num neg">−Rp 250.000</span>`,pill('Keluar','err')],
      ['14 Mei 2024',`<div class="cell">${av('AZ')}<span><b>Annisa Zahra</b><small>Sewa Bulanan</small></span></div>`,`<span class="chip">C-01</span>`,'Transfer BRI',`<span class="num pos">+Rp 1.400.000</span>`,pill('Berhasil','ok')]
    ],640)}
    <div class="foot"><span>Menampilkan 5 dari 24 transaksi Mei</span>
      <a data-go="bendahara-laporan" style="font-weight:600;color:var(--primary-d);cursor:pointer;display:flex;gap:4px;align-items:center">Lihat Semua ${ms('arrow_forward')}</a>
    </div>
  </div>
  <div class="card">
    <div class="ctr">
      <div><h3>Tagihan Tertunda</h3><p class="sub">Kamar yang belum membayar</p></div>
      ${pill('2 Kamar','err')}
    </div>
    <div class="note" style="margin:16px 0;align-items:center;justify-content:space-between">
      <span style="display:flex;gap:10px;align-items:center">${ms('notifications_active')}<span>Total Tunggakan<br><b style="font-size:20px;color:var(--primary-d)">Rp 2.400.000</b></span></span>
      <small>Periode Mei</small>
    </div>
    <div class="note" style="display:block;margin-bottom:12px">
      <div class="ctr"><span><b>Riska Maharani</b> <span class="chip" style="background:#fff">Kamar B-02</span><br><small>Jatuh tempo: 20 Mei (2 hari lagi)</small></span>
        <b style="font-size:18px;color:var(--primary-d)">Rp 1.200.000</b></div>
      <div class="acts" style="margin-top:10px">
        <button class="btn s sm" style="flex:1">${ms('chat')}Kirim Pengingat WA</button>
        <button class="btn p sm">${ms('check')}Konfirmasi</button>
      </div>
    </div>
    <div class="note" style="display:block;margin-bottom:12px">
      <div class="ctr"><span><b>Farida Utami</b> <span class="chip" style="background:#fff">Kamar A-06</span><br>${pill('Telat 3 Hari','err')}</span>
        <b style="font-size:18px;color:var(--err)">Rp 1.200.000</b></div>
      <div class="acts" style="margin-top:10px">
        <button class="btn err sm" style="flex:1">${ms('chat')}Kirim Peringatan</button>
        <button class="btn p sm">${ms('check')}Konfirmasi</button>
      </div>
    </div>
    <button class="btn s" style="width:100%">${ms('mail')}Kirim Tagihan Serentak</button>
  </div>
</div>` });


P['bendahara-kamar'] = () => ({ role: 'bendahara', body: `
${head({crumb:'Proyek › <b>Katalog Kamar</b>',title:'Manajemen Kamar',sub:'Kelola unit kamar kos, tipe fasilitas, harga sewa, dan ketersediaan ocupansi.',acts:`
  <button class="btn p" data-act="open-form:kamar">${ms('add')}Tambah Kamar</button>`})}
<div class="grid g3">
  ${stat('Total Kapasitas','20 <small>Unit</small>','2 Lantai Beroperasi','domain')}
  ${stat('Kamar Terisi','18 <small>Unit</small>',pill('90% Okupansi','ok'),'meeting_room')}
  ${stat('Kamar Tersedia','2 <small>Unit</small>','Siap disewa calon penghuni','event_available')}
</div>
<div class="card">
  <div class="filter" style="margin-bottom:12px">
    ${searchField('Cari nomor kamar, tipe, atau fasilitas...','tk')}
    ${sel('Status')}
  </div>
  ${tbl(['Nomor Kamar','Tipe & Dimensi','>Harga Sewa / Bln','Status','>Aksi'],
    kamarRows.map(r => {
      const o = [
        `<div class="cell">${av(r[0].replace('-',''))}<span><b>${r[1]}</b><small>${ms('location_on').replace('class="ms"','class="ms" style="font-size:12px"')} ${r[2]}</small></span></div>`,
        `<b>${r[3]}</b><small>${r[4]}</small>`,
        `<span class="num">${rp(r[5])}</span>`,
        pill(r[6], r[6]==='Terisi'?'ok dot':'warn dot'),
        `<div class="acts" style="justify-content:flex-end"><button class="btn sm s" data-act="open-form:kamar" aria-label="Ubah">${ms('edit')}</button></div>`
      ];
      return o;
    }), 680, 'tk')}
  ${pager('Menampilkan 1 - 7 dari 20 kamar terdaftar')}
</div>` });

P['bendahara-penghuni'] = () => ({ role: 'bendahara', body: `
${head({title:'Manajemen Penghuni',sub:'Direktori data penghuni kost, riwayat kamar, kontak, dan tanggal mulai huni',acts:`
  ${searchField('Cari nama, no. HP, atau kamar...','tp')}
  ${sel('Semua Status')}
  <button class="btn p">${ms('person_add')}Tambah Penghuni</button>`})}
<div class="grid g4">
  ${stat('TOTAL PENGHUNI AKTIF','18 <small>Orang</small>','Kapasitas 90% terisi','groups')}
  ${stat('PENGHUNI BARU BULAN INI','2 <small>Orang</small>',pill('+100% vs April','ok'),'person_add')}
  ${stat('KONTRAK SEGERA BERAKHIR','1 <small>Orang</small>',pill('Kamar B-04 (7 hari)','err'),'assignment_late',{cls:'red'})}
  ${stat('VERIFIKASI KTP','100% <small>Lengkap</small>','18 berkas tervalidasi','verified_user')}
</div>
<div class="card">
  <div class="ctr"><h3>Daftar Penghuni Kost ${pill('18 Terdaftar','')}</h3><button class="btn sm">${ms('download')}Ekspor Data</button></div>
  <div style="height:12px"></div>
  ${tbl(['Nama Penghuni','No. WhatsApp','Kamar Ditempati','Mulai Masuk & Durasi','Status','>Aksi'],
    penghuniRows.map(r => {
      const bgMap = { '#ffdad6': 'background:#ffdad6;color:#a01b23', '#cbe7d0': 'background:#cbe7d0;color:#003526' };
      const avStyle = bgMap[r[1]] || `background:${r[1]};color:#fff`;
      const o = [
        `<div class="cell"><span class="avatar" style="${avStyle}">${r[0]}</span><span><b>${r[2]}</b><small>${r[3]}</small></span></div>`,
        `<span class="num" style="font-weight:500">${r[4]}</span>`,
        `<span class="chip">● ${r[5]}</span><small>${r[6]}</small>`,
        `<b style="font-weight:500">${r[7]}</b><small ${r[9]==='Akan Keluar'?'style="color:var(--err)"':''}>${r[8]}</small>`,
        r[9]==='Aktif' ? pill('Aktif','dot') : pill('Akan Keluar','err dot'),
        `<div class="acts" style="justify-content:flex-end;flex-wrap:nowrap"><button class="btn sm s">Detail</button></div>`
      ];
      if (r[9] !== 'Aktif') o.cls = 'hl';
      return o;
    }), 860, 'tp')}
  ${pager('Menampilkan 1 - 7 dari 18 penghuni')}
</div>` });

P['bendahara-tagihan'] = () => ({ role: 'bendahara', body: `
${head({crumb:'Keuangan › <b>Manajemen Tagihan</b>',title:'Manajemen Tagihan',sub:'Kelola tagihan sewa kamar bulanan, jatuh tempo, denda, dan status pembayaran',acts:`
  <button class="btn">${ms('download')}Unduh Laporan</button>
  <button class="btn p">${ms('add_circle')}Buat Tagihan</button>`})}
<div class="grid g4">
  ${stat('Total Tagihan Diterbitkan','Rp 26.500.000','20 Tagihan • Target 100% rilis','receipt_long')}
  ${stat('Tagihan Terbayar (Lunas)','Rp 24.100.000',pill('18 Tagihan (91%)','dot'),'check_circle')}
  ${stat('Belum Dibayar / Menunggak','Rp 2.400.000',pill('2 Tagihan','err dot'),'assignment_late',{cls:'red'})}
  ${stat('Rata-rata Pelunasan','H-3 Jatuh Tempo',pill('Tepat Waktu','ok'),'speed')}
</div>
<div class="card" style="margin-bottom:16px">
  <div class="filter" style="margin:0">
    ${searchField('Cari ID invoice, nama penghuni, atau kamar...','tt')}
    <div class="tabs" id="ttabs">
      <button class="on">Semua Status</button>
      <button>Lunas</button><button>Menunggu</button><button>Jatuh Tempo</button>
    </div>
    <span class="sel">${ms('calendar_month')}Periode Mei 2024${ms('expand_more')}</span>
  </div>
</div>
<div class="card">
  ${tbl(['ID Tagihan','Nama Penghuni','Nomor Kamar','Periode','>Nominal Tagihan','Jatuh Tempo','Status','>Aksi'],
    tagihanRows.map(r => {
      const st = r[8], late = st === 'Jatuh Tempo';
      const o = [
        `<b class="mono">#INV-2024-05-${r[0]}</b>`,
        `<div class="cell">${av(r[1], late ? '#ffdad6;color:#a01b23' : '')}<span><b>${r[2]}</b><small>${r[3]}</small></span></div>`,
        `<span class="chip">Kamar ${r[4]}</span>`,
        `<small>Mei 2024</small>`,
        `<span class="num ${late?'neg':''}">Rp ${r[5]}</span>`,
        `${r[6]}<small ${late?'style="color:var(--err)"':''}>${r[7]}</small>`,
        st==='Lunas' ? pill('Lunas','ok dot') : late ? pill('Jatuh Tempo','err dot') : pill('Menunggu','warn'),
        st==='Lunas'
          ? `<div class="acts" style="justify-content:flex-end">${ms('visibility')}${ms('print')}</div>`
          : `<button class="btn s sm">${ms('send')}Kirim Pesan</button>`
      ];
      if (late) o.cls = 'hl';
      return o;
    }), 980, 'tt')}
  ${pager('Menampilkan 1-5 dari 20 tagihan')}
</div>` });


const stPill = s => s==='ok' ? pill('Lunas','ok') : s==='rej' ? pill('Ditolak','err') : pill('Menunggu Verifikasi','warn');
const hashCell = p => p.st==='ok'
  ? `<span class="hash">${ms('shield')}${p.hash}</span>`
  : p.st==='rej'
  ? `<span class="hash" style="background:var(--err-bg2);color:var(--err)">Tidak dicatat</span>`
  : `<span class="hash" style="background:var(--c1)">${ms('hourglass_top')}Mempersiapkan Hash</span>`;

P['bendahara-pembayaran'] = () => ({ role: 'bendahara', body: `
<div class="card" style="margin-bottom:16px">
  <div class="hd" style="margin:0">
    <div>
      <span class="eyebrow"><i></i>Audit Trail Terdistribusi & Otomatis</span>
      <h1>Manajemen Pembayaran</h1>
      <p>Verifikasi pembayaran masuk, pencatatan otomatis, rekonsiliasi kas, dan audit bukti transaksi.</p>
    </div>
    <div class="acts" style="flex-direction:column;align-items:stretch">
      <button class="btn p">${ms('point_of_sale')}Catat Pembayaran Manual</button>
      <button class="btn s">${ms('download')}Ekspor Jurnal</button>
    </div>
  </div>
</div>
<div class="card" style="margin-bottom:16px">
  <div class="filter" style="margin:0">
    ${searchField('Cari ID transaksi, nama penyewa, nomor kamar...','tj')}
    <span class="sel">${ms('account_balance_wallet')}Semua Metode</span>
    <span class="sel">${ms('task_alt')}Semua Status</span>
    <span class="sel">${ms('calendar_month')}Mei 2024</span>
  </div>
</div>
<div class="grid g4">
  ${stat('Total Pembayaran Masuk','Rp 24.100.000',pill('↑ +8.4%','ok')+'<br>Bulan Mei 2024','payments')}
  <div class="card stat">
    <span class="l">QRIS & Dompet Digital</span>
    <span class="v sm">14 Transaksi</span>
    <span class="ic">${ms('qr_code_2')}</span>
    <span class="f" style="justify-content:space-between;display:flex"><span>Porsi Digital</span><b>78%</b></span>
    <div class="bar"><i style="width:78%"></i></div>
  </div>
  <div class="card stat">
    <span class="l">Transfer Bank Manual</span>
    <span class="v sm">4 Transaksi</span>
    <span class="ic">${ms('account_balance')}</span>
    <span class="f" style="justify-content:space-between;display:flex"><span>Porsi Bank</span><b>22%</b></span>
    <div class="bar"><i style="width:22%;background:var(--mid)"></i></div>
  </div>
  ${stat('Immutable Ledger','18 Terverifikasi','Integritas Audit Trail '+pill('100% Valid','dot'),'lock')}
</div>
<div class="grid g21" style="align-items:start">
  <div class="card">
    <h3>Jurnal Pembayaran Terkini</h3>
    <p class="sub">Transaksi terdistribusi masuk yang dicatat bendahara.</p>
    ${tbl(['ID & Waktu','Penyewa & Kamar','Kanal Bayar','>Nominal','Status','Ledger Audit'],
      PAYS.map(p => [
        `<b class="mono" style="font-size:12px">${p.id}</b><small>${p.t}</small>`,
        `<div class="cell">${av(initials(p.n))}<span><b>${p.n}</b><small>Kamar ${p.kamar}</small></span></div>`,
        `<span class="chip">${ms(p.ic)} ${p.kanal}</span>`,
        `<span class="num pos">+${rp(p.nom)}</span>`,
        stPill(p.st),
        hashCell(p)
      ]), 820, 'tj')}
    ${pager('Menampilkan 4 dari 18 transaksi')}
  </div>
  <div style="display:grid;gap:16px;min-width:0">
    <div class="card">
      <span class="lbl" style="color:var(--primary)">REKONSILIASI KAS KOS</span>
      <div class="ctr"><h3 style="font-size:20px">Rekonsiliasi Kas Kos</h3>${ms('sync_alt')}</div>
      <div class="note" style="display:block;background:var(--c2)">
        <div class="kv"><span>Penerimaan Kas Tunai</span><b>Rp 3.300.000</b></div>
        <div class="kv"><span>Penerimaan Rekening BCA</span><b>Rp 20.800.000</b></div>
        <div class="kv" style="border-top:1px solid var(--c3);padding-top:12px">
          <b style="font-size:16px">Total Terkonsolidasi</b>
          <b style="font-size:24px;color:var(--primary-d)">Rp 24.100.000</b>
        </div>
      </div>
      <div class="note" style="margin:12px 0;align-items:center">
        ${ms('verified_user')}<span><b>Selisih:</b> <b style="float:right">Rp 0 (Sesuai)</b><br>Semua mutasi telah dipasangkan.</span>
      </div>
      <button class="btn s" style="width:100%">${ms('download')}Ekspor Bukti Rekonsiliasi</button>
    </div>
    <div class="card">
      <div class="ctr"><h3 style="font-size:16px">Sertifikat Ledger</h3>${pill('Aktif','ok')}</div>
      <div class="note" style="display:block;margin:14px 0;background:var(--c1)">
        <b style="display:flex;gap:8px;align-items:center">${ms('hub')}Merkle Tree State: Valid</b>
        <p style="margin:6px 0">Blok #10492 ditandatangani otomatis pada 18 Mei 2024, 09:42:11 WIB.</p>
        <span class="mono" style="color:var(--muted)">Root: 0x9b41...f088</span>
      </div>
      <button class="btn p" style="width:100%">Kirim WhatsApp Terjadwal</button>
    </div>
  </div>
</div>` });

P['bendahara-pengeluaran'] = () => ({ role: 'bendahara', body: `
${head({eyebrow:'Buku Kas Keluar • Kost Putri Griya Asri',dot:1,title:'Manajemen Pengeluaran',sub:'Catat dan monitor seluruh pengeluaran operasional, utilitas, serta pemeliharaan kos',acts:`
  <button class="btn">${ms('download')}Ekspor PDF/Excel</button>
  <button class="btn p">${ms('add')}Tambah Pengeluaran</button>`})}
<div class="grid g4">
  ${stat('Total Pengeluaran Bulan Ini','Rp 3.250.000',pill('↘ -4.2%','ok')+'<br>vs bulan April 2024','payments')}
  <div class="card stat">
    <span class="l">Beban Utilitas Terbesar</span>
    <span class="ic">${ms('bolt')}</span>
    <span style="display:flex;justify-content:space-between;align-items:baseline">
      <span class="v sm" style="font-size:22px">Listrik PLN</span>
      <b style="font-size:12px;color:var(--primary)">44.6%</b>
    </span>
    <div class="bar"><i style="width:44.6%"></i></div>
    <span class="f">Rp 1.450.000 (Token 3500 VA)</span>
  </div>
  ${stat('Biaya Rutin / Operasional','Rp 1.450.000','Kebersihan, Wifi & Tabung Gas','cleaning_services')}
  ${stat('Perawatan Insidental','Rp 350.000','Pompa Air & Service AC A-04','build')}
</div>
<div class="card" style="margin-bottom:16px">
  <div class="ctr" style="align-items:flex-start;gap:16px">
    ${searchField('Cari nama pengeluaran, vendor, staf...','tx')}
    <div class="kg" id="kcats">
      ${['Semua','Listrik','Air','Gas','CCTV','Perbaikan','Peralatan Kebersihan','Lainnya'].map((c,i) =>
        `<button class="pill ${i?'':'dk'}" data-cat="${c}">${c}</button>`
      ).join('')}
    </div>
  </div>
</div>
<div class="card">
  ${tbl(['Kategori','Deskripsi Pengeluaran','>Nominal','Tanggal','Dicatat Oleh','Bukti Nota','>Aksi'],
    keluarRows.map(r => {
      const o = [
        `<span class="pill ok">${ms(r[1]).replace('class="ms"','class="ms" style="font-size:14px"')} ${r[0]}</span>`,
        `<b>${r[2]}</b><small>${r[3]}</small>`,
        `<span class="num neg">−${rp(r[4])}</span>`,
        r[5],
        `<div class="cell">${av(r[6][0])}<span style="font-size:12px">${r[6]}</span></div>`,
        `<button class="btn s sm">${ms('receipt')}Lihat Struk</button>`,
        `<div class="acts" style="justify-content:flex-end;gap:12px">${ms('edit')}${ms('delete')}</div>`
      ];
      o.k = r[0];
      return o;
    }), 980, 'tx')}
  <div class="foot"><span>Menampilkan <b>1 - 7</b> dari <b>7</b> transaksi</span>
    <div class="pg"><button>${ms('chevron_left')}</button><button class="on">1</button><button>${ms('chevron_right')}</button></div>
  </div>
</div>` });


P['bendahara-laporan'] = () => ({ role: 'bendahara', body: `
${head({eyebrow:'Buku Kas & Neraca Operasional',dot:1,title:'Laporan Keuangan',sub:'Laporan komprehensif pemasukan, pengeluaran, saldo kas bersih, dan ringkasan audit finansial kos.',acts:`
  <span class="sel">${ms('calendar_month')}01 Mei 2024 - 31 Mei 2024${ms('expand_more')}</span>
  <button class="btn p">${ms('download')}Ekspor Laporan ${ms('expand_more')}</button>`})}
<div class="grid g3">
  ${stat('TOTAL PEMASUKAN','Rp 24.100.000',pill('↗ +8.4% YoY','ok')+'<br>18 transaksi sewa','south')}
  ${stat('TOTAL PENGELUARAN','Rp 3.250.000',pill('Terkendali','')+'<br>6 kategori beban','north')}
  ${stat('SALDO KAS BERSIH','Rp 20.850.000',pill('Margin 86.5%','mint')+'<br>Likuiditas optimal','account_balance_wallet',{cls:'dark'})}
</div>
<div class="grid g21">
  <div class="card">
    <div class="ctr" style="align-items:flex-start">
      <div><h3>Tren Arus Kas 6 Bulan Terakhir</h3><p class="sub">Komparasi pendapatan sewa vs pengeluaran operasional</p></div>
      <span style="display:flex;gap:12px;font-size:12px"><span>● Pemasukan</span><span style="color:var(--mid)">● Pengeluaran</span></span>
    </div>
    <div class="chartbox" style="margin-top:12px">${bars(['Des','Jan','Feb','Mar','Apr','Mei'],[19.6,20.3,20.9,21.7,21.2,24.1],[2.7,2.2,2.9,2.4,2.1,3.25],26,230)}</div>
    <div class="note" style="justify-content:space-between;margin-top:8px;align-items:center">
      <span style="display:flex;gap:8px;align-items:center">${ms('trending_up')}Rata-rata surplus bulanan semester ini:</span>
      <b style="color:var(--primary-d)">Rp 19.420.000/bln</b>
    </div>
  </div>
  <div class="card">
    <div class="ctr"><h3>Distribusi Pengeluaran</h3><small style="color:var(--muted)">Total Rp 3.250.000</small></div>
    <p class="sub">Alokasi beban operasional bulanan</p>
    <div class="donutwrap" style="margin-top:14px">
      <div style="width:130px;flex:none">${donut([44.6,24.6,20,10.8],'<b>6</b><span>Pos Biaya</span>')}</div>
      ${legendHtml([['Listrik & Air (PLN/PDAM)','44.6%'],['Kebersihan & Petugas Jaga','24.6%'],['Internet & WiFi Kos','20.0%'],['Perbaikan & Pemeliharaan','10.8%']])}
    </div>
  </div>
</div>
<div class="card">
  <div class="ctr">
    <div><h3>Buku Jurnal Keuangan</h3><p class="sub">Rincian mutasi kas masuk dan keluar periode 01 - 31 Mei 2024</p></div>
    <div class="filter" style="margin:0;flex:0 1 340px">
      ${searchField('Cari nama, no. transaksi...','tl')}
    </div>
  </div>
  <div style="height:12px"></div>
  ${tbl(['Tanggal','No. Transaksi','Jenis','Kategori / Uraian','Metode','>Nominal','>Saldo Berjalan'],
    jurnalRows.map(r => [
      r[0],
      `<span class="mono" style="font-weight:500">TRX-202405-${r[1]}</span>`,
      pill((r[7]>0?'↓ ':'↑ ')+r[2], r[7]>0?'ok':'err'),
      `<b>${r[3]}</b><small>${r[4]}</small>`,
      `<span style="display:flex;gap:8px;align-items:center">${ms(r[5])} ${r[6]}</span>`,
      `<span class="num ${r[7]>0?'pos':'neg'}">${r[7]>0?'+':''}${rp(r[7])}</span>`,
      `<span class="num" style="font-weight:${r[8]===20850000?800:500}">${rp(r[8])}</span>`
    ]), 980, 'tl')}
  <div class="ctr" style="background:var(--c1);margin:0 -20px;padding:16px 20px">
    <b style="font-size:16px;color:var(--primary-d)">Ringkasan Rekonsiliasi Kas Akhir Periode (Mei 2024)</b>
    <span style="display:flex;gap:16px;align-items:center;font-size:12px">
      Total Mutasi Bersih: <b class="pos">+Rp 20.850.000</b>
      <b style="font-size:20px;color:var(--primary-d)">Rp 20.850.000</b>
    </span>
  </div>
  ${pager('Menampilkan 8 dari 24 catatan transaksi Mei 2024')}
</div>` });

P['bendahara-profil'] = () => ({ role: 'bendahara', body: `<div class="card ph">${ms('construction').replace('class="ms"','class="ms" style="font-size:40px;color:var(--sage)"')}<h2 style="color:var(--primary-d);margin:10px 0 4px">Profil</h2><p>Halaman ini sedang dalam pengembangan.</p></div>` });


// ===== PENGHUNI PAGES =====

P['penghuni'] = () => ({ role: 'penghuni', body: `
<div class="hd">
  <div>
    <h1 style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      Halo, Andi Pratama <span style="font-size:28px">👋</span>${pill('Sewa Aktif','mint dot')}
    </h1>
    <p>Selamat datang di Portal Penghuni Kost Putri Griya Asri • Periode Berjalan 2024</p>
  </div>
  <div class="acts">
    <div class="card" style="padding:10px 16px;display:flex;gap:12px;align-items:center">${ms('event')}<span><span class="lbl" style="font-size:10px">Jatuh Tempo</span><br><b>10 Juni 2024</b></span></div>
    <div class="card" style="padding:10px 16px;display:flex;gap:12px;align-items:center">${ms('wifi')}<span><span class="lbl" style="font-size:10px">Koneksi WiFi</span><br><b>GriyaAsri_Guest</b></span></div>
  </div>
</div>
<div class="paybanner">
  <span class="ic">${ms('bolt')}</span>
  <div style="flex:1 1 300px">
    <b>Pembayaran Otomatis QRIS & Virtual Account Siap Digunakan</b>
    <span>Pelunasan instan 24/7 tanpa perlu kirim bukti transfer manual via WhatsApp.</span>
  </div>
  <div class="kg">${['BCA VA','Mandiri','QRIS'].map(x => `<span class="chip" style="background:#fff">${x}</span>`).join('')}</div>
</div>
<div class="grid g21" style="align-items:start">
  <div style="display:grid;gap:16px;min-width:0">
    <div class="card">
      <div class="ctr">
        <span style="display:flex;gap:8px">${pill('PERIODE JUNI 2024','')}${S.paid ? pill('● Lunas','ok') : pill('● Belum Dibayar','err')}</span>
        <span style="font-size:12px;display:flex;gap:6px;align-items:center;color:var(--muted)">${ms('hourglass_top')}Jatuh tempo: <b style="color:var(--err)">10 Juni 2024 (5 hari lagi)</b></span>
      </div>
      <div class="ctr" style="margin:20px 0">
        <div>
          <span style="color:var(--muted)">Total Tagihan Berjalan</span>
          <div class="big" style="font-size:40px">Rp 1.500.000 <small style="font-size:14px;color:var(--muted);font-weight:400">/ bulan</small></div>
        </div>
        ${S.paid
          ? `<button class="btn s" style="padding:14px 24px;font-size:15px" data-go="penghuni-status">${ms('task_alt')}Lihat Bukti Pembayaran</button>`
          : `<button class="btn p" style="padding:14px 24px;font-size:15px" data-go="penghuni-tagihan">${ms('credit_card')}Bayar Tagihan Sekarang</button>`}
      </div>
      <div class="note" style="display:block">
        <b style="display:flex;gap:8px;align-items:center;justify-content:space-between">
          <span style="display:flex;gap:8px">${ms('list_alt')}Rincian Komponen Tagihan Kamar A-04</span>${ms('expand_more')}
        </b>
        <div class="grid g4" style="margin:12px 0 0">
          ${[['Sewa Kamar Utama','1.350.000'],['Iuran Kebersihan','50.000'],['Internet WiFi','50.000'],['Keamanan & CCTV','50.000']].map(x =>
            `<div class="card" style="padding:12px;box-shadow:none;background:#fff"><small style="color:var(--muted)">${x[0]}</small><br><b style="font-size:15px">Rp ${x[1]}</b></div>`
          ).join('')}
        </div>
      </div>
    </div>
    <div>
      <div class="ctr" style="margin-bottom:12px">
        <h3 style="display:flex;gap:8px;align-items:center">${ms('handyman')}Layanan Penghuni & Kendala Kamar</h3>
        <small style="color:var(--muted)">Pusat Bantuan Cepat</small>
      </div>
      <div class="grid g4" style="margin:0">
        ${[
          ['ac_unit','Lapor Kendala AC','Filter kotor, bocor, atau pendinginan...','Buat Tiket →',''],
          ['badge','Izin Tamu Menginap','Registrasi keluarga/rekan...','Formulir Izin →',''],
          ['build_circle','Jadwal Servis Rutin','Cek kuras toren, sanitasi berkala...','Lihat Kalender →',''],
          ['emergency','Kontak Darurat Kos','Security 24 Jam, PLN, dan Polsek...','Panggil Sekarang 📞','red']
        ].map(x => `<div class="svc ${x[4]}"><span class="si">${ms(x[0])}</span><b>${x[1]}</b><span>${x[2]}</span><a>${x[3]}</a></div>`).join('')}
      </div>
    </div>
    <div class="card">
      <div class="ctr">
        <div><h3>Riwayat Pembayaran Terakhir</h3><p class="sub">Semua tagihan lunas tersinkronisasi otomatis.</p></div>
        <a data-go="penghuni-riwayat" style="font-weight:600;color:var(--primary-d);cursor:pointer">Lihat Semua ›</a>
      </div>
      <div style="display:grid;gap:10px;margin-top:14px">
        ${[['Mei 2024','08 Mei 2024 • BCA Virtual Account'],['April 2024','09 Apr 2024 • QRIS Instan'],['Maret 2024','07 Mar 2024 • Mandiri VA']].map(h =>
          `<div class="hist">
            <span class="ic">${ms('task_alt')}</span>
            <div class="m"><b>Sewa Kos - Periode ${h[0]} ${pill('Lunas','ok')}</b><small>Dibayar pada ${h[1]}</small></div>
            <b style="font-size:18px">Rp 1.500.000</b>
            <button class="btn sm">${ms('download')}Kuitansi PDF</button>
          </div>`
        ).join('')}
      </div>
    </div>
  </div>
  <div style="display:grid;gap:16px;min-width:0">
    <div class="card" style="padding:0;overflow:hidden">
      <div class="room" style="border-radius:0;min-height:170px">
        <div style="background:linear-gradient(135deg,#174d3b,#4b6453);position:absolute;inset:0"></div>
        <div><small>KAMAR HUNIAN</small><b>Kamar A-04</b></div>
        <span class="pillw">Lantai 1 • Deluxe AC</span>
      </div>
      <div style="padding:16px;display:grid;gap:10px">
        <div class="tiles">
          ${[['straighten','Ukuran','3.5 x 4.0 m'],['bathtub','Fasilitas','KM Dalam'],['bolt','Listrik','Termasuk (Token)'],['chair','Perabotan','Full Furnished']].map(x =>
            `<div class="tile">${ms(x[0])}<span>${x[1]}<b>${x[2]}</b></span></div>`
          ).join('')}
        </div>
        <div class="linkrow"><span style="display:flex;gap:8px">${ms('forum')}Hubungi Penjaga Kos (Pak Joko)</span>${ms('open_in_new')}</div>
        <div class="linkrow"><span style="display:flex;gap:8px">${ms('menu_book')}Tata Tertib & Jam Malam</span>${ms('chevron_right')}</div>
        <div class="linkrow"><span style="display:flex;gap:8px">${ms('warning')}Lapor Kerusakan Kamar A-04</span>${ms('chevron_right')}</div>
      </div>
    </div>
    <div class="card">
      <div class="ctr"><h3 style="font-size:16px;display:flex;gap:8px">${ms('electric_meter')}Kwh Meter Kamar A-04</h3>${pill('Normal','ok')}</div>
      <div class="note" style="margin:14px 0;justify-content:space-between;align-items:center">
        <span>Sisa Kuota Listrik<br><b style="font-size:26px;color:var(--primary-d)">124.6 kWh</b></span>
        ${ring(.7)}
      </div>
      <p style="font-size:12px;color:var(--muted);margin:0">Estimasi cadangan listrik mencukupi untuk 18 hari pemakaian normal.</p>
    </div>
    <div class="card">
      <h3 style="font-size:16px;display:flex;gap:8px">${ms('campaign')}Pengumuman Pengelola</h3>
      <div class="note" style="display:block;margin-top:12px">
        <div class="ctr"><b>Pembersihan Tangki Air</b><small>8 Juni</small></div>
        <p style="margin:6px 0 0">Pasokan air utama akan dimatikan sementara pada Sabtu pukul 09.00 - 12.00 WIB.</p>
      </div>
    </div>
  </div>
</div>` });


const payOpts = [
  ['qris','QRIS Instan (Semua Dompet Digital & Mobile Banking)','Bebas Biaya','Pindai barcode via GoPay, OVO, ShopeePay, Dana, BCA Mobile, Livin.',['BCA Mobile','GoPay','OVO','ShopeePay']],
  ['bca','BCA Virtual Account','Verifikasi Otomatis','Nomor akun virtual unik Midtrans akan di-generate khusus untuk tagihan ini.',[]],
  ['mdr','Mandiri Virtual Account (Bill Payment)','Verifikasi Otomatis','Bayar mudah via Livin by Mandiri, ATM Mandiri, atau Internet Banking.',[]],
  ['man','Transfer Manual ke Rekening Pengelola','Konfirmasi 1-2 Jam','Transfer langsung ke rekening BCA Kos Griya Asri & unggah bukti transfer.',[]]
];

P['penghuni-tagihan'] = () => ({ role: 'penghuni', body: `
<div class="sand">${ms('terminal')}<b>MODE SIMULASI — MIDTRANS SANDBOX</b><span style="flex:1 1 260px">Lingkungan pengujian pembayaran resmi. Transaksi ini tidak memotong dana riil Anda.</span>${pill('Gateway Aktif','dot')}</div>
<div class="hd">
  <div>
    <span class="lbl">Finansial Penghuni <span style="margin:0 6px">●</span><span style="text-transform:none;letter-spacing:0">Periode Berjalan</span></span>
    <h1 style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
      Tagihan & Pembayaran ${S.paid ? pill('Lunas','ok') : pill('Menunggu Pelunasan','err')}
    </h1>
  </div>
  <div class="acts">
    <span class="sel" style="background:var(--c3)">${ms('calendar_month')}Jatuh Tempo: <b>10 Juni 2024</b> (Sisa 3 Hari)</span>
  </div>
</div>
<div class="grid g21" style="align-items:start">
  <div style="display:grid;gap:16px;min-width:0">
    <div class="card">
      <div class="ctr" style="align-items:flex-start">
        <div style="display:flex;gap:14px">
          <span class="stat"><span class="ic" style="position:static;width:48px;height:48px">${ms('receipt_long')}</span></span>
          <div>
            <small style="color:var(--muted)">Faktur Hunian</small> <span class="chip mono">#INV-2024-06-004</span>
            <h2 style="margin:4px 0 2px;font-size:22px;color:var(--primary-d)">Kamar A-04 — Deluxe AC</h2>
            <small style="color:var(--muted)">Kost Putri Griya Asri • Lantai 1</small>
          </div>
        </div>
        <div style="text-align:right">
          <span class="lbl" style="font-size:10px">Periode Penagihan</span><br>
          <b style="font-size:18px">Juni 2024</b><br>
          <small style="color:var(--muted)">01 Jun 2024 - 30 Jun 2024</small>
        </div>
      </div>
    </div>
    <div class="card">
      <div class="ctr"><h3>${ms('payments')} Pilih Metode Pembayaran</h3><small style="display:flex;gap:4px;align-items:center;color:var(--muted)">${ms('bolt')}Konfirmasi Instan</small></div>
      <div id="payopts" style="display:grid;gap:12px;margin-top:14px">
        ${payOpts.map(o => `
          <button class="opt ${payChoice===o[0]?'on':''}" data-pay="${o[0]}" aria-pressed="${payChoice===o[0]}">
            <span class="rd"></span>
            <span style="flex:1">
              <span class="ot"><b>${o[1]}</b>${o[0]==='qris' ? pill('Rekomendasi','dk') : `<small style="color:var(--muted)">${o[2]}</small>`}</span>
              ${o[0]==='qris' ? `<b style="font-size:12px;display:block;margin-top:4px">${o[2]}</b>` : ''}
              <p>${o[3]}</p>
              ${o[4].map(c => `<code>${c}</code>`).join('')}
            </span>
          </button>`).join('')}
      </div>
    </div>
  </div>
  <div style="display:grid;gap:16px;min-width:0">
    <div class="card">
      <div class="ctr"><span class="lbl" style="color:var(--primary-d)">● Ringkasan Pembayaran</span><small>ID: KOS-INV-0604</small></div>
      <p style="margin:14px 0 2px;font-size:12px;color:var(--muted)">Total Nominal Tagihan</p>
      <div class="big">Rp 1.500.000 <small style="font-size:12px;font-weight:400;color:var(--muted)">/ bulan</small></div>
      <div class="note" style="display:block;margin:14px 0;background:var(--c1)">
        <div class="kv"><span>Sewa Kamar Pokok</span><b style="font-weight:500">Rp 1.350.000</b></div>
        <div class="kv"><span>Total Biaya Fasilitas</span><b style="font-weight:500">Rp 150.000</b></div>
        <div class="kv"><span>Biaya Gateway</span><b style="font-weight:500">Rp 0 (Subsidi)</b></div>
        <div class="kv" style="border-top:1px solid var(--c3);padding-top:12px">
          <b style="font-weight:600">Batas Akhir Pelunasan</b>
          <b style="color:var(--err);display:flex;gap:6px;align-items:center">${ms('alarm')}10 Juni 2024, 23:59 WIB</b>
        </div>
      </div>
      <button class="btn p" style="width:100%;padding:14px" data-act="open-snap">${ms('credit_card')}Bayar Sekarang (Checkout Midtrans)</button>
      <p style="text-align:center;font-size:12px;color:var(--muted);margin:10px 0">Jendela popup Midtrans Snap Sandbox akan terbuka.</p>
      <div class="note">${ms('info')}Dalam mode sandbox, gunakan nomor kartu dummy atau scan QRIS simulator.</div>
    </div>
    <div class="card">
      <div class="ctr"><h3 style="font-size:16px">${ms('history')}Riwayat Tagihan Lampau</h3>${pill('Semua Lunas','ok')}</div>
      <div style="display:grid;gap:10px;margin:14px 0">
        ${['Mei','April','Maret'].map((m,i) =>
          `<div class="note" style="justify-content:space-between;align-items:center;flex-wrap:wrap">
            <span><b>Periode ${m} 2024</b> ${pill('✓ Lunas','')}<br><small>#INV-2024-0${5-i}-004 • Rp 1.500.000</small></span>
            <button class="btn sm">${ms('download')}Kuitansi PDF</button>
          </div>`
        ).join('')}
      </div>
      <a data-go="penghuni-riwayat" style="display:block;text-align:center;font-weight:600;cursor:pointer;font-size:13px">Lihat Seluruh Arsip Pembayaran →</a>
    </div>
  </div>
</div>` });

