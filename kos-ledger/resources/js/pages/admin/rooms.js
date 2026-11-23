import { getRooms, getRoom, createRoom, updateRoom } from '../../api/rooms.js';
import { apiError, fieldErrors } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, avatar, ms, modal, closeModal, mhead, kvs, toast } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { emptyView, errorView, loadingView } from '../../components/states.js';
import { esc, rp, tgl, initials } from '../../utils/format.js';

const STATUS_MAP = {
  available: { label: 'Tersedia', cls: 'mint dot' },
  occupied: { label: 'Terisi', cls: 'ok dot' },
  maintenance: { label: 'Dalam Perbaikan', cls: 'warn dot' },
};

function roomRows(rooms) {
  return rooms.map((r) => {
    const st = STATUS_MAP[r.status] || { label: r.status, cls: '' };
    const occupiedCount = Number(r.occupied_count) || 0;
    const initialText = esc(String(r.room_number || '').replace('-', ''));

    return [
      `<div class="cell">${avatar(initialText)}<span><b>Kamar ${esc(r.room_number)}</b></span></div>`,
      `<span><b>${r.capacity} Orang</b><small style="color:var(--muted);display:block">Terisi: ${occupiedCount} orang</small></span>`,
      `<span class="num">${rp(r.monthly_rate)}</span>`,
      `<span data-status-val="${esc(r.status)}">${pill(st.label, st.cls)}</span>`,
      `<div class="acts" style="justify-content:flex-end;gap:6px">
        <button class="btn sm s" data-room-detail="${r.id}" aria-label="Lihat Detail Kamar">${ms('visibility')} Detail</button>
        <button class="btn sm s" data-room-edit="${r.id}" aria-label="Edit Kamar">${ms('edit')} Edit</button>
      </div>`,
    ];
  });
}

