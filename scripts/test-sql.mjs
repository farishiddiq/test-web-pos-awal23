// Tes skema Supabase Possir di PGlite (Postgres 18 WASM), tanpa Docker.
// Jalankan: npm run test:sql
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { PGlite } from '@electric-sql/pglite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');

const OWNER = '00000000-0000-4000-8000-00000000a001';
const CASHIER = '00000000-0000-4000-8000-00000000a002';
const OUTSIDER = '00000000-0000-4000-8000-00000000a003';

let passed = 0;
let failed = 0;
const eq = (actual, expected, label) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    console.error(`  GAGAL ${label}\n    dapat:   ${a}\n    harapan: ${e}`);
  }
};
const ok = (cond, label) => eq(Boolean(cond), true, label);

const db = new PGlite();
const t0 = performance.now();
await db.exec(read('supabase/pglite/auth-shim.sql'));
await db.exec(read('supabase/migrations/20260926000100_possir_tables.sql'));
await db.exec(read('supabase/migrations/20260926000200_possir_api.sql'));
console.log(`Migrasi selesai dalam ${Math.round(performance.now() - t0)} ms`);

// Peta argumen fungsi publik supaya bisa dipanggil dengan parameter bernama
const sig = new Map();
for (const row of (await db.query(`
  select p.proname as name, p.proargnames as names, p.proargtypes::regtype[]::text[] as types
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public'`)).rows) {
  sig.set(row.name, (row.names ?? []).map((n, i) => ({ name: n, type: row.types[i] })));
}

let currentUser = null;
const as = async (uid) => {
  currentUser = uid;
  await db.exec(`set request.jwt.claim.sub = '${uid ?? ''}'`);
};

const rpc = async (fn, args = {}) => {
  const params = sig.get(fn);
  if (!params) throw new Error(`Fungsi ${fn} tidak ada`);
  const values = [];
  const parts = [];
  for (const [key, value] of Object.entries(args)) {
    const p = params.find((x) => x.name === key);
    if (!p) throw new Error(`${fn}: argumen ${key} tidak dikenal`);
    values.push(value !== null && typeof value === 'object' ? JSON.stringify(value) : value);
    parts.push(`${key} => $${values.length}::${p.type}`);
  }
  const res = await db.query(`select public.${fn}(${parts.join(', ')}) as r`, values);
  return res.rows[0].r;
};

const rpcError = async (fn, args) => {
  try {
    await rpc(fn, args);
    return null;
  } catch (e) {
    return { code: e.code, message: e.message };
  }
};

// ---------------------------------------------------------------------
console.log('Pengguna dan usaha');
await db.exec(`
  insert into auth.users (id, email, raw_user_meta_data) values
    ('${OWNER}', 'ahmad@contoh.id', '{"full_name":"Ahmad Fauzi"}'),
    ('${CASHIER}', 'rizki@contoh.id', '{"full_name":"Rizki Maulana"}'),
    ('${OUTSIDER}', 'zaid@contoh.id', '{"full_name":"Zaid Alatas"}');`);
eq((await db.query(`select count(*)::int as n from public.profiles`)).rows[0].n, 3, 'profil dibuat oleh trigger');

await as(null);
eq((await rpcError('get_my_businesses')), null, 'get_my_businesses tanpa sesi tidak error');
eq((await rpcError('create_business', { p_name: 'X' }))?.code, 'PT401', 'buat usaha tanpa sesi ditolak');

await as(OWNER);
const ctx = await rpc('create_business', { p_name: 'Dapur Ahmad', p_business_type: 'makanan', p_owner_name: 'Ahmad' });
const B = ctx.business.id;
eq(ctx.role, 'owner', 'pembuat usaha jadi owner');
eq(ctx.payment_methods.filter((m) => m.is_active).map((m) => m.code), ['cash', 'instapay', 'vodafone_cash', 'hutang'], 'metode bayar aktif default');
eq(ctx.categories.map((c) => c.name), ['Makanan', 'Minuman', 'Camilan'], 'kategori default makanan');
const cat = Object.fromEntries(ctx.categories.map((c) => [c.name, c.id]));
eq(ctx.business.currency, 'EGP', 'mata uang EGP');
eq((await rpcError('create_business', { p_name: '  ' }))?.message, 'Nama usaha wajib diisi.', 'validasi nama usaha');

