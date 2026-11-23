import {
  getTransactions,
  getTransaction,
  createTransaction,
  updateTransaction,
} from '../../api/cash-transactions.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, ms, toast, modal, closeModal, mhead, kvs } from '../../components/ui.js';
import { statCard, dataTable, searchField } from '../../components/widgets.js';
import { errorView, loadingView } from '../../components/states.js';
import { esc, tgl, rp } from '../../utils/format.js';

const CATEGORIES = [
  'Listrik',
  'Air',
  'Gas',
  'CCTV',
  'Perbaikan',
  'Peralatan Kebersihan',
  'Internet',
  'Lainnya',
];

const CATEGORY_ICONS = {
  Listrik: 'bolt',
  Air: 'water_drop',
  Gas: 'local_fire_department',
  CCTV: 'videocam',
  Perbaikan: 'build',
  'Peralatan Kebersihan': 'cleaning_services',
  Internet: 'wifi',
  Lainnya: 'more_horiz',
};

const head = () =>
  pageHead({
    eyebrow: 'BUKU KAS KELUAR OPERASIONAL',
    txt: 1,
    dot: 1,
    title: 'Manajemen Pengeluaran',
    sub: 'Catat dan monitor seluruh pengeluaran operasional, utilitas, serta pemeliharaan properti kos.',
    acts: `<button class="btn p" id="btn-add-expense">${ms('add')}Tambah Pengeluaran</button>`,
  });

function expenseRows(list) {
  return list.map((x) => {
    const icon = CATEGORY_ICONS[x.category] || 'more_horiz';
    return [
      `<span class="pill ok" data-cat-val="${esc(x.category)}">${ms(icon)} ${esc(x.category)}</span>`,
      `<b>${esc(x.description)}</b>`,
      `<span class="num neg">−${rp(x.amount)}</span>`,
      `<span>${tgl(x.trx_date)}</span>`,
      `<span>${esc(x.creator?.name || 'Bendahara')}</span>`,
      `<div class="acts" style="justify-content:flex-end">
        <button class="btn sm s" data-exp-detail="${x.id}" aria-label="Lihat detail">${ms('visibility')} Detail</button>
        <button class="btn sm s" data-exp-edit="${x.id}" aria-label="Ubah pengeluaran">${ms('edit')} Ubah</button>
      </div>`,
    ];
  });
}

