<?php

namespace App\Http\Controllers;

use App\Models\Bill;
use App\Models\Payment;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PaymentController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();
        $query = Payment::with(['bill.occupancy.user:id,name', 'recorder:id,name']);

        if ($user->role === 'anggota') {
            $query->whereHas('bill.occupancy', fn($q) => $q->where('user_id', $user->id));
        }

        if ($request->filled('status')) $query->where('status', $request->status);

        return response()->json(['data' => $query->latest()->paginate(20)]);
    }

    public function show(Request $request, Payment $payment)
    {
        $this->authorizeAccess($request->user(), $payment);

        return response()->json(['data' => $payment->load(['bill.items', 'chainRecord', 'recorder:id,name'])]);
    }

    public function checkout(Request $request, Bill $bill)
    {
        $user = $request->user();
        abort_if($bill->occupancy->user_id !== $user->id, 403, 'Akses ditolak.');
        abort_if($bill->status === 'paid', 409, 'Tagihan sudah lunas.');

        $pendingExists = $bill->payments()->where('status', 'pending')->exists();
        if ($pendingExists) {
            return response()->json(['message' => 'Sudah ada transaksi pending untuk tagihan ini.'], 409);
        }

        $orderId = 'KL-' . $bill->id . '-' . Str::random(8);

        $payment = Payment::create([
            'bill_id'          => $bill->id,
            'method'           => 'gateway',
            'provider_order_id' => $orderId,
            'amount'           => $bill->total_amount,
            'status'           => 'pending',
        ]);

        // Midtrans Snap API call
        $snapToken = $this->createMidtransTransaction($orderId, $bill->total_amount, $user);

        return response()->json([
            'data'    => ['payment_id' => $payment->id, 'order_id' => $orderId, 'snap_token' => $snapToken],
            'message' => 'Checkout berhasil dibuat.',
        ], 201);
    }

    public function manualPayment(Request $request, Bill $bill)
    {
        abort_if($bill->status === 'paid', 409, 'Tagihan sudah lunas.');

        $data = $request->validate([
            'amount'  => 'required|integer|min:1',
            'paid_at' => 'required|date',
            'note'    => 'nullable|string|max:500',
        ]);

        $successExists = $bill->payments()->where('status', 'success')->exists();
        if ($successExists) {
            return response()->json(['message' => 'Tagihan sudah memiliki pembayaran sukses.'], 409);
        }

        DB::transaction(function () use ($bill, $data, $request) {
            $payment = Payment::create([
                'bill_id'     => $bill->id,
                'method'      => 'manual',
                'amount'      => $data['amount'],
                'status'      => 'success',
                'paid_at'     => $data['paid_at'],
                'recorded_by' => $request->user()->id,
                'note'        => $data['note'] ?? null,
            ]);

            $bill->update(['status' => 'paid']);
        });

        return response()->json(['message' => 'Pembayaran manual berhasil dicatat.'], 201);
    }

    public function expire(Request $request, Payment $payment)
    {
        $this->authorizeAccess($request->user(), $payment);

        abort_if($payment->status !== 'pending', 409, 'Hanya transaksi pending yang bisa di-expire.');

        $payment->update(['status' => 'expired']);

        return response()->json(['message' => 'Transaksi berhasil di-expire.']);
    }

    private function authorizeAccess($user, Payment $payment): void
    {
        if ($user->role === 'anggota') {
            $ownerId = $payment->bill->occupancy->user_id ?? null;
            abort_if($ownerId !== $user->id, 403, 'Akses ditolak.');
        }
    }

    private function createMidtransTransaction(string $orderId, int $amount, $user): ?string
    {
        $serverKey = config('midtrans.server_key');
        if (!$serverKey) return null;

        \Midtrans\Config::$serverKey    = $serverKey;
        \Midtrans\Config::$isProduction = config('midtrans.is_production');
        \Midtrans\Config::$isSanitized  = true;
        \Midtrans\Config::$is3ds        = true;

        $params = [
            'transaction_details' => ['order_id' => $orderId, 'gross_amount' => $amount],
            'customer_details'    => ['first_name' => $user->name],
        ];

        try {
            return \Midtrans\Snap::getSnapToken($params);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::error('Midtrans Snap error', ['error' => $e->getMessage(), 'order_id' => $orderId]);
            return null;
        }
    }
}