// ---------------------------------------------------------------------
console.log('Produk');
const nasi = await rpc('upsert_product', { p_business_id: B, p_product: { name: 'Nasi Ayam Geprek', category_id: cat.Makanan, price: 80, cost_price: 45, track_stock: false, unit: 'porsi' } });
const bakso = await rpc('upsert_product', { p_business_id: B, p_product: { name: 'Bakso Frozen', category_id: cat.Makanan, price: 150, cost_price: 110, track_stock: true, stock: 12, min_stock: 5, unit: 'pack', sku: 'BKS-01' } });
const teh = await rpc('upsert_product', { p_business_id: B, p_product: { name: 'Es Teh', category_id: cat.Minuman, price: 15, cost_price: 5, track_stock: false, unit: 'gelas' } });
const sambal = await rpc('upsert_product', { p_business_id: B, p_product: { name: 'Sambal Botol', category_id: cat.Camilan, price: 70, cost_price: 40, stock: 3, min_stock: 5, unit: 'botol' } });
eq([bakso.stock, bakso.cost_price, bakso.unit], [12, 110, 'pack'], 'produk dengan stok awal');
eq((await db.query(`select count(*)::int as n from public.stock_movements where product_id = $1 and type = 'initial'`, [bakso.id])).rows[0].n, 1, 'mutasi stok awal tercatat');
eq((await rpcError('upsert_product', { p_business_id: B, p_product: { name: 'Bakso lain', price: 10, sku: 'BKS-01' } }))?.code, 'PT409', 'SKU unik per usaha');
eq((await rpcError('upsert_product', { p_business_id: B, p_product: { name: 'Minus', price: -1 } }))?.message, 'Harga tidak boleh negatif.', 'harga negatif ditolak');
eq((await rpcError('upsert_product', { p_business_id: B, p_product: { name: 'Aneh', price: 'abc' } }))?.code, '22023', 'angka tidak valid ditolak');
const baksoEdit = await rpc('upsert_product', { p_business_id: B, p_product: { ...bakso, stock: 999, price: 155 } });
eq([baksoEdit.stock, baksoEdit.price], [12, 155], 'edit produk tidak mengubah stok langsung');
await rpc('upsert_product', { p_business_id: B, p_product: { ...baksoEdit, price: 150 } });

// ---------------------------------------------------------------------
console.log('Penjualan');
const ref1 = crypto.randomUUID();
const sale1 = await rpc('create_sale', { p_business_id: B, p_sale: {
  client_ref: ref1, payment_method: 'cash', cash_received: 400,
  items: [{ product_id: bakso.id, qty: 2 }, { product_id: teh.id, qty: 2 }] } });
eq([sale1.number, sale1.subtotal, sale1.total, sale1.cost_total, sale1.paid_amount, sale1.cash_received], [1, 330, 330, 230, 330, 400], 'transaksi cash');
eq(sale1.payments.map((p) => [p.method_code, p.amount]), [['cash', 330]], 'pembayaran cash tercatat');
const stockAfter = async (id) => (await db.query('select stock::float as s from public.products where id = $1', [id])).rows[0].s;
eq(await stockAfter(bakso.id), 10, 'stok bakso berkurang 2');

const again = await rpc('create_sale', { p_business_id: B, p_sale: {
  client_ref: ref1, payment_method: 'cash', items: [{ product_id: bakso.id, qty: 2 }] } });
eq(again.id, sale1.id, 'client_ref sama tidak membuat transaksi dobel');
eq(await stockAfter(bakso.id), 10, 'stok tidak berkurang dua kali');

const sale2 = await rpc('create_sale', { p_business_id: B, p_sale: {
  client_ref: crypto.randomUUID(), payment_method: 'hutang',
  new_customer: { name: 'Abdullah Syakir', phone: '01012345678' },
  down_payment: 50, down_payment_method: 'cash', due_date: '2026-10-01',
  items: [{ product_id: nasi.id, qty: 3 }] } });
