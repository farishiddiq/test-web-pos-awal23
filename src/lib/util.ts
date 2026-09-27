export function cn(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** crypto.randomUUID hanya ada di konteks aman (https/localhost); saat dites lewat IP LAN pakai cadangan. */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    try {
      return crypto.randomUUID();
    } catch {
      // lanjut ke cadangan
    }
  }
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

// localStorage bisa melempar (mode privat, penyimpanan penuh); jangan sampai app ikut crash
export const storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? fallback : (JSON.parse(raw) as T);
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // abaikan
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      // abaikan
    }
  },
};

export function sum<T>(items: T[], pick: (item: T) => number): number {
  return items.reduce((total, item) => total + pick(item), 0);
}

/**
 * Bulatkan ke 2 desimal persis seperti Postgres round(x, 2): setengah menjauhi nol.
 * Math.round(6.175 * 100) memberi 617 karena 6.175 * 100 = 617.4999…; toPrecision
 * membuang sisa galat biner itu dulu, jadi keranjang = struk yang tersimpan.
 */
export function roundMoney(n: number): number {
  if (!Number.isFinite(n)) return 0;
  const scaled = Number((Math.abs(n) * 100).toPrecision(15));
  return (Math.sign(n) * Math.round(scaled)) / 100 || 0;
}

/** Warna tile produk tanpa foto: stabil dari nama */
export const TILE_COLORS = ['lime', 'mint', 'sky', 'sand', 'peach', 'rose', 'stone'] as const;
export type TileColor = (typeof TILE_COLORS)[number];

export function colorFor(name: string, preferred?: string | null): TileColor {
  if (preferred && (TILE_COLORS as readonly string[]).includes(preferred)) return preferred as TileColor;
  let hash = 0;
  for (const ch of name) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TILE_COLORS[hash % TILE_COLORS.length];
}

export function normalizeSearch(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
}
