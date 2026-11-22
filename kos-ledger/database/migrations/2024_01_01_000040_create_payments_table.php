<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('payments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bill_id')->constrained()->restrictOnDelete();
            $table->enum('method', ['gateway', 'manual']);
            $table->string('provider_order_id')->unique()->nullable();
            $table->string('provider_transaction_id')->nullable();
            $table->bigInteger('amount');
            $table->enum('status', ['pending', 'success', 'failed', 'expired'])->default('pending');
            $table->timestamp('paid_at')->nullable();
            $table->foreignId('recorded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('note')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('payments');
    }
};