eq([sale2.total, sale2.paid_amount, sale2.debt_amount, sale2.due_date], [240, 50, 190, '2026-10-01'], 'hutang dengan uang muka');
eq(sale2.payments.map((p) => [p.method_code, p.amount]), [['cash', 50], ['hutang', 190]], 'uang muka + sisa hutang');
const abdullah = sale2.customer.id;

const sale3 = await rpc('create_sale', { p_business_id: B, p_sale: {
  payment_method: 'vodafone_cash', discount: 5,
  items: [{ name: 'Kerupuk Udang', qty: 2, unit_price: 10, unit_cost: 4 }] } });
eq([sale3.subtotal, sale3.discount, sale3.total, sale3.cost_total, sale3.items[0].product_id], [20, 5, 15, 8, null], 'jual cepat tanpa produk');

eq((await rpcError('create_sale', { p_business_id: B, p_sale: { payment_method: 'cash', items: [] } }))?.message, 'Keranjang masih kosong.', 'keranjang kosong ditolak');
eq((await rpcError('create_sale', { p_business_id: B, p_sale: { payment_method: 'cash', discount: 999, items: [{ product_id: teh.id, qty: 1 }] } }))?.message, 'Diskon tidak boleh melebihi subtotal.', 'diskon melebihi subtotal ditolak');
eq((await rpcError('create_sale', { p_business_id: B, p_sale: { payment_method: 'hutang', items: [{ product_id: teh.id, qty: 1 }] } }))?.message, 'Pilih pelanggan untuk transaksi hutang.', 'hutang wajib pelanggan');
eq((await rpcError('create_sale', { p_business_id: B, p_sale: { payment_method: 'orange_cash', items: [{ product_id: teh.id, qty: 1 }] } }))?.code, '22023', 'metode nonaktif ditolak');
eq((await rpcError('create_sale', { p_business_id: B, p_sale: { payment_method: 'cash', cash_received: 5, items: [{ product_id: teh.id, qty: 1 }] } }))?.message, 'Uang yang diterima kurang dari total belanja.', 'uang diterima kurang ditolak');

// stok boleh minus: penjualan nyata tetap tercatat
await rpc('create_sale', { p_business_id: B, p_sale: { payment_method: 'cash', items: [{ product_id: sambal.id, qty: 4 }] } });
eq(await stockAfter(sambal.id), -1, 'stok boleh minus');

// ---------------------------------------------------------------------
console.log('Piutang');
let cust = await rpc('get_customer', { p_business_id: B, p_customer_id: abdullah });
eq(cust.balance, 190, 'saldo hutang pelanggan');
const payRef = crypto.randomUUID();
cust = await rpc('record_debt_payment', { p_business_id: B, p_customer_id: abdullah, p_amount: 100, p_method_code: 'instapay', p_client_ref: payRef });
eq(cust.balance, 90, 'bayar sebagian');
cust = await rpc('record_debt_payment', { p_business_id: B, p_customer_id: abdullah, p_amount: 100, p_method_code: 'instapay', p_client_ref: payRef });
eq(cust.balance, 90, 'pembayaran dengan client_ref sama tidak dobel');
eq((await rpcError('record_debt_payment', { p_business_id: B, p_customer_id: abdullah, p_amount: 100, p_method_code: 'cash' }))?.message, 'Pembayaran melebihi sisa hutang.', 'bayar melebihi sisa ditolak');
eq((await rpcError('record_debt_payment', { p_business_id: B, p_customer_id: abdullah, p_amount: 10, p_method_code: 'hutang' }))?.message, 'Pilih metode bayar selain Hutang.', 'bayar hutang pakai hutang ditolak');
cust = await rpc('add_customer_debt', { p_business_id: B, p_customer_id: abdullah, p_amount: 60, p_note: 'Hutang lama' });
eq(cust.balance, 150, 'hutang manual');
const manual = cust.entries.find((e) => e.kind === 'debt' && e.sale_id === null);
cust = await rpc('void_customer_debt', { p_business_id: B, p_debt_id: manual.id, p_reason: 'Salah catat' });
eq(cust.balance, 90, 'batalkan hutang manual');
const saleDebt = cust.entries.find((e) => e.kind === 'debt' && e.sale_id);
eq((await rpcError('void_customer_debt', { p_business_id: B, p_debt_id: saleDebt.id, p_reason: 'x' }))?.code, 'PT409', 'hutang dari transaksi tidak bisa dibatalkan langsung');
const list = await rpc('list_customers', { p_business_id: B });
eq([list[0].name, list[0].balance, list[0].oldest_unpaid_due], ['Abdullah Syakir', 90, '2026-10-01'], 'daftar piutang + jatuh tempo tertua');

