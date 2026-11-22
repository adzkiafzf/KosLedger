<?php

namespace App\Http\Controllers;

use App\Models\Payment;
use App\Models\TelegramLinkCode;
use App\Models\WebhookEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class WebhookController extends Controller
{
    public function midtrans(Request $request)
    {
        $payload = $request->all();

        // Langkah 1 & 2: Validasi signature sebelum melakukan apapun
        $signatureValid = $this->verifyMidtransSignature($payload);

        if (!$signatureValid) {
            Log::warning('Midtrans webhook signature invalid', ['order_id' => $payload['order_id'] ?? null]);
            // Catat event yang gagal tanpa menyimpan payload penuh untuk keamanan
            WebhookEvent::create([
                'provider_event_id' => $payload['transaction_id'] ?? null,
                'payment_id'        => null,
                'signature_valid'   => false,
                'payload'           => ['order_id' => $payload['order_id'] ?? null, 'status_code' => $payload['status_code'] ?? null],
                'received_at'       => now(),
                'processing_status' => 'failed',
            ]);
            return response()->json(['message' => 'Invalid signature.'], 400);
        }

        // Langkah 3: Cari transaksi berdasarkan order_id
        $orderId = $payload['order_id'] ?? null;
        $payment = Payment::where('provider_order_id', $orderId)->first();

        if (!$payment) {
            WebhookEvent::create([
                'provider_event_id' => $payload['transaction_id'] ?? null,
                'payment_id'        => null,
                'signature_valid'   => true,
                'payload'           => ['order_id' => $orderId],
                'received_at'       => now(),
                'processing_status' => 'skipped',
            ]);
            return response()->json(['message' => 'OK']);
        }

        // Langkah 4: Cocokkan nominal antara webhook dan data internal
        $webhookAmount = (int) round((float) ($payload['gross_amount'] ?? 0));
        if ($webhookAmount !== $payment->amount) {
            Log::warning('Midtrans webhook gross_amount mismatch', [
                'order_id'       => $orderId,
                'webhook_amount' => $webhookAmount,
                'db_amount'      => $payment->amount,
            ]);
            WebhookEvent::create([
                'provider_event_id' => $payload['transaction_id'] ?? null,
                'payment_id'        => $payment->id,
                'signature_valid'   => true,
                'payload'           => ['order_id' => $orderId, 'gross_amount' => $payload['gross_amount'] ?? null],
                'received_at'       => now(),
                'processing_status' => 'failed',
            ]);
            return response()->json(['message' => 'Amount mismatch.'], 400);
        }

        // Langkah 5: Idempotensi — cek di level DB apakah event ini sudah pernah diproses
        // Unique constraint pada provider_event_id mencegah race condition di level database
        $providerEventId = $payload['transaction_id'] ?? null;
        $alreadyProcessed = WebhookEvent::where('provider_event_id', $providerEventId)
            ->where('processing_status', 'processed')
            ->exists();

        if ($alreadyProcessed) {
            return response()->json(['message' => 'OK']);
        }

        // Simpan event webhook (akan unik per provider_event_id berkat DB constraint)
        $event = WebhookEvent::create([
            'provider_event_id' => $providerEventId,
            'payment_id'        => $payment->id,
            'signature_valid'   => true,
            'payload'           => [
                'order_id'           => $orderId,
                'transaction_status' => $payload['transaction_status'] ?? null,
                'fraud_status'       => $payload['fraud_status'] ?? null,
                'status_code'        => $payload['status_code'] ?? null,
            ],
            'received_at'       => now(),
            'processing_status' => 'failed', // akan diupdate ke 'processed' di dalam transaksi
        ]);

        // Langkah 6: Validasi transisi status — tidak turunkan status final
        $newStatus = $this->mapMidtransStatus($payload['transaction_status'] ?? '', $payload['fraud_status'] ?? '');
        $finalStatuses = ['success', 'failed', 'expired'];

        if (in_array($payment->status, $finalStatuses)) {
            $event->update(['processing_status' => 'skipped']);
            return response()->json(['message' => 'OK']);
        }

        // Langkah 7 & 8: Update payment dan bill secara atomik, catat event
        DB::transaction(function () use ($payment, $newStatus, $event, $payload) {
            $payment->update([
                'status'                  => $newStatus,
                'provider_transaction_id' => $payload['transaction_id'] ?? null,
                'payment_type'            => $payload['payment_type'] ?? null,
                'paid_at'                 => $newStatus === 'success' ? now() : null,
                'raw_notification'        => $payload,
            ]);

            // Langkah 9: Jadwalkan notifikasi dan blockchain hanya untuk pembayaran baru yang sukses
            if ($newStatus === 'success') {
                $payment->bill->update(['status' => 'paid']);
                dispatch(new \App\Jobs\RecordPaymentOnChain($payment->id));
                dispatch(new \App\Jobs\SendPaymentNotification($payment->id));
            }

            $event->update(['processing_status' => 'processed']);
        });

        return response()->json(['message' => 'OK']);
    }

    public function telegram(Request $request)
    {
        $secret = config('services.telegram.webhook_secret');
        if ($request->header('X-Telegram-Bot-Api-Secret-Token') !== $secret) {
            return response()->json(['message' => 'Unauthorized.'], 401);
        }

        $update = $request->all();
        $text   = $update['message']['text'] ?? '';
        $chatId = $update['message']['chat']['id'] ?? null;

        if (str_starts_with($text, '/start ') && $chatId) {
            $code = trim(substr($text, 7));
            $link = TelegramLinkCode::where('code', $code)
                ->where('used', false)
                ->where('expires_at', '>', now())
                ->first();

            if ($link) {
                $link->user->update(['telegram_chat_id' => (string) $chatId]);
                $link->update(['used' => true]);
                $this->sendTelegramMessage($chatId, 'Akun Telegram berhasil ditautkan ke KosLedger.');
            } else {
                $this->sendTelegramMessage($chatId, 'Kode tidak valid atau sudah kedaluwarsa.');
            }
        }

        return response()->json(['message' => 'OK']);
    }

    private function verifyMidtransSignature(array $payload): bool
    {
        $serverKey   = config('midtrans.server_key');
        $orderId     = $payload['order_id'] ?? '';
        $statusCode  = $payload['status_code'] ?? '';
        $grossAmount = $payload['gross_amount'] ?? '';

        $expected = hash('sha512', $orderId . $statusCode . $grossAmount . $serverKey);

        return hash_equals($expected, $payload['signature_key'] ?? '');
    }

    private function mapMidtransStatus(string $transactionStatus, string $fraudStatus): string
    {
        if ($transactionStatus === 'capture' && $fraudStatus === 'accept') return 'success';
        if ($transactionStatus === 'settlement') return 'success';
        if (in_array($transactionStatus, ['deny', 'cancel', 'failure'])) return 'failed';
        if ($transactionStatus === 'expire') return 'expired';
        return 'pending';
    }

    private function sendTelegramMessage(int|string $chatId, string $text): void
    {
        $token = config('services.telegram.bot_token');
        if (!$token) return;

        \Illuminate\Support\Facades\Http::post("https://api.telegram.org/bot{$token}/sendMessage", [
            'chat_id' => $chatId,
            'text'    => $text,
        ]);
    }
}
