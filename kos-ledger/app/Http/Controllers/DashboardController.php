<?php

namespace App\Http\Controllers;

use App\Models\Bill;
use App\Models\CashTransaction;
use App\Models\Occupancy;
use App\Models\Room;
use App\Models\User;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    public function admin()
    {
        return response()->json(['data' => [
            'total_rooms'    => Room::count(),
            'occupied_rooms' => Room::where('status', 'occupied')->count(),
            'available_rooms' => Room::where('status', 'available')->count(),
            'active_tenants' => User::where('role', 'anggota')->where('is_active', true)->count(),
            'active_occupancies' => Occupancy::where('status', 'active')->count(),
        ]]);
    }

    public function treasurer()
    {
        $income  = CashTransaction::where('type', 'income')->sum('amount');
        $expense = CashTransaction::where('type', 'expense')->sum('amount');

        return response()->json(['data' => [
            'total_income'   => $income,
            'total_expense'  => $expense,
            'balance'        => $income - $expense,
            'unpaid_bills'   => Bill::where('status', 'unpaid')->count(),
            'unpaid_amount'  => Bill::where('status', 'unpaid')->sum('total_amount'),
            'recent_transactions' => CashTransaction::latest('trx_date')->limit(5)->get(),
        ]]);
    }

    public function member(Request $request)
    {
        $user = $request->user();
        $bills = Bill::whereHas('occupancy', fn($q) => $q->where('user_id', $user->id))
            ->with('items')
            ->latest()
            ->limit(5)
            ->get();

        $unpaid = $bills->where('status', 'unpaid');

        return response()->json(['data' => [
            'unpaid_bills'    => $unpaid->count(),
            'nearest_due'     => $unpaid->sortBy('due_date')->first()?->due_date,
            'recent_bills'    => $bills,
            'linked_telegram' => !is_null($user->telegram_chat_id),
        ]]);
    }

    public function owner()
    {
        $income  = CashTransaction::where('type', 'income')->sum('amount');
        $expense = CashTransaction::where('type', 'expense')->sum('amount');

        return response()->json(['data' => [
            'total_rooms'    => Room::count(),
            'occupied_rooms' => Room::where('status', 'occupied')->count(),
            'active_tenants' => User::where('role', 'anggota')->where('is_active', true)->count(),
            'total_income'   => $income,
            'total_expense'  => $expense,
            'balance'        => $income - $expense,
            'unpaid_amount'  => Bill::where('status', 'unpaid')->sum('total_amount'),
        ]]);
    }
}
