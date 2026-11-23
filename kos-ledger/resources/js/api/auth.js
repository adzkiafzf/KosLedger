import { api } from './client.js';

// POST /api/auth/login -> { data: {id,name,nickname,username,role}, token, message }
export async function login(username, password) {
  const { data } = await api.post('/auth/login', { username, password });
  return { user: data.data, token: data.token };
}

export async function logout() {
  try {
    await api.post('/auth/logout');
  } catch {
    /* token mungkin sudah tidak valid; sesi lokal tetap dibersihkan */
  }
}

// GET /api/auth/me
export async function me() {
  const { data } = await api.get('/auth/me');
  return data.data;
}
