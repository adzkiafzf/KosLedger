import { generateTelegramLinkCode } from '../../api/notifications.js';
import { member } from '../../api/dashboard.js';
import { apiError } from '../../api/client.js';
import { go } from '../../core/router.js';
import { pageHead, pill, ms, toast, modal, closeModal, mhead, kvs } from '../../components/ui.js';
import { statCard } from '../../components/widgets.js';
import { errorView } from '../../components/states.js';
import { esc } from '../../utils/format.js';

export default async function layanan({ user }) {
  let isLinked = false;

  try {
    const dash = await member();
    isLinked = Boolean(dash?.linked_telegram);
  } catch {
    // Fallback jika member() gagal
  }

  const html = `
    <!-- Header Halaman -->
    ${pageHead({
      title: 'Layanan & Pusat Bantuan',
      sub: 'Hubungkan notifikasi Telegram bot resmi, direktori bantuan cepat, dan panduan kendala hunian.',
      acts: `
        <span class="ro-badge">${ms('support_agent')}Pusat Layanan Penghuni</span>
        <button class="btn s" data-go="anggota-kamar">${ms('meeting_room')}Kamar Saya</button>
      `,
    })}

    <!-- Statistik Ringkasan Layanan -->
    <div class="grid g4" style="margin-bottom:20px">
      ${statCard(
        'STATUS TELEGRAM',
        isLinked ? 'Terhubung' : 'Belum Konek',
        isLinked
          ? '<span style="color:var(--primary);font-weight:600">✓ Notifikasi bot aktif</span>'
          : '<span style="color:var(--warn)">Buat kode tautan di bawah</span>',
        'send'
      )}

      ${statCard(
        'LAYANAN KENDALA',
        '24 Jam',
        `<span style="color:var(--text)">Dukungan operasional</span>`,
        'handyman'
      )}

      ${statCard(
        'KONSULTASI SEWA',
        'Bendahara',
        `<span style="color:var(--primary)">Administrasi pembayaran</span>`,
        'support_agent'
      )}

      ${statCard(
        'TATA TERTIB',
        'Standar Kos',
        `<span style="color:var(--text)">Keamanan & jam malam</span>`,
        'menu_book'
      )}
    </div>

    <!-- Layout Grid 2 Kolom -->
    <div class="grid g21" style="align-items:start">
      <!-- Kolom Kiri: Integrasi Bot Telegram & Form Generator -->
      <div style="display:grid;gap:16px;min-width:0">
        <!-- Card Generator Token Telegram -->
        <div class="card">
          <div class="ctr" style="margin-bottom:12px">
            <h3 style="font-size:16px;display:flex;gap:8px;align-items:center">
              ${ms('send')}Integrasi Bot Telegram KosLedger
            </h3>
            ${isLinked ? pill('Sudah Terhubung', 'ok dot') : pill('Belum Terhubung', 'warn dot')}
          </div>

          <p style="font-size:13px;color:var(--muted);line-height:1.5;margin:0 0 16px">
            Hubungkan akun Telegram Anda untuk menerima notifikasi instan saat tagihan bulanan diterbitkan dan pengingat otomatis sebelum batas jatuh tempo agar bebas denda.
          </p>

          ${isLinked ? `
            <div class="note" style="padding:16px;background:var(--c2);border:1px solid var(--primary);margin-bottom:16px">
              <div style="display:flex;gap:12px;align-items:center">
                <span class="ic" style="width:40px;height:40px;border-radius:12px;background:#fff;display:grid;place-items:center;color:var(--primary)">
                  ${ms('verified')}
                </span>
                <div>
                  <b style="font-size:14px;color:var(--primary-d)">Akun Telegram Anda Telah Aktif</b>
                  <p style="margin:2px 0 0;font-size:12px;color:var(--muted)">
                    Notifikasi tagihan dan kuitansi pembayaran dikirimkan langsung ke chat Telegram Anda.
                  </p>
                </div>
              </div>
            </div>
          ` : `
            <div class="note" style="display:block;padding:14px;background:var(--c1);margin-bottom:16px;font-size:12px">
              <b>Cara Menghubungkan:</b>
              <ol style="margin:6px 0 0;padding-left:18px;line-height:1.6">
                <li>Klik tombol <b>Buat Kode Tautan Baru</b> di bawah ini.</li>
                <li>Salin kode perintah yang dihasilkan (berlaku 15 menit).</li>
                <li>Buka bot Telegram resmi KosLedger dan kirimkan perintah tersebut.</li>
              </ol>
            </div>
          `}

          <div style="display:flex;gap:10px;flex-wrap:wrap">
            <button class="btn p" id="btn-generate-code" style="padding:12px 20px">
              ${ms('key')}${isLinked ? 'Hubungkan Ulang Akun' : 'Buat Kode Tautan Baru'}
            </button>
            <a href="https://t.me" target="_blank" rel="noopener" class="btn s" style="padding:12px 18px">
              ${ms('open_in_new')}Buka Telegram
            </a>
          </div>

          <div id="link-code-result-area" style="margin-top:16px"></div>
        </div>

        <!-- Panduan Pelaporan Kerusakan / Kendala Kamar -->
        <div class="card">
          <div class="ctr" style="margin-bottom:12px">
            <h3 style="font-size:16px;display:flex;gap:8px;align-items:center">
              ${ms('handyman')}Panduan Lapor Kerusakan Fasilitas
            </h3>
            ${pill('SOP Hunian', '')}
          </div>

          <div style="display:grid;gap:10px;font-size:13px">
            <div class="note" style="padding:12px 14px;background:#fff;border:1px solid var(--line)">
              <b style="color:var(--primary-d)">1. Kendala Sanitasi & Air</b>
              <p style="margin:4px 0 0;font-size:12px;color:var(--muted)">
                Jika terjadi kebocoran keran, kendala toren air, atau saluran mampet, segera laporkan ke penjaga kos agar segera diperbaiki teknisi.
              </p>
            </div>
            <div class="note" style="padding:12px 14px;background:#fff;border:1px solid var(--line)">
              <b style="color:var(--primary-d)">2. Kelistrikan & Lampu</b>
              <p style="margin:4px 0 0;font-size:12px;color:var(--muted)">
                Penggantian lampu utama kamar dan pengecekan sekring MCB ditangani langsung oleh pengelola tanpa biaya tambahan untuk penggunaan wajar.
              </p>
            </div>
            <div class="note" style="padding:12px 14px;background:#fff;border:1px solid var(--line)">
              <b style="color:var(--primary-d)">3. Jaringan Internet & WiFi</b>
              <p style="margin:4px 0 0;font-size:12px;color:var(--muted)">
                Jika koneksi WiFi terputus atau router lantai mengalami kendala, hubungi pengelola untuk restart router fiber optic bersama.
              </p>
            </div>
          </div>
        </div>
      </div>

      <!-- Kolom Kanan: Kontak Darurat & Tata Tertib -->
      <div style="display:grid;gap:16px;min-width:0">
        <!-- Direktori Kontak Penting -->
        <div class="card">
          <div class="ctr" style="margin-bottom:12px">
            <h3 style="font-size:15px;display:flex;gap:8px;align-items:center">
              ${ms('phone_in_talk')}Kontak Darurat & Pengelola
            </h3>
            ${pill('Siaga', 'ok')}
          </div>

          <div style="display:grid;gap:10px;font-size:13px">
            <div class="note" style="justify-content:space-between;align-items:center;padding:12px">
              <div>
                <b>Penjaga Kos (Pak Joko)</b>
                <small style="display:block;color:var(--muted)">Keamanan & Masalah Fasilitas</small>
              </div>
              <span class="chip mono">0812-3456-7890</span>
            </div>

            <div class="note" style="justify-content:space-between;align-items:center;padding:12px">
              <div>
                <b>Bendahara Kos (Ibu Siti)</b>
                <small style="display:block;color:var(--muted)">Administrasi & Pelunasan Sewa</small>
              </div>
              <span class="chip mono">0821-9876-5432</span>
            </div>

            <div class="note" style="justify-content:space-between;align-items:center;padding:12px">
              <div>
                <b>Layanan Gangguan PLN</b>
                <small style="display:block;color:var(--muted)">Darurat Listrik 24 Jam</small>
              </div>
              <span class="chip mono">123</span>
            </div>
          </div>
        </div>

        <!-- Tata Tertib & Jam Malam -->
        <div class="card">
          <div class="ctr" style="margin-bottom:12px">
            <h3 style="font-size:15px;display:flex;gap:8px;align-items:center">
              ${ms('menu_book')}Tata Tertib Hunian
            </h3>
          </div>

          <ul style="margin:0;padding-left:18px;font-size:12px;color:var(--muted);line-height:1.6">
            <li>Pintu gerbang utama dikunci pukul 23:00 WIB demi keamanan bersama.</li>
            <li>Tamu lawan jenis dilarang masuk ke dalam kamar hunian.</li>
            <li>Dilarang merokok di area koridor bersama dan kamar ber-AC.</li>
            <li>Menjaga ketenangan dan tidak menyalakan audio keras di atas jam 22:00 WIB.</li>
          </ul>
        </div>
      </div>
    </div>
  `;

  return {
    html,
    after() {
      // Handler Generate Link Code
      const genBtn = document.getElementById('btn-generate-code');
      genBtn?.addEventListener('click', async () => {
        genBtn.disabled = true;
        genBtn.innerHTML = `<span class="spin" style="width:14px;height:14px;border-width:2px;margin-right:6px"></span>Menghubungi Server...`;

        const resBox = document.getElementById('link-code-result-area');
        try {
          const res = await generateTelegramLinkCode();
          const code = res?.data?.code || '';
          const expiresIn = res?.data?.expires_in_minutes || 15;

          resBox.innerHTML = `
            <div class="note" style="padding:16px;background:var(--c2);border:1px solid var(--primary);display:block">
              <b style="font-size:14px;color:var(--primary-d);display:flex;gap:6px;align-items:center">
                ${ms('check_circle')}Kode Tautan Berhasil Dibuat!
              </b>
              <p style="margin:6px 0 10px;font-size:13px;color:var(--text)">
                Salin teks perintah di bawah ini dan kirimkan ke Bot Telegram KosLedger:
              </p>
              <div style="display:flex;gap:8px;align-items:center;background:#fff;padding:10px 14px;border-radius:10px;border:1px solid var(--line);margin-bottom:10px">
                <code style="font-size:13px;color:var(--primary-d);font-weight:700;flex:1;word-break:break-all">
                  /start ${esc(code)}
                </code>
                <button class="btn sm s" id="btn-copy-code" data-code="/start ${esc(code)}">
                  ${ms('content_copy')}Salin
                </button>
              </div>
              <small style="color:var(--muted);display:flex;gap:6px;align-items:center">
                ${ms('hourglass_bottom')}Kode ini berlaku selama ${expiresIn} menit.
              </small>
            </div>
          `;

          document.getElementById('btn-copy-code')?.addEventListener('click', (e) => {
            const textToCopy = e.target.closest('#btn-copy-code').dataset.code;
            if (navigator.clipboard?.writeText) {
              navigator.clipboard.writeText(textToCopy).then(() => {
                toast('Perintah Telegram berhasil disalin ke clipboard!', 'ok');
              });
            } else {
              toast('Silakan salin teks perintah di atas secara manual.', '');
            }
          });
        } catch (err) {
          toast(apiError(err) || 'Gagal membuat kode tautan Telegram.', 'err');
          resBox.innerHTML = `
            <div class="note" style="padding:12px;background:var(--err-bg);color:var(--err);font-size:13px">
              ${ms('error')} ${esc(apiError(err) || 'Terjadi kesalahan pada server saat membuat kode.')}
            </div>
          `;
        } finally {
          genBtn.disabled = false;
          genBtn.innerHTML = `${ms('key')}Buat Ulang Kode Tautan`;
        }
      });
    },
  };
}
