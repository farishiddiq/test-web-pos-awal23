// Ambil screenshot asli dari mode demo untuk landing page.
// Jalankan dev server dulu (npm run dev), lalu: npm run screenshots
// Memakai Chrome/Edge yang sudah terpasang lewat Chrome DevTools Protocol, tanpa dependensi tambahan.
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'public', 'screens');
const BASE = process.env.BASE_URL ?? 'http://localhost:5173';
const PORT = 9333;

const browsers = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter(Boolean);
const exe = browsers.find((p) => existsSync(p));
if (!exe) throw new Error('Chrome/Edge tidak ditemukan. Isi CHROME_PATH.');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const profile = mkdtempSync(join(tmpdir(), 'possir-shots-'));
const chrome = spawn(exe, [
  '--headless=new',
  `--remote-debugging-port=${PORT}`,
  `--user-data-dir=${profile}`,
  '--no-first-run',
  '--hide-scrollbars',
  '--force-color-profile=srgb',
  'about:blank',
], { stdio: 'ignore' });

async function target() {
  for (let i = 0; i < 50; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {
      // belum siap
    }
    await sleep(200);
  }
  throw new Error('Browser tidak merespons');
}

const ws = new WebSocket(await target());
await new Promise((r) => ws.addEventListener('open', r, { once: true }));
let id = 0;
const pending = new Map();
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data);
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id);
    pending.delete(msg.id);
    msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
  }
});
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const n = ++id;
    pending.set(n, { resolve, reject });
    ws.send(JSON.stringify({ id: n, method, params }));
  });
const evaluate = async (expression) => {
  const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluate gagal');
  return r.result.value;
};
const waitFor = async (expression, label, timeout = 90_000) => {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    if (await evaluate(`Boolean(${expression})`).catch(() => false)) return;
    await sleep(250);
  }
  throw new Error(`Menunggu terlalu lama: ${label}`);
};
const clickText = (text) =>
  evaluate(`(() => {
    const el = [...document.querySelectorAll('button, a')].find((b) => b.textContent.trim().startsWith(${JSON.stringify(text)}));
    if (!el) return false; el.click(); return true;
  })()`);

const HIDE_CSS = `[data-demo-ui], [data-sonner-toaster] { display: none !important; } *, *::before, *::after { transition: none !important; animation: none !important; caret-color: transparent !important; }`;

async function viewport(width, height, mobile) {
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 2, mobile });
  await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
}

async function go(path, ready) {
  await evaluate(`window.history.pushState({}, '', ${JSON.stringify(path)}); window.dispatchEvent(new PopStateEvent('popstate')); true`);
  await waitFor(ready, path);
  await waitFor(`!document.querySelector('.skeleton')`, `${path} selesai memuat`);
  await evaluate(`window.scrollTo(0, 0); document.querySelectorAll('main, [data-scroll]').forEach((e) => e.scrollTo?.(0, 0)); true`);
  await sleep(700);
}

async function shot(name) {
  const { data } = await send('Page.captureScreenshot', { format: 'webp', quality: 82 });
  writeFileSync(join(outDir, `${name}.webp`), Buffer.from(data, 'base64'));
  console.log(`  ${name}.webp`);
}

try {
  mkdirSync(outDir, { recursive: true });
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }, { name: 'prefers-reduced-motion', value: 'reduce' }] });
  await viewport(1440, 900, false);
  await send('Page.navigate', { url: `${BASE}/masuk` });
  await waitFor(`[...document.querySelectorAll('button')].some((b) => b.textContent.includes('demo'))`, 'halaman masuk');
  await evaluate(`localStorage.setItem('possir.theme', 'light'); true`);
  if (!(await clickText('Lihat demo'))) throw new Error('Tombol demo tidak ada');
  console.log('Menyiapkan demo (bisa 10-30 detik)…');
  await waitFor(`location.pathname === '/' && document.body.innerText.includes('Penjualan hari ini')`, 'dashboard demo', 180_000);
  await evaluate(`(() => { const s = document.createElement('style'); s.textContent = ${JSON.stringify(HIDE_CSS)}; document.head.appendChild(s); return true; })()`);

  console.log('Desktop');
  await go('/', `document.body.innerText.includes('Arus kas hari ini')`);
  await shot('dashboard-desktop');
  await go('/laporan', `document.body.innerText.includes('Laba bersih')`);
  await clickText('Bulanan');
  // tunggu data bulanan benar-benar masuk (grafik harian lama tetap tampil selama memuat)
  await waitFor(`document.querySelectorAll('table tr').length > 20`, 'laporan bulanan');
  await sleep(900);
  await evaluate(`document.activeElement?.blur(); document.dispatchEvent(new PointerEvent('pointerdown')); true`);
  await shot('laporan-desktop');
  await go('/kasir', `document.querySelectorAll('main button').length > 10`);
  for (const name of ['Indomie Goreng Original', 'Indomie Goreng Original', 'Indomie Goreng Original', 'Kecap Manis Bango', 'Beng-Beng', 'Kerupuk Udang Finna']) {
    await evaluate(`(() => { const b = [...document.querySelectorAll('main button')].find((x) => x.textContent.includes(${JSON.stringify(name)})); b?.click(); return Boolean(b); })()`);
    await sleep(150);
  }
  await sleep(500);
  await shot('kasir-desktop');

  console.log('HP');
  await viewport(390, 844, true);
  await go('/', `document.body.innerText.includes('Penjualan hari ini')`);
  await shot('dashboard-mobile');
  await go('/piutang', `document.body.innerText.includes('Hasan')`);
  await shot('piutang-mobile');
  await go('/produk', `document.body.innerText.includes('Stok')`);
  await shot('produk-mobile');
  await go('/kasir', `document.querySelectorAll('main button').length > 10`);
  await shot('kasir-mobile');
  console.log(`Selesai: ${outDir}`);
} finally {
  ws.close();
  chrome.kill();
}
