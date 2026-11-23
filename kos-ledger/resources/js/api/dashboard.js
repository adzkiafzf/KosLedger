
import { api } from './client.js';

// Setiap fungsi membaca { data: {...} } dari DashboardController.
export const treasurer = async () => (await api.get('/dashboard/treasurer')).data.data; // bendahara
export const owner = async () => (await api.get('/dashboard/owner')).data.data; // pemilik
export const member = async () => (await api.get('/dashboard/member')).data.data; // anggota (penghuni)
export const admin = async () => (await api.get('/dashboard/admin')).data.data; // admin