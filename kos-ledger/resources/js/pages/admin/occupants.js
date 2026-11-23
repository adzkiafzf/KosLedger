import { getOccupancies, createOccupancy } from '../../api/occupancies.js';
import { getUsers } from '../../api/users.js';
import { getRooms } from '../../api/rooms.js';
import { apiError, fieldErrors } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, avatar, ms, modal, closeModal, mhead, kvs, toast } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { emptyView, errorView, loadingView } from '../../components/states.js';
import { esc, tgl, rp, initials } from '../../utils/format.js';

function occupancyRows(occupancies, usersMap, roomsMap) {
  return occupancies.map((item) => {
    const isAktif = item.status === 'active';
    const userObj = usersMap.get(Number(item.user_id)) || item.user || {};
    const roomObj = roomsMap.get(Number(item.room_id)) || item.room || {};

    const kamarStr = roomObj.room_number ? `Kamar ${esc(roomObj.room_number)}` : '-';
    const rateStr = roomObj.monthly_rate ? rp(roomObj.monthly_rate) : '<span style="color:var(--muted)">–</span>';
    const contactStr = userObj.phone ? esc(userObj.phone) : (userObj.username ? `@${esc(userObj.username)}` : '–');

    return [
      `<div class="cell">
        ${avatar(esc(initials(userObj.name || item.user?.name || 'P')))}
        <div>
          <b>${esc(userObj.name || item.user?.name || 'Penghuni')}</b>
          ${userObj.nickname ? `<small style="color:var(--muted);display:block">"${esc(userObj.nickname)}"</small>` : ''}
        </div>
      </div>`,
      `<span><b>${contactStr}</b><small style="color:var(--muted);display:block">@${esc(userObj.username || item.user?.username || '-')}</small></span>`,
      `<span class="chip">● ${kamarStr}</span>`,
      `<span class="num">${rateStr}</span>`,
      `<span><b>${item.start_date ? tgl(item.start_date) : '–'}</b></span>`,
      `<span data-status-val="${esc(item.status)}">${pill(isAktif ? 'Aktif Menempati' : esc(item.status), isAktif ? 'ok dot' : 'warn dot')}</span>`,
      `<div class="acts" style="justify-content:flex-end">
        <button class="btn sm s" data-occ-detail="${item.id}" aria-label="Lihat Detail Penempatan">${ms('visibility')} Detail</button>
      </div>`,
    ];
  });
}

