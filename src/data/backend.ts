// Satu antarmuka untuk dua sumber data:
//  - Supabase (produksi): supabase.rpc(...)
//  - Demo: PGlite di browser menjalankan SQL migrasi yang SAMA
export type RpcArgs = Record<string, unknown>;

export interface Backend {
  kind: 'supabase' | 'demo';
  rpc<T>(fn: string, args?: RpcArgs): Promise<T>;
  uploadProductImage(businessId: string, image: Blob): Promise<string>;
}

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

const NETWORK_HINTS = ['Failed to fetch', 'NetworkError', 'Load failed', 'fetch failed', 'Network request failed'];

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const raw = error as { message?: string; code?: string } | undefined;
  const message = raw?.message ?? String(error);
  if (NETWORK_HINTS.some((hint) => message.includes(hint))) {
    return new ApiError('Tidak ada koneksi internet. Cek sinyal lalu coba lagi. Data di layar tidak hilang.', 'NETWORK');
  }
  // Pesan dari fungsi SQL kita sudah berbahasa Indonesia; pesan teknis lain disederhanakan
  const friendly = raw?.code && /^(PT\d{3}|22023)$/.test(raw.code) ? message : humanize(message);
  return new ApiError(friendly, raw?.code);
}

function humanize(message: string): string {
  if (/JWT|jwt|token/i.test(message)) return 'Sesi kamu sudah habis. Silakan masuk lagi.';
  if (/permission denied|row-level security/i.test(message)) return 'Kamu tidak punya akses untuk tindakan ini.';
  return message || 'Terjadi kesalahan. Coba lagi.';
}

let current: Backend | null = null;

export function setBackend(next: Backend | null): void {
  current = next;
}

export function backend(): Backend {
  if (!current) throw new ApiError('Aplikasi belum siap. Muat ulang halaman.');
  return current;
}

export function hasBackend(): boolean {
  return current !== null;
}
