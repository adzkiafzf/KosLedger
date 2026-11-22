<?php

use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

// Kirim pengingat tagihan jatuh tempo setiap hari pukul 08:00 WIB (UTC+7 = 01:00 UTC)
Schedule::job(new \App\Jobs\SendDueReminders)->dailyAt('01:00');
