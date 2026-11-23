import { api } from './client.js';

// Mengambil data penempatan penghuni (occupancies).
// Coba GET /occupancies (jika didukung). Jika 403 Forbidden (Bendahara),
// fallback legal ke endpoint kamar aktif (GET /rooms -> GET /rooms/{id}).
export async function getOccupancies() {
  try {
    const res = await api.get('/occupancies');
    return res.data.data;
  } catch (err) {
    if (err.response?.status === 403) {
      return await getOccupanciesFromRooms();
    }
    throw err;
  }
}

export async function getOccupanciesFromRooms() {
  const roomsRes = await api.get('/rooms');
  const rooms = Array.isArray(roomsRes.data.data) ? roomsRes.data.data : [];
  const occupiedRooms = rooms.filter((r) => Number(r.occupied_count) > 0 || r.status === 'occupied');

  const details = await Promise.all(
    occupiedRooms.map((r) =>
      api
        .get(`/rooms/${r.id}`)
        .then((res) => res.data.data)
        .catch(() => null)
    )
  );

  const occupancies = [];
  details.filter(Boolean).forEach((room) => {
    const occs = Array.isArray(room.active_occupancies) ? room.active_occupancies : [];
    occs.forEach((occ) => {
      occupancies.push({
        id: occ.id,
        user_id: occ.user_id,
        room_id: occ.room_id,
        start_date: occ.start_date,
        end_date: occ.end_date,
        status: occ.status || 'active',
        user: occ.user || { name: 'Penghuni', nickname: '' },
        room: {
          id: room.id,
          room_number: room.room_number,
          monthly_rate: room.monthly_rate,
          capacity: room.capacity,
        },
      });
    });
  });

  return occupancies;
}

// POST /api/occupancies
export const createOccupancy = async (data) => (await api.post('/occupancies', data)).data;

