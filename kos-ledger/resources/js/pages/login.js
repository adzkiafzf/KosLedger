import { login } from '../api/auth.js';
import { apiError, fieldErrors } from '../api/client.js';
import { HOME } from '../core/roles.js';
import { go } from '../core/router.js';
import { setSession } from '../core/session.js';
import { fieldHtml, passwordField, bindPasswordToggles, validate, setFieldError } from '../components/form.js';
import { ms, toast } from '../components/ui.js';
import { esc } from '../utils/format.js';

const brand = `
  <aside class="brand">
    <div class="logo"><span class="lg" style="background:#b7eed5;color:#003526">${ms('apartment')}</span><b style="color:#fff">KosLedger</b></div>
    <div>
      <h2>Keuangan kos yang rapi, terbuka, dan bisa dibuktikan.</h2>
      <p>Tagihan, pembayaran, dan laporan kas dalam satu tempat. Bukti pembayaran dicatat di blockchain supaya tidak bisa diubah-ubah.</p>
      <ul>${[
        ['receipt_long', 'Tagihan otomatis dan pengingat tepat waktu'],
        ['qr_code_2', 'Bayar lewat QRIS, VA, atau transfer'],
        ['verified_user', 'Bukti pembayaran tercatat di Sepolia'],
      ].map(([ic, t]) => `<li>${ms(ic)}<span>${t}</span></li>`).join('')}</ul>
    </div>
    <small>KosLedger • Midtrans Sandbox</small>
  </aside>`;

const banner = (msg) => `<div class="note err2">${ms('error')}<span>${esc(msg)}</span></div>`;

function setLoading(btn, on) {
  btn.disabled = on;
  btn.innerHTML = on ? '<span class="spin"></span>Memeriksa…' : 'Masuk';
}

async function onSubmit(e) {
  e.preventDefault();
  const bn = document.getElementById('lbanner');
  bn.innerHTML = '';
  if (!validate({ l_username: 1, l_pw: 1 })) return;

  const username = document.getElementById('l_username').value.trim();
  const password = document.getElementById('l_pw').value;
  const remember = document.getElementById('l_rem').checked;
  const btn = document.getElementById('lbtn');

  setLoading(btn, true);
  try {
    const { user, token } = await login(username, password);
    if (!HOME[user.role]) {
      const e = new Error('Role akun ini belum didukung di aplikasi.');
      e.local = true;
      throw e;
    }
    setSession(user, token, remember);
    toast(`Selamat datang, ${user.nickname || user.name}.`, 'ok');
    go(HOME[user.role]);
  } catch (err) {
    // Kesalahan per kolom dari server (422), lalu pesan umum di atas form
    const fe = fieldErrors(err);
    if (fe.username) setFieldError('l_username', fe.username[0]);
    if (fe.password) setFieldError('l_pw', fe.password[0]);
    bn.innerHTML = banner(err.local ? err.message : apiError(err));
    toast('Gagal masuk.', 'err');
    setLoading(btn, false);
  }
}

export default function loginPage() {
  return {
    html: `
      <div class="auth">
        ${brand}
        <main class="authm">
          <div class="authc">
            <h1>Masuk ke KosLedger</h1>
            <p class="sub">Masuk dengan username dan kata sandi akunmu.</p>
            <div style="height:20px"></div>
            <div id="lbanner"></div>
            <form id="lf" novalidate>
              ${fieldHtml('l_username', 'Username', { req: 1, ph: 'Masukkan username', auto: 'username' })}
              ${passwordField('l_pw', 'Kata sandi', { ph: 'Masukkan kata sandi' })}
              <div class="ctr" style="font-size:13px;margin:4px 0 18px">
                <label style="display:flex;gap:8px;align-items:center">
                  <input type="checkbox" id="l_rem" checked style="accent-color:var(--primary)">Ingat saya
                </label>
              </div>
              <button class="btn p" id="lbtn" type="submit" style="width:100%;padding:14px;font-size:14px">Masuk</button>
            </form>
            <p style="text-align:center;font-size:13px;color:var(--muted);margin:22px 0 0">
              Belum punya akun? Hubungi Admin kos untuk dibuatkan akun.
            </p>
          </div>
        </main>
      </div>`,
    after() {
      document.getElementById('lf').addEventListener('submit', onSubmit);
      bindPasswordToggles();
      document.getElementById('l_username').focus();
    },
  };
}
