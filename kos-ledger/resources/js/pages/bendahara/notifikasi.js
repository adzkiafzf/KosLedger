import { getNotifications } from '../../api/notifications.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, ms } from '../../components/ui.js';
import { errorView, loadingView, emptyView } from '../../components/states.js';
import { esc, tgl } from '../../utils/format.js';

// Konfigurasi tiap tipe notifikasi: ikon, label, warna
const TYPE_CONFIG = {
  reminder: {
    icon: 'notifications_active',
    label: 'Pengingat Tagihan',
    cls: 'warn',
    desc: 'Pengingat jatuh tempo dikirim ke penghuni via Telegram.',
  },
  payment_success: {
    icon: 'check_circle',
    label: 'Pembayaran Berhasil',
    cls: 'ok',
    desc: 'Konfirmasi pembayaran tagihan berhasil dikirim ke penghuni.',
  },
};

const STATUS_CONFIG = {
  sent:   { label: 'Terkirim', cls: 'ok dot' },
  failed: { label: 'Gagal',    cls: 'err dot' },
};

function getTypeConfig(type) {
  return TYPE_CONFIG[type] || { icon: 'notifications', label: esc(type), cls: '', desc: '' };
}

function getStatusConfig(status) {
  return STATUS_CONFIG[status] || { label: esc(status), cls: '' };
}

// Format waktu: "sent_at" lebih relevan daripada created_at
function formatTime(item) {
  const src = item.sent_at || item.created_at;
  if (!src) return '–';
  // Tampilkan tanggal + waktu (HH:MM)
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(src));
  if (m) return `${tgl(m[1])}, ${m[2]} WIB`;
  return tgl(src);
}

