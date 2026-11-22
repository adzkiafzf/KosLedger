<?php

namespace Database\Seeders;

use App\Models\Bill;
use App\Models\BillItem;
use App\Models\Occupancy;
use App\Models\Room;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    public function run(): void
    {
        // =====================================================================
        // Akun staf — dibuat via seeder, bukan registrasi publik (PRD §19 poin 13)
        // =====================================================================
        $admin = User::firstOrCreate(['username' => 'admin'], [
            'name'      => 'Admin KosLedger',
            'nickname'  => 'Admin',
            'phone'     => '081200000001',
            'role'      => 'admin',
            'password'  => Hash::make('password-dummy'),
            'is_active' => true,
        ]);

        $bendahara = User::firstOrCreate(['username' => 'bendahara'], [
            'name'      => 'Bendahara KosLedger',
            'nickname'  => 'Benda',
            'phone'     => '081200000002',
            'role'      => 'bendahara',
            'password'  => Hash::make('password-dummy'),
            'is_active' => true,
        ]);

        $pemilik = User::firstOrCreate(['username' => 'pemilik'], [
            'name'      => 'Pemilik KosLedger',
            'nickname'  => 'Pak Bos',
            'phone'     => '081200000003',
            'role'      => 'pemilik',
            'password'  => Hash::make('password-dummy'),
            'is_active' => true,
        ]);

        // =====================================================================
        // Penghuni dummy (role anggota)
        // =====================================================================
        $anggota1 = User::firstOrCreate(['username' => 'anggota1'], [
            'name'      => 'Penghuni Satu',
            'nickname'  => 'Satu',
            'phone'     => '081200000011',
            'role'      => 'anggota',
            'password'  => Hash::make('password-dummy'),
            'is_active' => true,
        ]);

        $anggota2 = User::firstOrCreate(['username' => 'anggota2'], [
            'name'      => 'Penghuni Dua',
            'nickname'  => 'Dua',
            'phone'     => '081200000012',
            'role'      => 'anggota',
            'password'  => Hash::make('password-dummy'),
            'is_active' => true,
        ]);

        $anggota3 = User::firstOrCreate(['username' => 'anggota3'], [
            'name'      => 'Penghuni Tiga',
            'nickname'  => 'Tiga',
            'phone'     => '081200000013',
            'role'      => 'anggota',
            'password'  => Hash::make('password-dummy'),
            'is_active' => true,
        ]);

        // =====================================================================
        // Kamar dummy
        // =====================================================================
        $roomA1 = Room::firstOrCreate(['room_number' => 'A-01'], [
            'monthly_rate' => 1500000,
            'capacity'     => 1,
            'status'       => 'occupied',
        ]);

        $roomA2 = Room::firstOrCreate(['room_number' => 'A-02'], [
            'monthly_rate' => 1500000,
            'capacity'     => 1,
            'status'       => 'occupied',
        ]);

        $roomB1 = Room::firstOrCreate(['room_number' => 'B-01'], [
            'monthly_rate' => 2000000,
            'capacity'     => 2,
            'status'       => 'occupied',
        ]);

        $roomB2 = Room::firstOrCreate(['room_number' => 'B-02'], [
            'monthly_rate' => 2000000,
            'capacity'     => 1,
            'status'       => 'available',
        ]);

        // =====================================================================
        // Penempatan dummy
        // =====================================================================
        $occ1 = Occupancy::firstOrCreate(
            ['user_id' => $anggota1->id, 'status' => 'active'],
            ['room_id' => $roomA1->id, 'start_date' => '2026-09-01', 'status' => 'active']
        );

        $occ2 = Occupancy::firstOrCreate(
            ['user_id' => $anggota2->id, 'status' => 'active'],
            ['room_id' => $roomA2->id, 'start_date' => '2026-10-01', 'status' => 'active']
        );

        $occ3 = Occupancy::firstOrCreate(
            ['user_id' => $anggota3->id, 'status' => 'active'],
            ['room_id' => $roomB1->id, 'start_date' => '2026-11-01', 'status' => 'active']
        );

        // =====================================================================
        // Tagihan dummy
        // =====================================================================
        $this->seedBill($occ1, '2026-11', '2026-11-10', $bendahara->id, [
            ['category' => 'sewa',   'description' => 'Sewa kamar A-01 November 2026', 'amount' => 1500000],
            ['category' => 'air',    'description' => 'Alokasi air November 2026',      'amount' => 50000],
            ['category' => 'listrik','description' => 'Alokasi listrik November 2026',  'amount' => 75000],
        ]);

        $this->seedBill($occ2, '2026-11', '2026-11-10', $bendahara->id, [
            ['category' => 'sewa',   'description' => 'Sewa kamar A-02 November 2026', 'amount' => 1500000],
            ['category' => 'air',    'description' => 'Alokasi air November 2026',      'amount' => 50000],
            ['category' => 'listrik','description' => 'Alokasi listrik November 2026',  'amount' => 75000],
        ]);

        $this->seedBill($occ3, '2026-11', '2026-11-10', $bendahara->id, [
            ['category' => 'sewa',   'description' => 'Sewa kamar B-01 November 2026', 'amount' => 2000000],
            ['category' => 'air',    'description' => 'Alokasi air November 2026',      'amount' => 60000],
        ]);

        $this->command->info('Seeder selesai. Akun dummy:');
        $this->command->table(
            ['Username', 'Password', 'Role'],
            [
                ['admin',     'password-dummy', 'admin'],
                ['bendahara', 'password-dummy', 'bendahara'],
                ['pemilik',   'password-dummy', 'pemilik'],
                ['anggota1',  'password-dummy', 'anggota'],
                ['anggota2',  'password-dummy', 'anggota'],
                ['anggota3',  'password-dummy', 'anggota'],
            ]
        );
    }

    private function seedBill(Occupancy $occupancy, string $period, string $dueDate, int $createdBy, array $items): void
    {
        $exists = Bill::where('occupancy_id', $occupancy->id)->where('period', $period)->exists();
        if ($exists) return;

        $total = collect($items)->sum('amount');

        $bill = Bill::create([
            'occupancy_id' => $occupancy->id,
            'period'       => $period,
            'due_date'     => $dueDate,
            'total_amount' => $total,
            'status'       => 'unpaid',
            'created_by'   => $createdBy,
        ]);

        foreach ($items as $item) {
            BillItem::create(array_merge($item, ['bill_id' => $bill->id]));
        }
    }
}
