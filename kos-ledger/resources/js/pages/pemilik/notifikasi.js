import { getNotifications } from '../../api/notifications.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, ms, toast, modal, mhead, kvs } from '../../components/ui.js';
import { statCard } from '../../components/widgets.js';
import { errorView, loadingView, emptyView } from '../../components/states.js';
import { esc, tgl } from '../../utils/format.js';

const TYPE_CONFIG = {
  reminder: {
    icon: 'notifications_active',
    label: 'Pengingat Tagihan Sewa',
    cls: 'warn',
    desc: 'Pengingat batas jatuh tempo tagihan sewa dikirimkan kepada penghuni.',
  },
  payment_success: {
    icon: 'check_circle',
    label: 'Konfirmasi Pembayaran Sewa',
    cls: 'ok',
    desc: 'Pembayaran sewa telah terverifikasi lunas dan notifikasi terkirim.',
  },
};

const STATUS_CONFIG = {
  sent: { label: 'Terkirim', cls: 'ok dot' },
  failed: { label: 'Gagal', cls: 'err dot' },
};

function getStorageKey(userId) {
  return `kosledger_read_notifs_${userId || 'default'}`;
}

function getReadSet(userId) {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function saveReadSet(userId, set) {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(Array.from(set)));
  } catch {
    // Abaikan jika localStorage tidak tersedia
  }
}

function formatTime(item) {
  const src = item.sent_at || item.created_at;
  if (!src) return '–';
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(src));
  if (m) return `${tgl(m[1])}, ${m[2]} WIB`;
  return tgl(src);
}