function renderDetailModal(r) {
  const st = STATUS_MAP[r.status] || { label: r.status, cls: '' };
  const occupancies = Array.isArray(r.active_occupancies || r.activeOccupancies)
    ? (r.active_occupancies || r.activeOccupancies)
    : [];

  const occupantsHtml = occupancies.length > 0 ? `
    <div style="margin:14px 0 8px">
      <b style="font-size:13px;display:flex;gap:6px;align-items:center;color:var(--primary-d)">
        ${ms('group')}Daftar Penghuni Aktif (${occupancies.length} Orang)
      </b>
    </div>
    <div style="display:grid;gap:8px;margin-bottom:14px">
      ${occupancies.map((occ) => {
        const u = occ.user || {};
        return `
          <div class="note" style="justify-content:space-between;align-items:center;background:#fff;border:1px solid var(--line);padding:10px 12px">
            <div style="display:flex;gap:10px;align-items:center">
              <span class="avatar" style="width:32px;height:32px;font-size:12px;flex:none">${esc((u.name || 'P').trim().split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase() || 'P')}</span>
              <div>
                <b style="font-size:13px;color:var(--text)">${esc(u.name || 'Penghuni')}</b>
                ${u.nickname ? `<small style="color:var(--muted);display:block">"${esc(u.nickname)}"</small>` : ''}
              </div>
            </div>
            <div style="text-align:right">
              <span class="lbl" style="font-size:10px">Mulai Huni</span>
              <small style="display:block;font-weight:500">${occ.start_date ? tgl(occ.start_date) : '-'}</small>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  ` : `
    <div class="note" style="margin-top:12px;background:var(--c1)">
      ${ms('info')}
      <span style="font-size:12px;color:var(--muted)">
        Kamar ini saat ini belum memiliki penghuni aktif (unit kosong siap huni).
      </span>
    </div>
  `;

  return `
    ${mhead(`Detail Kamar ${esc(r.room_number)}`, 'Spesifikasi Unit & Daftar Penghuni', 'meeting_room')}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px">
        <span class="lbl" style="font-size:11px">STATUS OPERASIONAL</span>
        ${pill(st.label, st.cls)}
      </div>

      ${kvs([
        ['Nomor Unit', `Kamar ${esc(r.room_number)}`],
        ['Kapasitas Maksimal', `${r.capacity} Orang`],
        ['Terisi Saat Ini', `${occupancies.length} Orang`],
        ['Tarif Sewa Bulanan', `${rp(r.monthly_rate)} / bulan`],
        ['Status Ketersediaan', st.label],
      ])}

      ${occupantsHtml}
    </div>
    <footer class="mf2">
      <button class="btn s" data-room-edit-from-detail="${r.id}">${ms('edit')}Edit Kamar</button>
      <button class="btn p" data-act="close">Tutup</button>
    </footer>
  `;
}

async function showRoomDetail(id) {
  modal(`
    ${mhead('Memuat Detail Kamar…', '', 'meeting_room')}
    <div class="mb">${loadingView('Mengambil data spesifikasi kamar dari server…')}</div>
    <footer class="mf2"><button class="btn s" data-act="close">Batal</button></footer>
  `);

  try {
    const room = await getRoom(id);
    modal(renderDetailModal(room));

    // Pasang tombol edit langsung dari modal detail
    document.querySelector('[data-room-edit-from-detail]')?.addEventListener('click', () => {
      showEditModal(room);
    });
  } catch (err) {
    modal(`
      ${mhead('Gagal Memuat Detail Kamar', '', 'error')}
      <div class="mb">${errorView(apiError(err))}</div>
      <footer class="mf2"><button class="btn p" data-act="close">Tutup</button></footer>
    `);
  }
}

function showAddModal(onSuccessCallback) {
  modal(`
    ${mhead('Tambah Kamar Baru', 'Daftarkan nomor unit kamar baru ke dalam sistem', 'meeting_room')}
    <form id="form-add-room" class="mb">
      <div style="display:grid;gap:14px">
        <label class="mf">
          Nomor Kamar <i>*</i>
          <input class="in" type="text" id="add_room_number" name="room_number" placeholder="Contoh: A-01, B-02" required maxlength="20" autocomplete="off">
          <span class="fe" id="e_add_room_number"></span>
        </label>

        <div class="two">
          <label class="mf">
            Tarif Sewa Bulanan (Rp) <i>*</i>
            <input class="in" type="number" id="add_monthly_rate" name="monthly_rate" placeholder="Contoh: 1500000" required min="1" autocomplete="off">
            <span class="fe" id="e_add_monthly_rate"></span>
          </label>

          <label class="mf">
            Kapasitas (Orang) <i>*</i>
            <input class="in" type="number" id="add_capacity" name="capacity" value="1" required min="1" max="10" autocomplete="off">
            <span class="fe" id="e_add_capacity"></span>
          </label>
        </div>

        <label class="mf">
          Status Operasional <i>*</i>
          <select class="in" id="add_status" name="status">
            <option value="available" selected>Tersedia (Siap Huni)</option>
            <option value="maintenance">Dalam Perbaikan (Maintenance)</option>
            <option value="occupied">Terisi (Occupied)</option>
          </select>
          <span class="fe" id="e_add_status"></span>
        </label>

        <div id="add-room-alert"></div>
      </div>

      <div class="mf2" style="margin-top:20px;padding:0">
        <button type="button" class="btn s" data-act="close">Batal</button>
        <button type="submit" class="btn p" id="btn-submit-add-room">${ms('save')}Simpan Kamar</button>
      </div>
    </form>
  `);

  const form = document.getElementById('form-add-room');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-add-room');
    const alertBox = document.getElementById('add-room-alert');
    if (alertBox) alertBox.innerHTML = '';

    // Bersihkan pesan error sebelumnya
    ['add_room_number', 'add_monthly_rate', 'add_capacity', 'add_status'].forEach((id) => {
      const errEl = document.getElementById('e_' + id);
      if (errEl) errEl.textContent = '';
      document.getElementById(id)?.classList.remove('bad');
    });

    const roomNumber = document.getElementById('add_room_number')?.value.trim();
    const monthlyRate = parseInt(document.getElementById('add_monthly_rate')?.value, 10);
    const capacity = parseInt(document.getElementById('add_capacity')?.value, 10);
    const status = document.getElementById('add_status')?.value;

    // Validasi frontend dasar
    let valid = true;
    if (!roomNumber) {
      document.getElementById('e_add_room_number').textContent = 'Nomor kamar wajib diisi';
      document.getElementById('add_room_number')?.classList.add('bad');
      valid = false;
    }
    if (!monthlyRate || monthlyRate < 1) {
      document.getElementById('e_add_monthly_rate').textContent = 'Tarif sewa harus lebih dari 0';
      document.getElementById('add_monthly_rate')?.classList.add('bad');
      valid = false;
    }
    if (!capacity || capacity < 1 || capacity > 10) {
      document.getElementById('e_add_capacity').textContent = 'Kapasitas kamar antara 1 s.d 10 orang';
      document.getElementById('add_capacity')?.classList.add('bad');
      valid = false;
    }

    if (!valid) return;

    btn.disabled = true;
    btn.innerHTML = `<span class="spin" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span>Menyimpan...`;

    try {
      await createRoom({
        room_number: roomNumber,
        monthly_rate: monthlyRate,
        capacity: capacity,
        status: status || 'available',
      });
      closeModal();
      toast(`Kamar ${roomNumber} berhasil ditambahkan.`, 'ok');
      if (typeof onSuccessCallback === 'function') onSuccessCallback();
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `${ms('save')}Simpan Kamar`;

      const fe = fieldErrors(err);
      if (fe.room_number) {
        document.getElementById('e_add_room_number').textContent = fe.room_number[0];
        document.getElementById('add_room_number')?.classList.add('bad');
      }
      if (fe.monthly_rate) {
        document.getElementById('e_add_monthly_rate').textContent = fe.monthly_rate[0];
        document.getElementById('add_monthly_rate')?.classList.add('bad');
      }
      if (fe.capacity) {
        document.getElementById('e_add_capacity').textContent = fe.capacity[0];
        document.getElementById('add_capacity')?.classList.add('bad');
      }
      if (fe.status) {
        document.getElementById('e_add_status').textContent = fe.status[0];
        document.getElementById('add_status')?.classList.add('bad');
      }

      if (alertBox) {
        alertBox.innerHTML = errorView(apiError(err) || 'Gagal menambahkan kamar.');
      }
    }
  });
}

function showEditModal(room, onSuccessCallback) {
  const occupiedCount = Number(room.occupied_count) || 0;

  modal(`
    ${mhead(`Edit Kamar ${esc(room.room_number)}`, 'Perbarui spesifikasi, tarif, kapasitas, atau status operasional', 'edit')}
    <form id="form-edit-room" class="mb">
      <div style="display:grid;gap:14px">
        <label class="mf">
          Nomor Kamar <i>*</i>
          <input class="in" type="text" id="edit_room_number" name="room_number" value="${esc(room.room_number)}" required maxlength="20" autocomplete="off">
          <span class="fe" id="e_edit_room_number"></span>
        </label>

        <div class="two">
          <label class="mf">
            Tarif Sewa Bulanan (Rp) <i>*</i>
            <input class="in" type="number" id="edit_monthly_rate" name="monthly_rate" value="${room.monthly_rate}" required min="1" autocomplete="off">
            <span class="fe" id="e_edit_monthly_rate"></span>
          </label>

          <label class="mf">
            Kapasitas (Orang) <i>*</i>
            <input class="in" type="number" id="edit_capacity" name="capacity" value="${room.capacity}" required min="1" max="10" autocomplete="off">
            <span class="fe" id="e_edit_capacity"></span>
          </label>
        </div>

        <label class="mf">
          Status Operasional <i>*</i>
          <select class="in" id="edit_status" name="status">
            <option value="available" ${room.status === 'available' ? 'selected' : ''}>Tersedia (Siap Huni)</option>
            <option value="occupied" ${room.status === 'occupied' ? 'selected' : ''}>Terisi (Occupied)</option>
            <option value="maintenance" ${room.status === 'maintenance' ? 'selected' : ''}>Dalam Perbaikan (Maintenance)</option>
          </select>
          <span class="fe" id="e_edit_status"></span>
        </label>

        ${occupiedCount > 0 ? `
          <div class="note" style="background:var(--warn-bg);padding:10px 12px;font-size:12px">
            ${ms('warning')}
            <span>Kamar ini saat ini ditempati oleh <b>${occupiedCount} penghuni aktif</b>. Perubahan status menjadi "Dalam Perbaikan" memerlukan koordinasi relokasi penghuni.</span>
          </div>
        ` : ''}

        <div id="edit-room-alert"></div>
      </div>

      <div class="mf2" style="margin-top:20px;padding:0">
        <button type="button" class="btn s" data-act="close">Batal</button>
        <button type="submit" class="btn p" id="btn-submit-edit-room">${ms('save')}Simpan Perubahan</button>
      </div>
    </form>
  `);

  const form = document.getElementById('form-edit-room');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-edit-room');
    const alertBox = document.getElementById('edit-room-alert');
    if (alertBox) alertBox.innerHTML = '';

    // Bersihkan pesan error sebelumnya
    ['edit_room_number', 'edit_monthly_rate', 'edit_capacity', 'edit_status'].forEach((id) => {
      const errEl = document.getElementById('e_' + id);
      if (errEl) errEl.textContent = '';
      document.getElementById(id)?.classList.remove('bad');
    });

    const roomNumber = document.getElementById('edit_room_number')?.value.trim();
    const monthlyRate = parseInt(document.getElementById('edit_monthly_rate')?.value, 10);
    const capacity = parseInt(document.getElementById('edit_capacity')?.value, 10);
    const status = document.getElementById('edit_status')?.value;

    // Validasi frontend dasar
    let valid = true;
    if (!roomNumber) {
      document.getElementById('e_edit_room_number').textContent = 'Nomor kamar wajib diisi';
      document.getElementById('edit_room_number')?.classList.add('bad');
      valid = false;
    }
    if (!monthlyRate || monthlyRate < 1) {
      document.getElementById('e_edit_monthly_rate').textContent = 'Tarif sewa harus lebih dari 0';
      document.getElementById('edit_monthly_rate')?.classList.add('bad');
      valid = false;
    }
    if (!capacity || capacity < 1 || capacity > 10) {
      document.getElementById('e_edit_capacity').textContent = 'Kapasitas kamar antara 1 s.d 10 orang';
      document.getElementById('edit_capacity')?.classList.add('bad');
      valid = false;
    }

    if (!valid) return;

    btn.disabled = true;
    btn.innerHTML = `<span class="spin" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span>Menyimpan...`;

    try {
      await updateRoom(room.id, {
        room_number: roomNumber,
        monthly_rate: monthlyRate,
        capacity: capacity,
        status: status,
      });
      closeModal();
      toast(`Data Kamar ${roomNumber} berhasil diperbarui.`, 'ok');
      if (typeof onSuccessCallback === 'function') onSuccessCallback();
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `${ms('save')}Simpan Perubahan`;

      const fe = fieldErrors(err);
      if (fe.room_number) {
        document.getElementById('e_edit_room_number').textContent = fe.room_number[0];
        document.getElementById('edit_room_number')?.classList.add('bad');
      }
      if (fe.monthly_rate) {
        document.getElementById('e_edit_monthly_rate').textContent = fe.monthly_rate[0];
        document.getElementById('edit_monthly_rate')?.classList.add('bad');
      }
      if (fe.capacity) {
        document.getElementById('e_edit_capacity').textContent = fe.capacity[0];
        document.getElementById('edit_capacity')?.classList.add('bad');
      }
      if (fe.status) {
        document.getElementById('e_edit_status').textContent = fe.status[0];
        document.getElementById('edit_status')?.classList.add('bad');
      }

      if (alertBox) {
        alertBox.innerHTML = errorView(apiError(err) || 'Gagal memperbarui kamar.');
      }
    }
  });
}

export default async function roomsPage() {
  let rooms = [];

  try {
    rooms = await getRooms();
    if (!Array.isArray(rooms)) rooms = [];
  } catch (err) {
    return {
      html: `
        <div style="padding:16px 0">
          ${pageHead({
            crumb: `KosLedger › <b>Katalog Kamar</b>`,
            title: 'Manajemen Kamar',
            sub: 'Kelola unit kamar kost, tarif sewa bulanan, kapasitas hunian, dan status operasional.',
          })}
          ${errorView(apiError(err) || 'Gagal memuat daftar kamar dari server.')}
          <div style="margin-top:16px">
            <button class="btn s" id="btn-retry-rooms">${ms('refresh')}Coba Lagi</button>
          </div>
        </div>
      `,
      after() {
        document.getElementById('btn-retry-rooms')?.addEventListener('click', () => go('admin-kamar'));
      },
    };
  }

  const total = rooms.length;
  const occupied = rooms.filter((r) => r.status === 'occupied' || Number(r.occupied_count) > 0).length;
  const available = rooms.filter((r) => r.status === 'available').length;
  const maintenance = rooms.filter((r) => r.status === 'maintenance').length;
  const occRate = total > 0 ? Math.round((occupied / total) * 100) : 0;

  const html = `
    <!-- Header Halaman Manajemen Kamar -->
    ${pageHead({
      crumb: `KosLedger › <b>Katalog Kamar</b>`,
      title: 'Manajemen Kamar',
      sub: 'Kelola inventaris fisik unit kamar kost, tarif sewa bulanan, kapasitas hunian, dan status operasional.',
      acts: `
        <button class="btn p" id="btn-add-room">${ms('add')}Tambah Kamar</button>
      `,
    })}

    <!-- Ringkasan Statistik Kamar -->
    <div class="grid g4" style="margin-bottom:20px">
      ${statCard(
        'TOTAL KAMAR',
        `${total} <small>Unit</small>`,
        `<span style="color:var(--text)">${occupied} Terisi • ${available} Kosong</span>`,
        'domain'
      )}

      ${statCard(
        'KAMAR TERISI',
        `${occupied} <small>Unit</small>`,
        pill(`${occRate}% Okupansi`, 'ok'),
        'meeting_room'
      )}

      ${statCard(
        'KAMAR TERSEDIA',
        `${available} <small>Unit</small>`,
        pill(`${available} Kosong`, available > 0 ? 'mint dot' : 'warn dot'),
        'event_available'
      )}

      ${statCard(
        'DALAM PERBAIKAN',
        `${maintenance} <small>Unit</small>`,
        pill(`${maintenance} Unit`, maintenance > 0 ? 'warn dot' : ''),
        'build'
      )}
    </div>

    <!-- Banner Informasi Peran Administrator -->
    <div class="card" style="background:var(--c1);border-left:4px solid var(--primary);margin-bottom:16px">
      <div class="ctr" style="align-items:flex-start;flex-wrap:wrap;gap:12px">
        <div>
          <h3 style="margin-bottom:4px">Tata Kelola Master Unit Kamar Kost</h3>
          <p class="sub" style="margin:0">
            Administrator memiliki wewenang penuh untuk menambahkan unit kamar baru, memperbarui spesifikasi tarif, serta mengalokasikan kamar ke penghuni.
          </p>
        </div>
        <span class="pill ok">${ms('shield')}Admin Authority</span>
      </div>
    </div>

    <!-- Tabel dan Filter Kamar -->
    <div class="card">
      <div class="filter" style="margin-bottom:14px;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between">
        <div style="display:flex;gap:10px;flex:1 1 280px;align-items:center">
          ${searchField('Cari nomor kamar, kapasitas...', 'table-admin-rooms')}
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <div class="tabs" id="room-status-tabs">
            <button class="on" data-status="">Semua (${total})</button>
            <button data-status="available">Tersedia (${available})</button>
            <button data-status="occupied">Terisi (${occupied})</button>
            <button data-status="maintenance">Perbaikan (${maintenance})</button>
          </div>
          <button class="btn s sm" id="btn-reset-filter" title="Reset filter">${ms('restart_alt')}Reset</button>
        </div>
      </div>

      ${dataTable(
        ['Nomor Kamar', 'Kapasitas & Hunian', '>Tarif Sewa / Bln', 'Status', '>Aksi'],
        roomRows(rooms),
        {
          id: 'table-admin-rooms',
          min: 680,
          emptyTitle: 'Belum Ada Kamar Terdaftar',
          emptyText: 'Unit kamar kost belum tersedia. Klik tombol Tambah Kamar untuk menambahkan unit kamar pertama.',
          emptyIcon: 'meeting_room',
        }
      )}
    </div>
  `;

  return {
    html,
    after() {
      // 1. Tombol Tambah Kamar
      document.getElementById('btn-add-room')?.addEventListener('click', () => {
        showAddModal(() => go('admin-kamar'));
      });

      // 2. Filter Status Tab
      const tabButtons = document.querySelectorAll('#room-status-tabs button');
      tabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          tabButtons.forEach((b) => b.classList.remove('on'));
          btn.classList.add('on');
          applyFilters();
        });
      });

      // 3. Tombol Reset Filter
      document.getElementById('btn-reset-filter')?.addEventListener('click', () => {
        const searchInput = document.querySelector('input[data-filter="table-admin-rooms"]');
        if (searchInput) searchInput.value = '';
        tabButtons.forEach((b) => b.classList.remove('on'));
        tabButtons[0]?.classList.add('on');
        applyFilters();
      });

      // 4. Input Pencarian real-time
      const searchInput = document.querySelector('input[data-filter="table-admin-rooms"]');
      searchInput?.addEventListener('input', () => {
        applyFilters();
      });

      function applyFilters() {
        const activeTab = document.querySelector('#room-status-tabs button.on');
        const statusFilter = activeTab ? activeTab.dataset.status : '';
        const searchVal = (searchInput?.value || '').toLowerCase().trim();

        const rows = document.querySelectorAll('#table-admin-rooms tbody tr');
        rows.forEach((tr) => {
          const statusVal = tr.querySelector('[data-status-val]')?.dataset?.statusVal || '';
          const textContent = tr.textContent.toLowerCase();

          const matchStatus = !statusFilter || statusVal === statusFilter;
          const matchSearch = !searchVal || textContent.includes(searchVal);

          tr.hidden = !(matchStatus && matchSearch);
        });
      }

      // 5. Tombol Detail Kamar
      document.querySelectorAll('[data-room-detail]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.roomDetail;
          if (id) showRoomDetail(id);
        });
      });

      // 6. Tombol Edit Kamar
      document.querySelectorAll('[data-room-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.roomEdit;
          const room = rooms.find((r) => String(r.id) === String(id));
          if (room) {
            showEditModal(room, () => go('admin-kamar'));
          } else {
            showRoomDetail(id);
          }
        });
      });
    },
  };
}
