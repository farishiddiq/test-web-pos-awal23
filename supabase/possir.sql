-- =====================================================================
-- POSSIR: seluruh skema Supabase dalam satu file (dibuat otomatis).
-- Sumber: supabase/migrations/*.sql. Jangan edit file ini langsung;
-- edit file migrasinya lalu jalankan: npm run sql:bundle
--
-- Cara pakai: Supabase Dashboard > SQL Editor > New query > tempel > Run.
-- Jalankan sekali di project baru.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 20260926000100_possir_tables.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- POSSIR - skema database (bagian 1 dari 3): tabel, index, trigger, RLS
--
-- Kasir, stok, piutang, pengeluaran, dan laporan untuk usaha mahasiswa
-- Indonesia di Mesir. Semua uang disimpan dalam EGP, numeric(12,2).
--
-- Urutan menjalankan di Supabase SQL Editor:
--   1. 20260926000100_possir_tables.sql   (file ini)
--   2. 20260926000200_possir_api.sql
--   3. 20260926000300_possir_storage.sql
-- Atau jalankan sekaligus: supabase/possir.sql (gabungan ketiganya).
--
-- Prinsip keamanan:
--   * Semua tabel memakai Row Level Security.
--   * Klien TIDAK menulis langsung ke tabel. Semua perubahan lewat fungsi
--     RPC (security definer) yang memeriksa keanggotaan dan peran.
--   * Pemilik (owner) boleh membaca tabel usahanya secara langsung,
--     kasir (cashier) hanya lewat RPC yang menyaring data sensitif
--     seperti harga modal dan laba.
-- =====================================================================

create schema if not exists private;

-- ---------------------------------------------------------------------
-- Profil pengguna (1:1 dengan auth.users)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  full_name   text check (full_name is null or char_length(full_name) <= 80),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Usaha dan anggotanya
-- ---------------------------------------------------------------------
create table public.businesses (
  id                      uuid primary key default gen_random_uuid(),
  name                    text not null check (char_length(btrim(name)) between 1 and 80),
  business_type           text not null default 'lainnya'
                          check (business_type in ('makanan', 'katering', 'frozen', 'toko', 'jasa', 'jastip', 'pulsa', 'lainnya')),
  currency                text not null default 'EGP' check (currency ~ '^[A-Z]{3}$'),
  timezone                text not null default 'Africa/Cairo',
  phone                   text check (phone is null or char_length(phone) <= 30),
  address                 text check (address is null or char_length(address) <= 200),
  receipt_footer          text check (receipt_footer is null or char_length(receipt_footer) <= 200),
  debt_reminder_template  text check (debt_reminder_template is null or char_length(debt_reminder_template) <= 600),
  sale_counter            integer not null default 0,
  purchase_counter        integer not null default 0,
  created_by              uuid references auth.users (id) on delete set null,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

create table public.business_members (
  business_id   uuid not null references public.businesses (id) on delete cascade,
  user_id       uuid not null references auth.users (id) on delete cascade,
  role          text not null default 'cashier' check (role in ('owner', 'cashier')),
  display_name  text check (display_name is null or char_length(display_name) <= 80),
  created_at    timestamptz not null default now(),
  primary key (business_id, user_id)
);
create index business_members_user_idx on public.business_members (user_id);

create table public.business_invites (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  code         text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  role         text not null default 'cashier' check (role in ('owner', 'cashier')),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  expires_at   timestamptz not null default now() + interval '7 days',
  used_by      uuid references auth.users (id) on delete set null,
  used_at      timestamptz,
  revoked_at   timestamptz
);
create index business_invites_business_idx on public.business_invites (business_id);

-- ---------------------------------------------------------------------
-- Master data: metode bayar, kategori, produk, pelanggan, supplier
-- ---------------------------------------------------------------------
create table public.payment_methods (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  code         text not null check (code ~ '^[a-z0-9_]{2,40}$'),
  name         text not null check (char_length(btrim(name)) between 1 and 40),
  kind         text not null check (kind in ('cash', 'wallet', 'bank', 'debt', 'other')),
  is_active    boolean not null default true,
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now(),
  unique (business_id, code)
);

create table public.categories (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 40),
  sort_order   integer not null default 0,
  created_at   timestamptz not null default now()
);
create unique index categories_business_name_key on public.categories (business_id, lower(name));

create table public.products (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  category_id  uuid references public.categories (id) on delete set null,
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  sku          text check (sku is null or char_length(sku) <= 64),
  unit         text not null default 'pcs' check (char_length(btrim(unit)) between 1 and 20),
  price        numeric(12, 2) not null default 0 check (price >= 0),
  cost_price   numeric(12, 2) not null default 0 check (cost_price >= 0),
  track_stock  boolean not null default true,
  stock        numeric(12, 3) not null default 0,
  min_stock    numeric(12, 3) not null default 0 check (min_stock >= 0),
  -- URL Supabase Storage, atau data URL kecil di mode demo
  image_url    text check (image_url is null or char_length(image_url) <= 300000),
  color        text check (color is null or color ~ '^[a-z]{3,12}$'),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index products_business_sku_key on public.products (business_id, sku) where sku is not null;
create index products_business_idx on public.products (business_id, is_active);

create table public.customers (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  phone        text check (phone is null or char_length(phone) <= 30),
  note         text check (note is null or char_length(note) <= 200),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index customers_business_idx on public.customers (business_id, is_active);

create table public.suppliers (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  name         text not null check (char_length(btrim(name)) between 1 and 80),
  phone        text check (phone is null or char_length(phone) <= 30),
  note         text check (note is null or char_length(note) <= 200),
  is_active    boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index suppliers_business_idx on public.suppliers (business_id, is_active);

-- ---------------------------------------------------------------------
-- Penjualan
-- ---------------------------------------------------------------------
create table public.sales (
  id                   uuid primary key default gen_random_uuid(),
  business_id          uuid not null references public.businesses (id) on delete cascade,
  number               integer not null,
  -- dibuat di HP sebelum dikirim; mencegah transaksi dobel saat sinyal putus-nyambung
  client_ref           uuid,
  status               text not null default 'completed' check (status in ('completed', 'void')),
  customer_id          uuid references public.customers (id) on delete restrict,
  payment_method_code  text not null,
  payment_method_name  text not null,
  subtotal             numeric(12, 2) not null check (subtotal >= 0),
  discount             numeric(12, 2) not null default 0 check (discount >= 0),
  total                numeric(12, 2) not null check (total >= 0),
  cost_total           numeric(12, 2) not null default 0 check (cost_total >= 0),
  paid_amount          numeric(12, 2) not null default 0 check (paid_amount >= 0),
  debt_amount          numeric(12, 2) not null default 0 check (debt_amount >= 0),
  cash_received        numeric(12, 2) check (cash_received is null or cash_received >= 0),
  note                 text check (note is null or char_length(note) <= 300),
  cashier_id           uuid references auth.users (id) on delete set null,
  cashier_name         text,
  created_at           timestamptz not null default now(),
  voided_at            timestamptz,
  voided_by            uuid references auth.users (id) on delete set null,
  voided_by_name       text,
  void_reason          text check (void_reason is null or char_length(void_reason) <= 200),
  unique (business_id, number),
  unique (business_id, client_ref),
  check (discount <= subtotal),
  check (total = subtotal - discount),
  check (paid_amount + debt_amount = total),
  check ((status = 'void') = (voided_at is not null))
);
create index sales_business_created_idx on public.sales (business_id, created_at desc);
create index sales_customer_idx on public.sales (customer_id) where customer_id is not null;
create index sales_cashier_idx on public.sales (business_id, cashier_id, created_at desc);

create table public.sale_items (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.sales (id) on delete cascade,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  -- nama, satuan, harga, dan modal disalin saat transaksi supaya laporan lama tidak berubah
  name         text not null,
  unit         text not null default 'pcs',
  qty          numeric(12, 3) not null check (qty > 0),
  unit_price   numeric(12, 2) not null check (unit_price >= 0),
  unit_cost    numeric(12, 2) not null default 0 check (unit_cost >= 0),
  line_total   numeric(12, 2) not null check (line_total >= 0),
  line_cost    numeric(12, 2) not null default 0 check (line_cost >= 0),
  position     smallint not null default 0
);
create index sale_items_sale_idx on public.sale_items (sale_id);
create index sale_items_product_idx on public.sale_items (business_id, product_id);

-- Satu transaksi bisa dibayar dengan beberapa cara, misalnya uang muka Cash + sisanya Hutang
create table public.sale_payments (
  id           uuid primary key default gen_random_uuid(),
  sale_id      uuid not null references public.sales (id) on delete cascade,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  method_code  text not null,
  method_name  text not null,
  method_kind  text not null check (method_kind in ('cash', 'wallet', 'bank', 'debt', 'other')),
  amount       numeric(12, 2) not null check (amount > 0)
);
create index sale_payments_sale_idx on public.sale_payments (sale_id);
create index sale_payments_business_idx on public.sale_payments (business_id, method_code);

-- ---------------------------------------------------------------------
-- Piutang pelanggan: buku kas bon (hutang masuk, pembayaran keluar)
-- Saldo = jumlah hutang aktif - jumlah pembayaran aktif
-- ---------------------------------------------------------------------
create table public.customer_debts (
  id           uuid primary key default gen_random_uuid(),
  business_id  uuid not null references public.businesses (id) on delete cascade,
  customer_id  uuid not null references public.customers (id) on delete restrict,
  sale_id      uuid references public.sales (id) on delete set null,
  amount       numeric(12, 2) not null check (amount > 0),
  due_date     date,
  note         text check (note is null or char_length(note) <= 200),
  created_by   uuid references auth.users (id) on delete set null,
  created_at   timestamptz not null default now(),
  voided_at    timestamptz,
  voided_by    uuid references auth.users (id) on delete set null,
  void_reason  text
);
create index customer_debts_customer_idx on public.customer_debts (business_id, customer_id);
create unique index customer_debts_sale_key on public.customer_debts (sale_id) where sale_id is not null;

create table public.debt_payments (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  customer_id      uuid not null references public.customers (id) on delete restrict,
  amount           numeric(12, 2) not null check (amount > 0),
  method_code      text not null,
  method_name      text not null,
  note             text check (note is null or char_length(note) <= 200),
  client_ref       uuid,
  created_by       uuid references auth.users (id) on delete set null,
  created_by_name  text,
  created_at       timestamptz not null default now(),
  voided_at        timestamptz,
  voided_by        uuid references auth.users (id) on delete set null,
  void_reason      text,
  unique (business_id, client_ref)
);
create index debt_payments_customer_idx on public.debt_payments (business_id, customer_id);
create index debt_payments_created_idx on public.debt_payments (business_id, created_at desc);

-- ---------------------------------------------------------------------
-- Pembelian ke supplier (restock) dan hutang ke supplier
-- ---------------------------------------------------------------------
create table public.purchases (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  number           integer not null,
  client_ref       uuid,
  supplier_id      uuid references public.suppliers (id) on delete restrict,
  status           text not null default 'completed' check (status in ('completed', 'void')),
  total            numeric(12, 2) not null check (total >= 0),
  paid_amount      numeric(12, 2) not null default 0 check (paid_amount >= 0),
  debt_amount      numeric(12, 2) not null default 0 check (debt_amount >= 0),
  method_code      text,
  method_name      text,
  note             text check (note is null or char_length(note) <= 300),
  purchased_on     date not null,
  created_by       uuid references auth.users (id) on delete set null,
  created_by_name  text,
  created_at       timestamptz not null default now(),
  voided_at        timestamptz,
  voided_by        uuid references auth.users (id) on delete set null,
  void_reason      text,
  unique (business_id, number),
  unique (business_id, client_ref),
  check (paid_amount + debt_amount = total),
  check (debt_amount = 0 or supplier_id is not null),
  check ((status = 'void') = (voided_at is not null))
);
create index purchases_business_idx on public.purchases (business_id, purchased_on desc);
create index purchases_supplier_idx on public.purchases (supplier_id) where supplier_id is not null;

create table public.purchase_items (
  id           uuid primary key default gen_random_uuid(),
  purchase_id  uuid not null references public.purchases (id) on delete cascade,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  product_id   uuid references public.products (id) on delete set null,
  name         text not null,
  unit         text not null default 'pcs',
  qty          numeric(12, 3) not null check (qty > 0),
  unit_cost    numeric(12, 2) not null check (unit_cost >= 0),
  line_total   numeric(12, 2) not null check (line_total >= 0),
  position     smallint not null default 0
);
create index purchase_items_purchase_idx on public.purchase_items (purchase_id);
create index purchase_items_product_idx on public.purchase_items (business_id, product_id);

create table public.supplier_payments (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  supplier_id      uuid not null references public.suppliers (id) on delete restrict,
  amount           numeric(12, 2) not null check (amount > 0),
  method_code      text not null,
  method_name      text not null,
  note             text check (note is null or char_length(note) <= 200),
  client_ref       uuid,
  created_by       uuid references auth.users (id) on delete set null,
  created_by_name  text,
  created_at       timestamptz not null default now(),
  voided_at        timestamptz,
  voided_by        uuid references auth.users (id) on delete set null,
  void_reason      text,
  unique (business_id, client_ref)
);
create index supplier_payments_supplier_idx on public.supplier_payments (business_id, supplier_id);

-- ---------------------------------------------------------------------
-- Pengeluaran operasional (gas, listrik, transport, kemasan, ...)
-- ---------------------------------------------------------------------
create table public.expenses (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  category         text not null check (char_length(btrim(category)) between 1 and 40),
  amount           numeric(12, 2) not null check (amount > 0),
  note             text check (note is null or char_length(note) <= 200),
  spent_on         date not null,
  method_code      text,
  method_name      text,
  client_ref       uuid,
  created_by       uuid references auth.users (id) on delete set null,
  created_by_name  text,
  created_at       timestamptz not null default now(),
  voided_at        timestamptz,
  voided_by        uuid references auth.users (id) on delete set null,
  void_reason      text,
  unique (business_id, client_ref)
);
create index expenses_business_date_idx on public.expenses (business_id, spent_on desc);

-- ---------------------------------------------------------------------
-- Mutasi stok: setiap perubahan stok punya jejak
-- ---------------------------------------------------------------------
create table public.stock_movements (
  id               uuid primary key default gen_random_uuid(),
  business_id      uuid not null references public.businesses (id) on delete cascade,
  product_id       uuid not null references public.products (id) on delete cascade,
  type             text not null
                   check (type in ('initial', 'sale', 'sale_void', 'purchase', 'purchase_void', 'adjustment')),
  reason           text check (reason is null or reason in ('restock', 'damaged', 'lost', 'expired', 'correction', 'other')),
  qty_change       numeric(12, 3) not null,
  qty_after        numeric(12, 3) not null,
  unit_cost        numeric(12, 2),
  sale_id          uuid references public.sales (id) on delete set null,
  purchase_id      uuid references public.purchases (id) on delete set null,
  note             text check (note is null or char_length(note) <= 200),
  created_by       uuid references auth.users (id) on delete set null,
  created_by_name  text,
  created_at       timestamptz not null default now()
);
create index stock_movements_product_idx on public.stock_movements (product_id, created_at desc);
create index stock_movements_sale_idx on public.stock_movements (sale_id) where sale_id is not null;
create index stock_movements_purchase_idx on public.stock_movements (purchase_id) where purchase_id is not null;

-- ---------------------------------------------------------------------
-- Jejak audit: siapa membatalkan apa, kapan, dan kenapa
-- ---------------------------------------------------------------------
create table public.audit_logs (
  id           bigint generated always as identity primary key,
  business_id  uuid not null references public.businesses (id) on delete cascade,
  actor_id     uuid references auth.users (id) on delete set null,
  actor_name   text,
  action       text not null,
  entity       text not null,
  entity_id    uuid,
  details      jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);
create index audit_logs_business_idx on public.audit_logs (business_id, created_at desc);

-- =====================================================================
-- Trigger
-- =====================================================================
create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function private.touch_updated_at();
create trigger businesses_touch before update on public.businesses
  for each row execute function private.touch_updated_at();
create trigger products_touch before update on public.products
  for each row execute function private.touch_updated_at();
create trigger customers_touch before update on public.customers
  for each row execute function private.touch_updated_at();
create trigger suppliers_touch before update on public.suppliers
  for each row execute function private.touch_updated_at();

-- Buat profil otomatis saat pengguna mendaftar
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

-- beberapa template Supabase sudah membuat trigger bernama sama
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- =====================================================================
-- Helper keanggotaan (dipakai RLS dan RPC)
-- =====================================================================
create or replace function private.is_member(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = auth.uid()
  );
$$;

create or replace function private.is_owner(p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.business_members m
    where m.business_id = p_business_id and m.user_id = auth.uid() and m.role = 'owner'
  );
$$;

grant usage on schema private to authenticated;
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_owner(uuid) to authenticated;

-- =====================================================================
-- Row Level Security
-- Tidak ada policy insert/update/delete: penulisan hanya lewat RPC.
-- =====================================================================
alter table public.profiles          enable row level security;
alter table public.businesses        enable row level security;
alter table public.business_members  enable row level security;
alter table public.business_invites  enable row level security;
alter table public.payment_methods   enable row level security;
alter table public.categories        enable row level security;
alter table public.products          enable row level security;
alter table public.customers         enable row level security;
alter table public.suppliers         enable row level security;
alter table public.sales             enable row level security;
alter table public.sale_items        enable row level security;
alter table public.sale_payments     enable row level security;
alter table public.customer_debts    enable row level security;
alter table public.debt_payments     enable row level security;
alter table public.purchases         enable row level security;
alter table public.purchase_items    enable row level security;
alter table public.supplier_payments enable row level security;
alter table public.expenses          enable row level security;
alter table public.stock_movements   enable row level security;
alter table public.audit_logs        enable row level security;

create policy "profil sendiri" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

create policy "anggota melihat usahanya" on public.businesses
  for select to authenticated using (private.is_member(id));

create policy "keanggotaan sendiri atau pemilik" on public.business_members
  for select to authenticated using (user_id = (select auth.uid()) or private.is_owner(business_id));

create policy "anggota melihat metode bayar" on public.payment_methods
  for select to authenticated using (private.is_member(business_id));

create policy "anggota melihat kategori" on public.categories
  for select to authenticated using (private.is_member(business_id));

create policy "pemilik membaca" on public.business_invites  for select to authenticated using (private.is_owner(business_id));
create policy "pemilik membaca" on public.products          for select to authenticated using (private.is_owner(business_id));
create policy "pemilik membaca" on public.customers         for select to authenticated using (private.is_owner(business_id));
create policy "pemilik membaca" on public.suppliers         for select to authenticated using (private.is_owner(business_id));
create policy "pemilik membaca" on public.sales             for select to authenticated using (private.is_owner(business_id));
create policy "pemilik membaca" on public.sale_items        for select to authenticated using (private.is_owner(business_id));
create policy "pemilik membaca" on public.sale_payments     for select to authenticated using (private.is_owner(business_id));
create policy "pemilik membaca" on public.customer_debts    for select to authenticated using (private.is_owner(business_id));
create policy "pemilik membaca" on public.debt_payments     for select to authenticated using (private.is_owner(business_id));
create policy "pemilik membaca" on public.purchases         for select to authenticated using (private.is_owner(business_id));
create policy "pemilik membaca" on public.purchase_items    for select to authenticated using (private.is_owner(business_id));
create policy "pemilik membaca" on public.supplier_payments for select to authenticated using (private.is_owner(business_id));
create policy "pemilik membaca" on public.expenses          for select to authenticated using (private.is_owner(business_id));
create policy "pemilik membaca" on public.stock_movements   for select to authenticated using (private.is_owner(business_id));
create policy "pemilik membaca" on public.audit_logs        for select to authenticated using (private.is_owner(business_id));

-- Pengunjung anonim tidak butuh akses tabel apa pun
revoke all on all tables in schema public from anon;


-- ---------------------------------------------------------------------
-- 20260926000200_possir_api.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- POSSIR - skema database (bagian 2 dari 3): API RPC
--
-- Semua fungsi publik bersifat security definer dengan search_path kosong
-- dan selalu memeriksa keanggotaan usaha sebelum menyentuh data.
-- Aplikasi memanggilnya lewat supabase.rpc('nama_fungsi', { p_... }).
--
-- Kode error:
--   PT401 belum masuk   PT403 tidak berhak   PT404 tidak ditemukan
--   PT409 konflik       22023 input tidak valid
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Helper
-- ---------------------------------------------------------------------
create or replace function private.fail(p_message text, p_code text default '22023')
returns void
language plpgsql
volatile
set search_path = ''
as $$
begin
  raise exception using errcode = p_code, message = p_message;
end;
$$;

create or replace function private.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = 'PT401', message = 'Sesi kamu sudah habis. Silakan masuk lagi.';
  end if;
  return v_uid;
end;
$$;

create or replace function private.assert_member(p_business_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  perform private.require_user();
  if p_business_id is null then
    raise exception using errcode = '22023', message = 'Usaha belum dipilih.';
  end if;
  select m.role into v_role
  from public.business_members m
  where m.business_id = p_business_id and m.user_id = auth.uid();
  if v_role is null then
    raise exception using errcode = 'PT403', message = 'Kamu tidak punya akses ke usaha ini.';
  end if;
  return v_role;
end;
$$;

create or replace function private.assert_owner(p_business_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if private.assert_member(p_business_id) <> 'owner' then
    raise exception using errcode = 'PT403', message = 'Hanya pemilik usaha yang bisa melakukan ini.';
  end if;
  return 'owner';
end;
$$;

create or replace function private.actor_name(p_business_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select nullif(btrim(m.display_name), '') from public.business_members m
      where m.business_id = p_business_id and m.user_id = auth.uid()),
    (select nullif(btrim(p.full_name), '') from public.profiles p where p.id = auth.uid()),
    'Pengguna'
  );
$$;

create or replace function private.business_tz(p_business_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select b.timezone from public.businesses b where b.id = p_business_id), 'Africa/Cairo');
$$;

-- Awal hari (jam 00:00) di zona waktu usaha, sebagai timestamptz
create or replace function private.day_start(p_day date, p_tz text)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select (p_day::timestamp) at time zone p_tz;
$$;

create or replace function private.local_today(p_tz text)
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone p_tz)::date;
$$;

create or replace function private.log(
  p_business_id uuid, p_action text, p_entity text, p_entity_id uuid, p_details jsonb default '{}'::jsonb)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  insert into public.audit_logs (business_id, actor_id, actor_name, action, entity, entity_id, details)
  values (p_business_id, auth.uid(), private.actor_name(p_business_id), p_action, p_entity, p_entity_id,
          coalesce(p_details, '{}'::jsonb));
$$;

-- Pembaca nilai dari payload jsonb, dengan pesan error berbahasa Indonesia
create or replace function private.txt(p jsonb, p_key text)
returns text
language sql
immutable
set search_path = ''
as $$
  select nullif(btrim(p ->> p_key), '');
$$;

create or replace function private.num(p jsonb, p_key text, p_default numeric default null)
returns numeric
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := nullif(btrim(p ->> p_key), '');
  r numeric;
begin
  if v is null then
    return p_default;
  end if;
  if v !~ '^-?[0-9]+(\.[0-9]+)?([eE][-+]?[0-9]+)?$' then
    raise exception using errcode = '22023', message = format('Angka untuk "%s" tidak valid.', p_key);
  end if;
  r := v::numeric;
  if abs(r) >= 10000000000 then
    raise exception using errcode = '22023', message = format('Angka untuk "%s" terlalu besar.', p_key);
  end if;
  return r;
end;
$$;

create or replace function private.uuid_val(p jsonb, p_key text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := nullif(btrim(p ->> p_key), '');
begin
  if v is null then
    return null;
  end if;
  if v !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    raise exception using errcode = '22023', message = format('ID untuk "%s" tidak valid.', p_key);
  end if;
  return v::uuid;
end;
$$;

create or replace function private.date_val(p jsonb, p_key text)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  v text := nullif(btrim(p ->> p_key), '');
begin
  if v is null then
    return null;
  end if;
  if v !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception using errcode = '22023', message = format('Tanggal untuk "%s" tidak valid.', p_key);
  end if;
  return v::date;
exception
  when datetime_field_overflow or invalid_datetime_format then
    raise exception using errcode = '22023', message = format('Tanggal untuk "%s" tidak valid.', p_key);
end;
$$;

create or replace function private.bool_val(p jsonb, p_key text, p_default boolean)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select case when jsonb_typeof(p -> p_key) = 'boolean' then (p ->> p_key)::boolean else p_default end;
$$;

create or replace function private.payment_method(p_business_id uuid, p_code text, p_allow_debt boolean)
returns public.payment_methods
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v public.payment_methods;
begin
  select * into v
  from public.payment_methods pm
  where pm.business_id = p_business_id and pm.code = p_code and pm.is_active;
  if not found then
    raise exception using errcode = '22023',
      message = 'Metode pembayaran tidak tersedia. Cek pengaturan metode bayar.';
  end if;
  if v.kind = 'debt' and not p_allow_debt then
    raise exception using errcode = '22023', message = 'Pilih metode bayar selain Hutang.';
  end if;
  return v;
end;
$$;

-- ---------------------------------------------------------------------
-- 2. Pembentuk JSON
-- ---------------------------------------------------------------------
create or replace function private.product_json(p_product_id uuid, p_with_cost boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p.id, 'name', p.name, 'category_id', p.category_id, 'category_name', c.name,
    'sku', p.sku, 'unit', p.unit, 'price', p.price,
    'cost_price', case when p_with_cost then p.cost_price end,
    'track_stock', p.track_stock, 'stock', p.stock, 'min_stock', p.min_stock,
    'image_url', p.image_url, 'color', p.color, 'is_active', p.is_active,
    'created_at', p.created_at, 'updated_at', p.updated_at)
  from public.products p
  left join public.categories c on c.id = p.category_id
  where p.id = p_product_id;
$$;

create or replace function private.sale_json(p_sale_id uuid, p_with_cost boolean)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', s.id, 'number', s.number, 'status', s.status, 'created_at', s.created_at,
    'customer', case when c.id is null then null
                     else jsonb_build_object('id', c.id, 'name', c.name, 'phone', c.phone) end,
    'payment_method_code', s.payment_method_code, 'payment_method_name', s.payment_method_name,
    'subtotal', s.subtotal, 'discount', s.discount, 'total', s.total,
    'cost_total', case when p_with_cost then s.cost_total end,
    'paid_amount', s.paid_amount, 'debt_amount', s.debt_amount, 'cash_received', s.cash_received,
    'note', s.note, 'cashier_id', s.cashier_id, 'cashier_name', s.cashier_name,
    'voided_at', s.voided_at, 'voided_by_name', s.voided_by_name, 'void_reason', s.void_reason,
    'due_date', (select d.due_date from public.customer_debts d where d.sale_id = s.id),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'product_id', i.product_id, 'name', i.name, 'unit', i.unit, 'qty', i.qty,
        'unit_price', i.unit_price, 'line_total', i.line_total,
        'unit_cost', case when p_with_cost then i.unit_cost end) order by i.position)
      from public.sale_items i where i.sale_id = s.id), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'method_code', sp.method_code, 'method_name', sp.method_name,
        'method_kind', sp.method_kind, 'amount', sp.amount) order by (sp.method_kind = 'debt'), sp.amount desc)
      from public.sale_payments sp where sp.sale_id = s.id), '[]'::jsonb))
  from public.sales s
  left join public.customers c on c.id = s.customer_id
  where s.id = p_sale_id;
$$;

create or replace function private.customer_balance(p_customer_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select sum(d.amount) from public.customer_debts d
                   where d.customer_id = p_customer_id and d.voided_at is null), 0)
       - coalesce((select sum(p.amount) from public.debt_payments p
                   where p.customer_id = p_customer_id and p.voided_at is null), 0);
$$;

create or replace function private.customer_json(p_customer_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', c.id, 'name', c.name, 'phone', c.phone, 'note', c.note, 'is_active', c.is_active,
    'created_at', c.created_at, 'balance', private.customer_balance(c.id))
  from public.customers c
  where c.id = p_customer_id;
$$;

create or replace function private.supplier_balance(p_supplier_id uuid)
returns numeric
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((select sum(pu.debt_amount) from public.purchases pu
                   where pu.supplier_id = p_supplier_id and pu.status = 'completed'), 0)
       - coalesce((select sum(sp.amount) from public.supplier_payments sp
                   where sp.supplier_id = p_supplier_id and sp.voided_at is null), 0);
$$;

create or replace function private.purchase_json(p_purchase_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', pu.id, 'number', pu.number, 'status', pu.status, 'purchased_on', pu.purchased_on,
    'created_at', pu.created_at,
    'supplier', case when s.id is null then null
                     else jsonb_build_object('id', s.id, 'name', s.name, 'phone', s.phone) end,
    'total', pu.total, 'paid_amount', pu.paid_amount, 'debt_amount', pu.debt_amount,
    'method_code', pu.method_code, 'method_name', pu.method_name, 'note', pu.note,
    'created_by_name', pu.created_by_name, 'voided_at', pu.voided_at, 'void_reason', pu.void_reason,
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'product_id', i.product_id, 'name', i.name, 'unit', i.unit, 'qty', i.qty,
        'unit_cost', i.unit_cost, 'line_total', i.line_total) order by i.position)
      from public.purchase_items i where i.purchase_id = pu.id), '[]'::jsonb))
  from public.purchases pu
  left join public.suppliers s on s.id = pu.supplier_id
  where pu.id = p_purchase_id;
$$;

create or replace function private.expense_json(p_expense_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'id', e.id, 'category', e.category, 'amount', e.amount, 'note', e.note, 'spent_on', e.spent_on,
    'method_code', e.method_code, 'method_name', e.method_name, 'created_by_name', e.created_by_name,
    'created_at', e.created_at, 'voided_at', e.voided_at, 'void_reason', e.void_reason)
  from public.expenses e
  where e.id = p_expense_id;
$$;

-- Total piutang yang masih harus ditagih (saldo positif saja)
create or replace function private.receivables(p_business_id uuid)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'total', coalesce(sum(greatest(x.bal, 0)), 0),
    'customers', count(*) filter (where x.bal > 0))
  from (
    select coalesce(d.total, 0) - coalesce(p.total, 0) as bal
    from public.customers c
    left join (select cd.customer_id, sum(cd.amount) as total from public.customer_debts cd
               where cd.business_id = p_business_id and cd.voided_at is null group by cd.customer_id) d
      on d.customer_id = c.id
    left join (select dp.customer_id, sum(dp.amount) as total from public.debt_payments dp
               where dp.business_id = p_business_id and dp.voided_at is null group by dp.customer_id) p
      on p.customer_id = c.id
    where c.business_id = p_business_id
  ) x;
$$;

-- ---------------------------------------------------------------------
-- 3. Usaha dan akun
-- ---------------------------------------------------------------------
create or replace function public.get_my_businesses()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', b.id, 'name', b.name, 'business_type', b.business_type, 'currency', b.currency,
      'timezone', b.timezone, 'role', m.role, 'joined_at', m.created_at)
    order by m.created_at), '[]'::jsonb)
  from public.business_members m
  join public.businesses b on b.id = m.business_id
  where m.user_id = auth.uid();
$$;

create or replace function public.get_business_context(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role text := private.assert_member(p_business_id);
begin
  return (
    select jsonb_build_object(
      'business', jsonb_build_object(
        'id', b.id, 'name', b.name, 'business_type', b.business_type, 'currency', b.currency,
        'timezone', b.timezone, 'phone', b.phone, 'address', b.address,
        'receipt_footer', b.receipt_footer, 'debt_reminder_template', b.debt_reminder_template,
        'created_at', b.created_at),
      'role', v_role,
      'me', jsonb_build_object('user_id', auth.uid(), 'display_name', private.actor_name(p_business_id)),
      'payment_methods', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', pm.id, 'code', pm.code, 'name', pm.name, 'kind', pm.kind,
          'is_active', pm.is_active, 'sort_order', pm.sort_order) order by pm.sort_order, pm.created_at)
        from public.payment_methods pm where pm.business_id = b.id), '[]'::jsonb),
      'categories', coalesce((
        select jsonb_agg(jsonb_build_object('id', c.id, 'name', c.name, 'sort_order', c.sort_order)
                         order by c.sort_order, c.name)
        from public.categories c where c.business_id = b.id), '[]'::jsonb),
      'today', private.local_today(b.timezone))
    from public.businesses b
    where b.id = p_business_id);
end;
$$;

create or replace function public.create_business(
  p_name text, p_business_type text default 'lainnya', p_owner_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid        uuid := private.require_user();
  v_id         uuid;
  v_name       text := left(nullif(btrim(p_name), ''), 80);
  v_type       text := coalesce(nullif(btrim(p_business_type), ''), 'lainnya');
  v_owner_name text := left(nullif(btrim(p_owner_name), ''), 80);
  v_categories text[];
begin
  if v_name is null then
    perform private.fail('Nama usaha wajib diisi.');
  end if;
  if v_type not in ('makanan', 'katering', 'frozen', 'toko', 'jasa', 'jastip', 'pulsa', 'lainnya') then
    perform private.fail('Jenis usaha tidak dikenal.');
  end if;
  if (select count(*) from public.business_members m where m.user_id = v_uid and m.role = 'owner') >= 5 then
    perform private.fail('Satu akun maksimal memiliki 5 usaha.', 'PT409');
  end if;

  insert into public.profiles (id, full_name) values (v_uid, v_owner_name)
  on conflict (id) do update set full_name = coalesce(public.profiles.full_name, excluded.full_name);

  insert into public.businesses (name, business_type, created_by)
  values (v_name, v_type, v_uid)
  returning id into v_id;

  insert into public.business_members (business_id, user_id, role, display_name)
  values (v_id, v_uid, 'owner', coalesce(v_owner_name, (select p.full_name from public.profiles p where p.id = v_uid)));

  insert into public.payment_methods (business_id, code, name, kind, is_active, sort_order) values
    (v_id, 'cash',          'Cash',          'cash',   true,  10),
    (v_id, 'instapay',      'InstaPay',      'bank',   true,  20),
    (v_id, 'vodafone_cash', 'Vodafone Cash', 'wallet', true,  30),
    (v_id, 'orange_cash',   'Orange Cash',   'wallet', false, 40),
    (v_id, 'etisalat_cash', 'Etisalat Cash', 'wallet', false, 50),
    (v_id, 'bank_transfer', 'Transfer Bank', 'bank',   false, 60),
    (v_id, 'hutang',        'Hutang',        'debt',   true,  90);

  v_categories := case v_type
    when 'makanan'  then array['Makanan', 'Minuman', 'Camilan']
    when 'katering' then array['Paket', 'Lauk', 'Minuman']
    when 'frozen'   then array['Frozen', 'Bumbu', 'Camilan']
    when 'toko'     then array['Sembako', 'Minuman', 'Camilan', 'Kebutuhan harian']
    when 'jasa'     then array['Layanan']
    when 'jastip'   then array['Titipan', 'Ongkir']
    when 'pulsa'    then array['Pulsa', 'Paket data']
    else array['Umum']
  end;
  insert into public.categories (business_id, name, sort_order)
  select v_id, c.name, (c.ord * 10)::integer
  from unnest(v_categories) with ordinality as c(name, ord);

  perform private.log(v_id, 'business.create', 'business', v_id, jsonb_build_object('name', v_name, 'type', v_type));
  return public.get_business_context(v_id);
end;
$$;

create or replace function public.update_business(p_business_id uuid, p_patch jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tz   text := private.txt(p_patch, 'timezone');
  v_type text := private.txt(p_patch, 'business_type');
begin
  perform private.assert_owner(p_business_id);
  if p_patch ? 'name' and private.txt(p_patch, 'name') is null then
    perform private.fail('Nama usaha wajib diisi.');
  end if;
  if v_type is not null and v_type not in ('makanan', 'katering', 'frozen', 'toko', 'jasa', 'jastip', 'pulsa', 'lainnya') then
    perform private.fail('Jenis usaha tidak dikenal.');
  end if;
  if v_tz is not null and not exists (select 1 from pg_catalog.pg_timezone_names t where t.name = v_tz) then
    perform private.fail('Zona waktu tidak dikenal.');
  end if;

  update public.businesses b set
    name = coalesce(left(private.txt(p_patch, 'name'), 80), b.name),
    business_type = coalesce(v_type, b.business_type),
    timezone = coalesce(v_tz, b.timezone),
    phone = case when p_patch ? 'phone' then left(private.txt(p_patch, 'phone'), 30) else b.phone end,
    address = case when p_patch ? 'address' then left(private.txt(p_patch, 'address'), 200) else b.address end,
    receipt_footer = case when p_patch ? 'receipt_footer'
                          then left(private.txt(p_patch, 'receipt_footer'), 200) else b.receipt_footer end,
    debt_reminder_template = case when p_patch ? 'debt_reminder_template'
                                  then left(private.txt(p_patch, 'debt_reminder_template'), 600)
                                  else b.debt_reminder_template end
  where b.id = p_business_id;

  perform private.log(p_business_id, 'business.update', 'business', p_business_id, p_patch - 'debt_reminder_template');
  return public.get_business_context(p_business_id);
end;
$$;

create or replace function public.update_my_profile(p_business_id uuid, p_display_name text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(nullif(btrim(p_display_name), ''), 80);
begin
  perform private.assert_member(p_business_id);
  if v_name is null then
    perform private.fail('Nama tidak boleh kosong.');
  end if;
  update public.business_members m set display_name = v_name
  where m.business_id = p_business_id and m.user_id = auth.uid();
  insert into public.profiles (id, full_name) values (auth.uid(), v_name)
  on conflict (id) do update set full_name = excluded.full_name;
  return public.get_business_context(p_business_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 4. Metode bayar dan kategori
-- ---------------------------------------------------------------------
create or replace function public.set_payment_method(
  p_business_id uuid, p_code text, p_is_active boolean, p_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_owner(p_business_id);
  update public.payment_methods pm set
    is_active = coalesce(p_is_active, pm.is_active),
    name = coalesce(left(nullif(btrim(p_name), ''), 40), pm.name)
  where pm.business_id = p_business_id and pm.code = p_code;
  if not found then
    perform private.fail('Metode pembayaran tidak ditemukan.', 'PT404');
  end if;
  if not exists (select 1 from public.payment_methods pm
                 where pm.business_id = p_business_id and pm.is_active and pm.kind <> 'debt') then
    perform private.fail('Minimal harus ada satu metode bayar aktif selain Hutang.');
  end if;
  return public.get_business_context(p_business_id);
end;
$$;

create or replace function public.add_payment_method(p_business_id uuid, p_name text, p_kind text default 'wallet')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(nullif(btrim(p_name), ''), 40);
begin
  perform private.assert_owner(p_business_id);
  if v_name is null then
    perform private.fail('Nama metode bayar wajib diisi.');
  end if;
  if p_kind not in ('cash', 'wallet', 'bank', 'other') then
    perform private.fail('Jenis metode bayar tidak dikenal.');
  end if;
  if (select count(*) from public.payment_methods pm where pm.business_id = p_business_id) >= 20 then
    perform private.fail('Maksimal 20 metode bayar.');
  end if;
  if exists (select 1 from public.payment_methods pm
             where pm.business_id = p_business_id and lower(pm.name) = lower(v_name)) then
    perform private.fail('Metode dengan nama ini sudah ada.', 'PT409');
  end if;
  insert into public.payment_methods (business_id, code, name, kind, is_active, sort_order)
  values (p_business_id, 'custom_' || substr(md5(gen_random_uuid()::text), 1, 8), v_name, p_kind, true, 80);
  return public.get_business_context(p_business_id);
end;
$$;

create or replace function public.upsert_category(p_business_id uuid, p_name text, p_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := left(nullif(btrim(p_name), ''), 40);
begin
  perform private.assert_owner(p_business_id);
  if v_name is null then
    perform private.fail('Nama kategori wajib diisi.');
  end if;
  if p_id is null then
    if (select count(*) from public.categories c where c.business_id = p_business_id) >= 50 then
      perform private.fail('Maksimal 50 kategori.');
    end if;
    insert into public.categories (business_id, name, sort_order)
    values (p_business_id, v_name,
            coalesce((select max(c.sort_order) from public.categories c where c.business_id = p_business_id), 0) + 10);
  else
    update public.categories c set name = v_name where c.id = p_id and c.business_id = p_business_id;
    if not found then
      perform private.fail('Kategori tidak ditemukan.', 'PT404');
    end if;
  end if;
  return public.get_business_context(p_business_id);
exception
  when unique_violation then
    raise exception using errcode = 'PT409', message = 'Kategori dengan nama ini sudah ada.';
end;
$$;

create or replace function public.delete_category(p_business_id uuid, p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_owner(p_business_id);
  delete from public.categories c where c.id = p_id and c.business_id = p_business_id;
  if not found then
    perform private.fail('Kategori tidak ditemukan.', 'PT404');
  end if;
  return public.get_business_context(p_business_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 5. Produk dan stok
-- ---------------------------------------------------------------------
create or replace function public.list_products(p_business_id uuid, p_include_inactive boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner boolean := private.assert_member(p_business_id) = 'owner';
  v_since timestamptz := now() - interval '30 days';
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', p.id, 'name', p.name, 'category_id', p.category_id, 'category_name', c.name,
      'sku', p.sku, 'unit', p.unit, 'price', p.price,
      'cost_price', case when v_owner then p.cost_price end,
      'track_stock', p.track_stock, 'stock', p.stock, 'min_stock', p.min_stock,
      'image_url', p.image_url, 'color', p.color, 'is_active', p.is_active,
      'sold_30d', coalesce(s.qty, 0), 'created_at', p.created_at, 'updated_at', p.updated_at)
      order by p.name)
    from public.products p
    left join public.categories c on c.id = p.category_id
    left join (
      select i.product_id, sum(i.qty) as qty
      from public.sale_items i
      join public.sales sa on sa.id = i.sale_id
      where i.business_id = p_business_id and sa.status = 'completed'
        and sa.created_at >= v_since and i.product_id is not null
      group by i.product_id
    ) s on s.product_id = p.id
    where p.business_id = p_business_id and (p_include_inactive or p.is_active)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.upsert_product(p_business_id uuid, p_product jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       uuid := private.uuid_val(p_product, 'id');
  v_name     text := left(private.txt(p_product, 'name'), 80);
  v_category uuid := private.uuid_val(p_product, 'category_id');
  v_sku      text := left(private.txt(p_product, 'sku'), 64);
  v_unit     text := coalesce(left(private.txt(p_product, 'unit'), 20), 'pcs');
  v_price    numeric := round(coalesce(private.num(p_product, 'price'), 0), 2);
  v_cost     numeric := round(coalesce(private.num(p_product, 'cost_price'), 0), 2);
  v_track    boolean := private.bool_val(p_product, 'track_stock', true);
  v_stock    numeric := round(coalesce(private.num(p_product, 'stock'), 0), 3);
  v_min      numeric := round(coalesce(private.num(p_product, 'min_stock'), 0), 3);
  v_color    text := private.txt(p_product, 'color');
  v_old      public.products;
begin
  perform private.assert_owner(p_business_id);
  if v_name is null then
    perform private.fail('Nama produk wajib diisi.');
  end if;
  if v_price < 0 or v_cost < 0 then
    perform private.fail('Harga tidak boleh negatif.');
  end if;
  if v_min < 0 then
    perform private.fail('Minimum stok tidak boleh negatif.');
  end if;
  if v_color is not null and v_color !~ '^[a-z]{3,12}$' then
    v_color := null;
  end if;
  if v_category is not null and not exists (
      select 1 from public.categories c where c.id = v_category and c.business_id = p_business_id) then
    perform private.fail('Kategori tidak ditemukan.', 'PT404');
  end if;

  if v_id is null then
    if (select count(*) from public.products p where p.business_id = p_business_id) >= 2000 then
      perform private.fail('Maksimal 2000 produk per usaha.');
    end if;
    perform 1 from public.businesses b where b.id = p_business_id for update;
    insert into public.products (business_id, category_id, name, sku, unit, price, cost_price,
                                 track_stock, stock, min_stock, image_url, color)
    values (p_business_id, v_category, v_name, v_sku, v_unit, v_price, v_cost,
            v_track, case when v_track then v_stock else 0 end, v_min,
            private.txt(p_product, 'image_url'), v_color)
    returning id into v_id;
    if v_track and v_stock <> 0 then
      insert into public.stock_movements (business_id, product_id, type, qty_change, qty_after, unit_cost,
                                          created_by, created_by_name)
      values (p_business_id, v_id, 'initial', v_stock, v_stock, v_cost, auth.uid(), private.actor_name(p_business_id));
    end if;
    perform private.log(p_business_id, 'product.create', 'product', v_id,
                        jsonb_build_object('name', v_name, 'price', v_price, 'cost_price', v_cost));
  else
    select * into v_old from public.products p
    where p.id = v_id and p.business_id = p_business_id
    for update;
    if not found then
      perform private.fail('Produk tidak ditemukan.', 'PT404');
    end if;
    update public.products p set
      category_id = v_category, name = v_name, sku = v_sku, unit = v_unit,
      price = v_price, cost_price = v_cost, track_stock = v_track, min_stock = v_min,
      image_url = case when p_product ? 'image_url' then private.txt(p_product, 'image_url') else p.image_url end,
      color = coalesce(v_color, p.color)
    where p.id = v_id;
    if v_old.price <> v_price or v_old.cost_price <> v_cost then
      perform private.log(p_business_id, 'product.price', 'product', v_id, jsonb_build_object(
        'name', v_name, 'old_price', v_old.price, 'price', v_price, 'old_cost', v_old.cost_price, 'cost_price', v_cost));
    end if;
  end if;
  return private.product_json(v_id, true);
exception
  when unique_violation then
    raise exception using errcode = 'PT409', message = 'Kode SKU/barcode sudah dipakai produk lain.';
end;
$$;

create or replace function public.set_product_active(p_business_id uuid, p_product_id uuid, p_is_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_owner(p_business_id);
  update public.products p set is_active = coalesce(p_is_active, true)
  where p.id = p_product_id and p.business_id = p_business_id;
  if not found then
    perform private.fail('Produk tidak ditemukan.', 'PT404');
  end if;
  perform private.log(p_business_id, case when p_is_active then 'product.restore' else 'product.archive' end,
                      'product', p_product_id, '{}'::jsonb);
  return private.product_json(p_product_id, true);
end;
$$;

-- Hapus permanen hanya untuk produk yang belum pernah terjual atau dibeli
create or replace function public.delete_product(p_business_id uuid, p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text;
begin
  perform private.assert_owner(p_business_id);
  select p.name into v_name from public.products p
  where p.id = p_product_id and p.business_id = p_business_id
  for update;
  if v_name is null then
    perform private.fail('Produk tidak ditemukan.', 'PT404');
  end if;
  if exists (select 1 from public.sale_items i where i.product_id = p_product_id)
     or exists (select 1 from public.purchase_items i where i.product_id = p_product_id) then
    perform private.fail('Produk ini sudah punya riwayat transaksi. Arsipkan saja supaya laporan tetap utuh.', 'PT409');
  end if;
  delete from public.products p where p.id = p_product_id;
  perform private.log(p_business_id, 'product.delete', 'product', p_product_id, jsonb_build_object('name', v_name));
  return jsonb_build_object('id', p_product_id, 'deleted', true);
end;
$$;

create or replace function public.adjust_stock(
  p_business_id uuid, p_product_id uuid, p_mode text, p_qty numeric,
  p_reason text default null, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p      public.products;
  v_qty    numeric := round(p_qty, 3);
  v_change numeric;
  v_reason text := nullif(btrim(p_reason), '');
  v_after  numeric;
begin
  perform private.assert_owner(p_business_id);
  perform 1 from public.businesses b where b.id = p_business_id for update;
  select * into v_p from public.products p
  where p.id = p_product_id and p.business_id = p_business_id
  for update;
  if not found then
    perform private.fail('Produk tidak ditemukan.', 'PT404');
  end if;
  if not v_p.track_stock then
    perform private.fail('Stok produk ini tidak dilacak. Aktifkan "Lacak stok" dulu.');
  end if;
  if v_qty is null or v_qty < 0 or v_qty > 1000000 then
    perform private.fail('Jumlah stok tidak valid.');
  end if;

  if p_mode = 'add' then
    if v_qty = 0 then perform private.fail('Jumlah harus lebih dari 0.'); end if;
    v_change := v_qty;
    v_reason := coalesce(v_reason, 'restock');
  elsif p_mode = 'remove' then
    if v_qty = 0 then perform private.fail('Jumlah harus lebih dari 0.'); end if;
    v_change := -v_qty;
    v_reason := coalesce(v_reason, 'damaged');
  elsif p_mode = 'set' then
    v_change := v_qty - v_p.stock;
    v_reason := coalesce(v_reason, 'correction');
  else
    perform private.fail('Mode penyesuaian stok tidak dikenal.');
  end if;

  if v_reason not in ('restock', 'damaged', 'lost', 'expired', 'correction', 'other') then
    perform private.fail('Alasan penyesuaian stok tidak dikenal.');
  end if;
  if v_change = 0 then
    perform private.fail('Stok fisik sama dengan stok di sistem. Tidak ada yang berubah.');
  end if;

  update public.products p set stock = p.stock + v_change
  where p.id = p_product_id
  returning p.stock into v_after;

  insert into public.stock_movements (business_id, product_id, type, reason, qty_change, qty_after, unit_cost,
                                      note, created_by, created_by_name)
  values (p_business_id, p_product_id, 'adjustment', v_reason, v_change, v_after, v_p.cost_price,
          left(nullif(btrim(p_note), ''), 200), auth.uid(), private.actor_name(p_business_id));

  perform private.log(p_business_id, 'stock.adjust', 'product', p_product_id, jsonb_build_object(
    'name', v_p.name, 'before', v_p.stock, 'change', v_change, 'after', v_after, 'reason', v_reason));
  return private.product_json(p_product_id, true);
end;
$$;

create or replace function public.list_stock_movements(p_business_id uuid, p_product_id uuid, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_owner(p_business_id);
  return coalesce((
    select jsonb_agg(x.obj order by x.created_at desc)
    from (
      select m.created_at, jsonb_build_object(
        'id', m.id, 'type', m.type, 'reason', m.reason, 'qty_change', m.qty_change, 'qty_after', m.qty_after,
        'unit_cost', m.unit_cost, 'sale_id', m.sale_id, 'sale_number', sa.number,
        'purchase_id', m.purchase_id, 'purchase_number', pu.number,
        'note', m.note, 'created_by_name', m.created_by_name, 'created_at', m.created_at) as obj
      from public.stock_movements m
      left join public.sales sa on sa.id = m.sale_id
      left join public.purchases pu on pu.id = m.purchase_id
      where m.business_id = p_business_id and m.product_id = p_product_id
      order by m.created_at desc
      limit least(greatest(coalesce(p_limit, 50), 1), 200)
    ) x
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- 6. Pelanggan dan piutang
-- ---------------------------------------------------------------------
create or replace function public.list_customers(p_business_id uuid, p_include_inactive boolean default false)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_member(p_business_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', c.id, 'name', c.name, 'phone', c.phone, 'note', c.note, 'is_active', c.is_active,
      'created_at', c.created_at,
      'debt_total', coalesce(d.total, 0), 'paid_total', coalesce(p.total, 0),
      'balance', coalesce(d.total, 0) - coalesce(p.total, 0),
      'last_activity_at', greatest(d.last_at, p.last_at, c.created_at),
      'oldest_unpaid_at', o.created_at, 'oldest_unpaid_due', o.due_date)
      order by (coalesce(d.total, 0) - coalesce(p.total, 0)) desc, c.name)
    from public.customers c
    left join (
      select cd.customer_id, sum(cd.amount) as total, max(cd.created_at) as last_at
      from public.customer_debts cd
      where cd.business_id = p_business_id and cd.voided_at is null
      group by cd.customer_id) d on d.customer_id = c.id
    left join (
      select dp.customer_id, sum(dp.amount) as total, max(dp.created_at) as last_at
      from public.debt_payments dp
      where dp.business_id = p_business_id and dp.voided_at is null
      group by dp.customer_id) p on p.customer_id = c.id
    -- hutang tertua yang belum tertutup pembayaran (urutan FIFO)
    left join lateral (
      select x.created_at, x.due_date
      from (
        select cd.created_at, cd.due_date,
               sum(cd.amount) over (order by cd.created_at, cd.id) as running
        from public.customer_debts cd
        where cd.customer_id = c.id and cd.voided_at is null) x
      where x.running > coalesce(p.total, 0)
      order by x.created_at
      limit 1) o on true
    where c.business_id = p_business_id and (p_include_inactive or c.is_active)
  ), '[]'::jsonb);
end;
$$;

create or replace function public.get_customer(p_business_id uuid, p_customer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_member(p_business_id);
  if not exists (select 1 from public.customers c where c.id = p_customer_id and c.business_id = p_business_id) then
    perform private.fail('Pelanggan tidak ditemukan.', 'PT404');
  end if;
  return private.customer_json(p_customer_id) || jsonb_build_object(
    'entries', coalesce((
      select jsonb_agg(e.obj order by e.created_at desc, e.kind desc)
      from (
        select d.created_at, 'debt' as kind, jsonb_build_object(
          'id', d.id, 'kind', 'debt', 'amount', d.amount, 'created_at', d.created_at,
          'due_date', d.due_date, 'note', d.note, 'sale_id', d.sale_id, 'sale_number', sa.number,
          'items', case when sa.id is null then null else (
            select jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'unit', i.unit) order by i.position)
            from public.sale_items i where i.sale_id = sa.id) end,
          'voided_at', d.voided_at, 'void_reason', d.void_reason) as obj
        from public.customer_debts d
        left join public.sales sa on sa.id = d.sale_id
        where d.customer_id = p_customer_id
        union all
        select p.created_at, 'payment', jsonb_build_object(
          'id', p.id, 'kind', 'payment', 'amount', p.amount, 'created_at', p.created_at,
          'method_code', p.method_code, 'method_name', p.method_name, 'note', p.note,
          'created_by_name', p.created_by_name, 'voided_at', p.voided_at, 'void_reason', p.void_reason)
        from public.debt_payments p
        where p.customer_id = p_customer_id
      ) e
    ), '[]'::jsonb));
end;
$$;

create or replace function public.upsert_customer(p_business_id uuid, p_customer jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role  text := private.assert_member(p_business_id);
  v_id    uuid := private.uuid_val(p_customer, 'id');
  v_name  text := left(private.txt(p_customer, 'name'), 80);
  v_phone text := left(private.txt(p_customer, 'phone'), 30);
  v_note  text := left(private.txt(p_customer, 'note'), 200);
begin
  if v_name is null then
    perform private.fail('Nama pelanggan wajib diisi.');
  end if;
  if v_id is null then
    if (select count(*) from public.customers c where c.business_id = p_business_id) >= 5000 then
      perform private.fail('Maksimal 5000 pelanggan per usaha.');
    end if;
    insert into public.customers (business_id, name, phone, note)
    values (p_business_id, v_name, v_phone, v_note)
    returning id into v_id;
    perform private.log(p_business_id, 'customer.create', 'customer', v_id, jsonb_build_object('name', v_name));
  else
    if v_role <> 'owner' then
      perform private.fail('Hanya pemilik usaha yang bisa mengubah data pelanggan.', 'PT403');
    end if;
    update public.customers c set name = v_name, phone = v_phone, note = v_note
    where c.id = v_id and c.business_id = p_business_id;
    if not found then
      perform private.fail('Pelanggan tidak ditemukan.', 'PT404');
    end if;
  end if;
  return private.customer_json(v_id);
end;
$$;

create or replace function public.set_customer_active(p_business_id uuid, p_customer_id uuid, p_is_active boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_owner(p_business_id);
  if not coalesce(p_is_active, true) and private.customer_balance(p_customer_id) <> 0 then
    perform private.fail('Pelanggan ini masih punya saldo hutang. Selesaikan dulu sebelum diarsipkan.', 'PT409');
  end if;
  update public.customers c set is_active = coalesce(p_is_active, true)
  where c.id = p_customer_id and c.business_id = p_business_id;
  if not found then
    perform private.fail('Pelanggan tidak ditemukan.', 'PT404');
  end if;
  return private.customer_json(p_customer_id);
end;
$$;

create or replace function public.record_debt_payment(
  p_business_id uuid, p_customer_id uuid, p_amount numeric, p_method_code text,
  p_note text default null, p_client_ref uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_method  public.payment_methods;
  v_amount  numeric := round(p_amount, 2);
  v_balance numeric;
  v_id      uuid;
begin
  perform private.assert_member(p_business_id);
  perform 1 from public.businesses b where b.id = p_business_id for update;
  if p_client_ref is not null and exists (
      select 1 from public.debt_payments dp where dp.business_id = p_business_id and dp.client_ref = p_client_ref) then
    return public.get_customer(p_business_id, p_customer_id);
  end if;
  if not exists (select 1 from public.customers c where c.id = p_customer_id and c.business_id = p_business_id) then
    perform private.fail('Pelanggan tidak ditemukan.', 'PT404');
  end if;
  if v_amount is null or v_amount <= 0 then
    perform private.fail('Jumlah pembayaran harus lebih dari 0.');
  end if;
  v_method := private.payment_method(p_business_id, p_method_code, false);
  v_balance := private.customer_balance(p_customer_id);
  if v_balance <= 0 then
    perform private.fail('Pelanggan ini tidak punya hutang.', 'PT409');
  end if;
  if v_amount > v_balance then
    perform private.fail('Pembayaran melebihi sisa hutang.');
  end if;

  insert into public.debt_payments (business_id, customer_id, amount, method_code, method_name, note, client_ref,
                                    created_by, created_by_name)
  values (p_business_id, p_customer_id, v_amount, v_method.code, v_method.name, left(nullif(btrim(p_note), ''), 200),
          p_client_ref, auth.uid(), private.actor_name(p_business_id))
  returning id into v_id;

  perform private.log(p_business_id, 'debt.payment', 'customer', p_customer_id, jsonb_build_object(
    'payment_id', v_id, 'amount', v_amount, 'method', v_method.code, 'balance_after', v_balance - v_amount));
  return public.get_customer(p_business_id, p_customer_id);
end;
$$;

-- Hutang manual, misalnya hutang lama sebelum pakai Possir
create or replace function public.add_customer_debt(
  p_business_id uuid, p_customer_id uuid, p_amount numeric,
  p_note text default null, p_due_date date default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_amount numeric := round(p_amount, 2);
  v_id     uuid;
begin
  perform private.assert_owner(p_business_id);
  if not exists (select 1 from public.customers c where c.id = p_customer_id and c.business_id = p_business_id) then
    perform private.fail('Pelanggan tidak ditemukan.', 'PT404');
  end if;
  if v_amount is null or v_amount <= 0 then
    perform private.fail('Jumlah hutang harus lebih dari 0.');
  end if;
  insert into public.customer_debts (business_id, customer_id, amount, due_date, note, created_by)
  values (p_business_id, p_customer_id, v_amount, p_due_date, left(nullif(btrim(p_note), ''), 200), auth.uid())
  returning id into v_id;
  perform private.log(p_business_id, 'debt.manual', 'customer', p_customer_id,
                      jsonb_build_object('debt_id', v_id, 'amount', v_amount));
  return public.get_customer(p_business_id, p_customer_id);
end;
$$;

create or replace function public.void_debt_payment(p_business_id uuid, p_payment_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pay    public.debt_payments;
  v_reason text := left(nullif(btrim(p_reason), ''), 200);
begin
  perform private.assert_owner(p_business_id);
  if v_reason is null then
    perform private.fail('Tulis alasan pembatalan dulu.');
  end if;
  select * into v_pay from public.debt_payments dp
  where dp.id = p_payment_id and dp.business_id = p_business_id
  for update;
  if not found then
    perform private.fail('Pembayaran tidak ditemukan.', 'PT404');
  end if;
  if v_pay.voided_at is not null then
    perform private.fail('Pembayaran ini sudah dibatalkan.', 'PT409');
  end if;
  update public.debt_payments dp set voided_at = now(), voided_by = auth.uid(), void_reason = v_reason
  where dp.id = p_payment_id;
  perform private.log(p_business_id, 'debt.payment_void', 'customer', v_pay.customer_id,
                      jsonb_build_object('payment_id', p_payment_id, 'amount', v_pay.amount, 'reason', v_reason));
  return public.get_customer(p_business_id, v_pay.customer_id);
end;
$$;

create or replace function public.void_customer_debt(p_business_id uuid, p_debt_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_debt   public.customer_debts;
  v_reason text := left(nullif(btrim(p_reason), ''), 200);
begin
  perform private.assert_owner(p_business_id);
  if v_reason is null then
    perform private.fail('Tulis alasan pembatalan dulu.');
  end if;
  select * into v_debt from public.customer_debts d
  where d.id = p_debt_id and d.business_id = p_business_id
  for update;
  if not found then
    perform private.fail('Catatan hutang tidak ditemukan.', 'PT404');
  end if;
  if v_debt.sale_id is not null then
    perform private.fail('Hutang ini berasal dari transaksi. Batalkan transaksinya dari Riwayat Transaksi.', 'PT409');
  end if;
  if v_debt.voided_at is not null then
    perform private.fail('Catatan hutang ini sudah dibatalkan.', 'PT409');
  end if;
  update public.customer_debts d set voided_at = now(), voided_by = auth.uid(), void_reason = v_reason
  where d.id = p_debt_id;
  perform private.log(p_business_id, 'debt.void', 'customer', v_debt.customer_id,
                      jsonb_build_object('debt_id', p_debt_id, 'amount', v_debt.amount, 'reason', v_reason));
  return public.get_customer(p_business_id, v_debt.customer_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 7. Penjualan
-- ---------------------------------------------------------------------
-- p_sale:
-- {
--   "client_ref": "uuid dari HP (idempotensi)",
--   "items": [ { "product_id": "uuid", "qty": 2, "unit_price": 50 } ,
--              { "name": "Nasi Ayam", "qty": 1, "unit_price": 80, "unit_cost": 45 } ],   -- jual cepat
--   "discount": 10,
--   "payment_method": "cash" | "instapay" | "hutang" | ...,
--   "cash_received": 200,                      -- opsional, untuk kembalian
--   "customer_id": "uuid" | "new_customer": { "name": "...", "phone": "..." },
--   "down_payment": 50, "down_payment_method": "cash",   -- hanya untuk hutang
--   "due_date": "2026-10-01",                  -- hanya untuk hutang
--   "note": "..."
-- }
create or replace function public.create_sale(p_business_id uuid, p_sale jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role        text := private.assert_member(p_business_id);
  v_uid         uuid := auth.uid();
  v_actor       text := private.actor_name(p_business_id);
  v_client_ref  uuid := private.uuid_val(p_sale, 'client_ref');
  v_items       jsonb := p_sale -> 'items';
  v_item        jsonb;
  v_lines       jsonb := '[]'::jsonb;
  v_pos         integer := 0;
  v_product     public.products;
  v_pid         uuid;
  v_name        text;
  v_unit        text;
  v_qty         numeric;
  v_price       numeric;
  v_cost        numeric;
  v_track       boolean;
  v_subtotal    numeric := 0;
  v_cost_total  numeric := 0;
  v_discount    numeric := round(coalesce(private.num(p_sale, 'discount'), 0), 2);
  v_total       numeric;
  v_method      public.payment_methods;
  v_dp          numeric := round(coalesce(private.num(p_sale, 'down_payment'), 0), 2);
  v_dp_method   public.payment_methods;
  v_customer_id uuid := private.uuid_val(p_sale, 'customer_id');
  v_new_cust    jsonb := p_sale -> 'new_customer';
  v_due         date := private.date_val(p_sale, 'due_date');
  v_cash        numeric := round(private.num(p_sale, 'cash_received'), 2);
  v_note        text := left(private.txt(p_sale, 'note'), 300);
  v_paid        numeric;
  v_debt        numeric;
  v_number      integer;
  v_sale_id     uuid;
begin
  -- semua perubahan stok satu usaha diantrikan lewat kunci baris usaha
  perform 1 from public.businesses b where b.id = p_business_id for update;

  if v_client_ref is not null then
    select sa.id into v_sale_id from public.sales sa
    where sa.business_id = p_business_id and sa.client_ref = v_client_ref;
    if v_sale_id is not null then
      return private.sale_json(v_sale_id, v_role = 'owner');
    end if;
  end if;

  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    perform private.fail('Keranjang masih kosong.');
  end if;
  if jsonb_array_length(v_items) > 200 then
    perform private.fail('Maksimal 200 baris item per transaksi.');
  end if;

  v_method := private.payment_method(p_business_id, private.txt(p_sale, 'payment_method'), true);

  for v_item in select e.value from jsonb_array_elements(v_items) e loop
    v_pos := v_pos + 1;
    if jsonb_typeof(v_item) <> 'object' then
      perform private.fail('Format item tidak valid.');
    end if;
    v_qty := private.num(v_item, 'qty');
    if v_qty is null or v_qty <= 0 then
      perform private.fail('Jumlah item harus lebih dari 0.');
    end if;
    if v_qty > 100000 then
      perform private.fail('Jumlah item terlalu besar.');
    end if;
    v_qty := round(v_qty, 3);
    v_pid := private.uuid_val(v_item, 'product_id');
    v_track := false;

    if v_pid is not null then
      select * into v_product from public.products p
      where p.id = v_pid and p.business_id = p_business_id;
      if not found then
        perform private.fail('Ada produk yang sudah tidak ada. Muat ulang halaman kasir.', 'PT404');
      end if;
      if not v_product.is_active then
        perform private.fail(format('%s sudah diarsipkan.', v_product.name));
      end if;
      v_name  := v_product.name;
      v_unit  := v_product.unit;
      v_price := coalesce(private.num(v_item, 'unit_price'), v_product.price);
      v_cost  := v_product.cost_price;
      v_track := v_product.track_stock;
    else
      v_name := left(private.txt(v_item, 'name'), 80);
      if v_name is null then
        perform private.fail('Nama item jual cepat wajib diisi.');
      end if;
      v_unit  := coalesce(left(private.txt(v_item, 'unit'), 20), 'pcs');
      v_price := private.num(v_item, 'unit_price');
      if v_price is null then
        perform private.fail(format('Harga %s wajib diisi.', v_name));
      end if;
      v_cost := coalesce(private.num(v_item, 'unit_cost'), 0);
    end if;

    if v_price < 0 or v_cost < 0 then
      perform private.fail('Harga tidak boleh negatif.');
    end if;
    v_price := round(v_price, 2);
    v_cost  := round(v_cost, 2);

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_pid, 'name', v_name, 'unit', v_unit, 'qty', v_qty,
      'unit_price', v_price, 'unit_cost', v_cost,
      'line_total', round(v_qty * v_price, 2), 'line_cost', round(v_qty * v_cost, 2),
      'position', v_pos, 'track', v_track));
    v_subtotal   := v_subtotal + round(v_qty * v_price, 2);
    v_cost_total := v_cost_total + round(v_qty * v_cost, 2);
  end loop;

  if v_discount < 0 then
    perform private.fail('Diskon tidak boleh negatif.');
  end if;
  if v_discount > v_subtotal then
    perform private.fail('Diskon tidak boleh melebihi subtotal.');
  end if;
  v_total := v_subtotal - v_discount;

  if v_customer_id is not null then
    if not exists (select 1 from public.customers c where c.id = v_customer_id and c.business_id = p_business_id) then
      perform private.fail('Pelanggan tidak ditemukan.', 'PT404');
    end if;
  elsif jsonb_typeof(v_new_cust) = 'object' and private.txt(v_new_cust, 'name') is not null then
    insert into public.customers (business_id, name, phone)
    values (p_business_id, left(private.txt(v_new_cust, 'name'), 80), left(private.txt(v_new_cust, 'phone'), 30))
    returning id into v_customer_id;
  end if;

  if v_method.kind = 'debt' then
    if v_customer_id is null then
      perform private.fail('Pilih pelanggan untuk transaksi hutang.');
    end if;
    if v_total <= 0 then
      perform private.fail('Transaksi dengan total 0 tidak bisa dicatat sebagai hutang.');
    end if;
    if v_dp < 0 then
      perform private.fail('Uang muka tidak boleh negatif.');
    end if;
    if v_dp >= v_total then
      perform private.fail('Uang muka sama dengan total. Pilih metode bayar biasa saja.');
    end if;
    if v_dp > 0 then
      v_dp_method := private.payment_method(
        p_business_id, coalesce(private.txt(p_sale, 'down_payment_method'), 'cash'), false);
    end if;
    v_paid := v_dp;
    v_debt := v_total - v_dp;
    v_cash := null;
  else
    v_paid := v_total;
    v_debt := 0;
    v_due  := null;
    if v_cash is not null then
      if v_method.kind <> 'cash' then
        v_cash := null;
      elsif v_cash < v_total then
        perform private.fail('Uang yang diterima kurang dari total belanja.');
      end if;
    end if;
  end if;

  update public.businesses b set sale_counter = b.sale_counter + 1
  where b.id = p_business_id
  returning b.sale_counter into v_number;

  insert into public.sales (business_id, number, client_ref, customer_id, payment_method_code, payment_method_name,
                            subtotal, discount, total, cost_total, paid_amount, debt_amount, cash_received, note,
                            cashier_id, cashier_name)
  values (p_business_id, v_number, v_client_ref, v_customer_id, v_method.code, v_method.name,
          v_subtotal, v_discount, v_total, v_cost_total, v_paid, v_debt, v_cash, v_note,
          v_uid, v_actor)
  returning id into v_sale_id;

  insert into public.sale_items (sale_id, business_id, product_id, name, unit, qty, unit_price, unit_cost,
                                 line_total, line_cost, position)
  select v_sale_id, p_business_id, (l ->> 'product_id')::uuid, l ->> 'name', l ->> 'unit',
         (l ->> 'qty')::numeric, (l ->> 'unit_price')::numeric, (l ->> 'unit_cost')::numeric,
         (l ->> 'line_total')::numeric, (l ->> 'line_cost')::numeric, (l ->> 'position')::smallint
  from jsonb_array_elements(v_lines) l;

  if v_method.kind = 'debt' then
    if v_dp > 0 then
      insert into public.sale_payments (sale_id, business_id, method_code, method_name, method_kind, amount)
      values (v_sale_id, p_business_id, v_dp_method.code, v_dp_method.name, v_dp_method.kind, v_dp);
    end if;
    insert into public.sale_payments (sale_id, business_id, method_code, method_name, method_kind, amount)
    values (v_sale_id, p_business_id, v_method.code, v_method.name, 'debt', v_debt);
    insert into public.customer_debts (business_id, customer_id, sale_id, amount, due_date, created_by)
    values (p_business_id, v_customer_id, v_sale_id, v_debt, v_due, v_uid);
  elsif v_total > 0 then
    insert into public.sale_payments (sale_id, business_id, method_code, method_name, method_kind, amount)
    values (v_sale_id, p_business_id, v_method.code, v_method.name, v_method.kind, v_total);
  end if;

  -- kurangi stok produk yang dilacak (boleh minus: penjualan nyata tetap tercatat)
  with agg as (
    select (l ->> 'product_id')::uuid as product_id, sum((l ->> 'qty')::numeric) as qty
    from jsonb_array_elements(v_lines) l
    where (l ->> 'track')::boolean
    group by 1
  ), upd as (
    update public.products p set stock = p.stock - agg.qty
    from agg
    where p.id = agg.product_id
    returning p.id, p.stock, agg.qty, p.cost_price
  )
  insert into public.stock_movements (business_id, product_id, type, qty_change, qty_after, unit_cost, sale_id,
                                      created_by, created_by_name)
  select p_business_id, upd.id, 'sale', -upd.qty, upd.stock, upd.cost_price, v_sale_id, v_uid, v_actor
  from upd;

  return private.sale_json(v_sale_id, v_role = 'owner');
end;
$$;

-- Void, bukan hapus: data tetap ada untuk jejak audit, stok dan piutang dikembalikan
create or replace function public.void_sale(p_business_id uuid, p_sale_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sale   public.sales;
  v_reason text := left(nullif(btrim(p_reason), ''), 200);
  v_uid    uuid := auth.uid();
  v_actor  text;
begin
  perform private.assert_owner(p_business_id);
  v_actor := private.actor_name(p_business_id);
  if v_reason is null then
    perform private.fail('Tulis alasan pembatalan dulu.');
  end if;
  perform 1 from public.businesses b where b.id = p_business_id for update;
  select * into v_sale from public.sales sa
  where sa.id = p_sale_id and sa.business_id = p_business_id
  for update;
  if not found then
    perform private.fail('Transaksi tidak ditemukan.', 'PT404');
  end if;
  if v_sale.status = 'void' then
    perform private.fail('Transaksi ini sudah dibatalkan.', 'PT409');
  end if;

  update public.sales sa set
    status = 'void', voided_at = now(), voided_by = v_uid, voided_by_name = v_actor, void_reason = v_reason
  where sa.id = p_sale_id;

  with mv as (
    select m.product_id, sum(-m.qty_change) as qty
    from public.stock_movements m
    where m.sale_id = p_sale_id and m.type = 'sale'
    group by m.product_id
  ), upd as (
    update public.products p set stock = p.stock + mv.qty
    from mv
    where p.id = mv.product_id
    returning p.id, p.stock, mv.qty, p.cost_price
  )
  insert into public.stock_movements (business_id, product_id, type, qty_change, qty_after, unit_cost, sale_id,
                                      note, created_by, created_by_name)
  select p_business_id, upd.id, 'sale_void', upd.qty, upd.stock, upd.cost_price, p_sale_id,
         v_reason, v_uid, v_actor
  from upd;

  update public.customer_debts d set
    voided_at = now(), voided_by = v_uid,
    void_reason = format('Transaksi #%s dibatalkan: %s', v_sale.number, v_reason)
  where d.sale_id = p_sale_id and d.voided_at is null;

  perform private.log(p_business_id, 'sale.void', 'sale', p_sale_id, jsonb_build_object(
    'number', v_sale.number, 'total', v_sale.total, 'reason', v_reason));
  return private.sale_json(p_sale_id, true);
end;
$$;

create or replace function public.get_sale(p_business_id uuid, p_sale_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role    text := private.assert_member(p_business_id);
  v_cashier uuid;
begin
  select sa.cashier_id into v_cashier from public.sales sa
  where sa.id = p_sale_id and sa.business_id = p_business_id;
  if not found then
    perform private.fail('Transaksi tidak ditemukan.', 'PT404');
  end if;
  if v_role <> 'owner' and v_cashier is distinct from auth.uid() then
    perform private.fail('Kasir hanya bisa melihat transaksinya sendiri.', 'PT403');
  end if;
  return private.sale_json(p_sale_id, v_role = 'owner');
end;
$$;

-- p_status: null/'all', 'completed', 'paid' (lunas), 'debt' (ada hutang), 'void'
create or replace function public.list_sales(
  p_business_id uuid, p_from date default null, p_to date default null,
  p_status text default null, p_customer_id uuid default null, p_limit integer default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner boolean := private.assert_member(p_business_id) = 'owner';
  v_uid   uuid := auth.uid();
  v_tz    text := private.business_tz(p_business_id);
  v_start timestamptz := case when p_from is null then '-infinity'::timestamptz else private.day_start(p_from, v_tz) end;
  v_end   timestamptz := case when p_to is null then 'infinity'::timestamptz else private.day_start(p_to + 1, v_tz) end;
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 500);
  v_rows  jsonb;
  v_count bigint;
begin
  select coalesce(jsonb_agg(x.obj order by x.created_at desc), '[]'::jsonb), coalesce(max(x.total_count), 0)
  into v_rows, v_count
  from (
    select sa.created_at, count(*) over () as total_count, jsonb_build_object(
      'id', sa.id, 'number', sa.number, 'status', sa.status, 'created_at', sa.created_at,
      'total', sa.total, 'discount', sa.discount, 'paid_amount', sa.paid_amount, 'debt_amount', sa.debt_amount,
      'payment_method_code', sa.payment_method_code, 'payment_method_name', sa.payment_method_name,
      'customer_id', sa.customer_id, 'customer_name', c.name, 'cashier_name', sa.cashier_name,
      'void_reason', sa.void_reason,
      'items', (select jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'unit', i.unit) order by i.position)
                from public.sale_items i where i.sale_id = sa.id)) as obj
    from public.sales sa
    left join public.customers c on c.id = sa.customer_id
    where sa.business_id = p_business_id
      and sa.created_at >= v_start and sa.created_at < v_end
      and (v_owner or sa.cashier_id = v_uid)
      and (p_customer_id is null or sa.customer_id = p_customer_id)
      and (p_status is null or p_status = 'all'
           or (p_status = 'completed' and sa.status = 'completed')
           or (p_status = 'paid' and sa.status = 'completed' and sa.debt_amount = 0)
           or (p_status = 'debt' and sa.status = 'completed' and sa.debt_amount > 0)
           or (p_status = 'void' and sa.status = 'void'))
    order by sa.created_at desc
    limit v_limit
  ) x;
  return jsonb_build_object('items', v_rows, 'total_count', v_count, 'limit', v_limit);
end;
$$;

-- ---------------------------------------------------------------------
-- 8. Pengeluaran
-- ---------------------------------------------------------------------
create or replace function public.list_expenses(p_business_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_owner(p_business_id);
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 366 then
    perform private.fail('Rentang tanggal tidak valid.');
  end if;
  return jsonb_build_object(
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', e.id, 'category', e.category, 'amount', e.amount, 'note', e.note, 'spent_on', e.spent_on,
        'method_code', e.method_code, 'method_name', e.method_name, 'created_by_name', e.created_by_name,
        'created_at', e.created_at) order by e.spent_on desc, e.created_at desc)
      from public.expenses e
      where e.business_id = p_business_id and e.voided_at is null and e.spent_on between p_from and p_to
    ), '[]'::jsonb),
    'total', (select coalesce(sum(e.amount), 0) from public.expenses e
              where e.business_id = p_business_id and e.voided_at is null and e.spent_on between p_from and p_to),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', x.category, 'amount', x.amount, 'count', x.cnt)
                       order by x.amount desc)
      from (select e.category, sum(e.amount) as amount, count(*) as cnt
            from public.expenses e
            where e.business_id = p_business_id and e.voided_at is null and e.spent_on between p_from and p_to
            group by e.category) x
    ), '[]'::jsonb));
end;
$$;

-- Buat baru (tanpa id) atau ubah (dengan id)
create or replace function public.save_expense(p_business_id uuid, p_expense jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id       uuid := private.uuid_val(p_expense, 'id');
  v_ref      uuid := private.uuid_val(p_expense, 'client_ref');
  v_category text := left(private.txt(p_expense, 'category'), 40);
  v_amount   numeric := round(private.num(p_expense, 'amount'), 2);
  v_note     text := left(private.txt(p_expense, 'note'), 200);
  v_date     date := private.date_val(p_expense, 'spent_on');
  v_code     text := private.txt(p_expense, 'method_code');
  v_method   public.payment_methods;
  v_today    date;
begin
  perform private.assert_owner(p_business_id);
  v_today := private.local_today(private.business_tz(p_business_id));
  if v_category is null then
    perform private.fail('Pilih kategori pengeluaran.');
  end if;
  if v_amount is null or v_amount <= 0 then
    perform private.fail('Jumlah pengeluaran harus lebih dari 0.');
  end if;
  v_date := coalesce(v_date, v_today);
  if v_date > v_today + 1 then
    perform private.fail('Tanggal pengeluaran tidak boleh di masa depan.');
  end if;
  if v_code is not null then
    v_method := private.payment_method(p_business_id, v_code, false);
  end if;

  if v_id is null then
    if v_ref is not null then
      select e.id into v_id from public.expenses e where e.business_id = p_business_id and e.client_ref = v_ref;
      if v_id is not null then
        return private.expense_json(v_id);
      end if;
    end if;
    insert into public.expenses (business_id, category, amount, note, spent_on, method_code, method_name, client_ref,
                                 created_by, created_by_name)
    values (p_business_id, v_category, v_amount, v_note, v_date, v_method.code, v_method.name, v_ref,
            auth.uid(), private.actor_name(p_business_id))
    returning id into v_id;
    perform private.log(p_business_id, 'expense.create', 'expense', v_id,
                        jsonb_build_object('category', v_category, 'amount', v_amount));
  else
    update public.expenses e set
      category = v_category, amount = v_amount, note = v_note, spent_on = v_date,
      method_code = v_method.code, method_name = v_method.name
    where e.id = v_id and e.business_id = p_business_id and e.voided_at is null;
    if not found then
      perform private.fail('Pengeluaran tidak ditemukan.', 'PT404');
    end if;
    perform private.log(p_business_id, 'expense.update', 'expense', v_id,
                        jsonb_build_object('category', v_category, 'amount', v_amount));
  end if;
  return private.expense_json(v_id);
end;
$$;

create or replace function public.void_expense(p_business_id uuid, p_expense_id uuid, p_reason text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_exp public.expenses;
begin
  perform private.assert_owner(p_business_id);
  select * into v_exp from public.expenses e
  where e.id = p_expense_id and e.business_id = p_business_id
  for update;
  if not found then
    perform private.fail('Pengeluaran tidak ditemukan.', 'PT404');
  end if;
  if v_exp.voided_at is not null then
    perform private.fail('Pengeluaran ini sudah dihapus.', 'PT409');
  end if;
  update public.expenses e set voided_at = now(), voided_by = auth.uid(),
    void_reason = coalesce(left(nullif(btrim(p_reason), ''), 200), 'Dihapus')
  where e.id = p_expense_id;
  perform private.log(p_business_id, 'expense.void', 'expense', p_expense_id,
                      jsonb_build_object('category', v_exp.category, 'amount', v_exp.amount));
  return jsonb_build_object('id', p_expense_id, 'voided', true);
end;
$$;

-- ---------------------------------------------------------------------
-- 9. Supplier dan pembelian (restock)
-- ---------------------------------------------------------------------
create or replace function public.list_suppliers(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_owner(p_business_id);
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', s.id, 'name', s.name, 'phone', s.phone, 'note', s.note, 'is_active', s.is_active,
      'created_at', s.created_at,
      'total_purchases', coalesce(pu.total, 0), 'purchase_count', coalesce(pu.cnt, 0),
      'last_purchase_on', pu.last_on,
      'balance', coalesce(pu.debt, 0) - coalesce(sp.total, 0))
      order by s.name)
    from public.suppliers s
    left join (
      select p.supplier_id, sum(p.total) as total, count(*) as cnt, max(p.purchased_on) as last_on,
             sum(p.debt_amount) as debt
      from public.purchases p
      where p.business_id = p_business_id and p.status = 'completed'
      group by p.supplier_id) pu on pu.supplier_id = s.id
    left join (
      select x.supplier_id, sum(x.amount) as total
      from public.supplier_payments x
      where x.business_id = p_business_id and x.voided_at is null
      group by x.supplier_id) sp on sp.supplier_id = s.id
    where s.business_id = p_business_id and s.is_active
  ), '[]'::jsonb);
end;
$$;

create or replace function public.upsert_supplier(p_business_id uuid, p_supplier jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id    uuid := private.uuid_val(p_supplier, 'id');
  v_name  text := left(private.txt(p_supplier, 'name'), 80);
  v_phone text := left(private.txt(p_supplier, 'phone'), 30);
  v_note  text := left(private.txt(p_supplier, 'note'), 200);
begin
  perform private.assert_owner(p_business_id);
  if v_name is null then
    perform private.fail('Nama supplier wajib diisi.');
  end if;
  if v_id is null then
    insert into public.suppliers (business_id, name, phone, note)
    values (p_business_id, v_name, v_phone, v_note)
    returning id into v_id;
  else
    update public.suppliers s set name = v_name, phone = v_phone, note = v_note
    where s.id = v_id and s.business_id = p_business_id;
    if not found then
      perform private.fail('Supplier tidak ditemukan.', 'PT404');
    end if;
  end if;
  return (select jsonb_build_object('id', s.id, 'name', s.name, 'phone', s.phone, 'note', s.note,
                                    'balance', private.supplier_balance(s.id))
          from public.suppliers s where s.id = v_id);
end;
$$;

create or replace function public.get_supplier(p_business_id uuid, p_supplier_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_owner(p_business_id);
  if not exists (select 1 from public.suppliers s where s.id = p_supplier_id and s.business_id = p_business_id) then
    perform private.fail('Supplier tidak ditemukan.', 'PT404');
  end if;
  return (
    select jsonb_build_object(
      'id', s.id, 'name', s.name, 'phone', s.phone, 'note', s.note, 'created_at', s.created_at,
      'balance', private.supplier_balance(s.id),
      'total_purchases', coalesce((select sum(p.total) from public.purchases p
                                   where p.supplier_id = s.id and p.status = 'completed'), 0),
      'purchases', coalesce((
        select jsonb_agg(private.purchase_json(p.id) order by p.purchased_on desc, p.created_at desc)
        from (select p2.id, p2.purchased_on, p2.created_at from public.purchases p2
              where p2.supplier_id = s.id order by p2.purchased_on desc, p2.created_at desc limit 100) p
      ), '[]'::jsonb),
      'payments', coalesce((
        select jsonb_agg(jsonb_build_object(
          'id', sp.id, 'amount', sp.amount, 'method_code', sp.method_code, 'method_name', sp.method_name,
          'note', sp.note, 'created_by_name', sp.created_by_name, 'created_at', sp.created_at,
          'voided_at', sp.voided_at) order by sp.created_at desc)
        from public.supplier_payments sp where sp.supplier_id = s.id
      ), '[]'::jsonb))
    from public.suppliers s
    where s.id = p_supplier_id);
end;
$$;

-- p_purchase:
-- { "client_ref", "supplier_id" | "new_supplier": {name, phone},
--   "items": [ { "product_id", "qty", "unit_cost" } ],
--   "paid_amount" (default = total), "method_code" (default cash),
--   "purchased_on", "note", "update_cost" (default true) }
create or replace function public.create_purchase(p_business_id uuid, p_purchase jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_actor       text;
  v_client_ref  uuid := private.uuid_val(p_purchase, 'client_ref');
  v_items       jsonb := p_purchase -> 'items';
  v_item        jsonb;
  v_lines       jsonb := '[]'::jsonb;
  v_pos         integer := 0;
  v_product     public.products;
  v_pid         uuid;
  v_qty         numeric;
  v_cost        numeric;
  v_total       numeric := 0;
  v_paid        numeric;
  v_method      public.payment_methods;
  v_supplier_id uuid := private.uuid_val(p_purchase, 'supplier_id');
  v_new_sup     jsonb := p_purchase -> 'new_supplier';
  v_date        date := private.date_val(p_purchase, 'purchased_on');
  v_update_cost boolean := private.bool_val(p_purchase, 'update_cost', true);
  v_today       date;
  v_number      integer;
  v_id          uuid;
begin
  perform private.assert_owner(p_business_id);
  v_actor := private.actor_name(p_business_id);
  v_today := private.local_today(private.business_tz(p_business_id));
  perform 1 from public.businesses b where b.id = p_business_id for update;

  if v_client_ref is not null then
    select pu.id into v_id from public.purchases pu
    where pu.business_id = p_business_id and pu.client_ref = v_client_ref;
    if v_id is not null then
      return private.purchase_json(v_id);
    end if;
  end if;

  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    perform private.fail('Tambahkan minimal satu produk yang dibeli.');
  end if;
  if jsonb_array_length(v_items) > 200 then
    perform private.fail('Maksimal 200 baris per pembelian.');
  end if;

  for v_item in select e.value from jsonb_array_elements(v_items) e loop
    v_pos := v_pos + 1;
    v_pid := private.uuid_val(v_item, 'product_id');
    if v_pid is null then
      perform private.fail('Pilih produk untuk setiap baris pembelian.');
    end if;
    select * into v_product from public.products p
    where p.id = v_pid and p.business_id = p_business_id;
    if not found then
      perform private.fail('Produk tidak ditemukan.', 'PT404');
    end if;
    v_qty := round(private.num(v_item, 'qty'), 3);
    if v_qty is null or v_qty <= 0 or v_qty > 1000000 then
      perform private.fail(format('Jumlah %s tidak valid.', v_product.name));
    end if;
    v_cost := round(coalesce(private.num(v_item, 'unit_cost'), v_product.cost_price), 2);
    if v_cost < 0 then
      perform private.fail('Harga beli tidak boleh negatif.');
    end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_pid, 'name', v_product.name, 'unit', v_product.unit, 'qty', v_qty,
      'unit_cost', v_cost, 'line_total', round(v_qty * v_cost, 2), 'position', v_pos,
      'track', v_product.track_stock));
    v_total := v_total + round(v_qty * v_cost, 2);
  end loop;

  if v_supplier_id is not null then
    if not exists (select 1 from public.suppliers s where s.id = v_supplier_id and s.business_id = p_business_id) then
      perform private.fail('Supplier tidak ditemukan.', 'PT404');
    end if;
  elsif jsonb_typeof(v_new_sup) = 'object' and private.txt(v_new_sup, 'name') is not null then
    insert into public.suppliers (business_id, name, phone)
    values (p_business_id, left(private.txt(v_new_sup, 'name'), 80), left(private.txt(v_new_sup, 'phone'), 30))
    returning id into v_supplier_id;
  end if;

  v_paid := round(coalesce(private.num(p_purchase, 'paid_amount'), v_total), 2);
  if v_paid < 0 or v_paid > v_total then
    perform private.fail('Jumlah yang dibayar tidak valid.');
  end if;
  if v_paid < v_total and v_supplier_id is null then
    perform private.fail('Pilih supplier untuk mencatat hutang pembelian.');
  end if;
  if v_paid > 0 then
    v_method := private.payment_method(p_business_id, coalesce(private.txt(p_purchase, 'method_code'), 'cash'), false);
  end if;
  v_date := coalesce(v_date, v_today);
  if v_date > v_today + 1 then
    perform private.fail('Tanggal pembelian tidak boleh di masa depan.');
  end if;

  update public.businesses b set purchase_counter = b.purchase_counter + 1
  where b.id = p_business_id
  returning b.purchase_counter into v_number;

  insert into public.purchases (business_id, number, client_ref, supplier_id, total, paid_amount, debt_amount,
                                method_code, method_name, note, purchased_on, created_by, created_by_name)
  values (p_business_id, v_number, v_client_ref, v_supplier_id, v_total, v_paid, v_total - v_paid,
          v_method.code, v_method.name, left(private.txt(p_purchase, 'note'), 300), v_date, v_uid, v_actor)
  returning id into v_id;

  insert into public.purchase_items (purchase_id, business_id, product_id, name, unit, qty, unit_cost, line_total, position)
  select v_id, p_business_id, (l ->> 'product_id')::uuid, l ->> 'name', l ->> 'unit', (l ->> 'qty')::numeric,
         (l ->> 'unit_cost')::numeric, (l ->> 'line_total')::numeric, (l ->> 'position')::smallint
  from jsonb_array_elements(v_lines) l;

  -- stok bertambah untuk produk yang dilacak; harga modal ikut harga beli terakhir
  with agg as (
    select (l ->> 'product_id')::uuid as product_id, sum((l ->> 'qty')::numeric) as qty,
           (array_agg((l ->> 'unit_cost')::numeric order by (l ->> 'position')::integer desc))[1] as last_cost,
           bool_or((l ->> 'track')::boolean) as track
    from jsonb_array_elements(v_lines) l
    group by 1
  ), upd as (
    update public.products p set
      stock = case when agg.track then p.stock + agg.qty else p.stock end,
      cost_price = case when v_update_cost then agg.last_cost else p.cost_price end
    from agg
    where p.id = agg.product_id
    returning p.id, p.stock, agg.qty, agg.last_cost, agg.track
  )
  insert into public.stock_movements (business_id, product_id, type, qty_change, qty_after, unit_cost, purchase_id,
                                      created_by, created_by_name)
  select p_business_id, upd.id, 'purchase', upd.qty, upd.stock, upd.last_cost, v_id, v_uid, v_actor
  from upd
  where upd.track;

  perform private.log(p_business_id, 'purchase.create', 'purchase', v_id,
                      jsonb_build_object('number', v_number, 'total', v_total, 'debt', v_total - v_paid));
  return private.purchase_json(v_id);
end;
$$;

create or replace function public.void_purchase(p_business_id uuid, p_purchase_id uuid, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_pu     public.purchases;
  v_reason text := left(nullif(btrim(p_reason), ''), 200);
  v_uid    uuid := auth.uid();
  v_actor  text;
begin
  perform private.assert_owner(p_business_id);
  v_actor := private.actor_name(p_business_id);
  if v_reason is null then
    perform private.fail('Tulis alasan pembatalan dulu.');
  end if;
  perform 1 from public.businesses b where b.id = p_business_id for update;
  select * into v_pu from public.purchases pu
  where pu.id = p_purchase_id and pu.business_id = p_business_id
  for update;
  if not found then
    perform private.fail('Pembelian tidak ditemukan.', 'PT404');
  end if;
  if v_pu.status = 'void' then
    perform private.fail('Pembelian ini sudah dibatalkan.', 'PT409');
  end if;

  update public.purchases pu set status = 'void', voided_at = now(), voided_by = v_uid, void_reason = v_reason
  where pu.id = p_purchase_id;

  with mv as (
    select m.product_id, sum(m.qty_change) as qty
    from public.stock_movements m
    where m.purchase_id = p_purchase_id and m.type = 'purchase'
    group by m.product_id
  ), upd as (
    update public.products p set stock = p.stock - mv.qty
    from mv
    where p.id = mv.product_id
    returning p.id, p.stock, mv.qty, p.cost_price
  )
  insert into public.stock_movements (business_id, product_id, type, qty_change, qty_after, unit_cost, purchase_id,
                                      note, created_by, created_by_name)
  select p_business_id, upd.id, 'purchase_void', -upd.qty, upd.stock, upd.cost_price, p_purchase_id,
         v_reason, v_uid, v_actor
  from upd;

  perform private.log(p_business_id, 'purchase.void', 'purchase', p_purchase_id,
                      jsonb_build_object('number', v_pu.number, 'total', v_pu.total, 'reason', v_reason));
  return private.purchase_json(p_purchase_id);
end;
$$;

create or replace function public.record_supplier_payment(
  p_business_id uuid, p_supplier_id uuid, p_amount numeric, p_method_code text,
  p_note text default null, p_client_ref uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_method  public.payment_methods;
  v_amount  numeric := round(p_amount, 2);
  v_balance numeric;
begin
  perform private.assert_owner(p_business_id);
  perform 1 from public.businesses b where b.id = p_business_id for update;
  if p_client_ref is not null and exists (
      select 1 from public.supplier_payments sp where sp.business_id = p_business_id and sp.client_ref = p_client_ref) then
    return public.get_supplier(p_business_id, p_supplier_id);
  end if;
  if not exists (select 1 from public.suppliers s where s.id = p_supplier_id and s.business_id = p_business_id) then
    perform private.fail('Supplier tidak ditemukan.', 'PT404');
  end if;
  if v_amount is null or v_amount <= 0 then
    perform private.fail('Jumlah pembayaran harus lebih dari 0.');
  end if;
  v_method := private.payment_method(p_business_id, p_method_code, false);
  v_balance := private.supplier_balance(p_supplier_id);
  if v_balance <= 0 then
    perform private.fail('Tidak ada hutang ke supplier ini.', 'PT409');
  end if;
  if v_amount > v_balance then
    perform private.fail('Pembayaran melebihi sisa hutang ke supplier.');
  end if;
  insert into public.supplier_payments (business_id, supplier_id, amount, method_code, method_name, note, client_ref,
                                        created_by, created_by_name)
  values (p_business_id, p_supplier_id, v_amount, v_method.code, v_method.name, left(nullif(btrim(p_note), ''), 200),
          p_client_ref, auth.uid(), private.actor_name(p_business_id));
  perform private.log(p_business_id, 'supplier.payment', 'supplier', p_supplier_id,
                      jsonb_build_object('amount', v_amount, 'method', v_method.code));
  return public.get_supplier(p_business_id, p_supplier_id);
end;
$$;

create or replace function public.list_purchases(p_business_id uuid, p_from date default null, p_to date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_owner(p_business_id);
  return coalesce((
    select jsonb_agg(x.obj order by x.purchased_on desc, x.created_at desc)
    from (
      select pu.purchased_on, pu.created_at, jsonb_build_object(
        'id', pu.id, 'number', pu.number, 'status', pu.status, 'purchased_on', pu.purchased_on,
        'created_at', pu.created_at, 'supplier_id', pu.supplier_id, 'supplier_name', s.name,
        'total', pu.total, 'paid_amount', pu.paid_amount, 'debt_amount', pu.debt_amount,
        'method_name', pu.method_name, 'note', pu.note, 'void_reason', pu.void_reason,
        'items', (select jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'unit', i.unit,
                                                      'unit_cost', i.unit_cost) order by i.position)
                  from public.purchase_items i where i.purchase_id = pu.id)) as obj
      from public.purchases pu
      left join public.suppliers s on s.id = pu.supplier_id
      where pu.business_id = p_business_id
        and (p_from is null or pu.purchased_on >= p_from)
        and (p_to is null or pu.purchased_on <= p_to)
      order by pu.purchased_on desc, pu.created_at desc
      limit 300
    ) x
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- 10. Dashboard dan laporan
-- ---------------------------------------------------------------------
create or replace function public.get_dashboard(p_business_id uuid, p_date date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role       text := private.assert_member(p_business_id);
  v_owner      boolean := v_role = 'owner';
  v_uid        uuid := auth.uid();
  v_tz         text := private.business_tz(p_business_id);
  v_day        date;
  v_start      timestamptz;
  v_end        timestamptz;
  v_week_start timestamptz;
  v_today      record;
  v_items      numeric;
  v_collected  numeric;
  v_expenses   numeric;
  v_same_time  numeric;
begin
  v_day := coalesce(p_date, private.local_today(v_tz));
  v_start := private.day_start(v_day, v_tz);
  v_end := private.day_start(v_day + 1, v_tz);
  v_week_start := private.day_start(v_day - 6, v_tz);

  -- pembanding yang adil: kemarin sampai jam yang sama dengan sekarang
  select coalesce(sum(sa.total), 0) into v_same_time
  from public.sales sa
  where sa.business_id = p_business_id and sa.status = 'completed'
    and sa.created_at >= private.day_start(v_day - 1, v_tz)
    and sa.created_at < least(now(), v_end) - interval '1 day'
    and (v_owner or sa.cashier_id = v_uid);

  select coalesce(sum(sa.total) filter (where sa.status = 'completed'), 0) as sales,
         coalesce(sum(sa.cost_total) filter (where sa.status = 'completed'), 0) as cost,
         coalesce(sum(sa.discount) filter (where sa.status = 'completed'), 0) as discount,
         coalesce(sum(sa.paid_amount) filter (where sa.status = 'completed'), 0) as paid,
         coalesce(sum(sa.debt_amount) filter (where sa.status = 'completed'), 0) as debt_new,
         count(*) filter (where sa.status = 'completed') as transactions,
         count(*) filter (where sa.status = 'void') as voids
  into v_today
  from public.sales sa
  where sa.business_id = p_business_id and sa.created_at >= v_start and sa.created_at < v_end
    and (v_owner or sa.cashier_id = v_uid);

  select coalesce(sum(i.qty), 0) into v_items
  from public.sale_items i
  join public.sales sa on sa.id = i.sale_id
  where sa.business_id = p_business_id and sa.status = 'completed'
    and sa.created_at >= v_start and sa.created_at < v_end
    and (v_owner or sa.cashier_id = v_uid);

  select coalesce(sum(dp.amount), 0) into v_collected
  from public.debt_payments dp
  where dp.business_id = p_business_id and dp.voided_at is null
    and dp.created_at >= v_start and dp.created_at < v_end
    and (v_owner or dp.created_by = v_uid);

  select coalesce(sum(e.amount), 0) into v_expenses
  from public.expenses e
  where e.business_id = p_business_id and e.voided_at is null and e.spent_on = v_day;

  return jsonb_build_object(
    'date', v_day,
    'role', v_role,
    'today', jsonb_build_object(
      'sales', v_today.sales,
      'cost', case when v_owner then v_today.cost end,
      'gross_profit', case when v_owner then v_today.sales - v_today.cost end,
      'expenses', case when v_owner then v_expenses end,
      'discount', v_today.discount,
      'transactions', v_today.transactions,
      'items_sold', v_items,
      'voids', v_today.voids,
      'debt_new', v_today.debt_new,
      'debt_collected', v_collected,
      'cash_in', v_today.paid + v_collected,
      'sales_same_time_yesterday', v_same_time),
    'cash_in_by_method', coalesce((
      select jsonb_agg(jsonb_build_object('code', x.code, 'name', x.name, 'amount', x.amount) order by x.amount desc)
      from (
        select u.code, max(u.name) as name, sum(u.amount) as amount
        from (
          select sp.method_code as code, sp.method_name as name, sp.amount
          from public.sale_payments sp
          join public.sales sa on sa.id = sp.sale_id
          where sa.business_id = p_business_id and sa.status = 'completed' and sp.method_kind <> 'debt'
            and sa.created_at >= v_start and sa.created_at < v_end
            and (v_owner or sa.cashier_id = v_uid)
          union all
          select dp.method_code, dp.method_name, dp.amount
          from public.debt_payments dp
          where dp.business_id = p_business_id and dp.voided_at is null
            and dp.created_at >= v_start and dp.created_at < v_end
            and (v_owner or dp.created_by = v_uid)
        ) u
        group by u.code
      ) x
    ), '[]'::jsonb),
    'series', (
      select jsonb_agg(jsonb_build_object(
        'date', g.day, 'sales', coalesce(t.sales, 0),
        'gross_profit', case when v_owner then coalesce(t.sales, 0) - coalesce(t.cost, 0) end,
        'transactions', coalesce(t.cnt, 0)) order by g.day)
      from (select v_day - i as day from generate_series(0, 6) as i) g
      left join (
        select (sa.created_at at time zone v_tz)::date as day, sum(sa.total) as sales,
               sum(sa.cost_total) as cost, count(*) as cnt
        from public.sales sa
        where sa.business_id = p_business_id and sa.status = 'completed'
          and sa.created_at >= v_week_start and sa.created_at < v_end
          and (v_owner or sa.cashier_id = v_uid)
        group by 1
      ) t on t.day = g.day),
    'receivables', private.receivables(p_business_id),
    'low_stock', (
      select jsonb_build_object(
        'count', count(*),
        'items', coalesce(jsonb_agg(jsonb_build_object(
                   'id', p.id, 'name', p.name, 'stock', p.stock, 'min_stock', p.min_stock, 'unit', p.unit)
                   order by p.stock - p.min_stock, p.name) filter (where p.rn <= 6), '[]'::jsonb))
      from (
        select p2.*, row_number() over (order by p2.stock - p2.min_stock, p2.name) as rn
        from public.products p2
        where p2.business_id = p_business_id and p2.is_active and p2.track_stock and p2.stock <= p2.min_stock
      ) p),
    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', t.product_id, 'name', t.name, 'unit', t.unit, 'qty', t.qty, 'revenue', t.revenue)
        order by t.qty desc, t.revenue desc)
      from (
        select i.product_id, coalesce(max(p.name), max(i.name)) as name, max(i.unit) as unit,
               sum(i.qty) as qty, sum(i.line_total) as revenue
        from public.sale_items i
        join public.sales sa on sa.id = i.sale_id
        left join public.products p on p.id = i.product_id
        where sa.business_id = p_business_id and sa.status = 'completed'
          and sa.created_at >= v_week_start and sa.created_at < v_end
          and (v_owner or sa.cashier_id = v_uid)
        group by i.product_id, case when i.product_id is null then lower(i.name) end
        order by sum(i.qty) desc, sum(i.line_total) desc
        limit 5
      ) t
    ), '[]'::jsonb),
    'recent_sales', coalesce((
      select jsonb_agg(x.obj order by x.created_at desc)
      from (
        select sa.created_at, jsonb_build_object(
          'id', sa.id, 'number', sa.number, 'status', sa.status, 'created_at', sa.created_at,
          'total', sa.total, 'debt_amount', sa.debt_amount, 'payment_method_name', sa.payment_method_name,
          'payment_method_code', sa.payment_method_code, 'customer_name', c.name,
          'items', (select jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'unit', i.unit)
                                     order by i.position)
                    from public.sale_items i where i.sale_id = sa.id)) as obj
        from public.sales sa
        left join public.customers c on c.id = sa.customer_id
        where sa.business_id = p_business_id and (v_owner or sa.cashier_id = v_uid)
        order by sa.created_at desc
        limit 6
      ) x
    ), '[]'::jsonb));
end;
$$;

create or replace function public.get_report(p_business_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz          text;
  v_start       timestamptz;
  v_end         timestamptz;
  v_sales       record;
  v_items_sold  numeric;
  v_expenses    numeric;
  v_debt_manual numeric;
  v_collected   numeric;
  v_purchases   numeric;
begin
  perform private.assert_owner(p_business_id);
  if p_from is null or p_to is null or p_to < p_from then
    perform private.fail('Rentang tanggal tidak valid.');
  end if;
  if p_to - p_from > 366 then
    perform private.fail('Rentang laporan maksimal satu tahun.');
  end if;
  v_tz := private.business_tz(p_business_id);
  v_start := private.day_start(p_from, v_tz);
  v_end := private.day_start(p_to + 1, v_tz);

  select coalesce(sum(sa.total) filter (where sa.status = 'completed'), 0) as revenue,
         coalesce(sum(sa.subtotal) filter (where sa.status = 'completed'), 0) as gross_sales,
         coalesce(sum(sa.discount) filter (where sa.status = 'completed'), 0) as discount,
         coalesce(sum(sa.cost_total) filter (where sa.status = 'completed'), 0) as cogs,
         count(*) filter (where sa.status = 'completed') as transactions,
         count(*) filter (where sa.status = 'void') as voids,
         coalesce(sum(sa.total) filter (where sa.status = 'void'), 0) as void_total,
         coalesce(sum(sa.debt_amount) filter (where sa.status = 'completed'), 0) as debt_from_sales,
         coalesce(sum(sa.paid_amount) filter (where sa.status = 'completed'), 0) as paid_at_sale
  into v_sales
  from public.sales sa
  where sa.business_id = p_business_id and sa.created_at >= v_start and sa.created_at < v_end;

  select coalesce(sum(i.qty), 0) into v_items_sold
  from public.sale_items i
  join public.sales sa on sa.id = i.sale_id
  where sa.business_id = p_business_id and sa.status = 'completed'
    and sa.created_at >= v_start and sa.created_at < v_end;

  select coalesce(sum(e.amount), 0) into v_expenses
  from public.expenses e
  where e.business_id = p_business_id and e.voided_at is null and e.spent_on between p_from and p_to;

  select coalesce(sum(d.amount), 0) into v_debt_manual
  from public.customer_debts d
  where d.business_id = p_business_id and d.voided_at is null and d.sale_id is null
    and d.created_at >= v_start and d.created_at < v_end;

  select coalesce(sum(dp.amount), 0) into v_collected
  from public.debt_payments dp
  where dp.business_id = p_business_id and dp.voided_at is null
    and dp.created_at >= v_start and dp.created_at < v_end;

  select coalesce(sum(pu.total), 0) into v_purchases
  from public.purchases pu
  where pu.business_id = p_business_id and pu.status = 'completed' and pu.purchased_on between p_from and p_to;

  return jsonb_build_object(
    'business', (select jsonb_build_object('id', b.id, 'name', b.name, 'currency', b.currency,
                                           'timezone', b.timezone, 'phone', b.phone, 'address', b.address)
                 from public.businesses b where b.id = p_business_id),
    'from', p_from,
    'to', p_to,
    'generated_at', now(),
    'summary', jsonb_build_object(
      'revenue', v_sales.revenue,
      'gross_sales', v_sales.gross_sales,
      'discount', v_sales.discount,
      'cogs', v_sales.cogs,
      'gross_profit', v_sales.revenue - v_sales.cogs,
      'expenses', v_expenses,
      'net_profit', v_sales.revenue - v_sales.cogs - v_expenses,
      'transactions', v_sales.transactions,
      'avg_ticket', case when v_sales.transactions > 0
                         then round(v_sales.revenue / v_sales.transactions, 2) else 0 end,
      'items_sold', v_items_sold,
      'voids', v_sales.voids,
      'void_total', v_sales.void_total,
      'debt_new', v_sales.debt_from_sales + v_debt_manual,
      'debt_collected', v_collected,
      'cash_in', v_sales.paid_at_sale + v_collected,
      'purchases', v_purchases,
      'receivables_now', private.receivables(p_business_id) -> 'total'),
    'by_method', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', m.code, 'name', m.name, 'kind', m.kind, 'sales', m.sales,
        'debt_payments', m.debt_payments, 'total', m.sales + m.debt_payments)
        order by (m.kind = 'debt'), m.sales + m.debt_payments desc)
      from (
        select u.code, max(u.name) as name, max(u.kind) as kind,
               sum(u.sales) as sales, sum(u.debt_payments) as debt_payments
        from (
          select sp.method_code as code, sp.method_name as name, sp.method_kind as kind,
                 sp.amount as sales, 0::numeric as debt_payments
          from public.sale_payments sp
          join public.sales sa on sa.id = sp.sale_id
          where sa.business_id = p_business_id and sa.status = 'completed'
            and sa.created_at >= v_start and sa.created_at < v_end
          union all
          select dp.method_code, dp.method_name, coalesce(pm.kind, 'other'), 0::numeric, dp.amount
          from public.debt_payments dp
          left join public.payment_methods pm on pm.business_id = dp.business_id and pm.code = dp.method_code
          where dp.business_id = p_business_id and dp.voided_at is null
            and dp.created_at >= v_start and dp.created_at < v_end
        ) u
        group by u.code
      ) m
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', t.product_id, 'name', t.name, 'unit', t.unit, 'qty', t.qty,
        'revenue', t.revenue, 'cogs', t.cogs, 'profit', t.revenue - t.cogs)
        order by t.qty desc, t.revenue desc)
      from (
        select i.product_id, coalesce(max(p.name), max(i.name)) as name, max(i.unit) as unit,
               sum(i.qty) as qty, sum(i.line_total) as revenue, sum(i.line_cost) as cogs
        from public.sale_items i
        join public.sales sa on sa.id = i.sale_id
        left join public.products p on p.id = i.product_id
        where sa.business_id = p_business_id and sa.status = 'completed'
          and sa.created_at >= v_start and sa.created_at < v_end
        group by i.product_id, case when i.product_id is null then lower(i.name) end
        order by sum(i.qty) desc, sum(i.line_total) desc
        limit 10
      ) t
    ), '[]'::jsonb),
    'expenses_by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', x.category, 'amount', x.amount, 'count', x.cnt)
                       order by x.amount desc)
      from (
        select e.category, sum(e.amount) as amount, count(*) as cnt
        from public.expenses e
        where e.business_id = p_business_id and e.voided_at is null and e.spent_on between p_from and p_to
        group by e.category
      ) x
    ), '[]'::jsonb),
    'series', (
      select jsonb_agg(jsonb_build_object(
        'date', g.day, 'revenue', coalesce(s.revenue, 0),
        'gross_profit', coalesce(s.revenue, 0) - coalesce(s.cogs, 0),
        'transactions', coalesce(s.cnt, 0), 'expenses', coalesce(ex.amount, 0)) order by g.day)
      from (select p_from + i as day from generate_series(0, p_to - p_from) as i) g
      left join (
        select (sa.created_at at time zone v_tz)::date as day, sum(sa.total) as revenue,
               sum(sa.cost_total) as cogs, count(*) as cnt
        from public.sales sa
        where sa.business_id = p_business_id and sa.status = 'completed'
          and sa.created_at >= v_start and sa.created_at < v_end
        group by 1
      ) s on s.day = g.day
      left join (
        select e.spent_on as day, sum(e.amount) as amount
        from public.expenses e
        where e.business_id = p_business_id and e.voided_at is null and e.spent_on between p_from and p_to
        group by 1
      ) ex on ex.day = g.day),
    'by_hour', coalesce((
      select jsonb_agg(jsonb_build_object('hour', h.hour, 'revenue', h.revenue, 'transactions', h.cnt)
                       order by h.hour)
      from (
        select extract(hour from (sa.created_at at time zone v_tz))::integer as hour,
               sum(sa.total) as revenue, count(*) as cnt
        from public.sales sa
        where sa.business_id = p_business_id and sa.status = 'completed'
          and sa.created_at >= v_start and sa.created_at < v_end
        group by 1
      ) h
    ), '[]'::jsonb));
end;
$$;

-- ---------------------------------------------------------------------
-- 11. Anggota dan undangan (kasir)
-- ---------------------------------------------------------------------
create or replace function public.list_members(p_business_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_owner(p_business_id);
  return jsonb_build_object(
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'user_id', m.user_id, 'display_name', coalesce(m.display_name, pr.full_name), 'email', u.email,
        'role', m.role, 'joined_at', m.created_at, 'is_me', m.user_id = auth.uid())
        order by (m.role = 'owner') desc, m.created_at)
      from public.business_members m
      left join public.profiles pr on pr.id = m.user_id
      left join auth.users u on u.id = m.user_id
      where m.business_id = p_business_id
    ), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', i.id, 'code', i.code, 'role', i.role, 'created_at', i.created_at, 'expires_at', i.expires_at)
        order by i.created_at desc)
      from public.business_invites i
      where i.business_id = p_business_id and i.used_at is null and i.revoked_at is null and i.expires_at > now()
    ), '[]'::jsonb));
end;
$$;

create or replace function public.create_invite(p_business_id uuid, p_role text default 'cashier')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
  v_try  integer := 0;
  v_inv  public.business_invites;
begin
  perform private.assert_owner(p_business_id);
  if p_role not in ('owner', 'cashier') then
    perform private.fail('Peran tidak dikenal.');
  end if;
  if (select count(*) from public.business_invites i
      where i.business_id = p_business_id and i.used_at is null and i.revoked_at is null and i.expires_at > now()) >= 10 then
    perform private.fail('Terlalu banyak undangan aktif. Batalkan yang lama dulu.');
  end if;
  loop
    v_code := upper(substr(md5(gen_random_uuid()::text), 1, 8));
    exit when not exists (select 1 from public.business_invites i where i.code = v_code);
    v_try := v_try + 1;
    if v_try > 5 then
      perform private.fail('Gagal membuat kode undangan. Coba lagi.');
    end if;
  end loop;
  insert into public.business_invites (business_id, code, role, created_by)
  values (p_business_id, v_code, p_role, auth.uid())
  returning * into v_inv;
  perform private.log(p_business_id, 'member.invite', 'invite', v_inv.id, jsonb_build_object('role', p_role));
  return jsonb_build_object('id', v_inv.id, 'code', v_inv.code, 'role', v_inv.role,
                            'created_at', v_inv.created_at, 'expires_at', v_inv.expires_at);
end;
$$;

create or replace function public.revoke_invite(p_business_id uuid, p_invite_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.assert_owner(p_business_id);
  update public.business_invites i set revoked_at = now()
  where i.id = p_invite_id and i.business_id = p_business_id and i.used_at is null and i.revoked_at is null;
  if not found then
    perform private.fail('Undangan tidak ditemukan.', 'PT404');
  end if;
  return public.list_members(p_business_id);
end;
$$;

create or replace function public.accept_invite(p_code text, p_display_name text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid  uuid := private.require_user();
  v_inv  public.business_invites;
  v_name text := left(nullif(btrim(p_display_name), ''), 80);
begin
  select * into v_inv from public.business_invites i
  where i.code = upper(btrim(p_code))
  for update;
  if not found or v_inv.revoked_at is not null or v_inv.used_at is not null or v_inv.expires_at <= now() then
    perform private.fail('Kode undangan tidak berlaku. Minta kode baru ke pemilik usaha.', 'PT404');
  end if;
  if exists (select 1 from public.business_members m where m.business_id = v_inv.business_id and m.user_id = v_uid) then
    perform private.fail('Kamu sudah menjadi anggota usaha ini.', 'PT409');
  end if;
  insert into public.profiles (id, full_name) values (v_uid, v_name)
  on conflict (id) do update set full_name = coalesce(public.profiles.full_name, excluded.full_name);
  insert into public.business_members (business_id, user_id, role, display_name)
  values (v_inv.business_id, v_uid, v_inv.role,
          coalesce(v_name, (select pr.full_name from public.profiles pr where pr.id = v_uid)));
  update public.business_invites i set used_by = v_uid, used_at = now() where i.id = v_inv.id;
  perform private.log(v_inv.business_id, 'member.join', 'member', v_uid, jsonb_build_object('role', v_inv.role));
  return public.get_business_context(v_inv.business_id);
end;
$$;

create or replace function public.remove_member(p_business_id uuid, p_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role text;
begin
  perform private.assert_owner(p_business_id);
  select m.role into v_role from public.business_members m
  where m.business_id = p_business_id and m.user_id = p_user_id;
  if v_role is null then
    perform private.fail('Anggota tidak ditemukan.', 'PT404');
  end if;
  if v_role = 'owner' and (select count(*) from public.business_members m
                           where m.business_id = p_business_id and m.role = 'owner') <= 1 then
    perform private.fail('Usaha harus punya minimal satu pemilik.', 'PT409');
  end if;
  delete from public.business_members m where m.business_id = p_business_id and m.user_id = p_user_id;
  perform private.log(p_business_id, 'member.remove', 'member', p_user_id, jsonb_build_object('role', v_role));
  return public.list_members(p_business_id);
end;
$$;

-- ---------------------------------------------------------------------
-- 12. Jejak audit
-- ---------------------------------------------------------------------
create or replace function public.list_audit_logs(p_business_id uuid, p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.assert_owner(p_business_id);
  return coalesce((
    select jsonb_agg(x.obj order by x.id desc)
    from (
      select a.id, jsonb_build_object(
        'id', a.id, 'action', a.action, 'entity', a.entity, 'entity_id', a.entity_id,
        'actor_name', a.actor_name, 'details', a.details, 'created_at', a.created_at) as obj
      from public.audit_logs a
      where a.business_id = p_business_id
      order by a.id desc
      limit least(greatest(coalesce(p_limit, 100), 1), 500)
    ) x
  ), '[]'::jsonb);
end;
$$;

-- ---------------------------------------------------------------------
-- 13. Hak akses
-- Fungsi publik hanya bisa dipanggil pengguna yang sudah masuk.
-- Helper di schema private tidak bisa dipanggil langsung dari API.
-- ---------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as fn
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = any (array[
        'get_my_businesses', 'get_business_context', 'create_business', 'update_business', 'update_my_profile',
        'set_payment_method', 'add_payment_method', 'upsert_category', 'delete_category',
        'list_products', 'upsert_product', 'set_product_active', 'delete_product', 'adjust_stock',
        'list_stock_movements',
        'list_customers', 'get_customer', 'upsert_customer', 'set_customer_active', 'record_debt_payment',
        'add_customer_debt', 'void_debt_payment', 'void_customer_debt',
        'create_sale', 'void_sale', 'get_sale', 'list_sales',
        'list_expenses', 'save_expense', 'void_expense',
        'list_suppliers', 'upsert_supplier', 'get_supplier', 'create_purchase', 'void_purchase',
        'record_supplier_payment', 'list_purchases',
        'get_dashboard', 'get_report',
        'list_members', 'create_invite', 'revoke_invite', 'accept_invite', 'remove_member',
        'list_audit_logs'])
  loop
    execute format('revoke all on function %s from public, anon', r.fn);
    execute format('grant execute on function %s to authenticated', r.fn);
  end loop;

  for r in
    select p.oid::regprocedure as fn
    from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.fn);
  end loop;
end;
$$;

-- RLS memanggil dua helper ini atas nama pengguna, jadi tetap diizinkan
grant execute on function private.is_member(uuid) to authenticated;
grant execute on function private.is_owner(uuid) to authenticated;


-- ---------------------------------------------------------------------
-- 20260926000300_possir_storage.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- POSSIR - skema database (bagian 3 dari 3): Storage foto produk
--
-- Bucket publik "product-images". Struktur path: {business_id}/{nama}.webp
-- Hanya pemilik usaha yang boleh mengunggah, mengganti, dan menghapus.
-- Siapa pun yang punya URL bisa melihat fotonya (seperti foto menu).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 1048576, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Folder pertama harus UUID usaha milik pengguna. CASE menjamin cast uuid
-- hanya dijalankan kalau formatnya benar.
create or replace function private.can_manage_product_image(p_object_name text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (storage.foldername(p_object_name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      then private.is_owner(((storage.foldername(p_object_name))[1])::uuid)
    else false
  end;
$$;

grant execute on function private.can_manage_product_image(text) to authenticated;

drop policy if exists "possir: pemilik unggah foto produk" on storage.objects;
drop policy if exists "possir: pemilik ganti foto produk" on storage.objects;
drop policy if exists "possir: pemilik hapus foto produk" on storage.objects;

create policy "possir: pemilik unggah foto produk" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'product-images' and private.can_manage_product_image(name));

create policy "possir: pemilik ganti foto produk" on storage.objects
  for update to authenticated
  using (bucket_id = 'product-images' and private.can_manage_product_image(name))
  with check (bucket_id = 'product-images' and private.can_manage_product_image(name));

create policy "possir: pemilik hapus foto produk" on storage.objects
  for delete to authenticated
  using (bucket_id = 'product-images' and private.can_manage_product_image(name));


-- ---------------------------------------------------------------------
-- 20260927000100_possir_cashflow.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Arus kas: uang masuk dan uang keluar dari satu sumber hitungan.
-- Masuk  = dibayar saat jual (tanpa kembalian, tanpa hutang) + bayaran hutang pelanggan
-- Keluar = pengeluaran + pembelian yang dibayar di tempat + bayar hutang supplier
-- Semua yang di-void tidak dihitung. Aman dijalankan ulang (create or replace).
-- =====================================================================

create or replace function public.get_cash_flow(p_business_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz    text;
  v_start timestamptz;
  v_end   timestamptz;
  v_res   jsonb;
begin
  perform private.assert_owner(p_business_id);
  if p_from is null or p_to is null or p_to < p_from then
    perform private.fail('Rentang tanggal tidak valid.');
  end if;
  if p_to - p_from > 366 then
    perform private.fail('Rentang maksimal satu tahun.');
  end if;
  v_tz := private.business_tz(p_business_id);
  v_start := private.day_start(p_from, v_tz);
  v_end := private.day_start(p_to + 1, v_tz);

  with flows as (
    -- uang masuk dari penjualan (bagian hutang tidak dihitung)
    select 'in' as dir, 'sales' as src, sp.method_code as code, sp.method_name as name, sp.amount
    from public.sale_payments sp
    join public.sales sa on sa.id = sp.sale_id
    where sa.business_id = p_business_id and sa.status = 'completed' and sp.method_kind <> 'debt'
      and sa.created_at >= v_start and sa.created_at < v_end
    union all
    -- pelanggan bayar hutang
    select 'in', 'debt_collected', dp.method_code, dp.method_name, dp.amount
    from public.debt_payments dp
    where dp.business_id = p_business_id and dp.voided_at is null
      and dp.created_at >= v_start and dp.created_at < v_end
    union all
    -- pengeluaran operasional
    select 'out', 'expenses', coalesce(e.method_code, 'cash'), coalesce(e.method_name, 'Cash'), e.amount
    from public.expenses e
    where e.business_id = p_business_id and e.voided_at is null and e.spent_on between p_from and p_to
    union all
    -- belanja stok yang langsung dibayar
    select 'out', 'purchases', coalesce(pu.method_code, 'cash'), coalesce(pu.method_name, 'Cash'), pu.paid_amount
    from public.purchases pu
    where pu.business_id = p_business_id and pu.status = 'completed' and pu.paid_amount > 0
      and pu.purchased_on between p_from and p_to
    union all
    -- cicilan hutang ke supplier
    select 'out', 'supplier_payments', sp.method_code, sp.method_name, sp.amount
    from public.supplier_payments sp
    where sp.business_id = p_business_id and sp.voided_at is null
      and sp.created_at >= v_start and sp.created_at < v_end
  )
  select jsonb_build_object(
    'from', p_from,
    'to', p_to,
    'in', jsonb_build_object(
      'sales', coalesce(sum(amount) filter (where src = 'sales'), 0),
      'debt_collected', coalesce(sum(amount) filter (where src = 'debt_collected'), 0),
      'total', coalesce(sum(amount) filter (where dir = 'in'), 0)),
    'out', jsonb_build_object(
      'expenses', coalesce(sum(amount) filter (where src = 'expenses'), 0),
      'purchases', coalesce(sum(amount) filter (where src = 'purchases'), 0),
      'supplier_payments', coalesce(sum(amount) filter (where src = 'supplier_payments'), 0),
      'total', coalesce(sum(amount) filter (where dir = 'out'), 0)),
    'net', coalesce(sum(case when dir = 'in' then amount else -amount end), 0),
    'by_method', coalesce((
      select jsonb_agg(jsonb_build_object('code', m.code, 'name', m.name, 'in', m.cin, 'out', m.cout,
                                          'net', m.cin - m.cout) order by m.cin + m.cout desc)
      from (
        select f.code, max(f.name) as name,
               coalesce(sum(f.amount) filter (where f.dir = 'in'), 0) as cin,
               coalesce(sum(f.amount) filter (where f.dir = 'out'), 0) as cout
        from flows f group by f.code
      ) m
    ), '[]'::jsonb))
  into v_res
  from flows;

  return v_res;
end;
$$;

revoke all on function public.get_cash_flow(uuid, date, date) from public, anon;
grant execute on function public.get_cash_flow(uuid, date, date) to authenticated;


-- ---------------------------------------------------------------------
-- 20260928000100_possir_audit_fixes.sql
-- ---------------------------------------------------------------------
-- =====================================================================
-- Perbaikan hasil audit angka (aman dijalankan ulang, hanya create or replace).
-- 1. Produk terlaris: diskon transaksi dibagi ke setiap baris, jadi jumlah pendapatan
--    dan laba per produk sama dengan omzet dan laba kotor (dashboard dan laporan).
-- 2. Riwayat transaksi: ringkasan jumlah dan total dihitung dari semua transaksi yang
--    cocok, bukan hanya 200 baris yang tampil.
-- 3. Transaksi dan pembelian di luar batas angka ditolak dengan pesan jelas.
-- =====================================================================

create or replace function public.create_sale(p_business_id uuid, p_sale jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role        text := private.assert_member(p_business_id);
  v_uid         uuid := auth.uid();
  v_actor       text := private.actor_name(p_business_id);
  v_client_ref  uuid := private.uuid_val(p_sale, 'client_ref');
  v_items       jsonb := p_sale -> 'items';
  v_item        jsonb;
  v_lines       jsonb := '[]'::jsonb;
  v_pos         integer := 0;
  v_product     public.products;
  v_pid         uuid;
  v_name        text;
  v_unit        text;
  v_qty         numeric;
  v_price       numeric;
  v_cost        numeric;
  v_track       boolean;
  v_subtotal    numeric := 0;
  v_cost_total  numeric := 0;
  v_discount    numeric := round(coalesce(private.num(p_sale, 'discount'), 0), 2);
  v_total       numeric;
  v_method      public.payment_methods;
  v_dp          numeric := round(coalesce(private.num(p_sale, 'down_payment'), 0), 2);
  v_dp_method   public.payment_methods;
  v_customer_id uuid := private.uuid_val(p_sale, 'customer_id');
  v_new_cust    jsonb := p_sale -> 'new_customer';
  v_due         date := private.date_val(p_sale, 'due_date');
  v_cash        numeric := round(private.num(p_sale, 'cash_received'), 2);
  v_note        text := left(private.txt(p_sale, 'note'), 300);
  v_paid        numeric;
  v_debt        numeric;
  v_number      integer;
  v_sale_id     uuid;
begin
  -- semua perubahan stok satu usaha diantrikan lewat kunci baris usaha
  perform 1 from public.businesses b where b.id = p_business_id for update;

  if v_client_ref is not null then
    select sa.id into v_sale_id from public.sales sa
    where sa.business_id = p_business_id and sa.client_ref = v_client_ref;
    if v_sale_id is not null then
      return private.sale_json(v_sale_id, v_role = 'owner');
    end if;
  end if;

  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    perform private.fail('Keranjang masih kosong.');
  end if;
  if jsonb_array_length(v_items) > 200 then
    perform private.fail('Maksimal 200 baris item per transaksi.');
  end if;

  v_method := private.payment_method(p_business_id, private.txt(p_sale, 'payment_method'), true);

  for v_item in select e.value from jsonb_array_elements(v_items) e loop
    v_pos := v_pos + 1;
    if jsonb_typeof(v_item) <> 'object' then
      perform private.fail('Format item tidak valid.');
    end if;
    v_qty := private.num(v_item, 'qty');
    if v_qty is null or v_qty <= 0 then
      perform private.fail('Jumlah item harus lebih dari 0.');
    end if;
    if v_qty > 100000 then
      perform private.fail('Jumlah item terlalu besar.');
    end if;
    v_qty := round(v_qty, 3);
    v_pid := private.uuid_val(v_item, 'product_id');
    v_track := false;

    if v_pid is not null then
      select * into v_product from public.products p
      where p.id = v_pid and p.business_id = p_business_id;
      if not found then
        perform private.fail('Ada produk yang sudah tidak ada. Muat ulang halaman kasir.', 'PT404');
      end if;
      if not v_product.is_active then
        perform private.fail(format('%s sudah diarsipkan.', v_product.name));
      end if;
      v_name  := v_product.name;
      v_unit  := v_product.unit;
      v_price := coalesce(private.num(v_item, 'unit_price'), v_product.price);
      v_cost  := v_product.cost_price;
      v_track := v_product.track_stock;
    else
      v_name := left(private.txt(v_item, 'name'), 80);
      if v_name is null then
        perform private.fail('Nama item jual cepat wajib diisi.');
      end if;
      v_unit  := coalesce(left(private.txt(v_item, 'unit'), 20), 'pcs');
      v_price := private.num(v_item, 'unit_price');
      if v_price is null then
        perform private.fail(format('Harga %s wajib diisi.', v_name));
      end if;
      v_cost := coalesce(private.num(v_item, 'unit_cost'), 0);
    end if;

    if v_price < 0 or v_cost < 0 then
      perform private.fail('Harga tidak boleh negatif.');
    end if;
    v_price := round(v_price, 2);
    v_cost  := round(v_cost, 2);

    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_pid, 'name', v_name, 'unit', v_unit, 'qty', v_qty,
      'unit_price', v_price, 'unit_cost', v_cost,
      'line_total', round(v_qty * v_price, 2), 'line_cost', round(v_qty * v_cost, 2),
      'position', v_pos, 'track', v_track));
    if round(v_qty * v_price, 2) > 9999999999.99 or round(v_qty * v_cost, 2) > 9999999999.99 then
      perform private.fail(format('Nilai %s terlalu besar untuk satu transaksi.', v_name));
    end if;
    v_subtotal   := v_subtotal + round(v_qty * v_price, 2);
    v_cost_total := v_cost_total + round(v_qty * v_cost, 2);
  end loop;

  if v_subtotal > 9999999999.99 or v_cost_total > 9999999999.99 then
    perform private.fail('Total transaksi terlalu besar. Pecah menjadi beberapa transaksi.');
  end if;
  if v_discount < 0 then
    perform private.fail('Diskon tidak boleh negatif.');
  end if;
  if v_discount > v_subtotal then
    perform private.fail('Diskon tidak boleh melebihi subtotal.');
  end if;
  v_total := v_subtotal - v_discount;

  if v_customer_id is not null then
    if not exists (select 1 from public.customers c where c.id = v_customer_id and c.business_id = p_business_id) then
      perform private.fail('Pelanggan tidak ditemukan.', 'PT404');
    end if;
  elsif jsonb_typeof(v_new_cust) = 'object' and private.txt(v_new_cust, 'name') is not null then
    insert into public.customers (business_id, name, phone)
    values (p_business_id, left(private.txt(v_new_cust, 'name'), 80), left(private.txt(v_new_cust, 'phone'), 30))
    returning id into v_customer_id;
  end if;

  if v_method.kind = 'debt' then
    if v_customer_id is null then
      perform private.fail('Pilih pelanggan untuk transaksi hutang.');
    end if;
    if v_total <= 0 then
      perform private.fail('Transaksi dengan total 0 tidak bisa dicatat sebagai hutang.');
    end if;
    if v_dp < 0 then
      perform private.fail('Uang muka tidak boleh negatif.');
    end if;
    if v_dp >= v_total then
      perform private.fail('Uang muka sama dengan total. Pilih metode bayar biasa saja.');
    end if;
    if v_dp > 0 then
      v_dp_method := private.payment_method(
        p_business_id, coalesce(private.txt(p_sale, 'down_payment_method'), 'cash'), false);
    end if;
    v_paid := v_dp;
    v_debt := v_total - v_dp;
    v_cash := null;
  else
    v_paid := v_total;
    v_debt := 0;
    v_due  := null;
    if v_cash is not null then
      if v_method.kind <> 'cash' then
        v_cash := null;
      elsif v_cash < v_total then
        perform private.fail('Uang yang diterima kurang dari total belanja.');
      end if;
    end if;
  end if;

  update public.businesses b set sale_counter = b.sale_counter + 1
  where b.id = p_business_id
  returning b.sale_counter into v_number;

  insert into public.sales (business_id, number, client_ref, customer_id, payment_method_code, payment_method_name,
                            subtotal, discount, total, cost_total, paid_amount, debt_amount, cash_received, note,
                            cashier_id, cashier_name)
  values (p_business_id, v_number, v_client_ref, v_customer_id, v_method.code, v_method.name,
          v_subtotal, v_discount, v_total, v_cost_total, v_paid, v_debt, v_cash, v_note,
          v_uid, v_actor)
  returning id into v_sale_id;

  insert into public.sale_items (sale_id, business_id, product_id, name, unit, qty, unit_price, unit_cost,
                                 line_total, line_cost, position)
  select v_sale_id, p_business_id, (l ->> 'product_id')::uuid, l ->> 'name', l ->> 'unit',
         (l ->> 'qty')::numeric, (l ->> 'unit_price')::numeric, (l ->> 'unit_cost')::numeric,
         (l ->> 'line_total')::numeric, (l ->> 'line_cost')::numeric, (l ->> 'position')::smallint
  from jsonb_array_elements(v_lines) l;

  if v_method.kind = 'debt' then
    if v_dp > 0 then
      insert into public.sale_payments (sale_id, business_id, method_code, method_name, method_kind, amount)
      values (v_sale_id, p_business_id, v_dp_method.code, v_dp_method.name, v_dp_method.kind, v_dp);
    end if;
    insert into public.sale_payments (sale_id, business_id, method_code, method_name, method_kind, amount)
    values (v_sale_id, p_business_id, v_method.code, v_method.name, 'debt', v_debt);
    insert into public.customer_debts (business_id, customer_id, sale_id, amount, due_date, created_by)
    values (p_business_id, v_customer_id, v_sale_id, v_debt, v_due, v_uid);
  elsif v_total > 0 then
    insert into public.sale_payments (sale_id, business_id, method_code, method_name, method_kind, amount)
    values (v_sale_id, p_business_id, v_method.code, v_method.name, v_method.kind, v_total);
  end if;

  -- kurangi stok produk yang dilacak (boleh minus: penjualan nyata tetap tercatat)
  with agg as (
    select (l ->> 'product_id')::uuid as product_id, sum((l ->> 'qty')::numeric) as qty
    from jsonb_array_elements(v_lines) l
    where (l ->> 'track')::boolean
    group by 1
  ), upd as (
    update public.products p set stock = p.stock - agg.qty
    from agg
    where p.id = agg.product_id
    returning p.id, p.stock, agg.qty, p.cost_price
  )
  insert into public.stock_movements (business_id, product_id, type, qty_change, qty_after, unit_cost, sale_id,
                                      created_by, created_by_name)
  select p_business_id, upd.id, 'sale', -upd.qty, upd.stock, upd.cost_price, v_sale_id, v_uid, v_actor
  from upd;

  return private.sale_json(v_sale_id, v_role = 'owner');
end;
$$;

create or replace function public.create_purchase(p_business_id uuid, p_purchase jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid         uuid := auth.uid();
  v_actor       text;
  v_client_ref  uuid := private.uuid_val(p_purchase, 'client_ref');
  v_items       jsonb := p_purchase -> 'items';
  v_item        jsonb;
  v_lines       jsonb := '[]'::jsonb;
  v_pos         integer := 0;
  v_product     public.products;
  v_pid         uuid;
  v_qty         numeric;
  v_cost        numeric;
  v_total       numeric := 0;
  v_paid        numeric;
  v_method      public.payment_methods;
  v_supplier_id uuid := private.uuid_val(p_purchase, 'supplier_id');
  v_new_sup     jsonb := p_purchase -> 'new_supplier';
  v_date        date := private.date_val(p_purchase, 'purchased_on');
  v_update_cost boolean := private.bool_val(p_purchase, 'update_cost', true);
  v_today       date;
  v_number      integer;
  v_id          uuid;
begin
  perform private.assert_owner(p_business_id);
  v_actor := private.actor_name(p_business_id);
  v_today := private.local_today(private.business_tz(p_business_id));
  perform 1 from public.businesses b where b.id = p_business_id for update;

  if v_client_ref is not null then
    select pu.id into v_id from public.purchases pu
    where pu.business_id = p_business_id and pu.client_ref = v_client_ref;
    if v_id is not null then
      return private.purchase_json(v_id);
    end if;
  end if;

  if v_items is null or jsonb_typeof(v_items) <> 'array' or jsonb_array_length(v_items) = 0 then
    perform private.fail('Tambahkan minimal satu produk yang dibeli.');
  end if;
  if jsonb_array_length(v_items) > 200 then
    perform private.fail('Maksimal 200 baris per pembelian.');
  end if;

  for v_item in select e.value from jsonb_array_elements(v_items) e loop
    v_pos := v_pos + 1;
    v_pid := private.uuid_val(v_item, 'product_id');
    if v_pid is null then
      perform private.fail('Pilih produk untuk setiap baris pembelian.');
    end if;
    select * into v_product from public.products p
    where p.id = v_pid and p.business_id = p_business_id;
    if not found then
      perform private.fail('Produk tidak ditemukan.', 'PT404');
    end if;
    v_qty := round(private.num(v_item, 'qty'), 3);
    if v_qty is null or v_qty <= 0 or v_qty > 1000000 then
      perform private.fail(format('Jumlah %s tidak valid.', v_product.name));
    end if;
    v_cost := round(coalesce(private.num(v_item, 'unit_cost'), v_product.cost_price), 2);
    if v_cost < 0 then
      perform private.fail('Harga beli tidak boleh negatif.');
    end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_pid, 'name', v_product.name, 'unit', v_product.unit, 'qty', v_qty,
      'unit_cost', v_cost, 'line_total', round(v_qty * v_cost, 2), 'position', v_pos,
      'track', v_product.track_stock));
    if round(v_qty * v_cost, 2) > 9999999999.99 then
      perform private.fail('Nilai satu baris pembelian terlalu besar.');
    end if;
    v_total := v_total + round(v_qty * v_cost, 2);
    if v_total > 9999999999.99 then
      perform private.fail('Total pembelian terlalu besar. Pecah menjadi beberapa pembelian.');
    end if;
  end loop;

  if v_supplier_id is not null then
    if not exists (select 1 from public.suppliers s where s.id = v_supplier_id and s.business_id = p_business_id) then
      perform private.fail('Supplier tidak ditemukan.', 'PT404');
    end if;
  elsif jsonb_typeof(v_new_sup) = 'object' and private.txt(v_new_sup, 'name') is not null then
    insert into public.suppliers (business_id, name, phone)
    values (p_business_id, left(private.txt(v_new_sup, 'name'), 80), left(private.txt(v_new_sup, 'phone'), 30))
    returning id into v_supplier_id;
  end if;

  v_paid := round(coalesce(private.num(p_purchase, 'paid_amount'), v_total), 2);
  if v_paid < 0 or v_paid > v_total then
    perform private.fail('Jumlah yang dibayar tidak valid.');
  end if;
  if v_paid < v_total and v_supplier_id is null then
    perform private.fail('Pilih supplier untuk mencatat hutang pembelian.');
  end if;
  if v_paid > 0 then
    v_method := private.payment_method(p_business_id, coalesce(private.txt(p_purchase, 'method_code'), 'cash'), false);
  end if;
  v_date := coalesce(v_date, v_today);
  if v_date > v_today + 1 then
    perform private.fail('Tanggal pembelian tidak boleh di masa depan.');
  end if;

  update public.businesses b set purchase_counter = b.purchase_counter + 1
  where b.id = p_business_id
  returning b.purchase_counter into v_number;

  insert into public.purchases (business_id, number, client_ref, supplier_id, total, paid_amount, debt_amount,
                                method_code, method_name, note, purchased_on, created_by, created_by_name)
  values (p_business_id, v_number, v_client_ref, v_supplier_id, v_total, v_paid, v_total - v_paid,
          v_method.code, v_method.name, left(private.txt(p_purchase, 'note'), 300), v_date, v_uid, v_actor)
  returning id into v_id;

  insert into public.purchase_items (purchase_id, business_id, product_id, name, unit, qty, unit_cost, line_total, position)
  select v_id, p_business_id, (l ->> 'product_id')::uuid, l ->> 'name', l ->> 'unit', (l ->> 'qty')::numeric,
         (l ->> 'unit_cost')::numeric, (l ->> 'line_total')::numeric, (l ->> 'position')::smallint
  from jsonb_array_elements(v_lines) l;

  -- stok bertambah untuk produk yang dilacak; harga modal ikut harga beli terakhir
  with agg as (
    select (l ->> 'product_id')::uuid as product_id, sum((l ->> 'qty')::numeric) as qty,
           (array_agg((l ->> 'unit_cost')::numeric order by (l ->> 'position')::integer desc))[1] as last_cost,
           bool_or((l ->> 'track')::boolean) as track
    from jsonb_array_elements(v_lines) l
    group by 1
  ), upd as (
    update public.products p set
      stock = case when agg.track then p.stock + agg.qty else p.stock end,
      cost_price = case when v_update_cost then agg.last_cost else p.cost_price end
    from agg
    where p.id = agg.product_id
    returning p.id, p.stock, agg.qty, agg.last_cost, agg.track
  )
  insert into public.stock_movements (business_id, product_id, type, qty_change, qty_after, unit_cost, purchase_id,
                                      created_by, created_by_name)
  select p_business_id, upd.id, 'purchase', upd.qty, upd.stock, upd.last_cost, v_id, v_uid, v_actor
  from upd
  where upd.track;

  perform private.log(p_business_id, 'purchase.create', 'purchase', v_id,
                      jsonb_build_object('number', v_number, 'total', v_total, 'debt', v_total - v_paid));
  return private.purchase_json(v_id);
end;
$$;



create or replace function public.list_sales(
  p_business_id uuid, p_from date default null, p_to date default null,
  p_status text default null, p_customer_id uuid default null, p_limit integer default 200)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_owner boolean := private.assert_member(p_business_id) = 'owner';
  v_uid   uuid := auth.uid();
  v_tz    text := private.business_tz(p_business_id);
  v_start timestamptz := case when p_from is null then '-infinity'::timestamptz else private.day_start(p_from, v_tz) end;
  v_end   timestamptz := case when p_to is null then 'infinity'::timestamptz else private.day_start(p_to + 1, v_tz) end;
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 500);
  v_rows  jsonb;
  v_count bigint;
  v_sum   jsonb;
begin
  select coalesce(jsonb_agg(x.obj order by x.created_at desc), '[]'::jsonb), coalesce(max(x.total_count), 0)
  into v_rows, v_count
  from (
    select sa.created_at, count(*) over () as total_count, jsonb_build_object(
      'id', sa.id, 'number', sa.number, 'status', sa.status, 'created_at', sa.created_at,
      'total', sa.total, 'discount', sa.discount, 'paid_amount', sa.paid_amount, 'debt_amount', sa.debt_amount,
      'payment_method_code', sa.payment_method_code, 'payment_method_name', sa.payment_method_name,
      'customer_id', sa.customer_id, 'customer_name', c.name, 'cashier_name', sa.cashier_name,
      'void_reason', sa.void_reason,
      'items', (select jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'unit', i.unit) order by i.position)
                from public.sale_items i where i.sale_id = sa.id)) as obj
    from public.sales sa
    left join public.customers c on c.id = sa.customer_id
    where sa.business_id = p_business_id
      and sa.created_at >= v_start and sa.created_at < v_end
      and (v_owner or sa.cashier_id = v_uid)
      and (p_customer_id is null or sa.customer_id = p_customer_id)
      and (p_status is null or p_status = 'all'
           or (p_status = 'completed' and sa.status = 'completed')
           or (p_status = 'paid' and sa.status = 'completed' and sa.debt_amount = 0)
           or (p_status = 'debt' and sa.status = 'completed' and sa.debt_amount > 0)
           or (p_status = 'void' and sa.status = 'void'))
    order by sa.created_at desc
    limit v_limit
  ) x;
  -- ringkasan dihitung dari SEMUA transaksi yang cocok, bukan hanya yang tampil (dibatasi v_limit)
  select jsonb_build_object(
    'transactions', count(*) filter (where sa.status = 'completed'),
    'revenue', coalesce(sum(sa.total) filter (where sa.status = 'completed'), 0),
    'voids', count(*) filter (where sa.status = 'void'))
  into v_sum
  from public.sales sa
  where sa.business_id = p_business_id
    and sa.created_at >= v_start and sa.created_at < v_end
    and (v_owner or sa.cashier_id = v_uid)
    and (p_customer_id is null or sa.customer_id = p_customer_id)
    and (p_status is null or p_status = 'all'
         or (p_status = 'completed' and sa.status = 'completed')
         or (p_status = 'paid' and sa.status = 'completed' and sa.debt_amount = 0)
         or (p_status = 'debt' and sa.status = 'completed' and sa.debt_amount > 0)
         or (p_status = 'void' and sa.status = 'void'));
  return jsonb_build_object('items', v_rows, 'total_count', v_count, 'limit', v_limit, 'summary', v_sum);
end;
$$;

create or replace function public.get_dashboard(p_business_id uuid, p_date date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_role       text := private.assert_member(p_business_id);
  v_owner      boolean := v_role = 'owner';
  v_uid        uuid := auth.uid();
  v_tz         text := private.business_tz(p_business_id);
  v_day        date;
  v_start      timestamptz;
  v_end        timestamptz;
  v_week_start timestamptz;
  v_today      record;
  v_items      numeric;
  v_collected  numeric;
  v_expenses   numeric;
  v_same_time  numeric;
begin
  v_day := coalesce(p_date, private.local_today(v_tz));
  v_start := private.day_start(v_day, v_tz);
  v_end := private.day_start(v_day + 1, v_tz);
  v_week_start := private.day_start(v_day - 6, v_tz);

  -- pembanding yang adil: kemarin sampai jam yang sama dengan sekarang
  select coalesce(sum(sa.total), 0) into v_same_time
  from public.sales sa
  where sa.business_id = p_business_id and sa.status = 'completed'
    and sa.created_at >= private.day_start(v_day - 1, v_tz)
    and sa.created_at < least(now(), v_end) - interval '1 day'
    and (v_owner or sa.cashier_id = v_uid);

  select coalesce(sum(sa.total) filter (where sa.status = 'completed'), 0) as sales,
         coalesce(sum(sa.cost_total) filter (where sa.status = 'completed'), 0) as cost,
         coalesce(sum(sa.discount) filter (where sa.status = 'completed'), 0) as discount,
         coalesce(sum(sa.paid_amount) filter (where sa.status = 'completed'), 0) as paid,
         coalesce(sum(sa.debt_amount) filter (where sa.status = 'completed'), 0) as debt_new,
         count(*) filter (where sa.status = 'completed') as transactions,
         count(*) filter (where sa.status = 'void') as voids
  into v_today
  from public.sales sa
  where sa.business_id = p_business_id and sa.created_at >= v_start and sa.created_at < v_end
    and (v_owner or sa.cashier_id = v_uid);

  select coalesce(sum(i.qty), 0) into v_items
  from public.sale_items i
  join public.sales sa on sa.id = i.sale_id
  where sa.business_id = p_business_id and sa.status = 'completed'
    and sa.created_at >= v_start and sa.created_at < v_end
    and (v_owner or sa.cashier_id = v_uid);

  select coalesce(sum(dp.amount), 0) into v_collected
  from public.debt_payments dp
  where dp.business_id = p_business_id and dp.voided_at is null
    and dp.created_at >= v_start and dp.created_at < v_end
    and (v_owner or dp.created_by = v_uid);

  select coalesce(sum(e.amount), 0) into v_expenses
  from public.expenses e
  where e.business_id = p_business_id and e.voided_at is null and e.spent_on = v_day;

  return jsonb_build_object(
    'date', v_day,
    'role', v_role,
    'today', jsonb_build_object(
      'sales', v_today.sales,
      'cost', case when v_owner then v_today.cost end,
      'gross_profit', case when v_owner then v_today.sales - v_today.cost end,
      'expenses', case when v_owner then v_expenses end,
      'discount', v_today.discount,
      'transactions', v_today.transactions,
      'items_sold', v_items,
      'voids', v_today.voids,
      'debt_new', v_today.debt_new,
      'debt_collected', v_collected,
      'cash_in', v_today.paid + v_collected,
      'sales_same_time_yesterday', v_same_time),
    'cash_in_by_method', coalesce((
      select jsonb_agg(jsonb_build_object('code', x.code, 'name', x.name, 'amount', x.amount) order by x.amount desc)
      from (
        select u.code, max(u.name) as name, sum(u.amount) as amount
        from (
          select sp.method_code as code, sp.method_name as name, sp.amount
          from public.sale_payments sp
          join public.sales sa on sa.id = sp.sale_id
          where sa.business_id = p_business_id and sa.status = 'completed' and sp.method_kind <> 'debt'
            and sa.created_at >= v_start and sa.created_at < v_end
            and (v_owner or sa.cashier_id = v_uid)
          union all
          select dp.method_code, dp.method_name, dp.amount
          from public.debt_payments dp
          where dp.business_id = p_business_id and dp.voided_at is null
            and dp.created_at >= v_start and dp.created_at < v_end
            and (v_owner or dp.created_by = v_uid)
        ) u
        group by u.code
      ) x
    ), '[]'::jsonb),
    'series', (
      select jsonb_agg(jsonb_build_object(
        'date', g.day, 'sales', coalesce(t.sales, 0),
        'gross_profit', case when v_owner then coalesce(t.sales, 0) - coalesce(t.cost, 0) end,
        'transactions', coalesce(t.cnt, 0)) order by g.day)
      from (select v_day - i as day from generate_series(0, 6) as i) g
      left join (
        select (sa.created_at at time zone v_tz)::date as day, sum(sa.total) as sales,
               sum(sa.cost_total) as cost, count(*) as cnt
        from public.sales sa
        where sa.business_id = p_business_id and sa.status = 'completed'
          and sa.created_at >= v_week_start and sa.created_at < v_end
          and (v_owner or sa.cashier_id = v_uid)
        group by 1
      ) t on t.day = g.day),
    'receivables', private.receivables(p_business_id),
    'low_stock', (
      select jsonb_build_object(
        'count', count(*),
        'items', coalesce(jsonb_agg(jsonb_build_object(
                   'id', p.id, 'name', p.name, 'stock', p.stock, 'min_stock', p.min_stock, 'unit', p.unit)
                   order by p.stock - p.min_stock, p.name) filter (where p.rn <= 6), '[]'::jsonb))
      from (
        select p2.*, row_number() over (order by p2.stock - p2.min_stock, p2.name) as rn
        from public.products p2
        where p2.business_id = p_business_id and p2.is_active and p2.track_stock and p2.stock <= p2.min_stock
      ) p),
    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', t.product_id, 'name', t.name, 'unit', t.unit, 'qty', t.qty, 'revenue', t.revenue)
        order by t.qty desc, t.revenue desc)
      from (
        select i.product_id, coalesce(max(p.name), max(i.name)) as name, max(i.unit) as unit,
               sum(i.qty) as qty, round(sum((i.line_total - case when sa.subtotal > 0 then sa.discount * i.line_total / sa.subtotal else 0 end)), 2) as revenue
        from public.sale_items i
        join public.sales sa on sa.id = i.sale_id
        left join public.products p on p.id = i.product_id
        where sa.business_id = p_business_id and sa.status = 'completed'
          and sa.created_at >= v_week_start and sa.created_at < v_end
          and (v_owner or sa.cashier_id = v_uid)
        group by i.product_id, case when i.product_id is null then lower(i.name) end
        order by sum(i.qty) desc, sum((i.line_total - case when sa.subtotal > 0 then sa.discount * i.line_total / sa.subtotal else 0 end)) desc
        limit 5
      ) t
    ), '[]'::jsonb),
    'recent_sales', coalesce((
      select jsonb_agg(x.obj order by x.created_at desc)
      from (
        select sa.created_at, jsonb_build_object(
          'id', sa.id, 'number', sa.number, 'status', sa.status, 'created_at', sa.created_at,
          'total', sa.total, 'debt_amount', sa.debt_amount, 'payment_method_name', sa.payment_method_name,
          'payment_method_code', sa.payment_method_code, 'customer_name', c.name,
          'items', (select jsonb_agg(jsonb_build_object('name', i.name, 'qty', i.qty, 'unit', i.unit)
                                     order by i.position)
                    from public.sale_items i where i.sale_id = sa.id)) as obj
        from public.sales sa
        left join public.customers c on c.id = sa.customer_id
        where sa.business_id = p_business_id and (v_owner or sa.cashier_id = v_uid)
        order by sa.created_at desc
        limit 6
      ) x
    ), '[]'::jsonb));
end;
$$;

create or replace function public.get_report(p_business_id uuid, p_from date, p_to date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_tz          text;
  v_start       timestamptz;
  v_end         timestamptz;
  v_sales       record;
  v_items_sold  numeric;
  v_expenses    numeric;
  v_debt_manual numeric;
  v_collected   numeric;
  v_purchases   numeric;
begin
  perform private.assert_owner(p_business_id);
  if p_from is null or p_to is null or p_to < p_from then
    perform private.fail('Rentang tanggal tidak valid.');
  end if;
  if p_to - p_from > 366 then
    perform private.fail('Rentang laporan maksimal satu tahun.');
  end if;
  v_tz := private.business_tz(p_business_id);
  v_start := private.day_start(p_from, v_tz);
  v_end := private.day_start(p_to + 1, v_tz);

  select coalesce(sum(sa.total) filter (where sa.status = 'completed'), 0) as revenue,
         coalesce(sum(sa.subtotal) filter (where sa.status = 'completed'), 0) as gross_sales,
         coalesce(sum(sa.discount) filter (where sa.status = 'completed'), 0) as discount,
         coalesce(sum(sa.cost_total) filter (where sa.status = 'completed'), 0) as cogs,
         count(*) filter (where sa.status = 'completed') as transactions,
         count(*) filter (where sa.status = 'void') as voids,
         coalesce(sum(sa.total) filter (where sa.status = 'void'), 0) as void_total,
         coalesce(sum(sa.debt_amount) filter (where sa.status = 'completed'), 0) as debt_from_sales,
         coalesce(sum(sa.paid_amount) filter (where sa.status = 'completed'), 0) as paid_at_sale
  into v_sales
  from public.sales sa
  where sa.business_id = p_business_id and sa.created_at >= v_start and sa.created_at < v_end;

  select coalesce(sum(i.qty), 0) into v_items_sold
  from public.sale_items i
  join public.sales sa on sa.id = i.sale_id
  where sa.business_id = p_business_id and sa.status = 'completed'
    and sa.created_at >= v_start and sa.created_at < v_end;

  select coalesce(sum(e.amount), 0) into v_expenses
  from public.expenses e
  where e.business_id = p_business_id and e.voided_at is null and e.spent_on between p_from and p_to;

  select coalesce(sum(d.amount), 0) into v_debt_manual
  from public.customer_debts d
  where d.business_id = p_business_id and d.voided_at is null and d.sale_id is null
    and d.created_at >= v_start and d.created_at < v_end;

  select coalesce(sum(dp.amount), 0) into v_collected
  from public.debt_payments dp
  where dp.business_id = p_business_id and dp.voided_at is null
    and dp.created_at >= v_start and dp.created_at < v_end;

  select coalesce(sum(pu.total), 0) into v_purchases
  from public.purchases pu
  where pu.business_id = p_business_id and pu.status = 'completed' and pu.purchased_on between p_from and p_to;

  return jsonb_build_object(
    'business', (select jsonb_build_object('id', b.id, 'name', b.name, 'currency', b.currency,
                                           'timezone', b.timezone, 'phone', b.phone, 'address', b.address)
                 from public.businesses b where b.id = p_business_id),
    'from', p_from,
    'to', p_to,
    'generated_at', now(),
    'summary', jsonb_build_object(
      'revenue', v_sales.revenue,
      'gross_sales', v_sales.gross_sales,
      'discount', v_sales.discount,
      'cogs', v_sales.cogs,
      'gross_profit', v_sales.revenue - v_sales.cogs,
      'expenses', v_expenses,
      'net_profit', v_sales.revenue - v_sales.cogs - v_expenses,
      'transactions', v_sales.transactions,
      'avg_ticket', case when v_sales.transactions > 0
                         then round(v_sales.revenue / v_sales.transactions, 2) else 0 end,
      'items_sold', v_items_sold,
      'voids', v_sales.voids,
      'void_total', v_sales.void_total,
      'debt_new', v_sales.debt_from_sales + v_debt_manual,
      'debt_collected', v_collected,
      'cash_in', v_sales.paid_at_sale + v_collected,
      'purchases', v_purchases,
      'receivables_now', private.receivables(p_business_id) -> 'total'),
    'by_method', coalesce((
      select jsonb_agg(jsonb_build_object(
        'code', m.code, 'name', m.name, 'kind', m.kind, 'sales', m.sales,
        'debt_payments', m.debt_payments, 'total', m.sales + m.debt_payments)
        order by (m.kind = 'debt'), m.sales + m.debt_payments desc)
      from (
        select u.code, max(u.name) as name, max(u.kind) as kind,
               sum(u.sales) as sales, sum(u.debt_payments) as debt_payments
        from (
          select sp.method_code as code, sp.method_name as name, sp.method_kind as kind,
                 sp.amount as sales, 0::numeric as debt_payments
          from public.sale_payments sp
          join public.sales sa on sa.id = sp.sale_id
          where sa.business_id = p_business_id and sa.status = 'completed'
            and sa.created_at >= v_start and sa.created_at < v_end
          union all
          select dp.method_code, dp.method_name, coalesce(pm.kind, 'other'), 0::numeric, dp.amount
          from public.debt_payments dp
          left join public.payment_methods pm on pm.business_id = dp.business_id and pm.code = dp.method_code
          where dp.business_id = p_business_id and dp.voided_at is null
            and dp.created_at >= v_start and dp.created_at < v_end
        ) u
        group by u.code
      ) m
    ), '[]'::jsonb),
    'top_products', coalesce((
      select jsonb_agg(jsonb_build_object(
        'product_id', t.product_id, 'name', t.name, 'unit', t.unit, 'qty', t.qty,
        'revenue', t.revenue, 'cogs', t.cogs, 'profit', t.revenue - t.cogs)
        order by t.qty desc, t.revenue desc)
      from (
        select i.product_id, coalesce(max(p.name), max(i.name)) as name, max(i.unit) as unit,
               sum(i.qty) as qty, round(sum((i.line_total - case when sa.subtotal > 0 then sa.discount * i.line_total / sa.subtotal else 0 end)), 2) as revenue, sum(i.line_cost) as cogs
        from public.sale_items i
        join public.sales sa on sa.id = i.sale_id
        left join public.products p on p.id = i.product_id
        where sa.business_id = p_business_id and sa.status = 'completed'
          and sa.created_at >= v_start and sa.created_at < v_end
        group by i.product_id, case when i.product_id is null then lower(i.name) end
        order by sum(i.qty) desc, sum((i.line_total - case when sa.subtotal > 0 then sa.discount * i.line_total / sa.subtotal else 0 end)) desc
        limit 10
      ) t
    ), '[]'::jsonb),
    'expenses_by_category', coalesce((
      select jsonb_agg(jsonb_build_object('category', x.category, 'amount', x.amount, 'count', x.cnt)
                       order by x.amount desc)
      from (
        select e.category, sum(e.amount) as amount, count(*) as cnt
        from public.expenses e
        where e.business_id = p_business_id and e.voided_at is null and e.spent_on between p_from and p_to
        group by e.category
      ) x
    ), '[]'::jsonb),
    'series', (
      select jsonb_agg(jsonb_build_object(
        'date', g.day, 'revenue', coalesce(s.revenue, 0),
        'gross_profit', coalesce(s.revenue, 0) - coalesce(s.cogs, 0),
        'transactions', coalesce(s.cnt, 0), 'expenses', coalesce(ex.amount, 0)) order by g.day)
      from (select p_from + i as day from generate_series(0, p_to - p_from) as i) g
      left join (
        select (sa.created_at at time zone v_tz)::date as day, sum(sa.total) as revenue,
               sum(sa.cost_total) as cogs, count(*) as cnt
        from public.sales sa
        where sa.business_id = p_business_id and sa.status = 'completed'
          and sa.created_at >= v_start and sa.created_at < v_end
        group by 1
      ) s on s.day = g.day
      left join (
        select e.spent_on as day, sum(e.amount) as amount
        from public.expenses e
        where e.business_id = p_business_id and e.voided_at is null and e.spent_on between p_from and p_to
        group by 1
      ) ex on ex.day = g.day),
    'by_hour', coalesce((
      select jsonb_agg(jsonb_build_object('hour', h.hour, 'revenue', h.revenue, 'transactions', h.cnt)
                       order by h.hour)
      from (
        select extract(hour from (sa.created_at at time zone v_tz))::integer as hour,
               sum(sa.total) as revenue, count(*) as cnt
        from public.sales sa
        where sa.business_id = p_business_id and sa.status = 'completed'
          and sa.created_at >= v_start and sa.created_at < v_end
        group by 1
      ) h
    ), '[]'::jsonb));
end;
$$;
