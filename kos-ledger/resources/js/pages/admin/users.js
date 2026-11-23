import { getUsers, getUser, createUser, updateUser, deactivateUser } from '../../api/users.js';
import { apiError, fieldErrors } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, avatar, ms, modal, closeModal, mhead, kvs, toast } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { emptyView, errorView, loadingView } from '../../components/states.js';
import { passwordField, bindPasswordToggles } from '../../components/form.js';
import { esc, tgl, initials } from '../../utils/format.js';
import { ROLE_LABEL } from '../../core/roles.js';

function roleBadge(role) {
  const map = {
    admin: { label: 'Admin', cls: 'ok dot' },
    bendahara: { label: 'Bendahara', cls: 'mint dot' },
    pemilik: { label: 'Pemilik', cls: 'warn dot' },
    anggota: { label: 'Penghuni', cls: '' },
  };
  const r = map[role] || { label: ROLE_LABEL[role] || role, cls: '' };
  return pill(r.label, r.cls);
}

function statusBadge(isActive) {
  return isActive
    ? pill('Aktif', 'ok dot')
    : pill('Nonaktif', 'err dot');
}

function userRows(users, currentUser) {
  return users.map((u) => {
    const isSelf = String(u.id) === String(currentUser.id);
    const initialText = initials(u.name || u.username);
    const phoneText = u.phone ? esc(u.phone) : '<span style="color:var(--muted)">–</span>';
    const statusVal = u.is_active ? 'active' : 'inactive';

    let actionBtn = '';
    if (isSelf) {
      actionBtn = `<span class="chip" style="font-size:11px;background:var(--c1)">Akun Anda</span>`;
    } else if (!u.is_active) {
      actionBtn = `<span class="chip" style="font-size:11px;color:var(--muted)">Dinonaktifkan</span>`;
    } else {
      actionBtn = `
        <button class="btn sm s" data-user-deactivate="${u.id}" style="color:var(--err)" aria-label="Nonaktifkan Akun">
          ${ms('person_off')} Nonaktifkan
        </button>
      `;
    }

    return [
      `<div class="cell">
        ${avatar(initialText)}
        <div>
          <b>${esc(u.name)}</b>
          ${u.nickname ? `<small style="color:var(--muted);display:block">"${esc(u.nickname)}"</small>` : ''}
        </div>
      </div>`,
      u.username
        ? `<span class="mono" style="font-size:12px;color:var(--primary-d)">@${esc(u.username)}</span>`
        : `<span style="color:var(--muted);font-size:12px">–</span>`,
      `<span>${phoneText}</span>`,
      `<span data-role-val="${esc(u.role)}">${roleBadge(u.role)}</span>`,
      `<span data-status-val="${statusVal}">${statusBadge(u.is_active)}</span>`,
      `<span>${u.created_at ? tgl(u.created_at) : '–'}</span>`,
      `<div class="acts" style="justify-content:flex-end;gap:6px">
        <button class="btn sm s" data-user-detail="${u.id}" aria-label="Detail Pengguna">${ms('visibility')} Detail</button>
        <button class="btn sm s" data-user-edit="${u.id}" aria-label="Edit Pengguna">${ms('edit')} Edit</button>
        ${actionBtn}
      </div>`,
    ];
  });
}

