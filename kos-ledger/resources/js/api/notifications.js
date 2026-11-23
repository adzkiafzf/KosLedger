import { api } from './client.js';

// GET /api/notifications
// Response: { data: { data: [...], current_page, last_page, total, ... } }
// Field tiap item: id, user_id, bill_id, type, status, error_message, sent_at, created_at
export const getNotifications = async (params = {}) =>
  (await api.get('/notifications', { params })).data.data;

// POST /api/telegram/link-code (khusus role anggota generate token bot 15 menit)
export const generateTelegramLinkCode = async () =>
  (await api.post('/telegram/link-code')).data;

