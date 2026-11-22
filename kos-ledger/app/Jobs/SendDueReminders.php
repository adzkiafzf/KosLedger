<?php

namespace App\Jobs;

use App\Models\Bill;
use App\Models\NotificationLog;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SendDueReminders implements ShouldQueue
{
    use Queueable;

    public function handle(): void
    {
        $token = config('services.telegram.bot_token');
        if (!$token) return;

        // Bills due in 3 days or less, still unpaid
        $bills = Bill::where('status', 'unpaid')
            ->whereDate('due_date', '<=', now()->addDays(3))
            ->whereDate('due_date', '>=', now())
            ->with('occupancy.user')
            ->get();

        foreach ($bills as $bill) {
            $user = $bill->occupancy->user;
            if (!$user->telegram_chat_id) continue;

            $amount = number_format($bill->total_amount, 0, ',', '.');
            $due    = $bill->due_date->format('d/m/Y');
            $period = $bill->period;
            $text   = "⏰ Pengingat\nTagihan kos periode {$period} sebesar <b>Rp {$amount}</b> jatuh tempo pada <b>{$due}</b>. Segera lakukan pembayaran.";

            $status = 'sent';
            $error  = null;

            try {
                $response = Http::post("https://api.telegram.org/bot{$token}/sendMessage", [
                    'chat_id'    => $user->telegram_chat_id,
                    'text'       => $text,
                    'parse_mode' => 'HTML',
                ]);

                if (!$response->successful()) throw new \Exception($response->body());
            } catch (\Throwable $e) {
                $status = 'failed';
                $error  = substr($e->getMessage(), 0, 255);
                Log::warning('Reminder failed', ['bill_id' => $bill->id, 'error' => $e->getMessage()]);
            }

            NotificationLog::create([
                'user_id'       => $user->id,
                'bill_id'       => $bill->id,
                'type'          => 'reminder',
                'status'        => $status,
                'error_message' => $error,
                'sent_at'       => now(),
            ]);
        }
    }
}
