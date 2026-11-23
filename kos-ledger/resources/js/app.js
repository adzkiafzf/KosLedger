// import './bootstrap';

// const ms = (n) => `<span class="ms">${n}</span>`;

// document.getElementById('app').innerHTML = `
//   <div style="padding:40px;max-width:420px">
//     <div class="logo">
//       <span class="lg">${ms('apartment')}</span>
//       <b>KosLedger</b>
//     </div>
//     <div class="card stat" style="margin-top:24px">
//       <span class="l">Status Frontend</span>
//       <span class="v">Siap 🎉</span>
//       <span class="f">Vite + Tailwind + CSS desain termuat</span>
//       <span class="ic">${ms('task_alt')}</span>
//     </div>
//   </div>
// `;

import './bootstrap';
import { startRouter } from './core/router.js';

startRouter();
