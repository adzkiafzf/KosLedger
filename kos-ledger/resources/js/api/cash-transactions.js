import { api } from './client.js';

// GET /api/transactions?type=&category=&start_date=&end_date=
export const getTransactions = async (params = {}) => (await api.get('/transactions', { params })).data.data;

// GET /api/transactions/{id}
export const getTransaction = async (id) => (await api.get(`/transactions/${id}`)).data.data;

// POST /api/transactions
export const createTransaction = async (data) => (await api.post('/transactions', data)).data;

// PUT /api/transactions/{id}
export const updateTransaction = async (id, data) => (await api.put(`/transactions/${id}`, data)).data;
