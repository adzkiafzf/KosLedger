<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class CashTransaction extends Model
{
    protected $fillable = ['type', 'category', 'description', 'amount', 'trx_date', 'created_by', 'payment_id'];

    protected function casts(): array
    {
        return ['trx_date' => 'date', 'amount' => 'integer'];
    }

    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
    public function payment() { return $this->belongsTo(Payment::class); }
}
