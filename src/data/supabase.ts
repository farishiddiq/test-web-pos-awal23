import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { ApiError, toApiError, type Backend } from './backend';
import { uuid } from '@/lib/util';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) as string | undefined;

export const isSupabaseConfigured = Boolean(url && key && !url.includes('xxxxxxxx'));

let client: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!isSupabaseConfigured) throw new ApiError('Supabase belum dikonfigurasi. Isi file .env dulu.');
  if (!client) {
    client = createClient(url!, key!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'possir.auth' },
    });
  }
  return client;
}

export function createSupabaseBackend(): Backend {
  const sb = supabase();
  return {
    kind: 'supabase',
    async rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
      const { data, error } = await sb.rpc(fn, args ?? {});
      if (error) throw toApiError(error);
      return data as T;
    },
    async uploadProductImage(businessId: string, image: Blob): Promise<string> {
      const ext = image.type === 'image/jpeg' ? 'jpg' : image.type === 'image/png' ? 'png' : 'webp';
      const path = `${businessId}/${uuid()}.${ext}`;
      const { error } = await sb.storage.from('product-images').upload(path, image, {
        contentType: image.type || 'image/webp',
        cacheControl: '31536000',
        upsert: false,
      });
      if (error) throw toApiError(error);
      return sb.storage.from('product-images').getPublicUrl(path).data.publicUrl;
    },
  };
}
