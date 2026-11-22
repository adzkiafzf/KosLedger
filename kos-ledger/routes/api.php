<?php

use App\Http\Controllers\AuthController;
use App\Http\Controllers\BillController;
use App\Http\Controllers\CashTransactionController;
use App\Http\Controllers\ChainRecordController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\OccupancyController;
use App\Http\Controllers\PaymentController;
use App\Http\Controllers\ReportController;
use App\Http\Controllers\RoomController;
use App\Http\Controllers\TelegramController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\WebhookController;
use Illuminate\Support\Facades\Route;

// Public
Route::post('/auth/login', [AuthController::class, 'login']);

// Webhooks — tidak membutuhkan sesi login, diverifikasi via signature/secret
Route::post('/webhooks/payment', [WebhookController::class, 'midtrans']);
Route::post('/webhooks/telegram', [WebhookController::class, 'telegram']);

// Semua route berikut membutuhkan autentikasi
Route::middleware('auth:sanctum')->group(function () {

    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // =========================================================================
    // Admin
    // =========================================================================
    Route::middleware('role:admin')->group(function () {
        Route::apiResource('users', UserController::class)->except(['destroy']);
        Route::patch('users/{user}/deactivate', [UserController::class, 'deactivate']);
        Route::apiResource('rooms', RoomController::class)->except(['destroy']);
        Route::post('occupancies', [OccupancyController::class, 'store']);
        Route::get('occupancies', [OccupancyController::class, 'index']);
        Route::get('dashboard/admin', [DashboardController::class, 'admin']);
    });

    // =========================================================================
    // Bendahara
    // =========================================================================
    Route::middleware('role:bendahara')->group(function () {
        Route::apiResource('transactions', CashTransactionController::class)->except(['destroy']);
        Route::get('dashboard/treasurer', [DashboardController::class, 'treasurer']);
        Route::post('bills/{bill}/manual-payment', [PaymentController::class, 'manualPayment']);
        Route::post('bills', [BillController::class, 'store']);
        Route::put('bills/{bill}', [BillController::class, 'update']);
        Route::post('chain-records/{payment}/retry', [ChainRecordController::class, 'retry']);
        Route::post('telegram/reminders/send', [TelegramController::class, 'sendReminders']);
    });

    // =========================================================================
    // Admin + Bendahara — lihat data kamar
    // =========================================================================
    Route::middleware('role:admin,bendahara')->group(function () {
        Route::get('rooms', [RoomController::class, 'index']);
        Route::get('rooms/{room}', [RoomController::class, 'show']);
    });

    // =========================================================================
    // Bendahara + Pemilik — laporan keuangan dan pembayaran, chain records
    // =========================================================================
    Route::middleware('role:bendahara,pemilik')->group(function () {
        Route::get('reports/finance', [ReportController::class, 'finance']);
        Route::get('reports/payments', [ReportController::class, 'payments']);
        Route::get('chain-records', [ChainRecordController::class, 'index']);
    });

    // =========================================================================
    // Admin + Pemilik — laporan hunian
    // =========================================================================
    Route::middleware('role:admin,pemilik')->group(function () {
        Route::get('reports/occupancy', [ReportController::class, 'occupancy']);
    });

    // =========================================================================
    // Tagihan — Bendahara + Anggota (dengan otorisasi kepemilikan di controller)
    // =========================================================================
    Route::middleware('role:bendahara,anggota')->group(function () {
        Route::get('bills', [BillController::class, 'index']);
        Route::get('bills/{bill}', [BillController::class, 'show']);
        Route::get('bills/{bill}/items', [BillController::class, 'items']);
        Route::get('payments', [PaymentController::class, 'index']);
        Route::get('payments/{payment}', [PaymentController::class, 'show']);
    });

    // =========================================================================
    // Anggota
    // =========================================================================
    Route::middleware('role:anggota')->group(function () {
        Route::post('bills/{bill}/checkout', [PaymentController::class, 'checkout']);
        Route::get('dashboard/member', [DashboardController::class, 'member']);
        Route::post('telegram/link-code', [TelegramController::class, 'linkCode']);
    });

    // =========================================================================
    // Pemilik
    // =========================================================================
    Route::middleware('role:pemilik')->group(function () {
        Route::get('dashboard/owner', [DashboardController::class, 'owner']);
    });

    // =========================================================================
    // Chain records detail & verifikasi — Bendahara + Pemilik + Anggota (kepemilikan dicek di controller)
    // =========================================================================
    Route::middleware('role:bendahara,pemilik,anggota')->group(function () {
        Route::get('chain-records/{payment}', [ChainRecordController::class, 'show']);
        Route::post('chain-records/{payment}/verify', [ChainRecordController::class, 'verify']);
    });

    // =========================================================================
    // Notifikasi — semua role yang login
    // =========================================================================
    Route::get('notifications', [TelegramController::class, 'notifications']);
});
