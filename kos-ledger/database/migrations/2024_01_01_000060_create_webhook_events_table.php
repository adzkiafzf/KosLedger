<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('webhook_events', function (Blueprint $table) {
            $table->id();
            $table->string('provider_event_id')->nullable()->unique(); // unique untuk idempotensi di level DB
            $table->foreignId('payment_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('signature_valid')->default(false);
            $table->json('payload');
            $table->timestamp('received_at');
            $table->enum('processing_status', ['processed', 'skipped', 'failed'])->default('processed');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('webhook_events');
    }
};
