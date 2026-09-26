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
