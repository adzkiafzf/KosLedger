<?php

namespace App\Http\Controllers;

use App\Models\CashTransaction;
use Illuminate\Http\Request;

class CashTransactionController extends Controller
{
    public function index(Request $request)
    {
        $query = CashTransaction::with('creator:id,name')->latest('trx_date');

        if ($request->filled('type')) $query->where('type', $request->type);
        if ($request->filled('category')) $query->where('category', $request->category);
        if ($request->filled('start_date')) $query->whereDate('trx_date', '>=', $request->start_date);
        if ($request->filled('end_date')) $query->whereDate('trx_date', '<=', $request->end_date);

        return response()->json(['data' => $query->paginate(20)]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'type'        => 'required|in:income,expense',
            'category'    => 'required|string|max:100',
            'description' => 'required|string|max:500',
            'amount'      => 'required|integer|min:1',
            'trx_date'    => 'required|date',
        ]);

        $data['created_by'] = $request->user()->id;
        $trx = CashTransaction::create($data);

        return response()->json(['data' => $trx, 'message' => 'Transaksi berhasil dicatat.'], 201);
    }

    public function show(CashTransaction $cashTransaction)
    {
        return response()->json(['data' => $cashTransaction->load('creator:id,name')]);
    }

    public function update(Request $request, CashTransaction $cashTransaction)
    {
        $data = $request->validate([
            'type'        => 'sometimes|in:income,expense',
            'category'    => 'sometimes|string|max:100',
            'description' => 'sometimes|string|max:500',
            'amount'      => 'sometimes|integer|min:1',
            'trx_date'    => 'sometimes|date',
        ]);

        $cashTransaction->update($data);

        return response()->json(['data' => $cashTransaction->fresh(), 'message' => 'Transaksi diperbarui.']);
    }
}
