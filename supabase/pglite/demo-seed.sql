-- =====================================================================
-- Data contoh untuk mode demo (PGlite di browser). Bukan untuk Supabase.
-- "Pasar Asia Ahmad": toko barang Indonesia dan Asia milik mahasiswa di Kairo,
-- 5 minggu data. Semua barang kemasan dengan stok dilacak dan restock mingguan.
-- Transaksi dibuat lewat RPC asli (create_sale, void_sale, ...) lalu
-- tanggalnya dimundurkan, supaya stok, piutang, dan laporan tetap konsisten.
-- =====================================================================

-- Pembelian yang tanggalnya dimundurkan (hanya untuk seed)
create or replace function private.seed_purchase(
  p_business_id uuid, p_supplier_id uuid, p_day date, p_time interval,
  p_paid numeric, p_method text, p_items jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
  v_ts timestamptz := private.day_start(p_day, 'Africa/Cairo') + p_time;
begin
  v_id := (public.create_purchase(p_business_id, jsonb_strip_nulls(jsonb_build_object(
    'supplier_id', p_supplier_id, 'purchased_on', p_day, 'items', p_items,
    'paid_amount', p_paid, 'method_code', p_method))) ->> 'id')::uuid;
  update public.purchases set created_at = v_ts where id = v_id;
  update public.stock_movements set created_at = v_ts where purchase_id = v_id;
end;
$$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-4000-8000-000000000d01', 'ahmad@demo.possir', '{"full_name":"Ahmad Fauzi"}'),
  ('00000000-0000-4000-8000-000000000d02', 'rizki@demo.possir', '{"full_name":"Rizki Maulana"}')
on conflict (id) do nothing;

-- Katalog seed: isi per karton grosir, bobot kelarisan, target stok akhir, pemasok,
-- dan catatan opname untuk tiga barang yang sengaja menipis.
create table private.seed_catalog (
  id uuid, name text, price numeric, cost numeric, unit text, min_stock numeric, color text, sku text,
  category text, bulk boolean, weight int, case_qty int, target numeric, supplier text, reason text, note text
);
insert into private.seed_catalog (name, price, cost, unit, min_stock, color, sku, category, bulk, weight, case_qty, target, supplier, reason, note) values
  ('Indomie Goreng Original',        22,  15, 'pcs',     40, 'peach', 'IDM-GRG', 'Mie instan',      true,  14, 40, 96, 'grosir', null, null),
  ('Indomie Soto Mie',               22,  15, 'pcs',     30, 'sand',  'IDM-SOT', 'Mie instan',      true,   8, 40, 64, 'grosir', null, null),
  ('Mie Sedaap Goreng',              21,  14, 'pcs',     30, 'lime',  'SDP-GRG', 'Mie instan',      true,   6, 40, 58, 'grosir', null, null),
  ('Samyang Buldak Hot Chicken',     85,  62, 'pcs',     10, 'rose',  'SMY-HOT', 'Mie instan',      false,  5, 10,  4, 'import', 'lost', 'Stock opname: selisih hitung'),
  ('Kecap Manis Bango 220 ml',      115,  82, 'botol',    6, 'stone', 'BGO-220', 'Bumbu & saus',    false,  5, 12,  2, 'grosir', 'damaged', 'Stock opname: botol retak'),
  ('Sambal ABC Extra Pedas 335 ml',  95,  66, 'botol',    6, 'rose',  'ABC-335', 'Bumbu & saus',    false,  4, 12, 14, 'grosir', null, null),
  ('Bumbu Racik Nasi Goreng',        18,  11, 'sachet',  20, 'sand',  'RCK-NGR', 'Bumbu & saus',    true,   5, 24, 45, 'grosir', null, null),
  ('Royco Kaldu Ayam 94 g',          45,  31, 'bungkus',  8, 'peach', 'RYC-94',  'Bumbu & saus',    false,  3, 12, 17, 'grosir', null, null),
  ('Saus Tiram Saori 133 ml',        80,  56, 'botol',    5, 'stone', 'SAO-133', 'Bumbu & saus',    false,  2,  6,  9, 'grosir', null, null),
  ('Kerupuk Udang Finna 200 g',      85,  58, 'bungkus',  6, 'peach', 'FIN-200', 'Camilan',         false,  4, 12,  3, 'grosir', 'damaged', 'Stock opname: melempem'),
  ('Chitato Sapi Panggang 68 g',     55,  37, 'bungkus',  8, 'sand',  'CHT-68',  'Camilan',         false,  4, 12, 20, 'grosir', null, null),
  ('Beng-Beng',                      14,   9, 'pcs',     24, 'stone', 'BNG-20',  'Camilan',         true,   5, 24, 60, 'grosir', null, null),
  ('Nori Snack Tao Kae Noi',         40,  27, 'bungkus', 10, 'lime',  'TKN-NRI', 'Camilan',         false,  3, 12, 22, 'import', null, null),
  ('Kopi Kapal Api Mix',             10,   6, 'sachet',  30, 'stone', 'KPA-MIX', 'Minuman',         true,   5, 30, 70, 'grosir', null, null),
  ('Teh Sariwangi isi 25',          105,  74, 'kotak',    5, 'mint',  'SRW-25',  'Minuman',         false,  2,  6, 11, 'grosir', null, null),
  ('Beras Pandan Wangi 5 kg',       640, 515, 'karung',   3, 'mint',  'BRS-PW5', 'Sembako',         false,  1,  4,  6, 'import', null, null),
  ('Tempe Beku',                     65,  42, 'papan',    8, 'lime',  'TMP-BKU', 'Frozen & dingin', false,  3, 10, 15, 'frozen', null, null),
  ('Bakso Sapi isi 25',             175, 128, 'pack',     5, 'rose',  'BKS-25',  'Frozen & dingin', false,  2,  6,  9, 'frozen', null, null);

do $$
declare
  c_owner   constant uuid := '00000000-0000-4000-8000-000000000d01';
  c_cashier constant uuid := '00000000-0000-4000-8000-000000000d02';
  c_tz      constant text := 'Africa/Cairo';
  v_b        uuid;
  v_ctx      jsonb;
  v_today    date;
  v_now      timestamptz := now();
  v_day      date;
  v_n        integer;
  v_i        integer;
  v_j        integer;
  v_lines    integer;
  v_ts       timestamptz;
  v_pool     uuid[] := '{}';
  v_bulk     uuid[] := '{}';
  v_picked   uuid[];
  v_pid      uuid;
  v_qty      numeric;
  v_items    jsonb;
  v_sale     jsonb;
  v_sale_id  uuid;
  v_r        double precision;
  v_method   text;
  v_payload  jsonb;
  v_customers uuid[] := '{}';
  v_debtors  uuid[] := '{}';
  v_age      integer;
  v_cust     uuid;
  v_total    numeric;
  v_p        record;
  v_sup_grosir uuid;
  v_sup_import uuid;
  v_sup_frozen uuid;
  v_sup      uuid;
  v_week     date;
  v_hours    integer[] := array[10, 11, 12, 13, 13, 14, 15, 16, 16, 17, 18, 19, 19, 20, 20, 21, 21, 22];
  v_net      numeric;
  v_min      numeric;
  v_last     timestamptz;
  v_initial  numeric;
  v_delta    numeric;
  v_cat      jsonb;
  v_name     text;
begin
  perform setseed(0.2609);
  perform set_config('request.jwt.claim.sub', c_owner::text, false);

  v_ctx := public.create_business('Pasar Asia Ahmad', 'toko', 'Ahmad');
  v_b := (v_ctx -> 'business' ->> 'id')::uuid;
  v_today := (v_ctx ->> 'today')::date;

  update public.businesses set
    phone = '+20 100 000 0000',
    address = 'Hay Asyir, Nasr City, Kairo',
    receipt_footer = 'Syukran! Barang Indonesia dan Asia, pesan lewat WA juga bisa.'
  where id = v_b;

  -- kasir kedua
  insert into public.business_members (business_id, user_id, role, display_name)
  values (v_b, c_cashier, 'cashier', 'Rizki');

  -- kategori toko barang Asia (bawaan tipe "toko" diganti)
  delete from public.categories where business_id = v_b;
  v_i := 0;
  foreach v_name in array array['Mie instan', 'Bumbu & saus', 'Camilan', 'Minuman', 'Sembako', 'Frozen & dingin'] loop
    v_i := v_i + 1;
    insert into public.categories (business_id, name, sort_order) values (v_b, v_name, v_i);
  end loop;
  select jsonb_object_agg(name, id) into v_cat from public.categories where business_id = v_b;

  for v_p in select * from private.seed_catalog order by category, weight desc loop
    v_pid := (public.upsert_product(v_b, jsonb_build_object(
      'name', v_p.name, 'price', v_p.price, 'cost_price', v_p.cost, 'unit', v_p.unit, 'track_stock', true,
      'min_stock', v_p.min_stock, 'color', v_p.color, 'sku', v_p.sku,
      'category_id', v_cat ->> v_p.category)) ->> 'id')::uuid;
    update private.seed_catalog set id = v_pid where name = v_p.name;
    v_pool := v_pool || array_fill(v_pid, array[v_p.weight]);
    if v_p.bulk then
      v_bulk := v_bulk || v_pid;
    end if;
  end loop;

  -- pelanggan langganan (tanpa nomor HP supaya demo tidak mengirim WA ke orang sungguhan)
  v_customers := array[
    (public.upsert_customer(v_b, '{"name":"Abdullah Syakir","note":"Asrama Buuts, lantai 3"}'::jsonb) ->> 'id')::uuid,
    (public.upsert_customer(v_b, '{"name":"Mahmoud Adel","note":"Tetangga flat sebelah"}'::jsonb) ->> 'id')::uuid,
    (public.upsert_customer(v_b, '{"name":"Nabila Putri"}'::jsonb) ->> 'id')::uuid,
    (public.upsert_customer(v_b, '{"name":"Hasan Basri","note":"Biasa bayar tiap awal bulan"}'::jsonb) ->> 'id')::uuid,
    (public.upsert_customer(v_b, '{"name":"Aisyah Rahmawati","note":"Borong mie untuk flat"}'::jsonb) ->> 'id')::uuid,
    (public.upsert_customer(v_b, '{"name":"Faris Hidayat"}'::jsonb) ->> 'id')::uuid,
    (public.upsert_customer(v_b, '{"name":"Zaid Alatas"}'::jsonb) ->> 'id')::uuid];
  -- yang sering ngutang: Abdullah, Hasan, Nabila
  v_debtors := array_fill(v_customers[1], array[4]) || array_fill(v_customers[4], array[3])
            || array_fill(v_customers[3], array[3]) || array_fill(v_customers[2], array[2])
            || array[v_customers[5], v_customers[6], v_customers[7]];

  -- penjualan 35 hari terakhir
  for v_day in select d::date from generate_series(v_today - 34, v_today, interval '1 day') d loop
    v_n := 7 + floor(random() * 6)::integer
         + case when extract(isodow from v_day) in (4, 5) then 4 else 0 end;  -- Kamis-Jumat lebih ramai
    if v_day = v_today then
      v_n := 5 + floor(random() * 4)::integer;
    end if;

    for v_i in 1..v_n loop
      if v_day = v_today then
        v_ts := v_now - interval '6 minutes'
              - random() * least(v_now - private.day_start(v_today, c_tz) - interval '10 minutes', interval '9 hours');
        continue when v_ts < private.day_start(v_today, c_tz);
      else
        v_ts := private.day_start(v_day, c_tz)
              + make_interval(hours => v_hours[1 + floor(random() * array_length(v_hours, 1))::integer],
                              mins => floor(random() * 60)::integer, secs => floor(random() * 60)::integer);
      end if;
      continue when v_ts > v_now - interval '4 minutes';

      -- belanjaan 1-5 jenis barang; mie dan sachet biasanya dibeli beberapa sekaligus
      v_r := random();
      v_lines := case when v_r < 0.3 then 1 when v_r < 0.65 then 2 when v_r < 0.88 then 3 when v_r < 0.97 then 4 else 5 end;
      v_picked := '{}';
      v_items := '[]'::jsonb;
      for v_j in 1..v_lines loop
        v_pid := v_pool[1 + floor(random() * array_length(v_pool, 1))::integer];
        continue when v_pid = any (v_picked);
        v_picked := v_picked || v_pid;
        if v_pid = any (v_bulk) then
          v_qty := (array[2, 3, 5, 5, 5, 10])[1 + floor(random() * 6)::integer];
        else
          v_qty := case when random() < 0.75 then 1 when random() < 0.8 then 2 else 3 end;
        end if;
        v_items := v_items || jsonb_build_array(jsonb_build_object('product_id', v_pid, 'qty', v_qty));
      end loop;
      if random() < 0.06 then
        v_items := v_items || '[{"name":"Kantong belanja besar","qty":1,"unit_price":5,"unit_cost":2}]'::jsonb;
      end if;

      v_r := random();
      v_method := case when v_r < 0.46 then 'cash' when v_r < 0.72 then 'instapay'
                       when v_r < 0.90 then 'vodafone_cash' else 'hutang' end;
      v_payload := jsonb_build_object('items', v_items, 'payment_method', v_method,
                                      'discount', case when random() < 0.05 then 5 else 0 end);
      if v_method = 'hutang' then
        v_cust := v_debtors[1 + floor(random() * array_length(v_debtors, 1))::integer];
        v_payload := v_payload || jsonb_build_object(
          'customer_id', v_cust,
          'due_date', case when random() < 0.5 then null else to_char(v_day + 7, 'YYYY-MM-DD') end);
      end if;

      -- sekitar sepertiga transaksi dilayani kasir
      perform set_config('request.jwt.claim.sub', (case when random() < 0.32 then c_cashier else c_owner end)::text, false);
      v_sale := public.create_sale(v_b, v_payload);
      perform set_config('request.jwt.claim.sub', c_owner::text, false);

      v_sale_id := (v_sale ->> 'id')::uuid;
      update public.sales set created_at = v_ts where id = v_sale_id;
      update public.stock_movements set created_at = v_ts where sale_id = v_sale_id;
      update public.customer_debts set created_at = v_ts where sale_id = v_sale_id;

      if (v_sale ->> 'payment_method_code') = 'cash' and random() < 0.4 then
        v_total := (v_sale ->> 'total')::numeric;
        update public.sales set cash_received = ceil(v_total / 50) * 50 + case when random() < 0.3 then 50 else 0 end
        where id = v_sale_id;
      end if;
    end loop;
  end loop;

  -- pembayaran piutang: hutang lama hampir semua lunas, hutang minggu ini sebagian masih terbuka
  for v_p in
    select d.id, d.customer_id, d.amount, d.created_at
    from public.customer_debts d
    where d.business_id = v_b
    order by d.created_at
  loop
    v_age := v_today - (v_p.created_at at time zone c_tz)::date;
    v_r := random();
    v_ts := v_p.created_at + make_interval(days => 1 + floor(random() * 4)::integer, hours => floor(random() * 5)::integer);
    continue when v_ts > v_now - interval '10 minutes';
    if v_age > 7 then
      continue when v_r > 0.97;
    else
      continue when v_r > 0.45;
    end if;
    insert into public.debt_payments (business_id, customer_id, amount, method_code, method_name,
                                      created_by, created_by_name, created_at)
    values (v_b, v_p.customer_id,
            case when v_r < 0.93 or v_age <= 7 then v_p.amount else round(v_p.amount / 2) end,
            case when random() < 0.55 then 'cash' else 'instapay' end,
            'placeholder', c_owner, 'Ahmad', v_ts);
  end loop;
  update public.debt_payments set method_name = case method_code when 'cash' then 'Cash' else 'InstaPay' end
  where business_id = v_b;

  -- dua transaksi dibatalkan, dengan jejak audit
  select id into v_sale_id from public.sales
  where business_id = v_b and created_at < private.day_start(v_today, c_tz) and debt_amount = 0
  order by created_at desc limit 1;
  perform public.void_sale(v_b, v_sale_id, 'Salah input jumlah');
  update public.sales set voided_at = created_at + interval '6 minutes' where id = v_sale_id;
  update public.stock_movements set created_at = (select created_at + interval '6 minutes' from public.sales where id = v_sale_id)
  where sale_id = v_sale_id and type = 'sale_void';

  select id into v_sale_id from public.sales
  where business_id = v_b and created_at < private.day_start(v_today - 6, c_tz) and debt_amount = 0 and status = 'completed'
  order by created_at desc limit 1;
  perform public.void_sale(v_b, v_sale_id, 'Pembeli batal, barang dikembalikan');
  update public.sales set voided_at = created_at + interval '12 minutes' where id = v_sale_id;
  update public.stock_movements set created_at = (select created_at + interval '12 minutes' from public.sales where id = v_sale_id)
  where sale_id = v_sale_id and type = 'sale_void';

  -- pemasok
  v_sup_grosir := (public.upsert_supplier(v_b, '{"name":"Grosir Indo Hay Asyir","note":"Mie, bumbu, dan camilan Indonesia per karton"}'::jsonb) ->> 'id')::uuid;
  v_sup_import := (public.upsert_supplier(v_b, '{"name":"Asia Import Abbas El Akkad","note":"Barang Korea, Thailand, dan beras"}'::jsonb) ->> 'id')::uuid;
  v_sup_frozen := (public.upsert_supplier(v_b, '{"name":"Frozen Madinat Nasr","note":"Tempe dan bakso beku, antar tiap Selasa"}'::jsonb) ->> 'id')::uuid;

  -- Restock mingguan: jumlah = penjualan minggu itu, dibulatkan ke atas ke isi karton.
  -- Barang yang sengaja menipis tidak ikut restock terakhir.
  for v_week in select d::date from generate_series(v_today - 34, v_today - 6, interval '7 days') d loop
    foreach v_name in array array['grosir', 'import', 'frozen'] loop
      select coalesce(jsonb_agg(jsonb_build_object('product_id', x.id, 'qty', x.qty, 'unit_cost', x.cost) order by x.name), '[]'::jsonb)
      into v_items
      from (
        select c.id, c.name, c.cost,
               case when c.reason is null
                    then ceil(greatest(sum(-m.qty_change), 1) / c.case_qty) * c.case_qty
                    -- barang yang akan menipis: restock sedikit di bawah penjualan
                    else greatest(floor(sum(-m.qty_change) * 0.9 / c.case_qty), 1) * c.case_qty end as qty
        from private.seed_catalog c
        join public.stock_movements m on m.product_id = c.id and m.type = 'sale'
          and m.created_at >= private.day_start(v_week, c_tz) and m.created_at < private.day_start(v_week + 7, c_tz)
        where c.supplier = v_name and not (c.reason is not null and v_week = v_today - 6)
        group by c.id, c.name, c.cost, c.case_qty, c.reason
      ) x;
      continue when jsonb_array_length(v_items) = 0;
      v_sup := case v_name when 'grosir' then v_sup_grosir when 'import' then v_sup_import else v_sup_frozen end;
      if v_name = 'import' and v_week = v_today - 13 then
        -- dibayar sebagian: jadi hutang ke pemasok
        perform private.seed_purchase(v_b, v_sup, v_week, '9 hours 30 minutes', 1000, 'cash', v_items);
      else
        perform private.seed_purchase(v_b, v_sup, v_week, '9 hours 30 minutes', null,
          case v_name when 'grosir' then 'cash' when 'import' then 'instapay' else 'vodafone_cash' end, v_items);
      end if;
    end loop;
  end loop;
  if exists (select 1 from public.purchases where supplier_id = v_sup_import and debt_amount > 0) then
    perform public.record_supplier_payment(v_b, v_sup_import, 500, 'instapay', 'Cicilan pertama');
    update public.supplier_payments set created_at = private.day_start(v_today - 5, c_tz) + interval '16 hours'
    where supplier_id = v_sup_import;
  end if;

  -- Stok awal cukup supaya riwayat stok tidak pernah minus dan stok akhir sesuai target.
  -- Barang yang menipis: kalau masih lebih dari target, selisihnya dicatat sebagai stock opname.
  for v_p in
    select c.id as product_id, c.target, c.reason, c.note, pr.cost_price
    from private.seed_catalog c join public.products pr on pr.id = c.id
  loop
    select coalesce(sum(m.qty_change), 0), least(coalesce(min(m.running), 0), 0), max(m.created_at)
    into v_net, v_min, v_last
    from (select mm.qty_change, mm.created_at,
                 sum(mm.qty_change) over (order by mm.created_at, mm.id) as running
          from public.stock_movements mm
          where mm.product_id = v_p.product_id) m;
    v_initial := greatest(v_p.target - v_net, -v_min + 1);
    insert into public.stock_movements (business_id, product_id, type, qty_change, qty_after, unit_cost,
                                        created_by, created_by_name, created_at)
    values (v_b, v_p.product_id, 'initial', v_initial, 0, v_p.cost_price, c_owner, 'Ahmad',
            private.day_start(v_today - 35, c_tz) + interval '8 hours');
    v_delta := v_p.target - (v_initial + v_net);
    if v_delta < 0 and v_p.reason is not null then
      insert into public.stock_movements (business_id, product_id, type, reason, qty_change, qty_after, unit_cost,
                                          note, created_by, created_by_name, created_at)
      values (v_b, v_p.product_id, 'adjustment', v_p.reason, v_delta, 0, v_p.cost_price, v_p.note, c_owner, 'Ahmad',
              least(coalesce(v_last, v_now) + interval '40 minutes', v_now - interval '2 minutes'));
    end if;
  end loop;

  update public.stock_movements m set qty_after = x.running
  from (select id, sum(qty_change) over (partition by product_id order by created_at, id) as running
        from public.stock_movements where business_id = v_b) x
  where m.id = x.id;
  update public.products p set stock = coalesce((select sum(m.qty_change) from public.stock_movements m where m.product_id = p.id), 0)
  where p.business_id = v_b and p.track_stock;

  -- pengeluaran operasional toko
  for v_day in select d::date from generate_series(v_today - 34, v_today, interval '1 day') d loop
    if (v_today - v_day) % 7 = 6 then
      perform public.save_expense(v_b, jsonb_build_object('category', 'Transport', 'amount', 120 + floor(random() * 5) * 10,
        'note', 'Uber angkut karton dari grosir', 'spent_on', v_day, 'method_code', 'cash'));
    end if;
    if random() < 0.18 then
      perform public.save_expense(v_b, jsonb_build_object('category', 'Kemasan', 'amount', 40 + floor(random() * 5) * 10,
        'note', 'Kantong plastik dan lakban', 'spent_on', v_day, 'method_code', 'cash'));
    end if;
    if random() < 0.25 then
      perform public.save_expense(v_b, jsonb_build_object('category', 'Ongkir', 'amount', 25 + floor(random() * 5) * 5,
        'note', 'Antar pesanan ke Rabaa', 'spent_on', v_day,
        'method_code', case when random() < 0.5 then 'cash' else 'vodafone_cash' end));
    end if;
  end loop;
  perform public.save_expense(v_b, jsonb_build_object('category', 'Ongkir', 'amount', 900,
    'note', 'Titip koper Jakarta-Kairo (bumbu dan kecap)', 'spent_on', v_today - 27, 'method_code', 'instapay'));
  perform public.save_expense(v_b, jsonb_build_object('category', 'Sewa', 'amount', 600,
    'note', 'Sewa rak gudang di flat', 'spent_on', v_today - 25, 'method_code', 'cash'));
  perform public.save_expense(v_b, jsonb_build_object('category', 'Listrik', 'amount', 280,
    'note', 'Kartu listrik, freezer', 'spent_on', v_today - 19, 'method_code', 'cash'));
  perform public.save_expense(v_b, jsonb_build_object('category', 'Iklan', 'amount', 150,
    'note', 'Promosi di grup WA Masisir', 'spent_on', v_today - 9, 'method_code', 'instapay'));
  update public.expenses e set created_at = private.day_start(e.spent_on, c_tz) + interval '9 hours 20 minutes'
  where e.business_id = v_b;

  -- tanggal pembuatan data master ikut awal cerita
  update public.businesses set created_at = private.day_start(v_today - 35, c_tz) + interval '8 hours' where id = v_b;
  update public.products set created_at = private.day_start(v_today - 35, c_tz) + interval '8 hours' where business_id = v_b;
  update public.categories set created_at = private.day_start(v_today - 35, c_tz) + interval '8 hours' where business_id = v_b;
  update public.customers set created_at = private.day_start(v_today - 35, c_tz) + interval '8 hours' where business_id = v_b;
  update public.suppliers set created_at = private.day_start(v_today - 35, c_tz) + interval '8 hours' where business_id = v_b;

  -- jejak audit ikut waktu kejadian aslinya
  delete from public.audit_logs where business_id = v_b
    and action in ('product.create', 'customer.create', 'expense.create', 'supplier.create');
  update public.audit_logs set created_at = private.day_start(v_today - 35, c_tz) + interval '8 hours'
  where business_id = v_b and action in ('business.create');
end;
$$;

drop table private.seed_catalog;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000d01', false);