// Satu item notifikasi dalam daftar
function notifItem(item) {
  const tc = getTypeConfig(item.type);
  const sc = getStatusConfig(item.status);

  const iconColor =
    item.status === 'failed'
      ? 'background:var(--err-bg);color:var(--err)'
      : tc.cls === 'ok'
      ? 'background:var(--active);color:var(--primary-d)'
      : 'background:var(--warn-bg);color:var(--warn-text)';

  return `
    <div class="ni" style="border-radius:12px;cursor:default">
      <span class="nic" style="${iconColor}">${ms(tc.icon)}</span>
      <span class="nt">
        <b>${esc(tc.label)}</b>
        <small>${esc(tc.desc)}${item.bill_id ? ` Tagihan #${item.bill_id}.` : ''}</small>
        <em>${formatTime(item)}</em>
        ${item.status === 'failed' && item.error_message
          ? `<em style="color:var(--err);margin-top:2px">${ms('error').replace('class="ms"', 'class="ms" style="font-size:12px"')} ${esc(item.error_message)}</em>`
          : ''}
      </span>
      ${pill(sc.label, sc.cls)}
    </div>`;
}

// Grup notifikasi berdasarkan tanggal (lokal)
function groupByDate(items) {
  const groups = new Map();
  items.forEach((item) => {
    const src = item.sent_at || item.created_at || '';
    const dateKey = src ? src.split('T')[0] : 'unknown';
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey).push(item);
  });
  return groups;
}

function renderGroups(items) {
  if (!items.length) return emptyView('Belum ada notifikasi', 'Log pengiriman notifikasi Telegram akan muncul di sini.', 'notifications_none');

  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  const labelFor = (key) => {
    if (key === today) return 'Hari Ini';
    if (key === yesterday) return 'Kemarin';
    if (key === 'unknown') return 'Tanggal Tidak Diketahui';
    return tgl(key);
  };

  const groups = groupByDate(items);
  return [...groups.entries()]
    .map(
      ([dateKey, group]) => `
      <div class="pt" style="padding:14px 0 6px">${esc(labelFor(dateKey))}</div>
      <div class="nl">${group.map(notifItem).join('')}</div>`
    )
    .join('');
}

// Stat summary
function summaryCards(items) {
  const total   = items.length;
  const sent    = items.filter((x) => x.status === 'sent').length;
  const failed  = items.filter((x) => x.status === 'failed').length;
  const remind  = items.filter((x) => x.type === 'reminder').length;
  const paySuc  = items.filter((x) => x.type === 'payment_success').length;

  const statCard = (label, value, foot, icon, cls = '') => `
    <div class="card stat ${cls}">
      <span class="l">${label}</span>
      <span class="v sm">${value}</span>
      <span class="f">${foot}</span>
      ${icon ? `<span class="ic">${ms(icon)}</span>` : ''}
    </div>`;

  return `
    <div class="grid g4" style="margin-bottom:16px">
      ${statCard('Total Notifikasi', String(total), 'Log pengiriman Telegram', 'notifications')}
      ${statCard('Terkirim', String(sent), pill(`${total > 0 ? Math.round((sent / total) * 100) : 0}% Sukses`, 'ok'), 'check_circle')}
      ${statCard('Gagal Kirim', String(failed), failed > 0 ? pill('Perlu perhatian', 'err') : 'Semua terkirim', 'error', failed > 0 ? 'red' : '')}
      ${statCard('Pengingat Tagihan', String(remind), `${paySuc} notif pembayaran`, 'campaign')}
    </div>`;
}

// Filter bar
const FILTER_TYPES  = [['all', 'Semua'], ['reminder', 'Pengingat'], ['payment_success', 'Pembayaran']];
const FILTER_STATUS = [['all', 'Semua Status'], ['sent', 'Terkirim'], ['failed', 'Gagal']];

function filterBar(activeType, activeStatus) {
  return `
    <div class="filter" style="margin-bottom:16px">
      <div class="tabs" id="notif-type-tabs">
        ${FILTER_TYPES.map(([k, l]) => `<button data-type="${k}" class="${activeType === k ? 'on' : ''}">${l}</button>`).join('')}
      </div>
      <div class="tabs" id="notif-status-tabs">
        ${FILTER_STATUS.map(([k, l]) => `<button data-status="${k}" class="${activeStatus === k ? 'on' : ''}">${l}</button>`).join('')}
      </div>
    </div>`;
}

// Render utama halaman
function pageHtml(allItems, activeType = 'all', activeStatus = 'all', page = 1, lastPage = 1) {
  const filtered = allItems.filter((x) => {
    const matchType   = activeType   === 'all' || x.type   === activeType;
    const matchStatus = activeStatus === 'all' || x.status === activeStatus;
    return matchType && matchStatus;
  });

  const pagerHtml =
    lastPage > 1
      ? `<div class="foot" style="margin-top:4px">
          <span>Halaman ${page} dari ${lastPage}</span>
          <div class="pg">
            ${page > 1      ? `<button id="pg-prev" class="btn sm s">${ms('chevron_left')} Sebelumnya</button>` : ''}
            ${page < lastPage ? `<button id="pg-next" class="btn sm s">Berikutnya ${ms('chevron_right')}</button>` : ''}
          </div>
        </div>`
      : '';

  return `
    ${pageHead({
      eyebrow: 'LOG SISTEM',
      txt: 1,
      dot: 1,
      title: 'Notifikasi',
      sub: 'Log seluruh notifikasi Telegram yang telah dikirim oleh sistem KosLedger kepada penghuni.',
    })}

    ${summaryCards(allItems)}

    <div class="card">
      ${filterBar(activeType, activeStatus)}
      <div id="notif-list">
        ${renderGroups(filtered)}
      </div>
      ${pagerHtml}
    </div>

    <div class="note" style="margin-top:16px">
      ${ms('info')}
      <span>
        Halaman ini menampilkan log pengiriman notifikasi Telegram.
        Notifikasi dikirim otomatis oleh sistem saat ada tagihan jatuh tempo atau pembayaran berhasil.
      </span>
    </div>`;
}

export default async function notifikasiPage({ user }) {
  // State lokal untuk filter & pagination
  let allItems   = [];
  let page       = 1;
  let lastPage   = 1;
  let activeType   = 'all';
  let activeStatus = 'all';

  // Ambil data dari API
  try {
    const res = await getNotifications({ page });
    allItems  = Array.isArray(res?.data) ? res.data : [];
    page      = res?.current_page || 1;
    lastPage  = res?.last_page    || 1;
  } catch (err) {
    return {
      html: `
        ${pageHead({ title: 'Notifikasi', sub: 'Log pengiriman notifikasi Telegram.' })}
        ${errorView(apiError(err))}
        <button class="btn s" id="retry-notif" style="margin-top:8px">${ms('refresh')}Coba lagi</button>`,
      after() {
        document.getElementById('retry-notif')?.addEventListener('click', () => go('notifikasi'));
      },
    };
  }

  return {
    html: pageHtml(allItems, activeType, activeStatus, page, lastPage),
    after() {
      // Filter berdasarkan tipe
      document.getElementById('notif-type-tabs')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-type]');
        if (!btn) return;
        activeType = btn.dataset.type;
        document.querySelectorAll('#notif-type-tabs [data-type]').forEach((b) =>
          b.classList.toggle('on', b.dataset.type === activeType)
        );
        const list = document.getElementById('notif-list');
        if (list) list.innerHTML = renderGroups(
          allItems.filter((x) => {
            const matchType   = activeType   === 'all' || x.type   === activeType;
            const matchStatus = activeStatus === 'all' || x.status === activeStatus;
            return matchType && matchStatus;
          })
        );
      });

      // Filter berdasarkan status
      document.getElementById('notif-status-tabs')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-status]');
        if (!btn) return;
        activeStatus = btn.dataset.status;
        document.querySelectorAll('#notif-status-tabs [data-status]').forEach((b) =>
          b.classList.toggle('on', b.dataset.status === activeStatus)
        );
        const list = document.getElementById('notif-list');
        if (list) list.innerHTML = renderGroups(
          allItems.filter((x) => {
            const matchType   = activeType   === 'all' || x.type   === activeType;
            const matchStatus = activeStatus === 'all' || x.status === activeStatus;
            return matchType && matchStatus;
          })
        );
      });

      // Paginasi — muat ulang halaman berikutnya dari API
      document.getElementById('pg-next')?.addEventListener('click', async () => {
        const view = document.getElementById('view');
        if (view) view.innerHTML = loadingView('Memuat halaman berikutnya…');
        try {
          const res = await getNotifications({ page: page + 1 });
          allItems  = Array.isArray(res?.data) ? res.data : [];
          page      = res?.current_page || page + 1;
          lastPage  = res?.last_page    || lastPage;
          if (view) {
            view.innerHTML = pageHtml(allItems, activeType, activeStatus, page, lastPage);
            // after() perlu dipasang ulang setelah re-render
            const event = new CustomEvent('notif-reafter');
            document.dispatchEvent(event);
          }
        } catch (err) {
          if (view) view.innerHTML = errorView(apiError(err));
        }
      });

      document.getElementById('pg-prev')?.addEventListener('click', async () => {
        const view = document.getElementById('view');
        if (view) view.innerHTML = loadingView('Memuat halaman sebelumnya…');
        try {
          const res = await getNotifications({ page: page - 1 });
          allItems  = Array.isArray(res?.data) ? res.data : [];
          page      = res?.current_page || page - 1;
          lastPage  = res?.last_page    || lastPage;
          if (view) {
            view.innerHTML = pageHtml(allItems, activeType, activeStatus, page, lastPage);
            document.dispatchEvent(new CustomEvent('notif-reafter'));
          }
        } catch (err) {
          if (view) view.innerHTML = errorView(apiError(err));
        }
      });
    },
  };
}