// ---------------------------------------------------------------------
console.log('Dashboard');
let dash = await rpc('get_dashboard', { p_business_id: B });
// 330 + 240 + 15 + 280 (sambal 4 x 70)
eq(dash.today.sales, 865, 'penjualan hari ini');
eq(dash.today.cost, 230 + 135 + 8 + 160, 'modal hari ini');
eq(dash.today.gross_profit, 865 - 533, 'laba kotor hari ini');
eq(dash.today.transactions, 4, 'jumlah transaksi');
eq(dash.today.cash_in, 330 + 50 + 15 + 280 + 100, 'uang masuk hari ini');
eq(dash.receivables, { total: 90, customers: 1 }, 'total piutang');
eq(dash.low_stock.count, 1, 'stok menipis');
eq(dash.series.length, 7, 'seri 7 hari');
eq(dash.top_products[0].name, 'Sambal Botol', 'produk terlaris');

// ---------------------------------------------------------------------
console.log('Void');
eq((await rpcError('void_sale', { p_business_id: B, p_sale_id: sale1.id, p_reason: '' }))?.message, 'Tulis alasan pembatalan dulu.', 'void wajib alasan');
const voided = await rpc('void_sale', { p_business_id: B, p_sale_id: sale1.id, p_reason: 'Salah input' });
eq([voided.status, voided.void_reason, voided.voided_by_name], ['void', 'Salah input', 'Ahmad'], 'transaksi dibatalkan');
eq(await stockAfter(bakso.id), 12, 'stok kembali setelah void');
eq((await rpcError('void_sale', { p_business_id: B, p_sale_id: sale1.id, p_reason: 'lagi' }))?.code, 'PT409', 'void dua kali ditolak');
dash = await rpc('get_dashboard', { p_business_id: B });
eq([dash.today.sales, dash.today.voids], [535, 1], 'dashboard tanpa transaksi void');
const voidDebt = await rpc('void_sale', { p_business_id: B, p_sale_id: sale2.id, p_reason: 'Pelanggan batal' });
eq(voidDebt.status, 'void', 'void transaksi hutang');
cust = await rpc('get_customer', { p_business_id: B, p_customer_id: abdullah });
eq(cust.balance, -100, 'pembayaran lebih jadi saldo titipan');

// ---------------------------------------------------------------------
console.log('Stok, supplier, pembelian');
let adj = await rpc('adjust_stock', { p_business_id: B, p_product_id: bakso.id, p_mode: 'set', p_qty: 10, p_reason: 'damaged', p_note: 'Bocor' });
eq(adj.stock, 10, 'stock opname');
eq((await rpcError('adjust_stock', { p_business_id: B, p_product_id: bakso.id, p_mode: 'set', p_qty: 10 }))?.code, '22023', 'opname tanpa selisih ditolak');
eq((await rpcError('adjust_stock', { p_business_id: B, p_product_id: nasi.id, p_mode: 'add', p_qty: 1 }))?.code, '22023', 'stok tidak dilacak ditolak');
const moves = await rpc('list_stock_movements', { p_business_id: B, p_product_id: bakso.id });
eq(moves.map((m) => m.type), ['adjustment', 'sale_void', 'sale', 'initial'], 'riwayat mutasi stok');

