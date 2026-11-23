import { api } from './client.js';

// GET /api/reports/finance?start_date=&end_date=
// -> { total_income, total_expense, balance, transactions: { data: [...], ...paginasi } }
export const finance = async (params = {}) => (await api.get('/reports/finance', { params })).data.data;

// GET /api/reports/payments?status=&start_date=&end_date=
// -> { summary: { total_success, count_success, count_pending, count_failed }, payments: { data: [...] } }
export const paymentsReport = async (params = {}) => (await api.get('/reports/payments', { params })).data.data;

// GET /api/reports/occupancy?status=
// -> { data: [...occupancies], ...paginasi }
export const occupancyReport = async (params = {}) => (await api.get('/reports/occupancy', { params })).data.data;

// Total pemasukan & pengeluaran per bulan. Dipanggil SATU PER SATU (bukan bersamaan)
// supaya tidak menyumbat server lokal yang hanya memproses satu permintaan sekali waktu.
// rentang: hasil rentangBulan() -> [{ label, income, expense }, ...]
export async function arusKasBulanan(rentang) {
  const out = [];
  for (const r of rentang) {
    const d = await finance({ start_date: r.start, end_date: r.end });
    out.push({ label: r.label, income: Number(d.total_income) || 0, expense: Number(d.total_expense) || 0 });
  }
  return out;
}
