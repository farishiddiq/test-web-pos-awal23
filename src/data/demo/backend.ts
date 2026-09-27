import { PGliteWorker } from '@electric-sql/pglite/worker';
import shimSql from '../../../supabase/pglite/auth-shim.sql?raw';
import tablesSql from '../../../supabase/migrations/20260926000100_possir_tables.sql?raw';
import apiCoreSql from '../../../supabase/migrations/20260926000200_possir_api.sql?raw';
import cashFlowSql from '../../../supabase/migrations/20260927000100_possir_cashflow.sql?raw';
import auditFixSql from '../../../supabase/migrations/20260928000100_possir_audit_fixes.sql?raw';
import seedSql from '../../../supabase/pglite/demo-seed.sql?raw';
import { ApiError, toApiError, type Backend } from '../backend';
import { DEMO_DB_NAME, DEMO_USER } from './constants';

export type DemoStage = 'engine' | 'seed' | 'ready';

export interface DemoBackend extends Backend {
  reset(): Promise<void>;
}

type Signature = Map<string, Array<{ name: string; type: string }>>;

async function loadSignatures(db: PGliteWorker): Promise<Signature> {
  const { rows } = await db.query<{ name: string; names: string[] | null; types: string[] }>(`
    select p.proname as name, p.proargnames as names, p.proargtypes::regtype[]::text[] as types
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'`);
  const map: Signature = new Map();
  for (const row of rows) {
    map.set(row.name, (row.names ?? []).map((name, i) => ({ name, type: row.types[i] })));
  }
  return map;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

// Sidik jari SQL: kalau skema berubah, demo dibuat ulang; kalau hanya fungsi, fungsinya diperbarui
function fingerprint(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16);
}
const apiSql = [apiCoreSql, cashFlowSql, auditFixSql].join('\n;\n');
const SCHEMA_HASH = fingerprint(shimSql + tablesSql + seedSql);
const API_HASH = fingerprint(apiSql);

function openDb(): Promise<PGliteWorker> {
  return PGliteWorker.create(new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' }), {
    dataDir: `idb://${DEMO_DB_NAME}`,
  });
}

async function readMeta(db: PGliteWorker): Promise<Record<string, string> | null> {
  const { rows } = await db.query<{ ready: boolean }>(`select to_regclass('private.demo_meta') is not null as ready`);
  if (!rows[0]?.ready) return null;
  const meta = await db.query<{ key: string; value: string }>(`select key, value from private.demo_meta`);
  return Object.fromEntries(meta.rows.map((r) => [r.key, r.value]));
}

// Kosongkan database dari dalam Postgres (lebih andal daripada menghapus IndexedDB
// yang bisa tertahan selama worker masih membukanya)
const WIPE_SQL = `
  drop schema if exists private cascade;
  drop schema if exists auth cascade;
  drop schema if exists public cascade;
  create schema public;`;

const FULL_SETUP = () =>
  [
    WIPE_SQL,
    shimSql,
    tablesSql,
    apiSql,
    seedSql,
    `create table private.demo_meta (key text primary key, value text not null);
     insert into private.demo_meta values ('schema', '${SCHEMA_HASH}'), ('api', '${API_HASH}');`,
  ].join('\n;\n');

export async function createDemoBackend(onStage: (stage: DemoStage) => void): Promise<DemoBackend> {
  onStage('engine');
  const db = await openDb();
  const meta = await readMeta(db);

  if (!meta || meta.schema !== SCHEMA_HASH) {
    // demo baru, atau skema berubah sejak demo dibuat: bangun ulang dalam satu transaksi
    onStage('seed');
    await db.exec(FULL_SETUP());
  } else if (meta.api !== API_HASH) {
    await db.exec(`${apiSql}\n;\nupdate private.demo_meta set value = '${API_HASH}' where key = 'api';`);
  }
  await db.exec(`set request.jwt.claim.sub = '${DEMO_USER.id}'`);
  const signatures = await loadSignatures(db);
  onStage('ready');

  return {
    kind: 'demo',
    async rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
      const params = signatures.get(fn);
      if (!params) throw new ApiError(`Fungsi ${fn} tidak dikenal.`);
      const values: unknown[] = [];
      const named: string[] = [];
      for (const [key, value] of Object.entries(args)) {
        if (value === undefined) continue;
        const param = params.find((p) => p.name === key);
        if (!param) throw new ApiError(`Argumen ${key} tidak dikenal untuk ${fn}.`);
        values.push(value !== null && typeof value === 'object' ? JSON.stringify(value) : value);
        named.push(`${key} => $${values.length}::${param.type}`);
      }
      try {
        const res = await db.query<{ r: T }>(`select public.${fn}(${named.join(', ')}) as r`, values);
        return res.rows[0].r;
      } catch (error) {
        throw toApiError(error);
      }
    },
    async uploadProductImage(_businessId: string, image: Blob): Promise<string> {
      return blobToDataUrl(image);
    },
    async reset(): Promise<void> {
      await db.exec(FULL_SETUP());
      await db.exec(`set request.jwt.claim.sub = '${DEMO_USER.id}'`);
    },
  };
}