function renderDetailModal(item, usersMap, roomsMap) {
  const isAktif = item.status === 'active';
  const userObj = usersMap.get(Number(item.user_id)) || item.user || {};
  const roomObj = roomsMap.get(Number(item.room_id)) || item.room || {};

  const kamarStr = roomObj.room_number ? `Kamar ${esc(roomObj.room_number)}` : 'Belum ditentukan';
  const tarifStr = roomObj.monthly_rate ? `${rp(roomObj.monthly_rate)} / bulan` : '–';
  const kapasitasStr = roomObj.capacity ? `${roomObj.capacity} Orang` : '–';

  return `
    ${mhead(userObj.name || 'Detail Penempatan', `Alokasi ${kamarStr}`, 'badge')}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px">
        <span class="lbl" style="font-size:11px">STATUS PENEMPATAN</span>
        ${pill(isAktif ? 'Aktif Menempati' : esc(item.status), isAktif ? 'ok dot' : 'warn dot')}
      </div>

      ${kvs([
        ['ID Penempatan', `#${item.id}`],
        ['Nama Penghuni', esc(userObj.name || '-')],
        ['Nama Panggilan', userObj.nickname ? esc(userObj.nickname) : '–'],
        ['Username Akun', userObj.username ? `@${esc(userObj.username)}` : '–'],
        ['Nomor Telepon / WA', userObj.phone ? esc(userObj.phone) : '–'],
        ['Unit Kamar', kamarStr],
        ['Tarif Sewa Kamar', tarifStr],
        ['Kapasitas Kamar', kapasitasStr],
        ['Tanggal Mulai Huni', item.start_date ? tgl(item.start_date) : '–'],
        ['Status Alokasi', isAktif ? 'Aktif Berjalan' : esc(item.status)],
      ])}

      <div class="note" style="margin-top:14px;background:var(--c1)">
        ${ms('info')}
        <span style="font-size:12px;color:var(--muted)">
          Penempatan ini aktif mengikat penghuni ke unit kamar tersebut. Penerbitan tagihan bulanan dan kuitansi pembayaran mengacu pada data alokasi ini.
        </span>
      </div>
    </div>
    <footer class="mf2">
      <button class="btn p" data-act="close">Tutup</button>
    </footer>
  `;
}

function showAssignModal(eligibleUsers, eligibleRooms, onSuccessCallback) {
  const todayStr = new Date().toISOString().split('T')[0];

  const userOptions = eligibleUsers.length > 0
    ? eligibleUsers.map((u) => `
        <option value="${u.id}">${esc(u.name)} ${u.nickname ? `(${esc(u.nickname)})` : ''} • @${esc(u.username)}</option>
      `).join('')
    : `<option value="" disabled selected>Semua penghuni aktif sudah memiliki kamar</option>`;

  const roomOptions = eligibleRooms.length > 0
    ? eligibleRooms.map((r) => {
        const occupied = Number(r.occupied_count) || 0;
        const remaining = r.capacity - occupied;
        return `
          <option value="${r.id}">Kamar ${esc(r.room_number)} • Sisa Kapasitas: ${remaining} Orang • ${rp(r.monthly_rate)}/bln</option>
        `;
      }).join('')
    : `<option value="" disabled selected>Tidak ada kamar tersedia (penuh / perbaikan)</option>`;

  modal(`
    ${mhead('Tempatkan Penghuni ke Kamar', 'Alokasikan unit kamar kost untuk penghuni aktif', 'add_home')}
    <form id="form-assign-room" class="mb">
      <div style="display:grid;gap:14px">
        <label class="mf">
          Pilih Penghuni Kost <i>*</i>
          <select class="in" id="assign_user_id" name="user_id" required ${eligibleUsers.length === 0 ? 'disabled' : ''}>
            ${eligibleUsers.length > 0 ? '<option value="">-- Pilih Penghuni Aktif --</option>' : ''}
            ${userOptions}
          </select>
          <span class="fe" id="e_assign_user_id"></span>
        </label>

        <label class="mf">
          Pilih Unit Kamar <i>*</i>
          <select class="in" id="assign_room_id" name="room_id" required ${eligibleRooms.length === 0 ? 'disabled' : ''}>
            ${eligibleRooms.length > 0 ? '<option value="">-- Pilih Kamar Tersedia --</option>' : ''}
            ${roomOptions}
          </select>
          <span class="fe" id="e_assign_room_id"></span>
        </label>

        <label class="mf">
          Tanggal Mulai Menempati <i>*</i>
          <input class="in" type="date" id="assign_start_date" name="start_date" value="${todayStr}" required>
          <span class="fe" id="e_assign_start_date"></span>
        </label>

        ${eligibleUsers.length === 0 ? `
          <div class="note" style="background:var(--warn-bg);padding:10px 12px;font-size:12px">
            ${ms('warning')}
            <span>Seluruh akun penghuni yang aktif saat ini telah memiliki penempatan kamar. Daftarkan akun baru di Manajemen Pengguna jika ada penghuni baru.</span>
          </div>
        ` : (eligibleRooms.length === 0 ? `
          <div class="note" style="background:var(--warn-bg);padding:10px 12px;font-size:12px">
            ${ms('warning')}
            <span>Seluruh unit kamar saat ini telah terisi penuh atau sedang dalam perbaikan. Tambah unit baru di Manajemen Kamar.</span>
          </div>
        ` : `
          <div class="note" style="background:var(--c1);padding:10px 12px;font-size:12px">
            ${ms('info')}
            <span>Backend secara otomatis memvalidasi ketersediaan kapasitas kamar dan memperbarui status kamar menjadi <b>Terisi</b> jika kapasitas maksimal tercapai.</span>
          </div>
        `)}

        <div id="assign-room-alert"></div>
      </div>

      <div class="mf2" style="margin-top:20px;padding:0">
        <button type="button" class="btn s" data-act="close">Batal</button>
        <button type="submit" class="btn p" id="btn-submit-assign" ${eligibleUsers.length === 0 || eligibleRooms.length === 0 ? 'disabled' : ''}>
          ${ms('check_circle')}Simpan Penempatan
        </button>
      </div>
    </form>
  `);

  const form = document.getElementById('form-assign-room');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-assign');
    const alertBox = document.getElementById('assign-room-alert');
    if (alertBox) alertBox.innerHTML = '';

    ['assign_user_id', 'assign_room_id', 'assign_start_date'].forEach((id) => {
      const errEl = document.getElementById('e_' + id);
      if (errEl) errEl.textContent = '';
      document.getElementById(id)?.classList.remove('bad');
    });

    const userId = parseInt(document.getElementById('assign_user_id')?.value, 10);
    const roomId = parseInt(document.getElementById('assign_room_id')?.value, 10);
    const startDate = document.getElementById('assign_start_date')?.value;

    let valid = true;
    if (!userId) {
      document.getElementById('e_assign_user_id').textContent = 'Pilih salah satu penghuni kost';
      document.getElementById('assign_user_id')?.classList.add('bad');
      valid = false;
    }
    if (!roomId) {
      document.getElementById('e_assign_room_id').textContent = 'Pilih unit kamar yang tersedia';
      document.getElementById('assign_room_id')?.classList.add('bad');
      valid = false;
    }
    if (!startDate) {
      document.getElementById('e_assign_start_date').textContent = 'Tanggal mulai huni wajib diisi';
      document.getElementById('assign_start_date')?.classList.add('bad');
      valid = false;
    }

    if (!valid) return;

    btn.disabled = true;
    btn.innerHTML = `<span class="spin" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span>Menempatkan...`;

    try {
      await createOccupancy({
        user_id: userId,
        room_id: roomId,
        start_date: startDate,
      });
      closeModal();
      toast('Penghuni berhasil ditempatkan ke kamar.', 'ok');
      if (typeof onSuccessCallback === 'function') onSuccessCallback();
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `${ms('check_circle')}Simpan Penempatan`;

      const fe = fieldErrors(err);
      if (fe.user_id) {
        document.getElementById('e_assign_user_id').textContent = fe.user_id[0];
        document.getElementById('assign_user_id')?.classList.add('bad');
      }
      if (fe.room_id) {
        document.getElementById('e_assign_room_id').textContent = fe.room_id[0];
        document.getElementById('assign_room_id')?.classList.add('bad');
      }
      if (fe.start_date) {
        document.getElementById('e_assign_start_date').textContent = fe.start_date[0];
        document.getElementById('assign_start_date')?.classList.add('bad');
      }

      const msg = apiError(err) || err?.response?.data?.message || 'Gagal menempatkan penghuni.';
      if (alertBox) {
        alertBox.innerHTML = errorView(msg);
      }
      toast(msg, 'err');
    }
  });
}

export default async function occupantsPage() {
  let occupancies = [];
  let users = [];
  let rooms = [];

  try {
    const [occRes, usersRes, roomsRes] = await Promise.all([
      getOccupancies(),
      getUsers(),
      getRooms(),
    ]);

    occupancies = Array.isArray(occRes) ? occRes : [];
    users = Array.isArray(usersRes) ? usersRes : [];
    rooms = Array.isArray(roomsRes) ? roomsRes : [];
  } catch (err) {
    return {
      html: `
        <div style="padding:16px 0">
          ${pageHead({
            crumb: `KosLedger › <b>Penempatan Penghuni</b>`,
            title: 'Manajemen Penempatan Penghuni',
            sub: 'Kelola alokasi unit kamar kost untuk penghuni aktif dengan validasi kapasitas kamar.',
          })}
          ${errorView(apiError(err) || 'Gagal memuat data penempatan penghuni dari server.')}
          <div style="margin-top:16px">
            <button class="btn s" id="btn-retry-occupants">${ms('refresh')}Coba Lagi</button>
          </div>
        </div>
      `,
      after() {
        document.getElementById('btn-retry-occupants')?.addEventListener('click', () => go('admin-penghuni'));
      },
    };
  }

  // Peta cepat untuk look-up relasi
  const usersMap = new Map(users.map((u) => [Number(u.id), u]));
  const roomsMap = new Map(rooms.map((r) => [Number(r.id), r]));

  // ID penghuni yang saat ini memiliki penempatan aktif
  const activeOccupancies = occupancies.filter((o) => o.status === 'active');
  const activeUserIds = new Set(activeOccupancies.map((o) => Number(o.user_id)));

  // Penghuni aktif yang belum ditempatkan ke kamar
  const eligibleUsers = users.filter((u) => u.role === 'anggota' && u.is_active && !activeUserIds.has(Number(u.id)));

  // Kamar yang masih memiliki sisa kapasitas dan tidak sedang maintenance
  const eligibleRooms = rooms.filter((r) => {
    const isMaintenance = r.status === 'maintenance';
    const occupiedCount = Number(r.occupied_count) || 0;
    return !isMaintenance && occupiedCount < r.capacity;
  });

  // Statistik aktual
  const totalOcc = occupancies.length;
  const activeOccCount = activeOccupancies.length;
  const occupiedTenantsCount = activeUserIds.size;
  const availableRoomsCount = eligibleRooms.length;
  const unassignedTenantsCount = eligibleUsers.length;

  const html = `
    <!-- Header Halaman Manajemen Penempatan -->
    ${pageHead({
      crumb: `KosLedger › <b>Penempatan Penghuni</b>`,
      title: 'Manajemen Penempatan Penghuni',
      sub: 'Alokasikan unit kamar kost untuk penghuni aktif dengan kontrol sisa kapasitas unit secara real-time.',
      acts: `
        <button class="btn p" id="btn-open-assign">${ms('add_home')}Tempatkan Penghuni</button>
      `,
    })}

    <!-- Ringkasan Statistik Penempatan -->
    <div class="grid g4" style="margin-bottom:20px">
      ${statCard(
        'PENEMPATAN AKTIF',
        `${activeOccCount} <small>Alokasi</small>`,
        `<span style="color:var(--text)">Hunian Berjalan</span>`,
        'badge'
      )}

      ${statCard(
        'PENGHUNI BERKAMAR',
        `${occupiedTenantsCount} <small>Orang</small>`,
        pill('Penghuni Aktif', 'ok'),
        'how_to_reg'
      )}

      ${statCard(
        'KAMAR BERKAPASITAS',
        `${availableRoomsCount} <small>Kamar</small>`,
        pill(`${availableRoomsCount} Siap Huni`, availableRoomsCount > 0 ? 'mint dot' : 'warn dot'),
        'door_open'
      )}

      ${statCard(
        'BELUM DITEMPATKAN',
        `${unassignedTenantsCount} <small>Orang</small>`,
        pill(`${unassignedTenantsCount} Perlu Kamar`, unassignedTenantsCount > 0 ? 'warn dot' : ''),
        'person_search'
      )}
    </div>

    <!-- Banner Informasi Otoritas Alokasi Hunian -->
    <div class="card" style="background:var(--c1);border-left:4px solid var(--primary);margin-bottom:16px">
      <div class="ctr" style="align-items:flex-start;flex-wrap:wrap;gap:12px">
        <div>
          <h3 style="margin-bottom:4px">Validasi Alokasi Kamar & Kapasitas</h3>
          <p class="sub" style="margin:0">
            Penghuni yang sudah memiliki kamar aktif tidak dapat dialokasikan ganda. Kamar yang telah mencapai batas kapasitas otomatis berstatus terisi penuh.
          </p>
        </div>
        <span class="pill ok">${ms('verified')}Dual-Check Guard</span>
      </div>
    </div>

    <!-- Tabel dan Filter Penempatan -->
    <div class="card">
      <div class="filter" style="margin-bottom:14px;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between">
        <div style="display:flex;gap:10px;flex:1 1 280px;align-items:center">
          ${searchField('Cari nama penghuni, username, nomor kamar...', 'table-admin-occupants')}
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <div class="tabs" id="occ-status-tabs">
            <button class="on" data-status="">Semua (${totalOcc})</button>
            <button data-status="active">Aktif (${activeOccCount})</button>
            <button data-status="inactive">Riwayat (${totalOcc - activeOccCount})</button>
          </div>
          <button class="btn s sm" id="btn-reset-occ-filter" title="Reset filter">${ms('restart_alt')}Reset</button>
        </div>
      </div>

      ${dataTable(
        ['Nama Penghuni', 'Kontak / Akun', 'Nomor Kamar', '>Tarif Sewa', 'Mulai Masuk', 'Status', '>Aksi'],
        occupancyRows(occupancies, usersMap, roomsMap),
        {
          id: 'table-admin-occupants',
          min: 740,
          emptyTitle: 'Belum Ada Penempatan Penghuni',
          emptyText: 'Belum ada penghuni yang dialokasikan ke unit kamar. Klik tombol Tempatkan Penghuni untuk membuat alokasi kamar baru.',
          emptyIcon: 'badge',
        }
      )}
    </div>
  `;

  return {
    html,
    after() {
      // 1. Tombol Buka Modal Tempatkan Penghuni
      document.getElementById('btn-open-assign')?.addEventListener('click', () => {
        showAssignModal(eligibleUsers, eligibleRooms, () => go('admin-penghuni'));
      });

      // 2. Filter Status Tabs
      const tabButtons = document.querySelectorAll('#occ-status-tabs button');
      tabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          tabButtons.forEach((b) => b.classList.remove('on'));
          btn.classList.add('on');
          applyOccFilters();
        });
      });

      // 3. Tombol Reset Filter
      document.getElementById('btn-reset-occ-filter')?.addEventListener('click', () => {
        const searchInput = document.querySelector('input[data-filter="table-admin-occupants"]');
        if (searchInput) searchInput.value = '';
        tabButtons.forEach((b) => b.classList.remove('on'));
        tabButtons[0]?.classList.add('on');
        applyOccFilters();
      });

      // 4. Input Pencarian Real-Time
      const searchInput = document.querySelector('input[data-filter="table-admin-occupants"]');
      searchInput?.addEventListener('input', () => {
        applyOccFilters();
      });

      function applyOccFilters() {
        const activeTab = document.querySelector('#occ-status-tabs button.on');
        const statusFilter = activeTab ? activeTab.dataset.status : '';
        const searchVal = (searchInput?.value || '').toLowerCase().trim();

        const rows = document.querySelectorAll('#table-admin-occupants tbody tr');
        rows.forEach((tr) => {
          const statusVal = tr.querySelector('[data-status-val]')?.dataset?.statusVal || '';
          const textContent = tr.textContent.toLowerCase();

          let matchStatus = true;
          if (statusFilter === 'active') {
            matchStatus = statusVal === 'active';
          } else if (statusFilter === 'inactive') {
            matchStatus = statusVal !== 'active';
          }

          const matchSearch = !searchVal || textContent.includes(searchVal);

          tr.hidden = !(matchStatus && matchSearch);
        });
      }

      // 5. Tombol Detail Penempatan
      document.querySelectorAll('[data-occ-detail]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.occDetail;
          const target = occupancies.find((o) => String(o.id) === String(id));
          if (target) {
            modal(renderDetailModal(target, usersMap, roomsMap));
          }
        });
      });
    },
  };
}
