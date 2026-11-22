<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bills', function (Blueprint $table) {
            $table->id();
            $table->foreignId('occupancy_id')->constrained()->restrictOnDelete();
            $table->string('period', 7); // YYYY-MM
            $table->date('due_date');
            $table->bigInteger('total_amount');
            $table->enum('status', ['unpaid', 'paid'])->default('unpaid');
            $table->foreignId('created_by')->constrained('users')->restrictOnDelete();
            $table->timestamps();

            $table->unique(['occupancy_id', 'period']);
        });

        Schema::create('bill_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('bill_id')->constrained()->cascadeOnDelete();
            $table->string('category');
            $table->string('description');
            $table->bigInteger('amount');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('bill_items');
        Schema::dropIfExists('bills');
    }
};
