<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Payment extends Model
{
    protected $fillable = [
        'bill_id', 'method', 'provider_order_id', 'provider_transaction_id',
        'amount', 'status', 'paid_at', 'recorded_by', 'note',
    ];

    protected function casts(): array
    {
        return ['paid_at' => 'datetime', 'amount' => 'integer'];
    }

    public function bill() { return $this->belongsTo(Bill::class); }
    public function recorder() { return $this->belongsTo(User::class, 'recorded_by'); }
    public function chainRecord() { return $this->hasOne(ChainRecord::class); }
}
