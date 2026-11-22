<?php

namespace Tests\Feature\Payment;

use App\Models\Bill;
use App\Models\Occupancy;
use App\Models\Payment;
use App\Models\Room;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class PaymentTest extends TestCase
{
    use RefreshDatabase;

    private User $anggota;
    private User $anggota2;
    private Bill $bill;
    private string $serverKey = 'test-server-key';

    protected function setUp(): void
    {
        parent::setUp();

        config(['midtrans.server_key' => $this->serverKey]);

        // Buat user anggota
        $this->anggota = User::create([
            'name'      => 'Penghuni Test',
            'username'  => 'anggota_test',
            'password'  => bcrypt('password'),
            'role'      => 'anggota',
            'is_active' => true,
        ]);

        $this->anggota2 = User::create([
            'name'      => 'Penghuni Lain',
            'username'  => 'anggota_lain',
            'password'  => bcrypt('password'),
            'role'      => 'anggota',
            'is_active' => true,
        ]);

        $pemilik = User::create([
            'name'      => 'Pemilik Test',
            'username'  => 'pemilik_test',
            'password'  => bcrypt('password'),
            'role'      => 'pemilik',
            'is_active' => true,
        ]);

        $room = Room::create(['room_number' => '101', 'monthly_rate' => 500000, 'capacity' => 1, 'status' => 'occupied']);

        $occupancy = Occupancy::create([
            'user_id'    => $this->anggota->id,
            'room_id'    => $room->id,
            'start_date' => now()->subMonth(),
            'status'     => 'active',
        ]);

        $this->bill = Bill::create([
            'occupancy_id' => $occupancy->id,
            'period'       => now()->format('Y-m'),
            'due_date'     => now()->addDays(7),
            'total_amount' => 500000,
            'status'       => 'unpaid',
            'created_by'   => $pemilik->id,
        ]);
    }

    // ---------------------------------------------------------------
    // TC-01: Checkout berhasil — dapat snap_token
    // ---------------------------------------------------------------
    public function test_checkout_berhasil_dapat_snap_token(): void
    {
        // Mock Midtrans Snap::getSnapToken via HTTP fake ke Midtrans API
        Http::fake([
            '*sandbox.midtrans.com/snap/v1/transactions*' => Http::response(['token' => 'fake-snap-token-123', 'redirect_url' => 'https://app.sandbox.midtrans.com/snap/v4/redirection/fake'], 200),
        ]);

        $response = $this->actingAs($this->anggota, 'sanctum')
            ->postJson("/api/bills/{$this->bill->id}/checkout");

        $response->assertStatus(201)
            ->assertJsonStructure(['data' => ['payment_id', 'order_id', 'snap_token']]);

        $this->assertDatabaseHas('payments', [
            'bill_id' => $this->bill->id,
            'status'  => 'pending',
            'method'  => 'gateway',
        ]);
    }

    // ---------------------------------------------------------------
    // TC-02: Checkout ditolak jika tagihan sudah lunas
    // ---------------------------------------------------------------
    public function test_checkout_ditolak_jika_tagihan_sudah_lunas(): void
    {
        $this->bill->update(['status' => 'paid']);

        $response = $this->actingAs($this->anggota, 'sanctum')
            ->postJson("/api/bills/{$this->bill->id}/checkout");

        $response->assertStatus(409);
    }

    // ---------------------------------------------------------------
    // TC-03: Checkout ditolak jika sudah ada payment pending
    // ---------------------------------------------------------------
    public function test_checkout_ditolak_jika_ada_pending(): void
    {
        Payment::create([
            'bill_id'           => $this->bill->id,
            'method'            => 'gateway',
            'provider_order_id' => 'KL-existing-pending',
            'amount'            => 500000,
            'status'            => 'pending',
        ]);

        $response = $this->actingAs($this->anggota, 'sanctum')
            ->postJson("/api/bills/{$this->bill->id}/checkout");

        $response->assertStatus(409);
    }

    // ---------------------------------------------------------------
    // TC-04: Anggota tidak bisa bayar tagihan orang lain
    // ---------------------------------------------------------------
    public function test_anggota_tidak_bisa_bayar_tagihan_orang_lain(): void
    {
        $response = $this->actingAs($this->anggota2, 'sanctum')
            ->postJson("/api/bills/{$this->bill->id}/checkout");

        $response->assertStatus(403);
    }

    // ---------------------------------------------------------------
    // TC-05: Webhook signature valid — status jadi success
    // ---------------------------------------------------------------
    public function test_webhook_settlement_mengubah_status_jadi_success(): void
    {
        $payment = Payment::create([
            'bill_id'           => $this->bill->id,
            'method'            => 'gateway',
            'provider_order_id' => 'KL-test-settlement',
            'amount'            => 500000,
            'status'            => 'pending',
        ]);

        $payload = $this->buildWebhookPayload('KL-test-settlement', '200', '500000.00', 'settlement', 'accept', 'txn-001');

        $response = $this->postJson('/api/webhooks/payment', $payload);

        $response->assertStatus(200)->assertJson(['message' => 'OK']);

        $this->assertDatabaseHas('payments', [
            'id'     => $payment->id,
            'status' => 'success',
        ]);

        $this->assertDatabaseHas('bills', [
            'id'     => $this->bill->id,
            'status' => 'paid',
        ]);
    }

    // ---------------------------------------------------------------
    // TC-06: Webhook signature tidak valid — ditolak 400
    // ---------------------------------------------------------------
    public function test_webhook_signature_invalid_ditolak(): void
    {
        Payment::create([
            'bill_id'           => $this->bill->id,
            'method'            => 'gateway',
            'provider_order_id' => 'KL-test-invalid-sig',
            'amount'            => 500000,
            'status'            => 'pending',
        ]);

        $payload = $this->buildWebhookPayload('KL-test-invalid-sig', '200', '500000.00', 'settlement', 'accept', 'txn-002');
        $payload['signature_key'] = 'signature-salah-total';

        $response = $this->postJson('/api/webhooks/payment', $payload);

        $response->assertStatus(400);

        $this->assertDatabaseHas('payments', [
            'provider_order_id' => 'KL-test-invalid-sig',
            'status'            => 'pending',
        ]);
    }

    // ---------------------------------------------------------------
    // TC-07: Webhook idempoten — notifikasi ganda tidak double update
    // ---------------------------------------------------------------
    public function test_webhook_idempoten_notifikasi_ganda(): void
    {
        Payment::create([
            'bill_id'           => $this->bill->id,
            'method'            => 'gateway',
            'provider_order_id' => 'KL-test-idem',
            'amount'            => 500000,
            'status'            => 'pending',
        ]);

        $payload = $this->buildWebhookPayload('KL-test-idem', '200', '500000.00', 'settlement', 'accept', 'txn-idem-001');

        $this->postJson('/api/webhooks/payment', $payload)->assertStatus(200);
        $this->postJson('/api/webhooks/payment', $payload)->assertStatus(200);

        $this->assertEquals(1, Payment::where('provider_order_id', 'KL-test-idem')->where('status', 'success')->count());
    }

    // ---------------------------------------------------------------
    // TC-08: Webhook status expire
    // ---------------------------------------------------------------
    public function test_webhook_expire_mengubah_status_jadi_expired(): void
    {
        Payment::create([
            'bill_id'           => $this->bill->id,
            'method'            => 'gateway',
            'provider_order_id' => 'KL-test-expire',
            'amount'            => 500000,
            'status'            => 'pending',
        ]);

        $payload = $this->buildWebhookPayload('KL-test-expire', '407', '500000.00', 'expire', '', 'txn-expire-001');

        $this->postJson('/api/webhooks/payment', $payload)->assertStatus(200);

        $this->assertDatabaseHas('payments', [
            'provider_order_id' => 'KL-test-expire',
            'status'            => 'expired',
        ]);
    }

    // ---------------------------------------------------------------
    // TC-09: Webhook status deny/cancel
    // ---------------------------------------------------------------
    public function test_webhook_deny_mengubah_status_jadi_failed(): void
    {
        Payment::create([
            'bill_id'           => $this->bill->id,
            'method'            => 'gateway',
            'provider_order_id' => 'KL-test-deny',
            'amount'            => 500000,
            'status'            => 'pending',
        ]);

        $payload = $this->buildWebhookPayload('KL-test-deny', '202', '500000.00', 'deny', 'deny', 'txn-deny-001');

        $this->postJson('/api/webhooks/payment', $payload)->assertStatus(200);

        $this->assertDatabaseHas('payments', [
            'provider_order_id' => 'KL-test-deny',
            'status'            => 'failed',
        ]);
    }

    // ---------------------------------------------------------------
    // TC-10: Status final tidak bisa di-downgrade
    // ---------------------------------------------------------------
    public function test_status_final_tidak_bisa_didowngrade(): void
    {
        Payment::create([
            'bill_id'           => $this->bill->id,
            'method'            => 'gateway',
            'provider_order_id' => 'KL-test-final',
            'amount'            => 500000,
            'status'            => 'success',
            'paid_at'           => now(),
        ]);

        $payload = $this->buildWebhookPayload('KL-test-final', '407', '500000.00', 'expire', '', 'txn-final-001');

        $this->postJson('/api/webhooks/payment', $payload)->assertStatus(200);

        $this->assertDatabaseHas('payments', [
            'provider_order_id' => 'KL-test-final',
            'status'            => 'success',
        ]);
    }

    // ---------------------------------------------------------------
    // Helper: build webhook payload dengan signature yang benar
    // ---------------------------------------------------------------
    private function buildWebhookPayload(
        string $orderId,
        string $statusCode,
        string $grossAmount,
        string $transactionStatus,
        string $fraudStatus,
        string $transactionId
    ): array {
        $signature = hash('sha512', $orderId . $statusCode . $grossAmount . $this->serverKey);

        return [
            'order_id'           => $orderId,
            'status_code'        => $statusCode,
            'gross_amount'       => $grossAmount,
            'transaction_status' => $transactionStatus,
            'fraud_status'       => $fraudStatus,
            'transaction_id'     => $transactionId,
            'payment_type'       => 'credit_card',
            'signature_key'      => $signature,
        ];
    }
}
