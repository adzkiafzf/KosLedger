<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class NotificationLog extends Model
{
    protected $fillable = ['user_id', 'bill_id', 'type', 'status', 'error_message', 'sent_at'];

    protected function casts(): array
    {
        return ['sent_at' => 'datetime'];
    }

    public function user() { return $this->belongsTo(User::class); }
    public function bill() { return $this->belongsTo(Bill::class); }
}
