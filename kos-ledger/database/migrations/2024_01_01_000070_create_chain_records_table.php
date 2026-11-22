<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chain_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('payment_id')->unique()->constrained()->restrictOnDelete();
            $table->string('payment_ref', 66)->unique(); // 0x + 32 bytes hex
            $table->string('payload_hash', 66);
            $table->string('contract_address')->nullable();
            $table->string('tx_hash')->nullable();
            $table->enum('chain_status', ['not_submitted', 'pending', 'recorded', 'failed'])->default('not_submitted');
            $table->unsignedTinyInteger('retry_count')->default(0);
            $table->string('error_message')->nullable();
            $table->timestamp('recorded_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('chain_records');
    }
};
