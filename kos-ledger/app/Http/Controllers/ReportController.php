<?php

namespace App\Http\Controllers;

use App\Models\Bill;
use App\Models\CashTransaction;
use App\Models\Occupancy;
use App\Models\Payment;
use Illuminate\Http\Request;

class ReportController extends Controller
{
    public function finance(Request $request)
    {
        $query = CashTransaction::query();

        if ($request->filled('start_date')) $query->whereDate('trx_date', '>=', $request->start_date);
        if ($request->filled('end_date')) $query->whereDate('trx_date', '<=', $request->end_date);

        $income  = (clone $query)->where('type', 'income')->sum('amount');
        $expense = (clone $query)->where('type', 'expense')->sum('amount');

        return response()->json(['data' => [
            'total_income'  => $income,
            'total_expense' => $expense,
            'balance'       => $income - $expense,
            'transactions'  => $query->with('creator:id,name')->latest('trx_date')->paginate(20),
        ]]);
    }

    public function occupancy(Request $request)
    {
        $occupancies = Occupancy::with(['user:id,name', 'room:id,room_number'])
            ->when($request->filled('status'), fn($q) => $q->where('status', $request->status))
            ->latest()
            ->paginate(20);

        return response()->json(['data' => $occupancies]);
    }

    public function payments(Request $request)
    {
        $query = Payment::with(['bill.occupancy.room:id,room_number']);

        if ($request->filled('status')) $query->where('status', $request->status);
        if ($request->filled('start_date')) $query->whereDate('paid_at', '>=', $request->start_date);
        if ($request->filled('end_date')) $query->whereDate('paid_at', '<=', $request->end_date);

        $summary = [
            'total_success' => (clone $query)->where('status', 'success')->sum('amount'),
            'count_success' => (clone $query)->where('status', 'success')->count(),
            'count_pending' => (clone $query)->where('status', 'pending')->count(),
            'count_failed'  => (clone $query)->whereIn('status', ['failed', 'expired'])->count(),
        ];

        return response()->json(['data' => ['summary' => $summary, 'payments' => $query->latest()->paginate(20)]]);
    }
}
