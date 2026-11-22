<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $request->validate(['username' => 'required|string', 'password' => 'required|string']);

        $key = 'login:' . $request->ip();
        if (RateLimiter::tooManyAttempts($key, 5)) {
            return response()->json(['message' => 'Terlalu banyak percobaan. Coba lagi nanti.'], 429);
        }

        $user = User::where('username', $request->username)->where('is_active', true)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            RateLimiter::hit($key, 60);
            return response()->json(['message' => 'Kredensial tidak valid.'], 401);
        }

        RateLimiter::clear($key);
        $token = $user->createToken('api')->plainTextToken;

        return response()->json(['data' => $this->userPayload($user), 'token' => $token, 'message' => 'Login berhasil.']);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

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
