// Membuat ikon PNG aplikasi (PWA) dari tanda Possir tanpa dependensi.
// Jalankan: npm run icons
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'icons');
mkdirSync(out, { recursive: true });

const LIME = [0xd4, 0xf2, 0x6b];
const INK = [0x15, 0x20, 0x1b];

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

function png(size, pixel) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x, y);
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = r;
      raw[i + 1] = g;
      raw[i + 2] = b;
      raw[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// Bentuk dalam ruang 32x32, sama dengan favicon.svg
const insideRoundRect = (x, y, r) => {
  const cx = Math.min(Math.max(x, r), 32 - r);
  const cy = Math.min(Math.max(y, r), 32 - r);
  return x >= 0 && y >= 0 && x <= 32 && y <= 32 && (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
};
const onStem = (x, y) => {
  const cy = Math.min(Math.max(y, 10), 24.5);
  return (x - 12) ** 2 + (y - cy) ** 2 <= 1.7 ** 2;
};
const onRing = (x, y) => Math.abs(Math.hypot(x - 17, y - 14.6) - 4.9) <= 1.7;

function render(size, { maskable = false } = {}) {
  const S = 4; // supersampling per sumbu
  return png(size, (px, py) => {
    let lime = 0;
    let ink = 0;
    for (let sy = 0; sy < S; sy++) {
      for (let sx = 0; sx < S; sx++) {
        let x = ((px + (sx + 0.5) / S) / size) * 32;
        let y = ((py + (sy + 0.5) / S) / size) * 32;
        if (maskable) {
          // latar penuh; tanda diperkecil ke zona aman 70%
          x = (x - 16) / 0.7 + 16;
          y = (y - 16) / 0.7 + 16;
          if (onStem(x, y) || onRing(x, y)) ink++;
          else lime++;
          continue;
        }
        if (!insideRoundRect(x, y, 10)) continue;
        if (onStem(x, y) || onRing(x, y)) ink++;
        else lime++;
      }
    }
    const total = S * S;
    const covered = lime + ink;
    if (covered === 0) return [0, 0, 0, 0];
    const mix = (i) => Math.round((LIME[i] * lime + INK[i] * ink) / covered);
    return [mix(0), mix(1), mix(2), Math.round((covered / total) * 255)];
  });
}

writeFileSync(join(out, 'icon-192.png'), render(192));
writeFileSync(join(out, 'icon-512.png'), render(512));
writeFileSync(join(out, 'icon-maskable-512.png'), render(512, { maskable: true }));
writeFileSync(join(out, 'apple-touch-icon.png'), render(180, { maskable: true }));
console.log('Ikon dibuat di public/icons');
