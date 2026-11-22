<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ChainRecord extends Model
{
    protected $fillable = [
        'payment_id', 'payment_ref', 'payload_hash', 'contract_address',
        'tx_hash', 'chain_status', 'retry_count', 'error_message', 'recorded_at',
    ];

    protected function casts(): array
    {
        return ['recorded_at' => 'datetime', 'retry_count' => 'integer'];
    }

    public function payment() { return $this->belongsTo(Payment::class); }
}
