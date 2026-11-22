<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class BillItem extends Model
{
    protected $fillable = ['bill_id', 'category', 'description', 'amount'];

    protected function casts(): array
    {
        return ['amount' => 'integer'];
    }

    public function bill() { return $this->belongsTo(Bill::class); }
}
