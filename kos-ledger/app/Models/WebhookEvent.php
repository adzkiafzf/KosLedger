<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WebhookEvent extends Model
{
    protected $fillable = ['provider_event_id', 'payment_id', 'signature_valid', 'payload', 'received_at', 'processing_status'];

    protected function casts(): array
    {
        return ['payload' => 'array', 'signature_valid' => 'boolean', 'received_at' => 'datetime'];
    }

    public function payment() { return $this->belongsTo(Payment::class); }
}
