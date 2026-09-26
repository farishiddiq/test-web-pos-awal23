-- =====================================================================
-- Data contoh untuk mode demo (PGlite di browser). Bukan untuk Supabase.
-- "Dapur Ahmad": usaha makanan rumahan mahasiswa di Kairo, 5 minggu data.
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
  v_minutes  integer;
  v_pool     uuid[] := '{}';
  v_picked   uuid[];
  v_pid      uuid;
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
  v_frozen   uuid;
  v_sup_grosir uuid;
  v_sup_frozen uuid;
  v_purchase jsonb;
  v_hours    integer[] := array[11, 12, 12, 13, 13, 13, 14, 14, 15, 16, 17, 18, 18, 19, 19, 19, 20, 20, 21, 21, 22];
  v_net      numeric;
  v_min      numeric;
  v_last     timestamptz;
  v_initial  numeric;
  v_delta    numeric;
  -- id produk
  p_geprek uuid; p_rendang uuid; p_mieayam uuid; p_soto uuid; p_nasgor uuid;
  p_mendoan uuid; p_bakwan uuid; p_esteh uuid; p_esjeruk uuid; p_kopi uuid;
  p_bakso uuid; p_dimsum uuid; p_sambal uuid; p_kerupuk uuid; p_tempe uuid;