function renderDetailModal(u, currentUser) {
  const isSelf = String(u.id) === String(currentUser.id);

  return `
    ${mhead(u.name, `Detail Akun @${esc(u.username)}`, 'person')}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px;flex-wrap:wrap;gap:8px">
        <div>
          <span class="lbl" style="font-size:10px">STATUS AKUN</span>
          <div>${statusBadge(u.is_active)}</div>
        </div>
        <div style="text-align:right">
          <span class="lbl" style="font-size:10px">HAK AKSES / PERAN</span>
          <div>${roleBadge(u.role)}</div>
        </div>
      </div>

      ${kvs([
        ['ID Pengguna', `#${u.id}`],
        ['Nama Lengkap', esc(u.name)],
        ['Nama Panggilan', u.nickname ? esc(u.nickname) : '<span style="color:var(--muted)">–</span>'],
        ['Username Akun', `<span class="mono">@${esc(u.username)}</span>`],
        ['Nomor Telepon / WA', u.phone ? esc(u.phone) : '<span style="color:var(--muted)">–</span>'],
        ['Peran Pengguna', ROLE_LABEL[u.role] || esc(u.role)],
        ['Status Akses', u.is_active ? 'Aktif (Dapat Login)' : 'Nonaktif (Akses Dicabut)'],
        ['Terhubung Telegram', u.telegram_chat_id ? `<span class="chip mono" style="color:var(--primary)">${esc(u.telegram_chat_id)}</span>` : '<span style="color:var(--muted)">Belum terhubung</span>'],
        ['Tanggal Bergabung', u.created_at ? tgl(u.created_at) : '–'],
      ])}

      ${isSelf ? `
        <div class="note" style="margin-top:14px;background:var(--c1)">
          ${ms('info')}
          <span style="font-size:12px;color:var(--muted)">
            Ini adalah akun administrator yang sedang Anda gunakan saat ini.
          </span>
        </div>
      ` : ''}
    </div>
    <footer class="mf2" style="flex-wrap:wrap;gap:8px">
      <button class="btn s" data-user-edit-from-detail="${u.id}">${ms('edit')}Edit Informasi</button>
      ${u.is_active && !isSelf ? `
        <button class="btn s" data-user-deactivate-from-detail="${u.id}" style="color:var(--err)">
          ${ms('person_off')}Nonaktifkan Akun
        </button>
      ` : ''}
      <button class="btn p" data-act="close">Tutup</button>
    </footer>
  `;
}

async function showUserDetail(id, currentUser, onRefresh) {
  modal(`
    ${mhead('Memuat Detail Pengguna…', '', 'person')}
    <div class="mb">${loadingView('Mengambil profil akun dari server…')}</div>
    <footer class="mf2"><button class="btn s" data-act="close">Batal</button></footer>
  `);

  try {
    const userDetail = await getUser(id);
    modal(renderDetailModal(userDetail, currentUser));

    // Tombol Edit dari detail
    document.querySelector('[data-user-edit-from-detail]')?.addEventListener('click', () => {
      showEditModal(userDetail, onRefresh);
    });

    // Tombol Nonaktifkan dari detail
    document.querySelector('[data-user-deactivate-from-detail]')?.addEventListener('click', () => {
      showDeactivateModal(userDetail, onRefresh);
    });
  } catch (err) {
    modal(`
      ${mhead('Gagal Memuat Detail', '', 'error')}
      <div class="mb">${errorView(apiError(err))}</div>
      <footer class="mf2"><button class="btn p" data-act="close">Tutup</button></footer>
    `);
  }
}

function showAddModal(onSuccessCallback) {
  modal(`
    ${mhead('Tambah Penghuni Baru', 'Daftarkan akun penyewa kamar baru (Role: Penghuni)', 'person_add')}
    <form id="form-add-user" class="mb">
      <div style="display:grid;gap:14px">
        <label class="mf">
          Nama Lengkap <i>*</i>
          <input class="in" type="text" id="add_name" name="name" placeholder="Contoh: Riska Maharani Dewi" required maxlength="255" autocomplete="off">
          <span class="fe" id="e_add_name"></span>
        </label>

        <div class="two">
          <label class="mf">
            Nama Panggilan
            <input class="in" type="text" id="add_nickname" name="nickname" placeholder="Contoh: Riska" maxlength="100" autocomplete="off">
            <span class="fe" id="e_add_nickname"></span>
          </label>

          <label class="mf">
            Nomor Telepon / WhatsApp
            <input class="in" type="tel" id="add_phone" name="phone" placeholder="Contoh: 081234567890" maxlength="20" autocomplete="off">
            <span class="fe" id="e_add_phone"></span>
          </label>
        </div>

        <label class="mf">
          Username Akun <i>*</i>
          <input class="in" type="text" id="add_username" name="username" placeholder="Contoh: riska_kos" required maxlength="100" autocomplete="off">
          <span class="fe" id="e_add_username"></span>
        </label>

        ${passwordField('add_password', 'Kata Sandi Awal', { ph: 'Minimal 6 karakter', req: true, auto: 'new-password' })}

        <div class="note" style="background:var(--c1);padding:10px 12px;font-size:12px">
          ${ms('info')}
          <span>Backend KosLedger menetapkan role secara otomatis sebagai <b>Penghuni (Anggota)</b> dengan status aktif.</span>
        </div>

        <div id="add-user-alert"></div>
      </div>

      <div class="mf2" style="margin-top:20px;padding:0">
        <button type="button" class="btn s" data-act="close">Batal</button>
        <button type="submit" class="btn p" id="btn-submit-add-user">${ms('person_add')}Daftarkan Penghuni</button>
      </div>
    </form>
  `);

  bindPasswordToggles();

  const form = document.getElementById('form-add-user');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-add-user');
    const alertBox = document.getElementById('add-user-alert');
    if (alertBox) alertBox.innerHTML = '';

    // Bersihkan error sebelumnya
    ['add_name', 'add_nickname', 'add_phone', 'add_username', 'add_password'].forEach((id) => {
      const errEl = document.getElementById('e_' + id);
      if (errEl) errEl.textContent = '';
      document.getElementById(id)?.classList.remove('bad');
    });

    const name = document.getElementById('add_name')?.value.trim();
    const nickname = document.getElementById('add_nickname')?.value.trim() || null;
    const phone = document.getElementById('add_phone')?.value.trim() || null;
    const username = document.getElementById('add_username')?.value.trim();
    const password = document.getElementById('add_password')?.value;

    let valid = true;
    if (!name) {
      document.getElementById('e_add_name').textContent = 'Nama lengkap wajib diisi';
      document.getElementById('add_name')?.classList.add('bad');
      valid = false;
    }
    if (!username) {
      document.getElementById('e_add_username').textContent = 'Username wajib diisi';
      document.getElementById('add_username')?.classList.add('bad');
      valid = false;
    }
    if (!password || password.length < 6) {
      document.getElementById('e_add_password').textContent = 'Kata sandi minimal 6 karakter';
      document.getElementById('add_password')?.classList.add('bad');
      valid = false;
    }

    if (!valid) return;

    btn.disabled = true;
    btn.innerHTML = `<span class="spin" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span>Mendaftarkan...`;

    try {
      await createUser({
        name,
        nickname,
        phone,
        username,
        password,
      });
      closeModal();
      toast(`Penghuni ${name} (@${username}) berhasil didaftarkan.`, 'ok');
      if (typeof onSuccessCallback === 'function') onSuccessCallback();
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `${ms('person_add')}Daftarkan Penghuni`;

      const fe = fieldErrors(err);
      if (fe.name) {
        document.getElementById('e_add_name').textContent = fe.name[0];
        document.getElementById('add_name')?.classList.add('bad');
      }
      if (fe.nickname) {
        document.getElementById('e_add_nickname').textContent = fe.nickname[0];
        document.getElementById('add_nickname')?.classList.add('bad');
      }
      if (fe.phone) {
        document.getElementById('e_add_phone').textContent = fe.phone[0];
        document.getElementById('add_phone')?.classList.add('bad');
      }
      if (fe.username) {
        document.getElementById('e_add_username').textContent = fe.username[0];
        document.getElementById('add_username')?.classList.add('bad');
      }
      if (fe.password) {
        document.getElementById('e_add_password').textContent = fe.password[0];
        document.getElementById('add_password')?.classList.add('bad');
      }

      if (alertBox) {
        alertBox.innerHTML = errorView(apiError(err) || 'Gagal mendaftarkan penghuni.');
      }
    }
  });
}

function showEditModal(user, onSuccessCallback) {
  modal(`
    ${mhead(`Edit Data Pengguna`, `Akun: @${esc(user.username)}`, 'edit')}
    <form id="form-edit-user" class="mb">
      <div style="display:grid;gap:14px">
        <div class="note" style="background:var(--c1);padding:10px 12px;display:flex;justify-content:space-between;align-items:center">
          <div>
            <span class="lbl" style="font-size:10px">USERNAME & PERAN</span>
            <div style="font-size:13px;font-weight:600">@${esc(user.username)} • ${ROLE_LABEL[user.role] || esc(user.role)}</div>
          </div>
          <small style="color:var(--muted)">Tetap (Read-Only)</small>
        </div>

        <label class="mf">
          Nama Lengkap <i>*</i>
          <input class="in" type="text" id="edit_name" name="name" value="${esc(user.name)}" required maxlength="255" autocomplete="off">
          <span class="fe" id="e_edit_name"></span>
        </label>

        <div class="two">
          <label class="mf">
            Nama Panggilan
            <input class="in" type="text" id="edit_nickname" name="nickname" value="${esc(user.nickname || '')}" maxlength="100" autocomplete="off">
            <span class="fe" id="e_edit_nickname"></span>
          </label>

          <label class="mf">
            Nomor Telepon / WhatsApp
            <input class="in" type="tel" id="edit_phone" name="phone" value="${esc(user.phone || '')}" maxlength="20" autocomplete="off">
            <span class="fe" id="e_edit_phone"></span>
          </label>
        </div>

        <div id="edit-user-alert"></div>
      </div>

      <div class="mf2" style="margin-top:20px;padding:0">
        <button type="button" class="btn s" data-act="close">Batal</button>
        <button type="submit" class="btn p" id="btn-submit-edit-user">${ms('save')}Simpan Perubahan</button>
      </div>
    </form>
  `);

  const form = document.getElementById('form-edit-user');
  form?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btn-submit-edit-user');
    const alertBox = document.getElementById('edit-user-alert');
    if (alertBox) alertBox.innerHTML = '';

    ['edit_name', 'edit_nickname', 'edit_phone'].forEach((id) => {
      const errEl = document.getElementById('e_' + id);
      if (errEl) errEl.textContent = '';
      document.getElementById(id)?.classList.remove('bad');
    });

    const name = document.getElementById('edit_name')?.value.trim();
    const nickname = document.getElementById('edit_nickname')?.value.trim() || null;
    const phone = document.getElementById('edit_phone')?.value.trim() || null;

    if (!name) {
      document.getElementById('e_edit_name').textContent = 'Nama lengkap wajib diisi';
      document.getElementById('edit_name')?.classList.add('bad');
      return;
    }

    btn.disabled = true;
    btn.innerHTML = `<span class="spin" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span>Menyimpan...`;

    try {
      await updateUser(user.id, {
        name,
        nickname,
        phone,
      });
      closeModal();
      toast(`Data ${name} berhasil diperbarui.`, 'ok');
      if (typeof onSuccessCallback === 'function') onSuccessCallback();
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `${ms('save')}Simpan Perubahan`;

      const fe = fieldErrors(err);
      if (fe.name) {
        document.getElementById('e_edit_name').textContent = fe.name[0];
        document.getElementById('edit_name')?.classList.add('bad');
      }
      if (fe.nickname) {
        document.getElementById('e_edit_nickname').textContent = fe.nickname[0];
        document.getElementById('edit_nickname')?.classList.add('bad');
      }
      if (fe.phone) {
        document.getElementById('e_edit_phone').textContent = fe.phone[0];
        document.getElementById('edit_phone')?.classList.add('bad');
      }

      if (alertBox) {
        alertBox.innerHTML = errorView(apiError(err) || 'Gagal memperbarui data pengguna.');
      }
    }
  });
}

function showDeactivateModal(user, onSuccessCallback) {
  modal(`
    ${mhead('Konfirmasi Nonaktifkan Akun', `Akun: ${esc(user.name)} (@${esc(user.username)})`, 'warning')}
    <div class="mb">
      <div class="note" style="background:var(--warn-bg);padding:14px;margin-bottom:14px">
        ${ms('warning')}
        <span style="font-size:13px;color:var(--text);line-height:1.5">
          Apakah Anda yakin ingin menonaktifkan akun <b>${esc(user.name)}</b> (@${esc(user.username)})?
          <br><br>
          <b>Konsekuensi:</b> Akun yang dinonaktifkan tidak akan dapat lagi masuk (login) ke sistem KosLedger. Status pengguna akan berubah menjadi nonaktif di master data.
        </span>
      </div>

      <div class="grid g2" style="margin:0">
        <button class="btn s" data-act="close">${ms('close')}Batal</button>
        <button class="btn p" id="btn-confirm-deactivate" style="background:var(--err);border-color:var(--err)">
          ${ms('person_off')}Ya, Nonaktifkan Akun
        </button>
      </div>
    </div>
  `);

  const confirmBtn = document.getElementById('btn-confirm-deactivate');
  confirmBtn?.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = `<span class="spin" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span>Memproses...`;

    try {
      await deactivateUser(user.id);
      closeModal();
      toast(`Akun @${user.username} berhasil dinonaktifkan.`, 'ok');
      if (typeof onSuccessCallback === 'function') onSuccessCallback();
    } catch (err) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = `${ms('person_off')}Ya, Nonaktifkan Akun`;
      toast(apiError(err) || 'Gagal menonaktifkan akun pengguna.', 'err');
    }
  });
}

export default async function usersPage({ user }) {
  let userList = [];

  try {
    userList = await getUsers();
    if (!Array.isArray(userList)) userList = [];
  } catch (err) {
    return {
      html: `
        <div style="padding:16px 0">
          ${pageHead({
            crumb: `KosLedger › <b>Direktori Pengguna</b>`,
            title: 'Manajemen Pengguna',
            sub: 'Kelola data identitas akun penghuni kos, kontak WhatsApp, dan kontrol hak akses login.',
          })}
          ${errorView(apiError(err) || 'Gagal memuat data pengguna dari server.')}
          <div style="margin-top:16px">
            <button class="btn s" id="btn-retry-users">${ms('refresh')}Coba Lagi</button>
          </div>
        </div>
      `,
      after() {
        document.getElementById('btn-retry-users')?.addEventListener('click', () => go('admin-users'));
      },
    };
  }

  // Statistik ringkasan
  const total = userList.length;
  const tenants = userList.filter((u) => u.role === 'anggota');
  const activeTenants = tenants.filter((u) => u.is_active).length;
  const inactiveUsers = userList.filter((u) => !u.is_active).length;

  const html = `
    <!-- Header Halaman Manajemen Pengguna -->
    ${pageHead({
      crumb: `KosLedger › <b>Direktori Pengguna</b>`,
      title: 'Manajemen Pengguna',
      sub: 'Kelola pendaftaran penghuni baru, perbarui data kontak, dan kontrol akses akun pengguna kost.',
      acts: `
        <button class="btn p" id="btn-add-user">${ms('person_add')}Tambah Penghuni</button>
      `,
    })}

    <!-- Ringkasan Statistik Pengguna -->
    <div class="grid g4" style="margin-bottom:20px">
      ${statCard(
        'TOTAL PENGGUNA',
        `${total} <small>Akun</small>`,
        `<span style="color:var(--text)">${tenants.length} Akun Penghuni</span>`,
        'group'
      )}

      ${statCard(
        'PENGHUNI AKTIF',
        `${activeTenants} <small>Orang</small>`,
        pill(`${activeTenants} Aktif Login`, 'ok'),
        'how_to_reg'
      )}

      ${statCard(
        'AKUN NONAKTIF',
        `${inactiveUsers} <small>Akun</small>`,
        pill(`${inactiveUsers} Dicabut`, inactiveUsers > 0 ? 'err dot' : ''),
        'person_off'
      )}

      ${statCard(
        'STAF & MANAJEMEN',
        `${total - tenants.length} <small>Akun</small>`,
        `<span style="color:var(--primary-d)">Admin, Bendahara, Owner</span>`,
        'admin_panel_settings'
      )}
    </div>

    <!-- Banner Informasi Peran Administrator -->
    <div class="card" style="background:var(--c1);border-left:4px solid var(--primary);margin-bottom:16px">
      <div class="ctr" style="align-items:flex-start;flex-wrap:wrap;gap:12px">
        <div>
          <h3 style="margin-bottom:4px">Otoritas Master Akun & Keamanan Pengguna</h3>
          <p class="sub" style="margin:0">
            Administrator bertindak sebagai registrar akun penghuni baru. Akun yang dinonaktifkan tidak akan dapat login atau melakukan transaksi pembayaran sewa.
          </p>
        </div>
        <span class="pill ok">${ms('shield')}Security Admin</span>
      </div>
    </div>

    <!-- Tabel dan Filter Pengguna -->
    <div class="card">
      <div class="filter" style="margin-bottom:14px;flex-wrap:wrap;gap:12px;align-items:center;justify-content:space-between">
        <div style="display:flex;gap:10px;flex:1 1 280px;align-items:center">
          ${searchField('Cari nama, username, nomor HP...', 'table-admin-users')}
        </div>
        <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">
          <div class="tabs" id="user-status-tabs">
            <button class="on" data-status="">Semua (${total})</button>
            <button data-status="active">Aktif (${total - inactiveUsers})</button>
            <button data-status="inactive">Nonaktif (${inactiveUsers})</button>
          </div>

          <select class="sel" id="filter-user-role" style="border:0;outline:0;font-size:12px">
            <option value="">Semua Role (${total})</option>
            <option value="anggota">Penghuni (${tenants.length})</option>
            <option value="bendahara">Bendahara</option>
            <option value="admin">Admin</option>
            <option value="pemilik">Pemilik</option>
          </select>

          <button class="btn s sm" id="btn-reset-user-filter" title="Reset seluruh filter">${ms('restart_alt')}Reset</button>
        </div>
      </div>

      ${dataTable(
        ['Nama Lengkap', 'Username', 'Nomor Telepon', 'Role', 'Status', 'Terdaftar', '>Aksi'],
        userRows(userList, user),
        {
          id: 'table-admin-users',
          min: 740,
          emptyTitle: 'Belum Ada Pengguna Terdaftar',
          emptyText: 'Data pengguna belum tersedia di sistem. Klik tombol Tambah Penghuni untuk mendaftarkan akun baru.',
          emptyIcon: 'group',
        }
      )}
    </div>
  `;

  return {
    html,
    after() {
      // 1. Tombol Tambah Penghuni
      document.getElementById('btn-add-user')?.addEventListener('click', () => {
        showAddModal(() => go('admin-users'));
      });

      // 2. Filter Status Tab
      const tabButtons = document.querySelectorAll('#user-status-tabs button');
      tabButtons.forEach((btn) => {
        btn.addEventListener('click', () => {
          tabButtons.forEach((b) => b.classList.remove('on'));
          btn.classList.add('on');
          applyUserFilters();
        });
      });

      // 3. Filter Role Dropdown
      const roleSelect = document.getElementById('filter-user-role');
      roleSelect?.addEventListener('change', () => {
        applyUserFilters();
      });

      // 4. Tombol Reset Filter
      document.getElementById('btn-reset-user-filter')?.addEventListener('click', () => {
        const searchInput = document.querySelector('input[data-filter="table-admin-users"]');
        if (searchInput) searchInput.value = '';
        tabButtons.forEach((b) => b.classList.remove('on'));
        tabButtons[0]?.classList.add('on');
        if (roleSelect) roleSelect.value = '';
        applyUserFilters();
      });

      // 5. Input Pencarian Real-Time
      const searchInput = document.querySelector('input[data-filter="table-admin-users"]');
      searchInput?.addEventListener('input', () => {
        applyUserFilters();
      });

      function applyUserFilters() {
        const activeTab = document.querySelector('#user-status-tabs button.on');
        const statusFilter = activeTab ? activeTab.dataset.status : '';
        const roleFilter = roleSelect ? roleSelect.value : '';
        const searchVal = (searchInput?.value || '').toLowerCase().trim();

        const rows = document.querySelectorAll('#table-admin-users tbody tr');
        rows.forEach((tr) => {
          const statusVal = tr.querySelector('[data-status-val]')?.dataset?.statusVal || '';
          const roleVal = tr.querySelector('[data-role-val]')?.dataset?.roleVal || '';
          const textContent = tr.textContent.toLowerCase();

          const matchStatus = !statusFilter || statusVal === statusFilter;
          const matchRole = !roleFilter || roleVal === roleFilter;
          const matchSearch = !searchVal || textContent.includes(searchVal);

          tr.hidden = !(matchStatus && matchRole && matchSearch);
        });
      }

      // 6. Tombol Detail Pengguna
      document.querySelectorAll('[data-user-detail]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.userDetail;
          if (id) showUserDetail(id, user, () => go('admin-users'));
        });
      });

      // 7. Tombol Edit Pengguna
      document.querySelectorAll('[data-user-edit]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.userEdit;
          const target = userList.find((u) => String(u.id) === String(id));
          if (target) {
            showEditModal(target, () => go('admin-users'));
          } else {
            showUserDetail(id, user, () => go('admin-users'));
          }
        });
      });

      // 8. Tombol Deaktivasi Akun
      document.querySelectorAll('[data-user-deactivate]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.userDeactivate;
          const target = userList.find((u) => String(u.id) === String(id));
          if (target) {
            showDeactivateModal(target, () => go('admin-users'));
          }
        });
      });
    },
  };
}
