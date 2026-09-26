// Gabungkan migrasi jadi satu file untuk ditempel di Supabase SQL Editor.
// Jalankan: npm run sql:bundle
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dir = join(root, 'supabase', 'migrations');
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();

const header = `-- =====================================================================
-- POSSIR: seluruh skema Supabase dalam satu file (dibuat otomatis).
-- Sumber: supabase/migrations/*.sql. Jangan edit file ini langsung;
-- edit file migrasinya lalu jalankan: npm run sql:bundle
--
-- Cara pakai: Supabase Dashboard > SQL Editor > New query > tempel > Run.
-- Jalankan sekali di project baru.
-- =====================================================================
`;

const body = files
  .map((f) => `\n-- ---------------------------------------------------------------------\n-- ${f}\n-- ---------------------------------------------------------------------\n${readFileSync(join(dir, f), 'utf8').trim()}\n`)
  .join('\n');

writeFileSync(join(root, 'supabase', 'possir.sql'), header + body);
console.log(`supabase/possir.sql dibuat dari ${files.length} file migrasi`);
