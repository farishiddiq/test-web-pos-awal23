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
