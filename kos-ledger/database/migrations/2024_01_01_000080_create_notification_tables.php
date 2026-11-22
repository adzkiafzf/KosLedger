<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notification_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->restrictOnDelete();
            $table->foreignId('bill_id')->nullable()->constrained()->nullOnDelete();
            $table->enum('type', ['reminder', 'payment_success']);
            $table->enum('status', ['sent', 'failed']);
            $table->string('error_message')->nullable();
            $table->timestamp('sent_at');
            $table->timestamps();
        });

        Schema::create('telegram_link_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('code', 32)->unique();
            $table->timestamp('expires_at');
            $table->boolean('used')->default(false);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telegram_link_codes');
        Schema::dropIfExists('notification_logs');
    }
};