const pur = await rpc('create_purchase', { p_business_id: B, p_purchase: {
  client_ref: crypto.randomUUID(), new_supplier: { name: 'Grosir Hay Asyir', phone: '01122334455' },
  items: [{ product_id: bakso.id, qty: 20, unit_cost: 105 }], paid_amount: 1000, method_code: 'cash' } });
eq([pur.number, pur.total, pur.debt_amount], [1, 2100, 1100], 'pembelian dengan hutang supplier');
eq(await stockAfter(bakso.id), 30, 'stok bertambah dari pembelian');
eq((await db.query('select cost_price::float as c from public.products where id = $1', [bakso.id])).rows[0].c, 105, 'harga modal ikut harga beli terakhir');
let sup = await rpc('record_supplier_payment', { p_business_id: B, p_supplier_id: pur.supplier.id, p_amount: 600, p_method_code: 'instapay' });
eq(sup.balance, 500, 'bayar hutang supplier');
const suppliers = await rpc('list_suppliers', { p_business_id: B });
eq([suppliers[0].total_purchases, suppliers[0].balance], [2100, 500], 'ringkasan supplier');
await rpc('void_purchase', { p_business_id: B, p_purchase_id: pur.id, p_reason: 'Barang dikembalikan' });
eq(await stockAfter(bakso.id), 10, 'void pembelian mengurangi stok');

// ---------------------------------------------------------------------
console.log('Pengeluaran dan laporan');
const today = ctx.today;
const expRef = crypto.randomUUID();
await rpc('save_expense', { p_business_id: B, p_expense: { category: 'Gas', amount: 200, client_ref: expRef, method_code: 'cash' } });
await rpc('save_expense', { p_business_id: B, p_expense: { category: 'Gas', amount: 200, client_ref: expRef } });
const kem = await rpc('save_expense', { p_business_id: B, p_expense: { category: 'Kemasan', amount: 35, note: 'Box nasi' } });
const exps = await rpc('list_expenses', { p_business_id: B, p_from: today, p_to: today });
eq([exps.items.length, exps.total], [2, 235], 'pengeluaran tidak dobel');
await rpc('void_expense', { p_business_id: B, p_expense_id: kem.id });
const report = await rpc('get_report', { p_business_id: B, p_from: today, p_to: today });
eq(report.summary.revenue, 295, 'omzet laporan');
eq(report.summary.cogs, 168, 'HPP laporan');
eq(report.summary.gross_profit, 127, 'laba kotor laporan');
eq(report.summary.expenses, 200, 'pengeluaran laporan');
eq(report.summary.net_profit, -73, 'laba bersih laporan');
eq([report.summary.voids, report.summary.void_total], [2, 570], 'transaksi void di laporan');
eq(report.summary.debt_collected, 100, 'piutang tertagih');
eq(report.series.length, 1, 'seri harian laporan');
ok(report.by_method.some((m) => m.code === 'instapay' && m.debt_payments === 100), 'pembayaran piutang per metode');
eq((await rpcError('get_report', { p_business_id: B, p_from: today, p_to: '2020-01-01' }))?.code, '22023', 'rentang terbalik ditolak');

