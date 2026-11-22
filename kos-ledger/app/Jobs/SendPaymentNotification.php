<?php

namespace App\Jobs;

use App\Models\NotificationLog;
use App\Models\Payment;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SendPaymentNotification implements ShouldQueue
{
    use Queueable;

    public function __construct(public int $paymentId) {}

    public function handle(): void
    {
        $payment = Payment::with('bill.occupancy.user')->findOrFail($this->paymentId);
        $user    = $payment->bill->occupancy->user;

        if (!$user->telegram_chat_id) return;

        $text = "✅ Pembayaran tagihan periode {$payment->bill->period} sebesar Rp " .
                number_format($payment->amount, 0, ',', '.') . " telah berhasil dikonfirmasi.";

        $status = 'sent';
        $error  = null;

        try {
            $token    = config('services.telegram.bot_token');
            $response = Http::post("https://api.telegram.org/bot{$token}/sendMessage", [
                'chat_id' => $user->telegram_chat_id,
                'text'    => $text,
            ]);

            if (!$response->successful()) {
                throw new \Exception($response->body());
            }
        } catch (\Throwable $e) {
            $status = 'failed';
            $error  = substr($e->getMessage(), 0, 255);
            Log::warning('Telegram notification failed', ['payment_id' => $this->paymentId, 'error' => $e->getMessage()]);
        }

        NotificationLog::create([
            'user_id'       => $user->id,
            'bill_id'       => $payment->bill_id,
            'type'          => 'payment_success',
            'status'        => $status,
            'error_message' => $error,
            'sent_at'       => now(),
        ]);
    }
}
