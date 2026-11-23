import { getNotifications } from '../../api/notifications.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, ms, toast, modal, closeModal, mhead, kvs } from '../../components/ui.js';
import { statCard, searchField } from '../../components/widgets.js';
import { emptyView, errorView } from '../../components/states.js';
import { esc, tgl } from '../../utils/format.js';

const TYPE_CONFIG = {
  due_reminder: {
    icon: 'notifications_active',
    label: 'Pengingat Jatuh Tempo Tagihan',
    tag: 'Penting',
    tagCls: 'warn',
    desc: 'Pengingat otomatis batas waktu pelunasan sewa kamar kos sebelum tanggal jatuh tempo.',
    actionLabel: 'Buka Tagihan Saya',
    actionGo: 'anggota-tagihan',
  },
  reminder: {
    icon: 'notifications_active',
    label: 'Pengingat Tagihan Sewa',
    tag: 'Penting',
    tagCls: 'warn',
    desc: 'Pengingat batas jatuh tempo tagihan sewa bulanan dikirimkan ke akun Anda.',
    actionLabel: 'Buka Tagihan Saya',
    actionGo: 'anggota-tagihan',
  },
  payment_success: {
    icon: 'check_circle',
    label: 'Konfirmasi Pembayaran Sewa',
    tag: 'Lunas',
    tagCls: 'ok',
    desc: 'Setoran sewa telah terverifikasi lunas oleh sistem dan tercatat sah di buku kas.',
    actionLabel: 'Lihat Bukti di Riwayat',
    actionGo: 'anggota-riwayat',
  },
};

const STATUS_CONFIG = {
  sent: { label: 'Terkirim via Bot', cls: 'ok dot' },
  failed: { label: 'Gagal Kirim', cls: 'err dot' },
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
    // Abaikan jika storage tidak tersedia
  }
}

function formatTime(item) {
  const src = item.sent_at || item.created_at;
  if (!src) return '–';
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})/.exec(String(src));
  if (m) return `${tgl(m[1])}, ${m[2]} WIB`;
  return tgl(src);
}

