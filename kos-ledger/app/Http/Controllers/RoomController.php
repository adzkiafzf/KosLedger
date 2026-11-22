<?php

namespace App\Http\Controllers;

use App\Models\Room;
use Illuminate\Http\Request;

class RoomController extends Controller
{
    public function index()
    {
        return response()->json(['data' => Room::withCount(['activeOccupancies as occupied_count'])->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'room_number'  => 'required|string|unique:rooms|max:20',
            'monthly_rate' => 'required|integer|min:1',
            'capacity'     => 'required|integer|min:1|max:10',
            'status'       => 'sometimes|in:available,occupied,maintenance',
        ]);

        $room = Room::create($data);

        return response()->json(['data' => $room, 'message' => 'Kamar berhasil ditambahkan.'], 201);
    }

    public function show(Room $room)
    {
        return response()->json(['data' => $room->load('activeOccupancies.user:id,name,nickname')]);
    }

    public function update(Request $request, Room $room)
    {
        $data = $request->validate([
            'room_number'  => 'sometimes|string|unique:rooms,room_number,' . $room->id . '|max:20',
            'monthly_rate' => 'sometimes|integer|min:1',
            'capacity'     => 'sometimes|integer|min:1|max:10',
            'status'       => 'sometimes|in:available,occupied,maintenance',
        ]);

        $room->update($data);

        return response()->json(['data' => $room->fresh(), 'message' => 'Data kamar diperbarui.']);
    }
}