begin
  perform setseed(0.2609);
  perform set_config('request.jwt.claim.sub', c_owner::text, false);

  v_ctx := public.create_business('Dapur Ahmad', 'makanan', 'Ahmad');
  v_b := (v_ctx -> 'business' ->> 'id')::uuid;
  v_today := (v_ctx ->> 'today')::date;

  update public.businesses set
    phone = '+20 100 000 0000',
    address = 'Hay Asyir, Nasr City, Kairo',
    receipt_footer = 'Syukran! Pesan lagi lewat WA ya.'
  where id = v_b;

  -- kasir kedua
  insert into public.business_members (business_id, user_id, role, display_name)
  values (v_b, c_cashier, 'cashier', 'Rizki');

  perform public.upsert_category(v_b, 'Frozen & Botolan');
  select id into v_frozen from public.categories where business_id = v_b and name = 'Frozen & Botolan';

  -- menu (stok tidak dilacak untuk makanan yang dimasak saat dipesan)
  p_geprek  := (public.upsert_product(v_b, jsonb_build_object('name', 'Nasi Ayam Geprek', 'price', 85, 'cost_price', 48, 'unit', 'porsi', 'track_stock', false, 'color', 'peach',
                 'category_id', (select id from public.categories where business_id = v_b and name = 'Makanan'))) ->> 'id')::uuid;
  p_rendang := (public.upsert_product(v_b, jsonb_build_object('name', 'Nasi Rendang', 'price', 110, 'cost_price', 66, 'unit', 'porsi', 'track_stock', false, 'color', 'rose',
                 'category_id', (select id from public.categories where business_id = v_b and name = 'Makanan'))) ->> 'id')::uuid;
  p_mieayam := (public.upsert_product(v_b, jsonb_build_object('name', 'Mie Ayam Bakso', 'price', 75, 'cost_price', 41, 'unit', 'mangkuk', 'track_stock', false, 'color', 'sand',
                 'category_id', (select id from public.categories where business_id = v_b and name = 'Makanan'))) ->> 'id')::uuid;
  p_soto    := (public.upsert_product(v_b, jsonb_build_object('name', 'Soto Ayam', 'price', 70, 'cost_price', 37, 'unit', 'mangkuk', 'track_stock', false, 'color', 'lime',
                 'category_id', (select id from public.categories where business_id = v_b and name = 'Makanan'))) ->> 'id')::uuid;
  p_nasgor  := (public.upsert_product(v_b, jsonb_build_object('name', 'Nasi Goreng Kampung', 'price', 65, 'cost_price', 31, 'unit', 'porsi', 'track_stock', false, 'color', 'peach',
                 'category_id', (select id from public.categories where business_id = v_b and name = 'Makanan'))) ->> 'id')::uuid;
  p_mendoan := (public.upsert_product(v_b, jsonb_build_object('name', 'Tempe Mendoan', 'price', 30, 'cost_price', 12, 'unit', 'porsi', 'track_stock', false, 'color', 'sand',
                 'category_id', (select id from public.categories where business_id = v_b and name = 'Camilan'))) ->> 'id')::uuid;
  p_bakwan  := (public.upsert_product(v_b, jsonb_build_object('name', 'Bakwan Sayur', 'price', 25, 'cost_price', 9, 'unit', 'porsi', 'track_stock', false, 'color', 'lime',
                 'category_id', (select id from public.categories where business_id = v_b and name = 'Camilan'))) ->> 'id')::uuid;
  p_esteh   := (public.upsert_product(v_b, jsonb_build_object('name', 'Es Teh Manis', 'price', 15, 'cost_price', 4, 'unit', 'gelas', 'track_stock', false, 'color', 'sky',
                 'category_id', (select id from public.categories where business_id = v_b and name = 'Minuman'))) ->> 'id')::uuid;
  p_esjeruk := (public.upsert_product(v_b, jsonb_build_object('name', 'Es Jeruk', 'price', 20, 'cost_price', 7, 'unit', 'gelas', 'track_stock', false, 'color', 'sand',
                 'category_id', (select id from public.categories where business_id = v_b and name = 'Minuman'))) ->> 'id')::uuid;
  p_kopi    := (public.upsert_product(v_b, jsonb_build_object('name', 'Kopi Susu Gula Aren', 'price', 35, 'cost_price', 14, 'unit', 'gelas', 'track_stock', false, 'color', 'stone',
                 'category_id', (select id from public.categories where business_id = v_b and name = 'Minuman'))) ->> 'id')::uuid;
  -- barang jadi yang stoknya dilacak (stok awal diisi di akhir supaya riwayatnya pas)
  p_bakso   := (public.upsert_product(v_b, jsonb_build_object('name', 'Bakso Frozen isi 25', 'price', 160, 'cost_price', 115, 'unit', 'pack', 'track_stock', true, 'min_stock', 5, 'color', 'rose', 'sku', 'FRZ-BKS25', 'category_id', v_frozen)) ->> 'id')::uuid;
  p_dimsum  := (public.upsert_product(v_b, jsonb_build_object('name', 'Dimsum Ayam isi 10', 'price', 120, 'cost_price', 80, 'unit', 'pack', 'track_stock', true, 'min_stock', 5, 'color', 'peach', 'sku', 'FRZ-DMS10', 'category_id', v_frozen)) ->> 'id')::uuid;
  p_sambal  := (public.upsert_product(v_b, jsonb_build_object('name', 'Sambal Bawang Botol', 'price', 70, 'cost_price', 38, 'unit', 'botol', 'track_stock', true, 'min_stock', 6, 'color', 'rose', 'category_id', v_frozen)) ->> 'id')::uuid;
  p_kerupuk := (public.upsert_product(v_b, jsonb_build_object('name', 'Kerupuk Udang', 'price', 45, 'cost_price', 28, 'unit', 'bungkus', 'track_stock', true, 'min_stock', 5, 'color', 'sand', 'category_id', v_frozen)) ->> 'id')::uuid;
  p_tempe   := (public.upsert_product(v_b, jsonb_build_object('name', 'Tempe Mentah', 'price', 40, 'cost_price', 22, 'unit', 'papan', 'track_stock', true, 'min_stock', 3, 'color', 'lime', 'category_id', v_frozen)) ->> 'id')::uuid;

  -- bobot kelarisan
  v_pool := array_fill(p_geprek, array[14]) || array_fill(p_esteh, array[12]) || array_fill(p_mieayam, array[9])
         || array_fill(p_rendang, array[7]) || array_fill(p_soto, array[6]) || array_fill(p_nasgor, array[6])
         || array_fill(p_mendoan, array[6]) || array_fill(p_esjeruk, array[5]) || array_fill(p_kopi, array[5])
         || array_fill(p_bakwan, array[4]) || array_fill(p_bakso, array[2]) || array_fill(p_dimsum, array[2])
         || array_fill(p_sambal, array[2]) || array_fill(p_kerupuk, array[2]) || array_fill(p_tempe, array[1]);

  -- pelanggan langganan (tanpa nomor HP supaya demo tidak mengirim WA ke orang sungguhan)
  v_customers := array[
    (public.upsert_customer(v_b, '{"name":"Abdullah Syakir","note":"Asrama Buuts, lantai 3"}'::jsonb) ->> 'id')::uuid,
    (public.upsert_customer(v_b, '{"name":"Mahmoud Adel","note":"Tetangga flat sebelah"}'::jsonb) ->> 'id')::uuid,
    (public.upsert_customer(v_b, '{"name":"Nabila Putri"}'::jsonb) ->> 'id')::uuid,
    (public.upsert_customer(v_b, '{"name":"Hasan Basri","note":"Biasa bayar tiap awal bulan"}'::jsonb) ->> 'id')::uuid,
    (public.upsert_customer(v_b, '{"name":"Aisyah Rahmawati"}'::jsonb) ->> 'id')::uuid,
    (public.upsert_customer(v_b, '{"name":"Faris Hidayat"}'::jsonb) ->> 'id')::uuid,
    (public.upsert_customer(v_b, '{"name":"Zaid Alatas"}'::jsonb) ->> 'id')::uuid];
  -- yang sering ngutang: Abdullah, Hasan, Nabila
  v_debtors := array_fill(v_customers[1], array[4]) || array_fill(v_customers[4], array[3])
            || array_fill(v_customers[3], array[3]) || array_fill(v_customers[2], array[2])
            || array[v_customers[5], v_customers[6], v_customers[7]];

  -- penjualan 35 hari terakhir
  for v_day in select d::date from generate_series(v_today - 34, v_today, interval '1 day') d loop
    v_n := 9 + floor(random() * 8)::integer
         + case when extract(isodow from v_day) in (4, 5) then 5 else 0 end;  -- Kamis-Jumat lebih ramai
    if v_day = v_today then
      -- hari ini selalu ada transaksi, tersebar di beberapa jam terakhir
      v_n := 7 + floor(random() * 4)::integer;
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

      -- item unik per transaksi
      v_r := random();
      v_lines := case when v_r < 0.35 then 1 when v_r < 0.75 then 2 when v_r < 0.95 then 3 else 4 end;
      v_picked := '{}';
      v_items := '[]'::jsonb;
      for v_j in 1..v_lines loop
        v_pid := v_pool[1 + floor(random() * array_length(v_pool, 1))::integer];
        continue when v_pid = any (v_picked);
        v_picked := v_picked || v_pid;
        v_items := v_items || jsonb_build_array(jsonb_build_object(
          'product_id', v_pid,
          'qty', case when random() < 0.78 then 1 when random() < 0.85 then 2 else 3 end));
      end loop;
      if random() < 0.05 then
        v_items := v_items || '[{"name":"Tambahan Nasi","qty":1,"unit_price":10,"unit_cost":3}]'::jsonb;
      end if;

      v_r := random();
      v_method := case when v_r < 0.48 then 'cash' when v_r < 0.72 then 'instapay'
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
  perform public.void_sale(v_b, v_sale_id, 'Pelanggan batal pesan');
  update public.sales set voided_at = created_at + interval '12 minutes' where id = v_sale_id;
  update public.stock_movements set created_at = (select created_at + interval '12 minutes' from public.sales where id = v_sale_id)
  where sale_id = v_sale_id and type = 'sale_void';

  -- supplier dan restock
  v_sup_grosir := (public.upsert_supplier(v_b, '{"name":"Grosir Hay Asyir","note":"Sembako dan barang Indonesia"}'::jsonb) ->> 'id')::uuid;
  v_sup_frozen := (public.upsert_supplier(v_b, '{"name":"Frozen Madinat Nasr","note":"Bakso dan dimsum, antar tiap Selasa"}'::jsonb) ->> 'id')::uuid;

  perform private.seed_purchase(v_b, v_sup_grosir, v_today - 30, '10 hours', null, null, jsonb_build_array(
    jsonb_build_object('product_id', p_kerupuk, 'qty', 18, 'unit_cost', 28),
    jsonb_build_object('product_id', p_sambal, 'qty', 24, 'unit_cost', 38)));
  perform private.seed_purchase(v_b, v_sup_grosir, v_today - 24, '11 hours', null, null, jsonb_build_array(
    jsonb_build_object('product_id', p_tempe, 'qty', 8, 'unit_cost', 22)));
  -- dibayar sebagian: jadi hutang ke supplier
  perform private.seed_purchase(v_b, v_sup_frozen, v_today - 21, '9 hours', 1500, 'cash', jsonb_build_array(
    jsonb_build_object('product_id', p_bakso, 'qty', 12, 'unit_cost', 115),
    jsonb_build_object('product_id', p_dimsum, 'qty', 10, 'unit_cost', 80)));
  perform public.record_supplier_payment(v_b, v_sup_frozen, 400, 'instapay', 'Cicilan pertama');
  update public.supplier_payments set created_at = private.day_start(v_today - 12, c_tz) + interval '16 hours'
  where supplier_id = v_sup_frozen;
  perform private.seed_purchase(v_b, v_sup_grosir, v_today - 10, '10 hours', null, null, jsonb_build_array(
    jsonb_build_object('product_id', p_tempe, 'qty', 6, 'unit_cost', 22),
    jsonb_build_object('product_id', p_sambal, 'qty', 18, 'unit_cost', 38)));
  perform private.seed_purchase(v_b, v_sup_frozen, v_today - 6, '9 hours', null, 'vodafone_cash', jsonb_build_array(
    jsonb_build_object('product_id', p_bakso, 'qty', 10, 'unit_cost', 115),
    jsonb_build_object('product_id', p_dimsum, 'qty', 8, 'unit_cost', 80)));
  perform private.seed_purchase(v_b, v_sup_grosir, v_today - 3, '11 hours', null, null, jsonb_build_array(
    jsonb_build_object('product_id', p_kerupuk, 'qty', 10, 'unit_cost', 28)));

  -- Stok awal cukup besar supaya riwayat stok tidak pernah minus. Tiga produk sengaja
  -- menipis: kalau sisa stok masih di atas target, selisihnya dicatat sebagai stock opname.
  for v_p in
    select t.product_id, t.target, t.initial_hint, t.reason, t.note, pr.cost_price
    from (values (p_bakso,   null::numeric, 14::numeric, null, null),
                 (p_sambal,  null::numeric, 10::numeric, null, null),
                 (p_dimsum,  3::numeric,    0::numeric,  'damaged', 'Stock opname: kemasan sobek'),
                 (p_kerupuk, 2::numeric,    0::numeric,  'damaged', 'Stock opname: melempem'),
                 (p_tempe,   0::numeric,    0::numeric,  'expired', 'Stock opname: sudah tidak layak'))
      as t(product_id, target, initial_hint, reason, note)
    join public.products pr on pr.id = t.product_id
  loop
    select coalesce(sum(m.qty_change), 0), least(coalesce(min(m.running), 0), 0), max(m.created_at)
    into v_net, v_min, v_last
    from (select mm.qty_change, mm.created_at,
                 sum(mm.qty_change) over (order by mm.created_at, mm.id) as running
          from public.stock_movements mm
          where mm.product_id = v_p.product_id) m;
    v_initial := greatest(coalesce(v_p.target - v_net, v_p.initial_hint), -v_min + 1, v_p.initial_hint);
    insert into public.stock_movements (business_id, product_id, type, qty_change, qty_after, unit_cost,
                                        created_by, created_by_name, created_at)
    values (v_b, v_p.product_id, 'initial', v_initial, 0, v_p.cost_price, c_owner, 'Ahmad',
            private.day_start(v_today - 35, c_tz) + interval '8 hours');
    v_delta := coalesce(v_p.target - (v_initial + v_net), 0);
    if v_delta < 0 then
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

  -- pengeluaran operasional
  for v_day in select d::date from generate_series(v_today - 34, v_today, interval '1 day') d loop
    if extract(isodow from v_day) = 6 then
      perform public.save_expense(v_b, jsonb_build_object('category', 'Gas', 'amount', 190 + floor(random() * 4) * 10,
        'note', 'Isi ulang tabung gas', 'spent_on', v_day, 'method_code', 'cash'));
    end if;
    if random() < 0.22 then
      perform public.save_expense(v_b, jsonb_build_object('category', 'Kemasan', 'amount', 60 + floor(random() * 10) * 10,
        'note', 'Box nasi dan plastik', 'spent_on', v_day, 'method_code', 'cash'));
    end if;
    if random() < 0.3 then
      perform public.save_expense(v_b, jsonb_build_object('category', 'Transport', 'amount', 30 + floor(random() * 6) * 10,
        'note', 'Uber belanja ke pasar', 'spent_on', v_day, 'method_code', case when random() < 0.5 then 'cash' else 'vodafone_cash' end));
    end if;
    if random() < 0.25 then
      perform public.save_expense(v_b, jsonb_build_object('category', 'Ongkir', 'amount', 25 + floor(random() * 5) * 5,
        'note', 'Antar pesanan ke Rabaa', 'spent_on', v_day, 'method_code', 'cash'));
    end if;
  end loop;
  perform public.save_expense(v_b, jsonb_build_object('category', 'Listrik', 'amount', 340, 'note', 'Kartu listrik flat',
    'spent_on', v_today - 19, 'method_code', 'cash'));
  perform public.save_expense(v_b, jsonb_build_object('category', 'Iklan', 'amount', 150, 'note', 'Promosi Instagram',
    'spent_on', v_today - 9, 'method_code', 'instapay'));
  update public.expenses e set created_at = private.day_start(e.spent_on, c_tz) + interval '9 hours 20 minutes'
  where e.business_id = v_b;

  -- tanggal pembuatan data master ikut awal cerita
  update public.businesses set created_at = private.day_start(v_today - 35, c_tz) + interval '8 hours' where id = v_b;
  update public.products set created_at = private.day_start(v_today - 35, c_tz) + interval '8 hours' where business_id = v_b;
  update public.customers set created_at = private.day_start(v_today - 35, c_tz) + interval '8 hours' where business_id = v_b;
  update public.suppliers set created_at = private.day_start(v_today - 31, c_tz) + interval '8 hours' where business_id = v_b;

  -- jejak audit ikut waktu kejadian aslinya
  delete from public.audit_logs where business_id = v_b and action in ('product.create', 'customer.create', 'expense.create');
  update public.audit_logs set created_at = private.day_start(v_today - 35, c_tz) + interval '8 hours'
  where business_id = v_b and action in ('business.create');
end;
$$;

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000d01', false);
