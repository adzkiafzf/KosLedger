<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Bill extends Model
{
    protected $fillable = ['occupancy_id', 'period', 'due_date', 'total_amount', 'status', 'created_by'];

    protected function casts(): array
    {
        return ['due_date' => 'date', 'total_amount' => 'integer'];
    }

    public function occupancy() { return $this->belongsTo(Occupancy::class); }
    public function items() { return $this->hasMany(BillItem::class); }
    public function payments() { return $this->hasMany(Payment::class); }
    public function successPayment() { return $this->hasOne(Payment::class)->where('status', 'success'); }
    public function creator() { return $this->belongsTo(User::class, 'created_by'); }
}