function expenseDetailModal(t) {
  const icon = CATEGORY_ICONS[t.category] || 'more_horiz';
  return `
    ${mhead(`Pengeluaran #${t.id}`, t.description, icon)}
    <div class="mb">
      <div class="ctr" style="margin-bottom:14px">
        <span class="lbl" style="font-size:11px">KATEGORI BIAYA</span>
        <span class="pill ok">${ms(icon)} ${esc(t.category)}</span>
      </div>
      ${kvs([
        ['ID Transaksi', `<span class="mono">TRX-EXP-${String(t.id).padStart(4, '0')}</span>`],
        ['Kategori Beban', esc(t.category)],
        ['Deskripsi / Uraian', esc(t.description)],
        ['Nominal Pengeluaran', `<b style="font-size:17px;color:var(--err)">−${rp(t.amount)}</b>`],
        ['Tanggal Transaksi', tgl(t.trx_date)],
        ['Dicatat Oleh', esc(t.creator?.name || 'Bendahara')],
      ])}
    </div>
    <footer class="mf2">
      <button class="btn" data-act="close">Tutup</button>
      <button class="btn p" id="btn-modal-edit" data-id="${t.id}">${ms('edit')}Ubah Transaksi</button>
    </footer>`;
}

async function showExpenseDetail(id) {
  modal(`
    ${mhead('Memuat Detail Pengeluaran…', '', 'receipt')}
    <div class="mb">${loadingView('Mengambil data mutasi kas…')}</div>
    <footer class="mf2"><button class="btn s" data-act="close">Batal</button></footer>
  `);

  try {
    const t = await getTransaction(id);
    modal(expenseDetailModal(t));

    document.getElementById('btn-modal-edit')?.addEventListener('click', () => {
      openExpenseFormModal(t, true);
    });
  } catch (err) {
    modal(`
      ${mhead('Gagal Memuat Transaksi', '', 'error')}
      <div class="mb">${errorView(apiError(err))}</div>
      <footer class="mf2"><button class="btn p" data-act="close">Tutup</button></footer>
    `);
  }
}

function openExpenseFormModal(data = {}, isEdit = false) {
  const today = new Date().toISOString().split('T')[0];
  const catOptions = CATEGORIES.map(
    (c) => `<option value="${c}" ${data.category === c ? 'selected' : ''}>${c}</option>`
  ).join('');

  modal(`
    ${mhead(
      isEdit ? `Ubah Pengeluaran #${data.id}` : 'Tambah Pengeluaran Operasional',
      'Catat mutasi kas keluar untuk utilitas atau pemeliharaan kos.',
      'receipt'
    )}
    <form id="f-expense" class="mb">
      <label class="mf">
        Kategori Pengeluaran <i>*</i>
        <select class="in" id="exp-cat" required>
          ${catOptions}
        </select>
      </label>

      <label class="mf" style="margin-top:12px">
        Deskripsi Pengeluaran <i>*</i>
        <input class="in" type="text" id="exp-desc" placeholder="Contoh: Token Listrik Utama Rumah Kos 3500 VA" value="${esc(data.description || '')}" required>
      </label>

      <div class="two" style="margin-top:12px">
        <label class="mf">
          Nominal Pengeluaran (Rp) <i>*</i>
          <input class="in" type="number" id="exp-amount" min="1" placeholder="Nominal biaya" value="${data.amount || ''}" required>
        </label>
        <label class="mf">
          Tanggal Transaksi <i>*</i>
          <input class="in" type="date" id="exp-date" value="${data.trx_date || today}" required>
        </label>
      </div>
    </form>
    <footer class="mf2">
      <button class="btn" data-act="close">Batal</button>
      <button class="btn p" id="btn-submit-exp">${ms('save')}${isEdit ? 'Simpan Perubahan' : 'Catat Pengeluaran'}</button>
    </footer>
  `);

  document.getElementById('btn-submit-exp')?.addEventListener('click', async () => {
    const category = document.getElementById('exp-cat')?.value;
    const description = (document.getElementById('exp-desc')?.value || '').trim();
    const amount = Number(document.getElementById('exp-amount')?.value);
    const trxDate = document.getElementById('exp-date')?.value;
    const btn = document.getElementById('btn-submit-exp');

    if (!category) {
      toast('Kategori pengeluaran wajib dipilih.', 'err');
      return;
    }
    if (!description) {
      toast('Deskripsi pengeluaran wajib diisi.', 'err');
      return;
    }
    if (!amount || amount <= 0) {
      toast('Nominal pengeluaran harus lebih dari 0.', 'err');
      return;
    }
    if (!trxDate) {
      toast('Tanggal transaksi wajib diisi.', 'err');
      return;
    }

    const payload = {
      type: 'expense',
      category,
      description,
      amount,
      trx_date: trxDate,
    };

    btn.disabled = true;
    btn.innerHTML = '<span class="spin"></span>Menyimpan…';

    try {
      if (isEdit && data.id) {
        await updateTransaction(data.id, payload);
        toast('Pengeluaran berhasil diperbarui.', 'ok');
      } else {
        await createTransaction(payload);
        toast('Pengeluaran operasional berhasil dicatat.', 'ok');
      }
      closeModal();
      go('bendahara-pengeluaran');
    } catch (err) {
      btn.disabled = false;
      btn.innerHTML = `${ms('save')}${isEdit ? 'Simpan Perubahan' : 'Catat Pengeluaran'}`;
      toast(apiError(err), 'err');
    }
  });
}

export default async function expensesPage() {
  let expenses = [];
  try {
    const res = await getTransactions({ type: 'expense' });
    expenses = Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : [];
  } catch (err) {
    return {
      html: `
        ${head()}
        ${errorView(apiError(err))}
        <button class="btn s" id="retry-exp">${ms('refresh')}Coba lagi</button>`,
      after() {
        document.getElementById('retry-exp')?.addEventListener('click', () => go('bendahara-pengeluaran'));
      },
    };
  }

  const totalAmount = expenses.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const totalCount = expenses.length;
  const avgAmount = totalCount > 0 ? Math.round(totalAmount / totalCount) : 0;

  // Hitung kategori dengan akumulasi nominal terbesar
  const catSums = {};
  expenses.forEach((x) => {
    catSums[x.category] = (catSums[x.category] || 0) + (Number(x.amount) || 0);
  });
  let topCat = '-';
  let topCatAmt = 0;
  Object.entries(catSums).forEach(([cat, sum]) => {
    if (sum > topCatAmt) {
      topCat = cat;
      topCatAmt = sum;
    }
  });

  const catPills = ['Semua', ...CATEGORIES]
    .map(
      (c, i) =>
        `<button class="pill ${i === 0 ? 'dk' : ''}" data-cat-filter="${c}">${c}</button>`
    )
    .join('');

  return {
    html: `
      ${head()}
      <div class="grid g4">
        ${statCard('Total Pengeluaran Kas', rp(totalAmount), pill(`${totalCount} Mutasi Keluar`, ''), 'account_balance_wallet')}
        ${statCard('Beban Biaya Terbesar', topCat, topCatAmt > 0 ? rp(topCatAmt) : 'Belum ada data', CATEGORY_ICONS[topCat] || 'bolt')}
        ${statCard('Rata-rata Pengeluaran', rp(avgAmount), '<span style="font-size:12px;color:var(--muted)">Per transaksi operasional</span>', 'query_stats')}
        ${statCard('Kategori Biaya Terdata', `${Object.keys(catSums).length} Kategori`, pill('Operasional Kos', 'mint'), 'category')}
      </div>

      <div class="card" style="margin-bottom:16px">
        <div class="ctr" style="align-items:flex-start;gap:16px;flex-wrap:wrap">
          ${searchField('Cari deskripsi pengeluaran, vendor, staf...', 'tb-expenses')}
          <div style="display:grid;gap:8px;justify-items:end">
            <span class="sub" style="font-size:12px">Saring berdasarkan kategori:</span>
            <div class="kg" id="cat-filter-group">${catPills}</div>
          </div>
        </div>
      </div>

      <div class="card">
        ${dataTable(
          ['Kategori', 'Deskripsi Pengeluaran', '>Nominal', 'Tanggal', 'Dicatat Oleh', '>Aksi'],
          expenseRows(expenses),
          {
            id: 'tb-expenses',
            min: 820,
            emptyTitle: 'Belum ada pengeluaran kas dicatat',
            emptyText: 'Tekan tombol "Tambah Pengeluaran" di atas untuk mencatat biaya utilitas atau pemeliharaan kos.',
            emptyIcon: 'account_balance_wallet',
          }
        )}
      </div>`,
    after() {
      // Event listener: Tambah pengeluaran
      document.getElementById('btn-add-expense')?.addEventListener('click', () => {
        openExpenseFormModal({}, false);
      });

      // Event listener: Filter kategori pills
      const catBtns = document.querySelectorAll('#cat-filter-group button');
      catBtns.forEach((btn) => {
        btn.addEventListener('click', () => {
          catBtns.forEach((b) => b.classList.remove('dk'));
          btn.classList.add('dk');
          const cat = btn.dataset.catFilter;
          document.querySelectorAll('#tb-expenses tbody tr').forEach((tr) => {
            if (cat === 'Semua') {
              tr.hidden = false;
            } else {
              const val = tr.querySelector('[data-cat-val]')?.dataset?.catVal;
              tr.hidden = val !== cat;
            }
          });
        });
      });

      // Event listener: Detail & Edit pengeluaran
      document.querySelectorAll('[data-exp-detail]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const id = btn.dataset.expDetail;
          if (id) showExpenseDetail(id);
        });
      });

      document.querySelectorAll('[data-exp-edit]').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.dataset.expEdit;
          if (id) {
            try {
              const t = await getTransaction(id);
              openExpenseFormModal(t, true);
            } catch (err) {
              toast(apiError(err), 'err');
            }
          }
        });
      });
    },
  };
}