function notifDetailModal(item) {
  const tc = TYPE_CONFIG[item.type] || { icon: 'notifications', label: esc(item.type), cls: '', desc: '' };
  const sc = STATUS_CONFIG[item.status] || { label: esc(item.status), cls: '' };

  return `
    ${mhead(tc.label, 'Rincian Log Notifikasi Sistem', tc.icon)}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px">
        <span class="lbl" style="font-size:11px">STATUS PENGIRIMAN</span>
        ${pill(sc.label, sc.cls)}
      </div>
      ${kvs([
        ['Jenis Pemberitahuan', tc.label],
        ['Waktu Pengiriman', formatTime(item)],
        ['ID Tagihan Terkait', item.bill_id ? `Tagihan #${item.bill_id}` : '–'],
        ['Kanal Distribusi', 'Bot Telegram Otomatis'],
        ['Keterangan', esc(tc.desc)],
        item.status === 'failed' && item.error_message ? ['Kendala Pengiriman', `<span style="color:var(--err)">${esc(item.error_message)}</span>`] : null,
      ].filter(Boolean))}
      <div class="note" style="margin-top:14px">
        ${ms('shield')}
        <span style="font-size:12px;color:var(--muted)">
          Mode Pantau Pemilik: Log notifikasi dicatat real-time dari sistem otomasi pesan pengingat tagihan dan konfirmasi transaksi sewa.
        </span>
      </div>
    </div>
    <footer class="mf2">
      ${
        item.bill_id
          ? `<button class="btn s" data-go="pemilik-tagihan" data-act="close">${ms('receipt_long')}Lihat Tagihan #${item.bill_id}</button>`
          : ''
      }
      <button class="btn p" data-act="close">Tutup</button>
    </footer>`;
}

export default async function ownerNotificationsPage({ user }) {
  const userId = user?.id || 0;
  const readSet = getReadSet(userId);

  let allItems = [];
  let page = 1;
  let lastPage = 1;
  let activeType = 'all';
  let activeRead = 'all';
  let fetchError = null;

  try {
    const res = await getNotifications({ page });
    allItems = Array.isArray(res?.data) ? res.data : [];
    page = res?.current_page || 1;
    lastPage = res?.last_page || 1;
  } catch (err) {
    fetchError = err;
  }

  if (fetchError && !allItems.length) {
    return {
      html: `
        ${pageHead({
          crumb: `Sistem › <b>Notifikasi</b>`,
          title: 'Notifikasi & Log Sistem',
          sub: 'Pantau log pengiriman notifikasi pengingat sewa dan konfirmasi pembayaran.',
        })}
        ${errorView(apiError(fetchError))}
        <button class="btn s" id="retry-owner-notif" style="margin-top:8px">${ms('refresh')}Coba lagi</button>`,
      after() {
        document.getElementById('retry-owner-notif')?.addEventListener('click', () => go('notifikasi'));
      },
    };
  }

  // Perhitungan status baca & metrik
  const unreadItems = allItems.filter((x) => !readSet.has(x.id));
  const unreadCount = unreadItems.length;
  const sentCount = allItems.filter((x) => x.status === 'sent').length;
  const failedCount = allItems.filter((x) => x.status === 'failed').length;

  // Sinkronisasi badge lonceng navbar
  function syncBellBadge() {
    const curRead = getReadSet(userId);
    const unread = allItems.filter((x) => !curRead.has(x.id)).length;
    document.querySelectorAll('.bell').forEach((b) => b.classList.toggle('has', unread > 0));
  }

  function renderNotifList() {
    const curRead = getReadSet(userId);
    const filtered = allItems.filter((x) => {
      const matchType = activeType === 'all' || x.type === activeType;
      const isRead = curRead.has(x.id);
      const matchRead =
        activeRead === 'all' ||
        (activeRead === 'unread' && !isRead) ||
        (activeRead === 'read' && isRead);
      return matchType && matchRead;
    });

    if (!filtered.length) {
      return emptyView(
        'Tidak ada notifikasi',
        'Tidak ditemukan notifikasi pada kategori filter yang dipilih.',
        'notifications_none'
      );
    }

    return filtered
      .map((item) => {
        const isRead = curRead.has(item.id);
        const tc = TYPE_CONFIG[item.type] || { icon: 'notifications', label: esc(item.type), cls: '', desc: '' };
        const sc = STATUS_CONFIG[item.status] || { label: esc(item.status), cls: '' };

        const iconColor =
          item.status === 'failed'
            ? 'background:var(--err-bg);color:var(--err)'
            : tc.cls === 'ok'
            ? 'background:var(--active);color:var(--primary-d)'
            : 'background:var(--warn-bg);color:var(--warn-text)';

        return `
          <div class="ni ${isRead ? '' : 'un'}" data-notif-item="${item.id}" style="border-radius:12px;cursor:pointer">
            <span class="nic" style="${iconColor}">${ms(tc.icon)}</span>
            <span class="nt">
              <b>${esc(tc.label)}</b>
              <small>${esc(tc.desc)}${item.bill_id ? ` Tagihan #${item.bill_id}.` : ''}</small>
              <em>${formatTime(item)}</em>
              ${
                item.status === 'failed' && item.error_message
                  ? `<em style="color:var(--err);margin-top:2px">${ms('error').replace('class="ms"', 'class="ms" style="font-size:12px"')} ${esc(item.error_message)}</em>`
                  : ''
              }
            </span>
            ${pill(sc.label, sc.cls)}
            ${isRead ? '' : `<span class="dot"></span>`}
          </div>`;
      })
      .join('');
  }

  const html = `
    ${pageHead({
      crumb: `Sistem › <b>Notifikasi</b>`,
      title: 'Notifikasi & Log Sistem',
      sub: 'Pemberitahuan aktivitas operasional, status pengingat sewa, dan konfirmasi transaksi sewa kos.',
      acts: `
        <button class="btn s" id="btn-owner-mark-all-read" aria-label="Tandai semua notifikasi sebagai sudah dibaca">${ms('done_all')}Tandai Semua Dibaca</button>
      `,
    })}

    <!-- 4 Kartu KPI Ringkasan Notifikasi -->
    <div class="grid g4" style="margin-bottom:16px">
      ${statCard('Total Notifikasi', String(allItems.length), '<span class="chip" style="background:var(--c1)">Log Telegram</span>', 'notifications')}
      ${statCard(
        'Belum Dibaca',
        `${unreadCount} <small>Pesan</small>`,
        pill(unreadCount > 0 ? `${unreadCount} Baru` : 'Semua Terbaca', unreadCount > 0 ? 'warn' : 'ok'),
        'mark_email_unread',
        { cls: unreadCount > 0 ? 'red' : '' }
      )}
      ${statCard('Berhasil Terkirim', `${sentCount} <small>Notif</small>`, pill('Terkirim ke Penghuni', 'ok'), 'check_circle')}
      ${statCard(
        'Gagal Kirim',
        `${failedCount} <small>Kendala</small>`,
        failedCount > 0 ? pill('Perlu Perhatian', 'err') : 'Nihil Gagal',
        'error',
        { cls: failedCount > 0 ? 'red' : '' }
      )}
    </div>

    <!-- Filter Tabs & Daftar Notifikasi -->
    <div class="card">
      <div class="filter" style="margin-bottom:12px;flex-wrap:wrap;gap:12px">
        <div class="filter-row">
        <div class="tabs" id="owner-notif-type-tabs">
          <button data-type="all" class="on">Semua Kategori</button>
          <button data-type="reminder">Pengingat Tagihan</button>
          <button data-type="payment_success">Pembayaran Sukses</button>
        </div>
        </div>
        <div class="filter-row">
        <div class="tabs" id="owner-notif-read-tabs">
          <button data-read="all" class="on">Semua Status</button>
          <button data-read="unread">Belum Dibaca</button>
          <button data-read="read">Sudah Dibaca</button>
        </div>
        </div>
      </div>

      <div class="nl" id="owner-notif-container">
        ${renderNotifList()}
      </div>

      ${
        lastPage > 1
          ? `<div class="foot" style="margin-top:14px;border-top:1px solid var(--c1)">
              <span>Halaman ${page} dari ${lastPage}</span>
              <div class="pg">
                ${page > 1 ? `<button id="owner-pg-prev" class="btn sm s">${ms('chevron_left')} Sebelumnya</button>` : ''}
                ${page < lastPage ? `<button id="owner-pg-next" class="btn sm s">Berikutnya ${ms('chevron_right')}</button>` : ''}
              </div>
            </div>`
          : ''
      }
    </div>

    <div class="note" style="margin-top:16px">
      ${ms('info')}
      <span style="font-size:12px">
        Notifikasi dikirimkan secara otomatis oleh backend KosLedger melalui bot Telegram kepada penghuni saat terdapat tagihan mendekati jatuh tempo atau pembayaran sewa terkonfirmasi lunas.
      </span>
    </div>
  `;

  return {
    html,
    after() {
      // Perbarui badge lonceng navbar saat halaman dibuka
      syncBellBadge();

      // 1. Tombol Tandai Semua Dibaca
      document.getElementById('btn-owner-mark-all-read')?.addEventListener('click', () => {
        const curRead = getReadSet(userId);
        allItems.forEach((it) => curRead.add(it.id));
        saveReadSet(userId, curRead);
        toast('Seluruh notifikasi ditandai sudah dibaca', 'ok');

        const container = document.getElementById('owner-notif-container');
        if (container) container.innerHTML = renderNotifList();
        syncBellBadge();
      });

      // 2. Filter Tab Kategori Tipe
      document.getElementById('owner-notif-type-tabs')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-type]');
        if (!btn) return;
        activeType = btn.dataset.type;
        document.querySelectorAll('#owner-notif-type-tabs [data-type]').forEach((b) =>
          b.classList.toggle('on', b.dataset.type === activeType)
        );
        const container = document.getElementById('owner-notif-container');
        if (container) container.innerHTML = renderNotifList();
      });

      // 3. Filter Tab Status Baca
      document.getElementById('owner-notif-read-tabs')?.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-read]');
        if (!btn) return;
        activeRead = btn.dataset.read;
        document.querySelectorAll('#owner-notif-read-tabs [data-read]').forEach((b) =>
          b.classList.toggle('on', b.dataset.read === activeRead)
        );
        const container = document.getElementById('owner-notif-container');
        if (container) container.innerHTML = renderNotifList();
      });

      // 4. Klik Item Notifikasi -> Buka Detail & Tandai Sudah Dibaca
      document.getElementById('owner-notif-container')?.addEventListener('click', (e) => {
        const card = e.target.closest('[data-notif-item]');
        if (!card) return;
        const id = Number(card.dataset.notifItem);
        const item = allItems.find((x) => x.id === id);
        if (!item) return;

        // Tandai sudah dibaca
        const curRead = getReadSet(userId);
        curRead.add(id);
        saveReadSet(userId, curRead);
        card.classList.remove('un');
        card.querySelector('.dot')?.remove();
        syncBellBadge();

        // Tampilkan modal rincian notifikasi
        modal(notifDetailModal(item));
      });
    },
  };
}
