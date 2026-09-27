// Audit konsistensi angka: satu data, satu angka, di semua halaman.
// Membandingkan dashboard, laporan, arus kas, riwayat transaksi, pengeluaran, piutang,
// supplier, dan stok untuk periode yang sama, lalu menjalankan skenario ubah data.
// Jalankan: npm run test:audit
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

let passed = 0;
let failed = 0;
const near = (a, b) => Math.abs(Number(a) - Number(b)) < 0.005;
const eq = (actual, expected, label) => {
  const ok = typeof expected === 'number' || typeof actual === 'number' ? near(actual, expected) : JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed++;
  else {
    failed++;
    console.error(`  GAGAL ${label}\n    dapat:   ${JSON.stringify(actual)}\n    harapan: ${JSON.stringify(expected)}`);
  }
};
const sum = (arr, f) => arr.reduce((t, x) => t + Number(f(x) ?? 0), 0);

const db = new PGlite();
await db.exec(read('supabase/pglite/auth-shim.sql'));
await db.exec(read('supabase/migrations/20260926000100_possir_tables.sql'));
await db.exec(read('supabase/migrations/20260926000200_possir_api.sql'));
for (const f of ['20260927000100_possir_cashflow.sql', '20260928000100_possir_audit_fixes.sql']) {
  try {
    await db.exec(read(`supabase/migrations/${f}`));
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}
const t0 = performance.now();
await db.exec(read('supabase/pglite/demo-seed.sql'));
console.log(`Data demo siap dalam ${Math.round(performance.now() - t0)} ms`);

const sig = new Map();
for (const row of (await db.query(`
  select p.proname as name, p.proargnames as names, p.proargtypes::regtype[]::text[] as types
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`)).rows) {
  sig.set(row.name, (row.names ?? []).map((n, i) => ({ name: n, type: row.types[i] })));
}
const as = (uid) => db.exec(`set request.jwt.claim.sub = '${uid ?? ''}'`);
const rpc = async (fn, args = {}) => {
  const params = sig.get(fn);
  const values = [];
  const parts = [];
  for (const [key, value] of Object.entries(args)) {
    const p = params.find((x) => x.name === key);
    if (!p) throw new Error(`${fn}: argumen ${key} tidak dikenal`);
    values.push(value !== null && typeof value === 'object' ? JSON.stringify(value) : value);
    parts.push(`${key} => $${values.length}::${p.type}`);
  }
  return (await db.query(`select public.${fn}(${parts.join(', ')}) as r`, values)).rows[0].r;
};
const rpcError = async (fn, args) => {
  try {
    await rpc(fn, args);
    return null;
  } catch (e) {
    return { code: e.code, message: e.message };
  }
};

const OWNER = '00000000-0000-4000-8000-000000000d01';
await as(OWNER);
const B = (await db.query(`select id from public.businesses limit 1`)).rows[0].id;
const today = (await db.query(`select (now() at time zone 'Africa/Cairo')::date::text as d`)).rows[0].d;
const addDays = (d, n) => new Date(Date.parse(`${d}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);
const monthStart = `${today.slice(0, 7)}-01`;

// FIFO yang sama persis dengan halaman pelanggan (customer-page.tsx)
function settleFifo(entries) {
  const active = entries.filter((e) => !e.voided_at);
  let paid = sum(active.filter((e) => e.kind === 'payment'), (e) => e.amount);
  const remaining = [];
  for (const d of active.filter((e) => e.kind === 'debt').sort((a, b) => (a.created_at < b.created_at ? -1 : 1))) {
    const covered = Math.min(Number(d.amount), paid);
    paid -= covered;
    remaining.push(Math.round((d.amount - covered) * 100) / 100);
  }
  return remaining;
}

// Pendapatan bersih per baris: diskon transaksi dibagi rata sesuai porsi baris
async function netLineRevenue(from, to) {
  const { rows } = await db.query(`
    select coalesce(sum(i.line_total - case when sa.subtotal > 0 then sa.discount * i.line_total / sa.subtotal else 0 end), 0)::float as revenue,
           coalesce(sum(i.line_cost), 0)::float as cogs
    from public.sale_items i join public.sales sa on sa.id = i.sale_id
    where sa.business_id = $1 and sa.status = 'completed'
      and sa.created_at >= private.day_start($2::date, 'Africa/Cairo') and sa.created_at < private.day_start($3::date + 1, 'Africa/Cairo')`,
    [B, from, to]);
  return rows[0];
}

async function auditPeriod(label, from, to) {
  const R = await rpc('get_report', { p_business_id: B, p_from: from, p_to: to });
  const C = await rpc('get_cash_flow', { p_business_id: B, p_from: from, p_to: to });
  const S = await rpc('list_sales', { p_business_id: B, p_from: from, p_to: to, p_limit: 500 });
  const E = await rpc('list_expenses', { p_business_id: B, p_from: from, p_to: to });
  const P = (await rpc('list_purchases', { p_business_id: B, p_from: from, p_to: to })) ?? [];
  const s = R.summary;
  const done = S.items.filter((x) => x.status === 'completed');

  // riwayat transaksi = laporan
  eq(S.total_count <= 500, true, `${label}: semua transaksi terbaca`);
  eq(sum(done, (x) => x.total), s.revenue, `${label}: total riwayat transaksi = omzet laporan`);
  eq(done.length, s.transactions, `${label}: jumlah transaksi riwayat = laporan`);
  eq(S.items.filter((x) => x.status === 'void').length, s.voids, `${label}: jumlah void riwayat = laporan`);
  if (S.summary) {
    eq(S.summary.revenue, s.revenue, `${label}: ringkasan riwayat (server) = omzet laporan`);
    eq(S.summary.transactions, s.transactions, `${label}: ringkasan jumlah (server) = laporan`);
  }
  eq(sum(done, (x) => x.discount), s.discount, `${label}: total diskon`);

  // rumus laporan
  eq(s.gross_sales - s.discount, s.revenue, `${label}: omzet = penjualan kotor - diskon`);
  eq(s.revenue - s.cogs, s.gross_profit, `${label}: laba kotor = omzet - modal`);
  eq(s.gross_profit - s.expenses, s.net_profit, `${label}: laba bersih = laba kotor - pengeluaran`);
  eq(s.transactions ? Math.round((s.revenue / s.transactions) * 100) / 100 : 0, s.avg_ticket, `${label}: rata-rata transaksi`);
  eq(sum(R.series, (d) => d.revenue), s.revenue, `${label}: grafik harian = omzet`);
  eq(sum(R.series, (d) => d.transactions), s.transactions, `${label}: grafik harian = jumlah transaksi`);
  eq(sum(R.series, (d) => d.gross_profit), s.gross_profit, `${label}: grafik laba kotor harian = laba kotor`);
  eq(sum(R.series, (d) => d.expenses), s.expenses, `${label}: grafik pengeluaran harian = pengeluaran`);
  eq(sum(R.by_hour, (h) => h.revenue), s.revenue, `${label}: jam ramai = omzet`);
  eq(sum(R.by_hour, (h) => h.transactions), s.transactions, `${label}: jam ramai = jumlah transaksi`);

  // uang masuk: laporan = arus kas = metode bayar
  eq(C.in.total, s.cash_in, `${label}: uang masuk arus kas = laporan`);
  eq(C.in.debt_collected, s.debt_collected, `${label}: bayaran hutang arus kas = laporan`);
  eq(sum(R.by_method.filter((m) => m.kind !== 'debt'), (m) => m.total), s.cash_in, `${label}: rincian metode bayar = uang masuk`);
  eq(sum(R.by_method.filter((m) => m.kind === 'debt'), (m) => m.total), sum(done, (x) => x.debt_amount), `${label}: metode Hutang = sisa hutang dari penjualan`);
  eq(s.revenue - sum(done, (x) => x.debt_amount), s.cash_in - s.debt_collected, `${label}: dibayar saat jual = omzet - hutang`);

  // pengeluaran: halaman pengeluaran = laporan = arus kas
  eq(E.total, s.expenses, `${label}: total halaman pengeluaran = laporan`);
  eq(sum(E.items, (e) => e.amount), E.total, `${label}: daftar pengeluaran = totalnya`);
  eq(sum(E.by_category, (c) => c.amount), E.total, `${label}: kategori pengeluaran = total`);
  eq(sum(R.expenses_by_category, (c) => c.amount), s.expenses, `${label}: kategori laporan = pengeluaran`);
  eq(C.out.expenses, s.expenses, `${label}: pengeluaran arus kas = laporan`);

  // pembelian
  const doneP = P.filter((p) => p.status === 'completed');
  eq(sum(doneP, (p) => p.total), s.purchases, `${label}: daftar pembelian = total pembelian laporan`);
  eq(C.out.purchases, sum(doneP, (p) => p.paid_amount), `${label}: pembelian dibayar arus kas = daftar pembelian`);

  // arus kas
  eq(C.in.total - C.out.total, C.net, `${label}: sisa uang = masuk - keluar`);
  eq(sum(C.by_method, (m) => m.net), C.net, `${label}: sisa per metode = sisa total`);
  eq(sum(C.by_method, (m) => m.in), C.in.total, `${label}: masuk per metode = masuk total`);
  eq(sum(C.by_method, (m) => m.out), C.out.total, `${label}: keluar per metode = keluar total`);

  // produk terlaris: jumlah semua produk = omzet dan modal (diskon ikut dibagi)
  const net = await netLineRevenue(from, to);
  eq(net.revenue, s.revenue, `${label}: pendapatan per produk (setelah diskon) = omzet`);
  eq(net.cogs, s.cogs, `${label}: modal per produk = modal laporan`);
  for (const p of R.top_products) eq(Number(p.revenue) - Number(p.cogs), p.profit, `${label}: laba ${p.name} = pendapatan - modal`);
  return R;
}

// ---------------------------------------------------------------------
console.log('Periode data demo');
const periods = [
  ['Hari ini', today, today],
  ['Kemarin', addDays(today, -1), addDays(today, -1)],
  ['7 hari', addDays(today, -6), today],
  ['Bulan ini', monthStart, today],
  ['35 hari', addDays(today, -34), today],
];
const reports = {};
for (const [label, from, to] of periods) reports[label] = await auditPeriod(label, from, to);

// laporan bulanan = jumlah laporan harian
{
  const days = [];
  for (let d = monthStart; d <= today; d = addDays(d, 1)) days.push(await rpc('get_report', { p_business_id: B, p_from: d, p_to: d }));
  const m = reports['Bulan ini'].summary;
  for (const k of ['revenue', 'cogs', 'expenses', 'cash_in', 'debt_collected', 'transactions', 'discount', 'purchases'])
    eq(sum(days, (r) => r.summary[k]), m[k], `bulanan = jumlah harian (${k})`);
}

// dashboard = laporan harian untuk tanggal yang sama
console.log('Dashboard');
for (const offset of [0, -1, -3]) {
  const day = addDays(today, offset);
  const D = await rpc('get_dashboard', { p_business_id: B, p_date: day });
  const r = (await rpc('get_report', { p_business_id: B, p_from: day, p_to: day })).summary;
  const c = await rpc('get_cash_flow', { p_business_id: B, p_from: day, p_to: day });
  const t = D.today;
  eq(t.sales, r.revenue, `${day}: penjualan dashboard = laporan`);
  eq(t.cost, r.cogs, `${day}: modal dashboard = laporan`);
  eq(t.gross_profit, r.gross_profit, `${day}: laba kotor dashboard = laporan`);
  eq(t.expenses, r.expenses, `${day}: pengeluaran dashboard = laporan`);
  eq(t.cash_in, r.cash_in, `${day}: uang masuk dashboard = laporan`);
  eq(t.cash_in, c.in.total, `${day}: uang masuk dashboard = arus kas`);
  eq(t.debt_collected, r.debt_collected, `${day}: bayaran hutang dashboard = laporan`);
  eq(t.transactions, r.transactions, `${day}: jumlah transaksi dashboard = laporan`);
  eq(t.items_sold, r.items_sold, `${day}: item terjual dashboard = laporan`);
  eq(t.discount, r.discount, `${day}: diskon dashboard = laporan`);
  eq(t.voids, r.voids, `${day}: void dashboard = laporan`);
  eq(sum(D.cash_in_by_method, (m) => m.amount), t.cash_in, `${day}: uang masuk per metode dashboard = uang masuk`);
  for (const pt of D.series) {
    const rr = (await rpc('get_report', { p_business_id: B, p_from: pt.date, p_to: pt.date })).summary;
    eq(pt.sales, rr.revenue, `${day}: grafik dashboard ${pt.date} = laporan hari itu`);
    eq(pt.gross_profit, rr.gross_profit, `${day}: laba grafik dashboard ${pt.date} = laporan`);
  }
  eq(D.receivables, (await rpc('get_dashboard', { p_business_id: B })).receivables, `${day}: piutang tidak tergantung tanggal`);
}

// piutang: dashboard = laporan = halaman piutang = halaman pelanggan
console.log('Piutang');
{
  const D = await rpc('get_dashboard', { p_business_id: B });
  const R = reports['Bulan ini'].summary;
  const list = await rpc('list_customers', { p_business_id: B, p_include_inactive: true });
  const debtors = list.filter((c) => c.balance > 0);
  eq(D.receivables.total, R.receivables_now, 'piutang dashboard = laporan');
  eq(sum(debtors, (c) => c.balance), D.receivables.total, 'piutang dashboard = jumlah saldo pelanggan');
  eq(debtors.length, D.receivables.customers, 'jumlah pelanggan berhutang');
  for (const c of list) {
    const detail = await rpc('get_customer', { p_business_id: B, p_customer_id: c.id });
    eq(detail.balance, c.balance, `${c.name}: saldo detail = daftar`);
    eq(c.debt_total - c.paid_total, c.balance, `${c.name}: saldo = hutang - bayar`);
    const act = detail.entries.filter((e) => !e.voided_at);
    eq(sum(act.filter((e) => e.kind === 'debt'), (e) => e.amount) - sum(act.filter((e) => e.kind === 'payment'), (e) => e.amount), c.balance, `${c.name}: riwayat = saldo`);
    if (c.balance >= 0) eq(sum(settleFifo(detail.entries), (x) => x), c.balance, `${c.name}: sisa per belanja (FIFO) = saldo`);
  }
}

// supplier: daftar = detail = pembelian - pembayaran
console.log('Supplier');
{
  const list = await rpc('list_suppliers', { p_business_id: B });
  const all = await rpc('list_purchases', { p_business_id: B });
  for (const s of list) {
    const d = await rpc('get_supplier', { p_business_id: B, p_supplier_id: s.id });
    const mine = all.filter((p) => p.supplier_id === s.id && p.status === 'completed');
    eq(d.balance, s.balance, `${s.name}: hutang detail = daftar`);
    eq(d.total_purchases, s.total_purchases, `${s.name}: total belanja detail = daftar`);
    eq(sum(mine, (p) => p.total), s.total_purchases, `${s.name}: total belanja = daftar pembelian`);
    eq(sum(mine, (p) => p.debt_amount) - sum(d.payments.filter((p) => !p.voided_at), (p) => p.amount), s.balance, `${s.name}: hutang = pembelian belum dibayar - cicilan`);
    for (const p of d.purchases) eq(sum(p.items, (i) => i.line_total), p.total, `${s.name} #${p.number}: jumlah item = total pembelian`);
  }
}

// stok
console.log('Stok');
{
  const products = await rpc('list_products', { p_business_id: B });
  const D = await rpc('get_dashboard', { p_business_id: B });
  for (const p of products.filter((x) => x.track_stock)) {
    const { rows } = await db.query(`select coalesce(sum(qty_change), 0)::float as s from public.stock_movements where product_id = $1`, [p.id]);
    eq(rows[0].s, p.stock, `${p.name}: stok = jumlah mutasi`);
  }
  eq(products.filter((p) => p.track_stock && p.is_active && p.stock <= p.min_stock).length, D.low_stock.count, 'stok menipis halaman produk = dashboard');
}

// struk: setiap transaksi konsisten dengan item dan pembayarannya
console.log('Struk transaksi');
{
  const S = await rpc('list_sales', { p_business_id: B, p_from: addDays(today, -6), p_to: today, p_limit: 500 });
  for (const x of S.items.slice(0, 80)) {
    const d = await rpc('get_sale', { p_business_id: B, p_sale_id: x.id });
    eq(sum(d.items, (i) => i.line_total), d.subtotal, `#${d.number}: jumlah baris = subtotal`);
    eq(d.subtotal - d.discount, d.total, `#${d.number}: total = subtotal - diskon`);
    eq(sum(d.payments, (p) => p.amount), d.total, `#${d.number}: pembayaran = total`);
    eq(Number(d.paid_amount) + Number(d.debt_amount), d.total, `#${d.number}: dibayar + hutang = total`);
    if (d.cash_received !== null) eq(d.cash_received >= d.total, true, `#${d.number}: uang diterima cukup`);
    for (const i of d.items) eq(Math.round(i.qty * i.unit_price * 100) / 100, i.line_total, `#${d.number}: ${i.name} qty x harga`);
  }
}

// ---------------------------------------------------------------------
console.log('Skenario: usaha baru, data kosong');
await db.exec(`insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-4000-8000-00000000e001', 'uji@user.possir.app', '{"full_name":"Uji"}')`);
await as('00000000-0000-4000-8000-00000000e001');
const X = (await rpc('create_business', { p_name: 'Uji Audit', p_business_type: 'toko', p_owner_name: 'Uji' })).business.id;
{
  const D = await rpc('get_dashboard', { p_business_id: X });
  const R = await rpc('get_report', { p_business_id: X, p_from: monthStart, p_to: today });
  const C = await rpc('get_cash_flow', { p_business_id: X, p_from: monthStart, p_to: today });
  const zeros = (o, keys, label) => keys.forEach((k) => eq(o[k], 0, `${label}.${k} = 0`));
  zeros(D.today, ['sales', 'cost', 'gross_profit', 'expenses', 'cash_in', 'transactions', 'items_sold', 'discount', 'voids', 'debt_new', 'debt_collected'], 'dashboard');
  zeros(R.summary, ['revenue', 'cogs', 'gross_profit', 'expenses', 'net_profit', 'cash_in', 'avg_ticket', 'purchases', 'receivables_now'], 'laporan');
  zeros(C, ['net'], 'arus kas');
  eq(D.series.length, 7, 'grafik 7 hari tetap 7 titik');
  eq(R.series.every((d) => d.revenue === 0), true, 'grafik laporan kosong berisi 0, bukan null');
  eq([R.top_products.length, R.by_method.length, R.expenses_by_category.length, R.by_hour.length], [0, 0, 0, 0], 'daftar kosong berupa array kosong');
}

console.log('Skenario: desimal dan pembulatan');
const cat = await rpc('upsert_category', { p_business_id: X, p_name: 'Uji' });
const mk = async (name, price, cost, stock = 100) => {
  const p = await rpc('upsert_product', { p_business_id: X, p_product: { name, price, cost_price: cost, track_stock: true, unit: 'pcs' } });
  await rpc('adjust_stock', { p_business_id: X, p_product_id: p.id, p_mode: 'set', p_qty: stock, p_reason: 'correction' }).catch(() => null);
  return p;
};
const beras = await mk('Beras curah', 12.35, 9.1, 50);
const kopi = await mk('Kopi sachet', 3.335, 2.1, 500);
{
  const s = await rpc('create_sale', { p_business_id: X, p_sale: { payment_method: 'cash', items: [{ product_id: beras.id, qty: 0.5 }, { product_id: kopi.id, qty: 3 }] } });
  // harga 3.335 disimpan 3.34 (2 desimal); 0.5 x 12.35 = 6.175 -> 6.18 (pembulatan setengah ke atas)
  eq(s.items.map((i) => i.line_total), [6.18, 10.02], 'baris desimal dibulatkan seperti kasir');
  eq(s.total, 16.2, 'total desimal');
  const { roundMoney } = await import('../src/lib/util.ts');
  eq([roundMoney(0.5 * 12.35), roundMoney(3 * 3.34), roundMoney(1.005), roundMoney(-1.005)], [6.18, 10.02, 1.01, -1.01], 'pembulatan keranjang (JS) = database');
}

console.log('Skenario: diskon dan produk terlaris');
{
  await rpc('create_sale', { p_business_id: X, p_sale: { payment_method: 'instapay', discount: 7.5, items: [{ product_id: beras.id, qty: 2 }, { product_id: kopi.id, qty: 10 }] } });
  const R = await rpc('get_report', { p_business_id: X, p_from: today, p_to: today });
  eq(sum(R.top_products, (p) => p.revenue), R.summary.revenue, 'jumlah pendapatan produk terlaris = omzet (ada diskon)');
  eq(sum(R.top_products, (p) => p.profit), R.summary.gross_profit, 'jumlah laba produk terlaris = laba kotor');
  const D = await rpc('get_dashboard', { p_business_id: X });
  eq(sum(D.top_products, (p) => p.revenue), D.today.sales, 'terlaris dashboard = penjualan (ada diskon)');
}

console.log('Skenario: tambah, ubah, batal berulang');
const cust = await rpc('upsert_customer', { p_business_id: X, p_customer: { name: 'Pelanggan Uji' } });
const snapshot = async () => {
  const R = (await rpc('get_report', { p_business_id: X, p_from: today, p_to: today })).summary;
  const D = await rpc('get_dashboard', { p_business_id: X });
  const C = await rpc('get_cash_flow', { p_business_id: X, p_from: today, p_to: today });
  const c = await rpc('get_customer', { p_business_id: X, p_customer_id: cust.id });
  const L = await rpc('list_sales', { p_business_id: X, p_from: today, p_to: today });
  eq(D.today.sales, R.revenue, '  dashboard = laporan');
  eq(D.today.cash_in, C.in.total, '  uang masuk dashboard = arus kas');
  eq(sum(L.items.filter((x) => x.status === 'completed'), (x) => x.total), R.revenue, '  riwayat = laporan');
  eq(D.receivables.total, Math.max(0, c.balance), '  piutang dashboard = saldo pelanggan');
  eq(R.net_profit, R.revenue - R.cogs - R.expenses, '  laba bersih');
  return { R, c, D };
};
{
  const debt = await rpc('create_sale', { p_business_id: X, p_sale: { payment_method: 'hutang', customer_id: cust.id, down_payment: 20, down_payment_method: 'cash', items: [{ product_id: beras.id, qty: 10 }] } });
  let s = await snapshot();
  eq(s.c.balance, 123.5 - 20, 'hutang = total - uang muka');
  await rpc('record_debt_payment', { p_business_id: X, p_customer_id: cust.id, p_amount: 50, p_method_code: 'vodafone_cash' });
  s = await snapshot();
  eq(s.c.balance, 53.5, 'saldo setelah bayar sebagian');
  const pay = s.c.entries.find((e) => e.kind === 'payment' && !e.voided_at);
  await rpc('void_debt_payment', { p_business_id: X, p_payment_id: pay.id, p_reason: 'salah catat' });
  s = await snapshot();
  eq(s.c.balance, 103.5, 'saldo kembali setelah pembayaran dibatalkan');
  eq((await rpcError('record_debt_payment', { p_business_id: X, p_customer_id: cust.id, p_amount: 103.51, p_method_code: 'cash' }))?.message, 'Pembayaran melebihi sisa hutang.', 'bayar lebih dari sisa ditolak');
  await rpc('record_debt_payment', { p_business_id: X, p_customer_id: cust.id, p_amount: 103.5, p_method_code: 'cash' });
  s = await snapshot();
  eq(s.c.balance, 0, 'lunas');
  // transaksi hutang yang sudah dibayar lalu dibatalkan: uangnya jadi saldo titipan pelanggan,
  // piutang tidak minus, dan uang masuk tetap tercatat (uangnya memang sudah diterima)
  const cashBefore = s.R.cash_in;
  await rpc('void_sale', { p_business_id: X, p_sale_id: debt.id, p_reason: 'uji' });
  s = await snapshot();
  eq(s.c.balance, -103.5, 'void transaksi hutang yang sudah dibayar: bayaran 103,5 jadi titipan');
  eq(s.D.receivables.total, 0, 'titipan tidak mengurangi total piutang jadi minus');
  eq(s.R.cash_in, cashBefore - 20, 'uang muka ikut batal bersama transaksi, bayaran hutang tetap uang masuk');

  const stockBefore = (await rpc('list_products', { p_business_id: X })).find((p) => p.id === kopi.id).stock;
  for (let i = 0; i < 5; i++) {
    const sale = await rpc('create_sale', { p_business_id: X, p_sale: { payment_method: 'cash', items: [{ product_id: kopi.id, qty: 4 }] } });
    if (i % 2 === 0) await rpc('void_sale', { p_business_id: X, p_sale_id: sale.id, p_reason: 'uji berulang' });
  }
  await snapshot();
  const stockAfter = (await rpc('list_products', { p_business_id: X })).find((p) => p.id === kopi.id).stock;
  eq(stockBefore - stockAfter, 8, 'stok: 5 jual, 3 batal = berkurang 8');

  const e = await rpc('save_expense', { p_business_id: X, p_expense: { category: 'Gas', amount: 40, spent_on: today, method_code: 'cash' } });
  await snapshot();
  await rpc('save_expense', { p_business_id: X, p_expense: { id: e.id, category: 'Transport', amount: 65.25, spent_on: today, method_code: 'instapay' } });
  s = await snapshot();
  eq(s.R.expenses, 65.25, 'ubah pengeluaran langsung tercermin');
  await rpc('void_expense', { p_business_id: X, p_expense_id: e.id, p_reason: 'uji' });
  s = await snapshot();
  eq(s.R.expenses, 0, 'hapus pengeluaran langsung tercermin');
}

console.log('Skenario: jumlah besar');
{
  const mahal = await mk('Barang mahal', 99999.99, 80000, 0);
  const big = await rpc('create_sale', { p_business_id: X, p_sale: { payment_method: 'cash', items: [{ product_id: mahal.id, qty: 1000 }] } }).catch((e) => ({ error: e.message }));
  eq(big.error ?? null, null, 'transaksi EGP 99,9 juta tersimpan');
  if (!big.error) eq(big.total, 99999990, 'total jumlah besar tepat');
  const huge = await rpcError('create_sale', { p_business_id: X, p_sale: { payment_method: 'cash', items: Array.from({ length: 150 }, () => ({ product_id: mahal.id, qty: 99999 })) } });
  eq(huge?.code, '22023', 'total di luar batas ditolak dengan pesan jelas, bukan error database');
  const R = (await rpc('get_report', { p_business_id: X, p_from: today, p_to: today })).summary;
  const L = await rpc('list_sales', { p_business_id: X, p_from: today, p_to: today });
  eq(sum(L.items.filter((x) => x.status === 'completed'), (x) => x.total), R.revenue, 'jumlah besar: riwayat = laporan');
}

console.log('Skenario: pembelian dibatalkan setelah dicicil');
{
  const sup = await rpc('upsert_supplier', { p_business_id: X, p_supplier: { name: 'Supplier Uji' } });
  const pu = await rpc('create_purchase', { p_business_id: X, p_purchase: { supplier_id: sup.id, paid_amount: 100, items: [{ product_id: kopi.id, qty: 100, unit_cost: 2.5 }] } });
  await rpc('record_supplier_payment', { p_business_id: X, p_supplier_id: sup.id, p_amount: 100, p_method_code: 'cash' });
  const outBefore = (await rpc('get_cash_flow', { p_business_id: X, p_from: today, p_to: today })).out;
  await rpc('void_purchase', { p_business_id: X, p_purchase_id: pu.id, p_reason: 'barang dikembalikan' });
  const d = await rpc('get_supplier', { p_business_id: X, p_supplier_id: sup.id });
  const l = (await rpc('list_suppliers', { p_business_id: X })).find((s) => s.id === sup.id);
  const outAfter = (await rpc('get_cash_flow', { p_business_id: X, p_from: today, p_to: today })).out;
  eq(d.balance, -100, 'cicilan 100 jadi titipan di supplier setelah pembelian dibatalkan');
  eq(l.balance, d.balance, 'titipan supplier: daftar = detail');
  eq(outBefore.purchases - outAfter.purchases, 100, 'bayar di muka ikut batal bersama pembelian');
  eq(outAfter.supplier_payments, outBefore.supplier_payments, 'cicilan tetap tercatat sebagai uang keluar');
}

await db.close();
console.log(`\n${passed} lulus, ${failed} gagal`);
process.exit(failed ? 1 : 0);
