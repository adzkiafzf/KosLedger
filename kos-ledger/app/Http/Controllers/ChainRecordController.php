<?php

namespace App\Http\Controllers;

use App\Models\ChainRecord;
use App\Models\Payment;
use Illuminate\Http\Request;

class ChainRecordController extends Controller
{
    public function index(Request $request)
    {
        $records = ChainRecord::with('payment:id,bill_id,status,amount')->latest()->paginate(20);

        return response()->json(['data' => $records]);
    }

    public function show(Request $request, Payment $payment)
    {
        $user = $request->user();

        if ($user->role === 'anggota') {
            $ownerId = $payment->bill->occupancy->user_id ?? null;
            abort_if($ownerId !== $user->id, 403, 'Akses ditolak.');
        }

        $record = $payment->chainRecord;
        abort_if(!$record, 404, 'Catatan blockchain tidak ditemukan.');

        return response()->json(['data' => $record]);
    }

    public function verify(Payment $payment)
    {
        $record = $payment->chainRecord;
        abort_if(!$record, 404, 'Catatan blockchain tidak ditemukan.');

        $recomputedHash = $this->computeHash($payment);
        $match = hash_equals($record->payload_hash, $recomputedHash);

        return response()->json([
            'data' => [
                'match'           => $match,
                'stored_hash'     => $record->payload_hash,
                'recomputed_hash' => $recomputedHash,
                'chain_status'    => $record->chain_status,
            ],
            'message' => $match ? 'Hash cocok. Data konsisten.' : 'Hash tidak cocok. Data mungkin berubah.',
        ]);
    }

    public function retry(Payment $payment)
    {
        abort_if($payment->status !== 'success', 422, 'Hanya pembayaran sukses yang dapat dicatat ulang.');

        $record = $payment->chainRecord;
        abort_if(!$record, 404, 'Catatan blockchain tidak ditemukan.');
        abort_if($record->chain_status === 'recorded', 409, 'Sudah tercatat di blockchain.');

        dispatch(new \App\Jobs\RecordPaymentOnChain($payment->id));

        return response()->json(['message' => 'Retry dijadwalkan.']);
    }

    public static function computeHash(Payment $payment): string
    {
        $record = $payment->chainRecord;
        $payload = json_encode([
            'schema_version' => '1',
            'payment_ref'    => $record->payment_ref,
            'amount'         => $payment->amount,
            'status'         => $payment->status,
            'verified_at'    => $payment->paid_at?->toIso8601String(),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return '0x' . hash('sha256', $payload);
    }
}
