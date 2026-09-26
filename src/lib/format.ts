// Format angka gaya Indonesia (titik ribuan, koma desimal), mata uang EGP.
const intFmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 0 });
const decFmt = new Intl.NumberFormat('id-ID', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const qtyFmt = new Intl.NumberFormat('id-ID', { maximumFractionDigits: 3 });
const compactFmt = new Intl.NumberFormat('id-ID', { notation: 'compact', maximumFractionDigits: 1 });
const pctFmt = new Intl.NumberFormat('id-ID', { style: 'percent', maximumFractionDigits: 0 });

export const CURRENCY = 'EGP';

export function toNumber(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

/** "1.250" atau "12,50" (desimal hanya kalau ada piaster) */
export function formatAmount(value: number | null | undefined): string {
  const n = Math.abs(toNumber(value));
  const rounded = Math.round(n * 100) / 100;
  return Number.isInteger(rounded) ? intFmt.format(rounded) : decFmt.format(rounded);
}

/** "EGP 1.250", negatif jadi "-EGP 1.250" */
export function formatMoney(value: number | null | undefined, opts: { sign?: boolean } = {}): string {
  const n = toNumber(value);
  const prefix = n < 0 ? '-' : opts.sign && n > 0 ? '+' : '';
  return `${prefix}${CURRENCY} ${formatAmount(n)}`;
}

export function formatQty(value: number | null | undefined): string {
  return qtyFmt.format(toNumber(value));
}

export function formatCompact(value: number): string {
  return compactFmt.format(value);
}

export function formatPercent(ratio: number): string {
  return pctFmt.format(ratio);
}

export function formatCount(value: number): string {
  return intFmt.format(value);
}

/**
 * Baca input uang dari keyboard HP. Terima "1250", "1.250", "12,5", "12.50".
 * Satu pemisah + tepat 3 digit di belakangnya dianggap pemisah ribuan.
 */
export function parseAmount(input: string): number | null {
  const raw = input.replace(/\s|EGP|egp|LE/g, '');
  if (!raw) return null;
  if (!/^[0-9.,]+$/.test(raw)) return null;
  const seps = raw.match(/[.,]/g) ?? [];
  let normalized: string;
  if (seps.length === 0) {
    normalized = raw;
  } else {
    const last = Math.max(raw.lastIndexOf('.'), raw.lastIndexOf(','));
    const tail = raw.slice(last + 1);
    const head = raw.slice(0, last).replace(/[.,]/g, '');
    const sameSepEverywhere = new Set(seps).size === 1;
    if (tail.length === 3 && (seps.length > 1 ? sameSepEverywhere : true)) {
      normalized = head + tail;
    } else if (tail.length <= 2) {
      normalized = `${head}.${tail}`;
    } else {
      return null;
    }
  }
  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * 100) / 100;
}

export function parseQty(input: string): number | null {
  const raw = input.trim().replace(',', '.');
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * 1000) / 1000;
}

/** Ubah angka ke teks untuk diisi ulang ke input */
export function amountToInput(value: number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const n = toNumber(value);
  return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
}

export function initials(name: string): string {
  const words = name
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function pluralItems(n: number): string {
  return `${formatQty(n)} item`;
}