function renderNotifDetailModal(item, user) {
  const tc = TYPE_CONFIG[item.type] || {
    icon: 'notifications',
    label: 'Pemberitahuan Sistem',
    tag: 'Info',
    tagCls: '',
    desc: 'Pemberitahuan resmi terkait aktivitas akun dan sewa kamar kos Anda.',
    actionLabel: 'Buka Dashboard',
    actionGo: 'anggota',
  };
  const sc = STATUS_CONFIG[item.status] || { label: esc(item.status), cls: '' };

  return `
    ${mhead(tc.label, 'Rincian Notifikasi Sistem', tc.icon)}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div>
          <span class="lbl" style="font-size:10px">STATUS PENGIRIMAN</span>
          <div>${pill(sc.label, sc.cls)}</div>
        </div>
        <div style="text-align:right">
          <span class="lbl" style="font-size:10px">KATEGORI PESAN</span>
          <div>${pill(tc.tag, tc.tagCls)}</div>
        </div>
      </div>

      ${kvs([
        ['Jenis Pemberitahuan', tc.label],
        ['Waktu Dikirimkan', formatTime(item)],
        ['Penerima', `${esc(user.name)} (@${esc(user.username)})`],
        ['Kanal Notifikasi', 'Bot Telegram Resmi KosLedger'],
        ['ID Tagihan Terkait', item.bill_id ? `Tagihan #${item.bill_id}` : '<span style="color:var(--muted)">–</span>'],
        ['Keterangan', esc(tc.desc)],
        item.status === 'failed' && item.error_message ? ['Kendala Pengiriman', `<span style="color:var(--err)">${esc(item.error_message)}</span>`] : null,
      ].filter(Boolean))}

      <div class="note" style="margin-top:16px;background:var(--c1);padding:12px;font-size:12px">
        ${ms('info')}
        <span>Notifikasi otomatis disinkronkan langsung dari server KosLedger saat event tagihan atau pembayaran terbit.</span>
      </div>

      <div style="margin-top:18px;display:flex;gap:10px;justify-content:flex-end;flex-wrap:wrap">
        <button class="btn p" data-go="${tc.actionGo}" onclick="document.getElementById('modal')?.remove()">
          ${tc.actionLabel}
        </button>
        <button class="btn s" onclick="document.getElementById('modal')?.remove()">
          ${ms('close')}Tutup
        </button>
      </div>
    </div>
  `;
}

export default async function notifikasi({ user }) {
  let notifList = [];

  try {
    const res = await getNotifications();
    notifList = res?.data || res || [];
    if (!Array.isArray(notifList)) notifList = [];
  } catch (err) {
    return {
      html: `
        <div style="padding:16px 0">
          ${pageHead({
            title: 'Notifikasi & Pengingat',
            sub: 'Pusat informasi tagihan dan konfirmasi pembayaran Anda.',
          })}
          ${errorView(err.message || 'Gagal memuat notifikasi.')}
          <div style="margin-top:16px">
            <button class="btn s" id="btn-retry-notifs">${ms('refresh')}Muat Ulang</button>
          </div>
        </div>
      `,
      after() {
        document.getElementById('btn-retry-notifs')?.addEventListener('click', () => go('notifikasi'));
      },
    };
  }

  // Hitung status unread berdasarkan localStorage
  const readSet = getReadSet(user.id);
  const totalNotifs = notifList.length;
  const unreadCount = notifList.filter((n) => !readSet.has(n.id)).length;
  const remindersCount = notifList.filter((n) => n.type === 'due_reminder' || n.type === 'reminder').length;
  const successCount = notifList.filter((n) => n.type === 'payment_success').length;

  // Sinkronkan badge lonceng navbar
  document.querySelectorAll('.bell').forEach((b) => b.classList.toggle('has', unreadCount > 0));

  const html = `
    <!-- Header Halaman -->
    ${pageHead({
      title: 'Notifikasi & Pengingat',
      sub: 'Pemberitahuan berkala terkait batas waktu pembayaran sewa dan status verifikasi transaksi.',
      acts: `
        ${unreadCount > 0 ? `
          <button class="btn s" id="btn-mark-all-read">
            ${ms('done_all')}Tandai Semua Dibaca (${unreadCount})
          </button>
        ` : `
          <span class="ro-badge">${ms('done_all')}Semua Sudah Dibaca</span>
        `}
      `,
    })}

    <!-- Statistik Ringkasan Notifikasi -->
    <div class="grid g4" style="margin-bottom:20px">
      ${statCard(
        'TOTAL PEMBERITAHUAN',
        `${totalNotifs} <small style="font-size:14px;font-weight:400;color:var(--muted)">Pesan</small>`,
        `<span style="color:var(--text)">Log notifikasi akun Anda</span>`,
        'notifications'
      )}

      ${statCard(
        'BELUM DIBACA',
        `${unreadCount} <small style="font-size:14px;font-weight:400;color:var(--muted)">Baru</small>`,
        unreadCount > 0
          ? `<span style="color:var(--warn);font-weight:600">Perlu ditinjau</span>`
          : '<span style="color:var(--primary);font-weight:600">✓ Semua telah dibaca</span>',
        'mark_chat_unread'
      )}

      ${statCard(
        'PENGINGAT JATUH TEMPO',
        `${remindersCount} <small style="font-size:14px;font-weight:400;color:var(--muted)">Pesan</small>`,
        `<span style="color:var(--text)">Batas waktu pembayaran</span>`,
        'notifications_active'
      )}

      ${statCard(
        'KONFIRMASI BAYAR',
        `${successCount} <small style="font-size:14px;font-weight:400;color:var(--muted)">Lunas</small>`,
        `<span style="color:var(--primary);font-weight:600">Pelunasan terverifikasi</span>`,
        'check_circle'
      )}
    </div>

    <!-- Filter Tab & Pencarian -->
    <div class="card" style="margin-bottom:16px">
      <div class="ctr" style="flex-wrap:wrap;gap:12px">
        <div class="tabs" id="notif-tabs" style="margin:0">
          <button class="on" data-tab-filter="all">Semua (${totalNotifs})</button>
          <button data-tab-filter="unread">Belum Dibaca (${unreadCount})</button>
          <button data-tab-filter="reminder">Pengingat Tagihan (${remindersCount})</button>
          <button data-tab-filter="payment_success">Pembayaran Sukses (${successCount})</button>
        </div>
        <div style="flex:1 1 240px;display:flex;justify-content:flex-end">
          ${searchField('Cari kata kunci notifikasi...', 'notif-list-container')}
        </div>
      </div>
    </div>

    <!-- Daftar Notifikasi -->
    <div id="notif-list-container" style="display:grid;gap:10px">
      ${totalNotifs > 0 ? notifList.map((item) => {
        const isRead = readSet.has(item.id);
        const tc = TYPE_CONFIG[item.type] || {
          icon: 'notifications',
          label: 'Pemberitahuan Sistem',
          tag: 'Info',
          tagCls: '',
          desc: 'Informasi resmi terkait sewa kamar.',
          actionLabel: 'Buka',
          actionGo: 'anggota',
        };
        const sc = STATUS_CONFIG[item.status] || { label: esc(item.status), cls: '' };

        return `
          <div class="card notif-card ${!isRead ? 'unread' : ''}" 
               data-notif-id="${item.id}" 
               data-notif-type="${esc(item.type)}" 
               data-notif-read="${isRead ? 'read' : 'unread'}"
               style="padding:16px 20px;cursor:pointer;border-left:4px solid ${!isRead ? 'var(--primary)' : 'var(--line)'};background:${!isRead ? 'var(--c2)' : '#fff'}">
            <div class="ctr" style="align-items:flex-start;flex-wrap:wrap;gap:12px">
              <div style="display:flex;gap:14px;align-items:flex-start;flex:1 1 320px">
                <span class="ic" style="width:42px;height:42px;border-radius:12px;background:#fff;display:grid;place-items:center;flex:none;color:${!isRead ? 'var(--primary)' : 'var(--muted)'};box-shadow:0 1px 3px rgba(0,0,0,.08)">
                  ${ms(tc.icon)}
                </span>
                <div>
                  <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:4px">
                    <b style="font-size:15px;color:var(--text)">${tc.label}</b>
                    ${!isRead ? pill('Baru', 'mint') : ''}
                    ${pill(tc.tag, tc.tagCls)}
                  </div>
                  <p style="margin:0 0 6px;font-size:13px;color:var(--muted);line-height:1.4">
                    ${esc(tc.desc)}
                    ${item.bill_id ? ` (Faktur Tagihan #${item.bill_id})` : ''}
                  </p>
                  <small style="color:var(--muted);display:flex;gap:12px;align-items:center;font-size:11px">
                    <span>${ms('schedule')}${formatTime(item)}</span>
                    <span>${pill(sc.label, sc.cls)}</span>
                  </small>
                </div>
              </div>
              <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:4px">
                <button class="btn sm s" data-open-notif="${item.id}">
                  ${ms('visibility')} Detail
                </button>
                <button class="btn sm p" data-go="${tc.actionGo}">
                  ${tc.actionLabel}
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('') : `
        <div class="card" style="padding:40px 20px">
          ${emptyView(
            'Belum Ada Notifikasi',
            'Kotak pemberitahuan Anda masih kosong. Pengingat tagihan dan konfirmasi pembayaran akan tercatat di sini secara otomatis.',
            'notifications_none'
          )}
        </div>
      `}
    </div>

    <!-- Edukasi Notifikasi Bot Telegram -->
    <div class="note" style="margin-top:16px;display:flex;gap:14px;padding:16px;background:var(--c1)">
      <span class="ic" style="width:40px;height:40px;border-radius:12px;background:#fff;display:grid;place-items:center;flex:none;color:var(--primary)">
        ${ms('send')}
      </span>
      <div style="font-size:12px">
        <b style="color:var(--primary-d);font-size:13px;display:block;margin-bottom:2px">
          Kanal Distribusi Otomatis Telegram
        </b>
        <span style="color:var(--muted)">
          Setiap notifikasi di atas juga diteruskan ke akun Telegram Anda secara instan jika bot telah dihubungkan. Kunjungi menu Layanan & Kendala untuk menghubungkan bot Telegram.
        </span>
      </div>
    </div>
  `;

  return {
    html,
    after() {
      // Handler Filter Tab
      const tabContainer = document.getElementById('notif-tabs');
      tabContainer?.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-tab-filter]');
        if (!btn) return;
        tabContainer.querySelectorAll('button').forEach((b) => b.classList.remove('on'));
        btn.classList.add('on');

        const filter = btn.dataset.tabFilter;
        const cards = document.querySelectorAll('#notif-list-container .notif-card');

        cards.forEach((card) => {
          const type = card.dataset.notifType;
          const isRead = card.dataset.notifRead === 'read';

          if (filter === 'all') {
            card.hidden = false;
          } else if (filter === 'unread') {
            card.hidden = isRead;
          } else if (filter === 'reminder') {
            card.hidden = !(type === 'due_reminder' || type === 'reminder');
          } else if (filter === 'payment_success') {
            card.hidden = type !== 'payment_success';
          }
        });
      });

      // Handler Tandai Semua Dibaca
      const markAllBtn = document.getElementById('btn-mark-all-read');
      markAllBtn?.addEventListener('click', () => {
        notifList.forEach((n) => readSet.add(n.id));
        saveReadSet(user.id, readSet);
        toast('Seluruh notifikasi telah ditandai sudah dibaca.', 'ok');
        document.querySelectorAll('.bell').forEach((b) => b.classList.remove('has'));
        go('notifikasi');
      });

      // Handler Klik Kartu Notifikasi untuk Detail
      document.addEventListener('click', (e) => {
        const trigger = e.target.closest('[data-open-notif]') || e.target.closest('.notif-card');
        if (!trigger) return;

        // Jangan trigger modal jika mengklik tombol aksi data-go langsung
        if (e.target.closest('[data-go]') && !e.target.closest('[data-open-notif]')) return;

        const notifId = Number(trigger.dataset.openNotif || trigger.dataset.notifId);
        const item = notifList.find((n) => n.id === notifId);
        if (!item) return;

        // Tandai item ini sudah dibaca
        if (!readSet.has(item.id)) {
          readSet.add(item.id);
          saveReadSet(user.id, readSet);
          trigger.dataset.notifRead = 'read';
          trigger.classList.remove('unread');
          trigger.style.borderLeftColor = 'var(--line)';
          trigger.style.background = '#fff';

          // Sinkronkan badge lonceng navbar
          const remainingUnread = notifList.filter((n) => !readSet.has(n.id)).length;
          document.querySelectorAll('.bell').forEach((b) => b.classList.toggle('has', remainingUnread > 0));
        }

        modal(renderNotifDetailModal(item, user));
      });
    },
  };
}
