<?php

namespace App\Jobs;

use App\Models\ChainRecord;
use App\Models\Payment;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class RecordPaymentOnChain implements ShouldQueue
{
    use Queueable;

    public int $tries = 3;

    public function __construct(public int $paymentId) {}

    public function handle(): void
    {
        $payment = Payment::with('chainRecord')->findOrFail($this->paymentId);

        // Hanya pembayaran sukses yang boleh dicatat (PRD §5.9)
        if ($payment->status !== 'success') {
            Log::info('RecordPaymentOnChain: pembayaran bukan success, dilewati.', ['payment_id' => $this->paymentId]);
            return;
        }

        $signerUrl    = config('services.ethereum.signer_url');
        $contractAddr = config('services.ethereum.contract_address');

        if (!$signerUrl || !$contractAddr) {
            Log::warning('Blockchain config tidak lengkap, pencatatan dilewati.', ['payment_id' => $this->paymentId]);
            // Buat/update record dengan status failed agar bisa di-retry manual
            $record = $payment->chainRecord ?? ChainRecord::create([
                'payment_id'   => $payment->id,
                'payment_ref'  => '0x' . bin2hex(random_bytes(32)),
                'payload_hash' => '',
                'chain_status' => 'failed',
            ]);
            $record->update([
                'chain_status'  => 'failed',
                'error_message' => 'Konfigurasi blockchain tidak lengkap.',
            ]);
            return;
        }

        // Dapatkan atau buat chain record
        $record = $payment->chainRecord ?? ChainRecord::create([
            'payment_id'   => $payment->id,
            'payment_ref'  => '0x' . bin2hex(random_bytes(32)),
            'payload_hash' => '',
            'chain_status' => 'pending',
        ]);

        // Jika sudah tercatat sebelumnya, tidak perlu kirim ulang (PRD §5.9)
        if ($record->chain_status === 'recorded') {
            Log::info('RecordPaymentOnChain: sudah tercatat, dilewati.', ['payment_id' => $this->paymentId]);
            return;
        }

        // Hitung hash payload kanonis (PRD §10.2)
        $payload = json_encode([
            'schema_version' => '1',
            'payment_ref'    => $record->payment_ref,
            'amount'         => $payment->amount,
            'status'         => $payment->status,
            'verified_at'    => $payment->paid_at?->toIso8601String(),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $hash = '0x' . hash('sha256', $payload);
        $record->update(['payload_hash' => $hash, 'chain_status' => 'pending']);

        // Sebelum mengirim ke kontrak, tanyakan sidecar apakah paymentRef sudah tercatat
        // Ini mencegah catatan ganda jika job sebelumnya gagal mencatat respons tapi
        // transaksi on-chain sudah berhasil (PRD §5.9, retry memeriksa isRecorded)
        try {
            $checkResponse = Http::get($signerUrl . '/is-recorded', [
                'payment_ref' => $record->payment_ref,
            ]);

            if ($checkResponse->successful() && $checkResponse->json('is_recorded') === true) {
                // Sudah tercatat on-chain — sinkronkan status lokal
                $txHash = $checkResponse->json('tx_hash');
                $record->update([
                    'chain_status'    => 'recorded',
                    'tx_hash'         => $txHash,
                    'contract_address' => $contractAddr,
                    'recorded_at'     => now(),
                ]);
                Log::info('RecordPaymentOnChain: paymentRef sudah tercatat on-chain, status disinkronkan.', [
                    'payment_id'  => $this->paymentId,
                    'payment_ref' => $record->payment_ref,
                ]);
                return;
            }
        } catch (\Throwable $e) {
            // Jika endpoint isRecorded tidak tersedia, lanjutkan dengan pengiriman normal
            Log::warning('RecordPaymentOnChain: gagal cek isRecorded, lanjut kirim.', [
                'payment_id' => $this->paymentId,
                'error'      => $e->getMessage(),
            ]);
        }

        // Kirim pencatatan ke sidecar yang memegang private key (PRD §10.3)
        try {
            $response = Http::post($signerUrl . '/record', [
                'payment_ref'  => $record->payment_ref,
                'payload_hash' => $hash,
            ]);

            if ($response->successful()) {
                $txHash = $response->json('tx_hash');
                $record->update([
                    'tx_hash'          => $txHash,
                    'contract_address' => $contractAddr,
                    'chain_status'     => 'recorded',
                    'recorded_at'      => now(),
                    'retry_count'      => $record->retry_count + 1,
                    'error_message'    => null,
                ]);
                Log::info('RecordPaymentOnChain: berhasil dicatat on-chain.', [
                    'payment_id' => $this->paymentId,
                    'tx_hash'    => $txHash,
                ]);
            } else {
                throw new \Exception('Sidecar error: ' . $response->body());
            }
        } catch (\Throwable $e) {
            Log::error('RecordPaymentOnChain: gagal.', [
                'payment_id' => $this->paymentId,
                'error'      => $e->getMessage(),
            ]);
            $record->update([
                'chain_status'  => 'failed',
                'error_message' => substr($e->getMessage(), 0, 255),
                'retry_count'   => $record->retry_count + 1,
            ]);

            // Re-throw agar Laravel queue mencoba ulang sesuai $tries
            throw $e;
        }
    }
}
