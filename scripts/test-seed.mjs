// Cek data demo: konsisten, realistis, dan cukup cepat untuk dibuat di browser.
// Jalankan: npm run test:seed
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
const db = new PGlite();

const t0 = performance.now();
await db.exec(read('supabase/pglite/auth-shim.sql'));
await db.exec(read('supabase/migrations/20260926000100_possir_tables.sql'));
await db.exec(read('supabase/migrations/20260926000200_possir_api.sql'));
const t1 = performance.now();
await db.exec(read('supabase/pglite/demo-seed.sql'));
const t2 = performance.now();
console.log(`migrasi ${Math.round(t1 - t0)} ms, seed ${Math.round(t2 - t1)} ms`);

const one = async (sql, params) => (await db.query(sql, params)).rows;
let failed = 0;
const check = (cond, label, detail) => {
  if (!cond) failed++;
  console.log(`${cond ? 'ok  ' : 'GAGAL'} ${label}${detail !== undefined ? `: ${JSON.stringify(detail)}` : ''}`);
};

const [biz] = await one(`select id from public.businesses`);
const B = biz.id;
const rpc = async (fn, args) => (await db.query(`select public.${fn}(${args}) as r`, [B])).rows[0].r;

const sales = await one(`select status, count(*)::int n, sum(total)::float total from public.sales group by status order by status`);
console.log('penjualan', sales);

const sold = await one(`
  select p.name, p.stock::float stock, p.min_stock::float min,
         coalesce((select sum(-m.qty_change) from public.stock_movements m where m.product_id = p.id and m.type = 'sale'), 0)::float sold,
         coalesce((select sum(m.qty_change) from public.stock_movements m where m.product_id = p.id and m.type = 'initial'), 0)::float initial,
         coalesce((select sum(m.qty_change) from public.stock_movements m where m.product_id = p.id and m.type = 'adjustment'), 0)::float adjust,
         (select min(m.qty_after) from public.stock_movements m where m.product_id = p.id)::float lowest
  from public.products p where p.track_stock order by p.name`);
console.table(sold);
check(sold.every((r) => r.lowest >= 0), 'riwayat stok tidak pernah minus');
check(sold.every((r) => Math.abs(r.adjust) <= 12), 'opname kecil (realistis)', sold.map((r) => r.adjust));
const lastQty = await one(`
  select p.name, p.stock::float stock,
    (select m.qty_after from public.stock_movements m where m.product_id = p.id order by m.created_at desc, m.id desc limit 1)::float last_after
  from public.products p where p.track_stock`);
check(lastQty.every((r) => r.stock === r.last_after), 'stok produk = qty_after mutasi terakhir');

const bal = await one(`select c.name, (coalesce((select sum(d.amount) from public.customer_debts d where d.customer_id = c.id and d.voided_at is null),0)
  - coalesce((select sum(p.amount) from public.debt_payments p where p.customer_id = c.id and p.voided_at is null),0))::float as balance
  from public.customers c order by balance desc`);
console.table(bal);
check(bal.every((r) => r.balance >= 0), 'saldo pelanggan tidak minus');

const dash = await rpc('get_dashboard', 'p_business_id => $1::uuid');
console.log('dashboard hari ini', dash.today, 'piutang', dash.receivables, 'stok menipis', dash.low_stock.count);
check(dash.low_stock.count === 3, 'tiga produk stok menipis', dash.low_stock.items.map((i) => i.name));

const [{ from, to }] = await one(`select date_trunc('month', (now() at time zone 'Africa/Cairo'))::date::text as from, (now() at time zone 'Africa/Cairo')::date::text as to`);
const report = await (async () => (await db.query(`select public.get_report(p_business_id => $1::uuid, p_from => $2::date, p_to => $3::date) as r`, [B, from, to])).rows[0].r)();
console.log('laporan bulan ini', report.summary);
check(report.summary.net_profit > 0, 'laba bersih bulan ini positif');
console.log('metode', report.by_method.map((m) => `${m.name}: ${m.total}`).join(', '));
console.log('terlaris', report.top_products.slice(0, 5).map((p) => `${p.name} ${p.qty}`).join(', '));
console.log('pengeluaran', report.expenses_by_category.map((e) => `${e.category} ${e.amount}`).join(', '));

await db.close();
process.exit(failed ? 1 : 0);
