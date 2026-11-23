import { api } from './client.js';

// GET /api/users
export const getUsers = async () => (await api.get('/users')).data.data;

// GET /api/users/{id}
export const getUser = async (id) => (await api.get(`/users/${id}`)).data.data;

// POST /api/users
export const createUser = async (data) => (await api.post('/users', data)).data;

// PUT /api/users/{id}
export const updateUser = async (id, data) => (await api.put(`/users/${id}`, data)).data;

// PATCH /api/users/{id}/deactivate
export const deactivateUser = async (id) => (await api.patch(`/users/${id}/deactivate`)).data;
