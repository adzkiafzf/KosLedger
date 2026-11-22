<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index()
    {
        return response()->json(['data' => User::select('id', 'name', 'nickname', 'phone', 'role', 'is_active', 'created_at')->get()]);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'     => 'required|string|max:255',
            'nickname' => 'nullable|string|max:100',
            'phone'    => 'nullable|string|max:20',
            'username' => 'required|string|unique:users|max:100',
            'password' => 'required|string|min:6',
        ]);

        $data['role'] = 'anggota';
        $data['password'] = Hash::make($data['password']);

        $user = User::create($data);

        return response()->json(['data' => $user->only('id', 'name', 'nickname', 'username', 'role'), 'message' => 'Penghuni berhasil ditambahkan.'], 201);
    }

    public function show(User $user)
    {
        return response()->json(['data' => $user->makeHidden(['password', 'remember_token'])]);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name'     => 'sometimes|string|max:255',
            'nickname' => 'nullable|string|max:100',
            'phone'    => 'nullable|string|max:20',
        ]);

        $user->update($data);

        return response()->json(['data' => $user->fresh()->makeHidden(['password', 'remember_token']), 'message' => 'Data penghuni diperbarui.']);
    }

    public function deactivate(User $user)
    {
        $user->update(['is_active' => false]);

        return response()->json(['message' => 'Penghuni dinonaktifkan.']);
    }
}
