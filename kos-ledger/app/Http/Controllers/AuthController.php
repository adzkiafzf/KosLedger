<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate(['username' => 'required|string', 'password' => 'required|string']);

        $key = 'login:' . $request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            return response()->json(['message' => 'Terlalu banyak percobaan. Coba lagi nanti.'], 429);
        }

        if (!Auth::attempt(['username' => $request->username, 'password' => $request->password, 'is_active' => true])) {
            RateLimiter::hit($key, 60);
            return response()->json(['message' => 'Kredensial tidak valid.'], 401);
        }

        RateLimiter::clear($key);
        $request->session()->regenerate();

        return response()->json(['data' => $this->userPayload(Auth::user()), 'message' => 'Login berhasil.']);
    }

    public function logout(Request $request)
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(['message' => 'Logout berhasil.']);
    }

    public function me(Request $request)
    {
        return response()->json(['data' => $this->userPayload($request->user())]);
    }

    private function userPayload($user): array
    {
        return [
            'id'       => $user->id,
            'name'     => $user->name,
            'nickname' => $user->nickname,
            'username' => $user->username,
            'role'     => $user->role,
        ];
    }
}
