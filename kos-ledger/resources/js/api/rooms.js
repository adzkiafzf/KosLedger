import { api } from './client.js';

// GET /api/rooms
export const getRooms = async () => (await api.get('/rooms')).data.data;

// GET /api/rooms/{id}
export const getRoom = async (id) => (await api.get(`/rooms/${id}`)).data.data;

// POST /api/rooms
export const createRoom = async (data) => (await api.post('/rooms', data)).data;

// PUT /api/rooms/{id}
export const updateRoom = async (id, data) => (await api.put(`/rooms/${id}`, data)).data;

