<?php

namespace App\Http\Controllers;

use App\Models\NotificationLog;
use App\Models\TelegramLinkCode;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class TelegramController extends Controller
{
    public function linkCode(Request $request)
    {
        $user = $request->user();

        // Invalidate old codes
        TelegramLinkCode::where('user_id', $user->id)->where('used', false)->delete();

        $code = Str::random(24);
        TelegramLinkCode::create([
            'user_id'    => $user->id,
            'code'       => $code,
            'expires_at' => now()->addMinutes(15),
        ]);

        return response()->json([
            'data'    => ['code' => $code, 'expires_in_minutes' => 15],
            'message' => 'Kirim /start ' . $code . ' ke bot Telegram KosLedger.',
        ]);
    }

    public function sendReminders(Request $request)
    {
        dispatch(new \App\Jobs\SendDueReminders());

        return response()->json(['message' => 'Pengingat sedang dikirim.']);
    }

    public function notifications(Request $request)
    {
        $logs = NotificationLog::where('user_id', $request->user()->id)->latest('sent_at')->paginate(20);

        return response()->json(['data' => $logs]);
    }
}
