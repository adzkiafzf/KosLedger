<?php

namespace App\Http\Controllers;

use App\Models\Bill;
use App\Models\Occupancy;
use Illuminate\Http\Request;

class BillController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Bill::with(['occupancy.user:id,name', 'occupancy.room:id,room_number']);

        if ($user->role === 'anggota') {
            $query->whereHas('occupancy', fn($q) => $q->where('user_id', $user->id));
        }

        if ($request->filled('period')) $query->where('period', $request->period);
        if ($request->filled('status')) $query->where('status', $request->status);

        return response()->json(['data' => $query->latest()->paginate(20)]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'occupancy_id' => 'required|exists:occupancies,id',
            'period'       => 'required|string|regex:/^\d{4}-\d{2}$/',
            'due_date'     => 'required|date',
            'items'        => 'required|array|min:1',
            'items.*.category'    => 'required|string|max:100',
            'items.*.description' => 'required|string|max:500',
            'items.*.amount'      => 'required|integer|min:1',
        ]);

        $exists = Bill::where('occupancy_id', $data['occupancy_id'])->where('period', $data['period'])->exists();
        if ($exists) {
            return response()->json(['message' => 'Tagihan periode ini sudah ada untuk penghuni tersebut.'], 409);
        }

        $total = collect($data['items'])->sum('amount');

        $bill = Bill::create([
            'occupancy_id' => $data['occupancy_id'],
            'period'       => $data['period'],
            'due_date'     => $data['due_date'],
            'total_amount' => $total,
            'status'       => 'unpaid',
            'created_by'   => $request->user()->id,
        ]);

        $bill->items()->createMany($data['items']);

        return response()->json(['data' => $bill->load('items'), 'message' => 'Tagihan berhasil dibuat.'], 201);
    }

    public function show(Request $request, Bill $bill)
    {
        $this->authorizeAccess($request->user(), $bill);

        return response()->json(['data' => $bill->load(['items', 'occupancy.user:id,name', 'occupancy.room:id,room_number', 'payments'])]);
    }

    public function update(Request $request, Bill $bill)
    {
        if ($bill->status === 'paid') {
            return response()->json(['message' => 'Tagihan yang sudah lunas tidak dapat diubah.'], 409);
        }

        $data = $request->validate([
            'due_date' => 'sometimes|date',
            'period'   => 'sometimes|string|regex:/^\d{4}-\d{2}$/',
        ]);

        $bill->update($data);

        return response()->json(['data' => $bill->fresh(), 'message' => 'Tagihan diperbarui.']);
    }

    public function items(Request $request, Bill $bill)
    {
        $this->authorizeAccess($request->user(), $bill);

        return response()->json(['data' => $bill->items]);
    }

    private function authorizeAccess($user, Bill $bill): void
    {
        if ($user->role === 'anggota') {
            $ownerId = $bill->occupancy->user_id ?? null;
            abort_if($ownerId !== $user->id, 403, 'Akses ditolak.');
        }
    }
}
