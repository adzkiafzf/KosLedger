<?php

namespace App\Http\Controllers;

use App\Models\Occupancy;
use App\Models\Room;
use App\Models\User;
use Illuminate\Http\Request;

class OccupancyController extends Controller
{
    public function index()
    {
        $occupancies = Occupancy::with(['user:id,name,nickname', 'room:id,room_number'])->latest()->get();

        return response()->json(['data' => $occupancies]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'user_id'    => 'required|exists:users,id',
            'room_id'    => 'required|exists:rooms,id',
            'start_date' => 'required|date',
        ]);

        $user = User::findOrFail($data['user_id']);
        if (!$user->is_active) {
            return response()->json(['message' => 'Penghuni tidak aktif.'], 422);
        }

        $room = Room::findOrFail($data['room_id']);
        $occupied = $room->activeOccupancies()->count();
        if ($occupied >= $room->capacity) {
            return response()->json(['message' => 'Kapasitas kamar sudah penuh.'], 422);
        }

        $conflict = Occupancy::where('user_id', $data['user_id'])->where('status', 'active')->exists();
        if ($conflict) {
            return response()->json(['message' => 'Penghuni sudah memiliki penempatan aktif.'], 409);
        }

        $occupancy = Occupancy::create($data + ['status' => 'active']);

        if ($room->activeOccupancies()->count() >= $room->capacity) {
            $room->update(['status' => 'occupied']);
        }

        return response()->json(['data' => $occupancy->load(['user:id,name', 'room:id,room_number']), 'message' => 'Penghuni berhasil ditempatkan.'], 201);
    }
}
