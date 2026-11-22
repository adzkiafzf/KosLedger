<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Foundation\Auth\User as Authenticatable;

class User extends Authenticatable
{
    use HasFactory;

    protected $fillable = ['name', 'nickname', 'phone', 'username', 'password', 'role', 'telegram_chat_id', 'is_active'];

    protected $hidden = ['password', 'remember_token'];

    protected function casts(): array
    {
        return ['password' => 'hashed', 'is_active' => 'boolean'];
    }

    public function occupancies() { return $this->hasMany(Occupancy::class); }
    public function activeOccupancy() { return $this->hasOne(Occupancy::class)->where('status', 'active'); }
}
