import { createRoot } from 'react-dom/client';
import './styles/index.css';
import { App } from './app/App';

// Setelah deploy baru, file halaman versi lama sudah tidak ada di server. Tab yang
// masih terbuka gagal memuat halaman lazy, jadi muat ulang sekali untuk ambil versi baru.
const RELOAD_KEY = 'possir.chunk-reload';
window.addEventListener('vite:preloadError', (event) => {
  let last = 0;
  try {
    last = Number(sessionStorage.getItem(RELOAD_KEY) ?? 0);
  } catch {
    // sessionStorage bisa diblokir; tetap coba muat ulang
  }
  if (Date.now() - last < 10_000) return; // sudah dicoba barusan, jangan loop
  event.preventDefault();
  try {
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()));
  } catch {
    // abaikan
  }
  window.location.reload();
});

createRoot(document.getElementById('root')!).render(<App />);