// ---------------------------------------------------------------------
console.log('Kasir, undangan, dan izin');
const invite = await rpc('create_invite', { p_business_id: B });
ok(/^[A-F0-9]{8}$/.test(invite.code), 'kode undangan 8 karakter');
await as(CASHIER);
eq((await rpcError('get_business_context', { p_business_id: B }))?.code, 'PT403', 'belum anggota ditolak');
const cctx = await rpc('accept_invite', { p_code: invite.code.toLowerCase(), p_display_name: 'Rizki' });
eq(cctx.role, 'cashier', 'kasir bergabung');
eq((await rpcError('accept_invite', { p_code: invite.code }))?.code, 'PT404', 'undangan sekali pakai');
const cprods = await rpc('list_products', { p_business_id: B });
ok(cprods.every((p) => p.cost_price === null), 'kasir tidak melihat harga modal');
const csale = await rpc('create_sale', { p_business_id: B, p_sale: { payment_method: 'cash', items: [{ product_id: teh.id, qty: 1 }] } });
eq([csale.cashier_name, csale.cost_total], ['Rizki', null], 'transaksi kasir tanpa modal');
eq((await rpcError('void_sale', { p_business_id: B, p_sale_id: csale.id, p_reason: 'x' }))?.code, 'PT403', 'kasir tidak bisa void');
eq((await rpcError('get_report', { p_business_id: B, p_from: today, p_to: today }))?.code, 'PT403', 'kasir tidak bisa lihat laporan');
eq((await rpcError('get_sale', { p_business_id: B, p_sale_id: sale3.id }))?.code, 'PT403', 'kasir tidak bisa lihat transaksi orang lain');
const csales = await rpc('list_sales', { p_business_id: B });
eq(csales.items.map((s) => s.id), [csale.id], 'kasir hanya melihat transaksinya sendiri');
const cdash = await rpc('get_dashboard', { p_business_id: B });
eq([cdash.today.sales, cdash.today.gross_profit, cdash.today.cost], [15, null, null], 'dashboard kasir tanpa laba');

console.log('Row Level Security');
await db.exec(`set role authenticated`);
eq((await db.query('select count(*)::int as n from public.products')).rows[0].n, 0, 'kasir tidak bisa baca tabel produk langsung');
eq((await db.query('select count(*)::int as n from public.businesses')).rows[0].n, 1, 'kasir bisa lihat usahanya');
let rlsError = null;
try {
  await db.query(`insert into public.products (business_id, name) values ($1, 'Selundupan')`, [B]);
} catch (e) {
  rlsError = e.message;
}
ok(rlsError && rlsError.includes('row-level security'), 'insert langsung ditolak RLS');
let execError = null;
try {
  await db.query(`select private.assert_owner($1::uuid)`, [B]);
} catch (e) {
  execError = e.message;
}
ok(execError && execError.includes('permission denied'), 'helper private tidak bisa dipanggil langsung');
await as(OWNER);
eq((await db.query('select count(*)::int as n from public.products')).rows[0].n, 4, 'owner bisa baca tabel produk');
await as(OUTSIDER);
eq((await db.query('select count(*)::int as n from public.sales')).rows[0].n, 0, 'orang luar tidak melihat penjualan');
await db.exec(`reset role`);
eq((await rpcError('get_dashboard', { p_business_id: B }))?.code, 'PT403', 'orang luar ditolak RPC');

// ---------------------------------------------------------------------
console.log('Zona waktu Kairo');
await as(OWNER);
const late = await rpc('create_sale', { p_business_id: B, p_sale: { payment_method: 'cash', items: [{ product_id: teh.id, qty: 1 }] } });
// 23:30 waktu Kairo kemarin
await db.query(`update public.sales set created_at = ((($1::date - 1)::timestamp + interval '23 hours 30 minutes') at time zone 'Africa/Cairo') where id = $2`, [today, late.id]);
dash = await rpc('get_dashboard', { p_business_id: B });
const yesterday = dash.series[5];
eq(yesterday.sales, 15, 'transaksi 23:30 masuk ke hari kemarin');
eq(dash.today.transactions, 3, 'hari ini tidak ikut terhitung');

// ---------------------------------------------------------------------
console.log('Performa (seed demo)');
const tSeed = performance.now();
for (let i = 0; i < 200; i++) {
  await rpc('create_sale', { p_business_id: B, p_sale: { payment_method: i % 3 ? 'cash' : 'instapay', items: [{ product_id: teh.id, qty: 1 }, { product_id: nasi.id, qty: 1 + (i % 2) }] } });
}
console.log(`  200 transaksi: ${Math.round(performance.now() - tSeed)} ms`);
const tRep = performance.now();
await rpc('get_report', { p_business_id: B, p_from: today, p_to: today });
await rpc('get_dashboard', { p_business_id: B });
console.log(`  laporan + dashboard: ${Math.round(performance.now() - tRep)} ms`);

await db.close();
console.log(`\n${passed} lulus, ${failed} gagal`);
process.exit(failed ? 1 : 0);
