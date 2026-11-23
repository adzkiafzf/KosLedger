import { api } from './client.js';

// GET /api/bills?period=&status=
export const getBills = async (params = {}) => (await api.get('/bills', { params })).data.data;

// GET /api/bills/{bill}
export const getBill = async (id) => (await api.get(`/bills/${id}`)).data.data;

// POST /api/bills
export const createBill = async (data) => (await api.post('/bills', data)).data;

// PUT /api/bills/{bill}
export const updateBill = async (id, data) => (await api.put(`/bills/${id}`, data)).data;

// POST /api/bills/{bill}/manual-payment
export const recordManualPayment = async (billId, data) => (await api.post(`/bills/${billId}/manual-payment`, data)).data;

// POST /api/telegram/reminders/send
export const sendTelegramReminders = async () => (await api.post('/telegram/reminders/send')).data;

// POST /api/bills/{bill}/checkout (khusus role anggota)
export const checkoutBill = async (billId) => (await api.post(`/bills/${billId}/checkout`)).data;

