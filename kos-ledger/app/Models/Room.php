<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Room extends Model
{
    protected $fillable = ['room_number', 'monthly_rate', 'capacity', 'status'];

    public function occupancies() { return $this->hasMany(Occupancy::class); }
    public function activeOccupancies() { return $this->hasMany(Occupancy::class)->where('status', 'active'); }
}
