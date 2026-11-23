import { api } from './client.js';

// GET /api/payments?status=
export const getPayments = async (params = {}) => (await api.get('/payments', { params })).data.data;

// GET /api/payments/{payment}
export const getPayment = async (id) => (await api.get(`/payments/${id}`)).data.data;

// GET /api/chain-records
export const getChainRecords = async (params = {}) => (await api.get('/chain-records', { params })).data.data;

// GET /api/chain-records/{payment}
export const getChainRecord = async (paymentId) => (await api.get(`/chain-records/${paymentId}`)).data.data;

// POST /api/chain-records/{payment}/verify
export const verifyChainRecord = async (paymentId) => (await api.post(`/chain-records/${paymentId}/verify`)).data;

// POST /api/chain-records/{payment}/retry
export const retryChainRecord = async (paymentId) => (await api.post(`/chain-records/${paymentId}/retry`)).data;

// POST /api/payments/{payment}/expire (khusus role anggota membatalkan pending payment)
export const expirePayment = async (paymentId) => (await api.post(`/payments/${paymentId}/expire`)).data;

