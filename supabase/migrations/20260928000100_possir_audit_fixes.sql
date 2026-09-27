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
