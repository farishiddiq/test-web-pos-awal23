import { useState } from 'react';
import { Link } from 'react-router';
import {
  ArrowRight,
  ChartLineUp,
  Coins,
  HandCoins,
  Package,
  Plus,
  Receipt,
  ShoppingBagOpen,
  Wallet,
  WarningCircle,
  Tag,
} from '@phosphor-icons/react';
import { Page } from '@/components/layout/app-shell';
import { ButtonLink } from '@/components/ui/button';
import { Avatar, Badge, Delta, EmptyState, ErrorState, Money, PageHeader, SectionCard, Skeleton, StatTile } from '@/components/ui/display';
import { ColumnChart, InlineBar } from '@/components/charts/column-chart';
import { SaleRow, SaleRowSkeleton, paymentIcon } from '@/components/sale/sale-bits';
import { SaleDetailSheet } from '@/features/transaksi/sale-detail-sheet';
import { useBusiness } from '@/data/business';
import { useCustomers, useDashboard } from '@/data/queries';
import type { Dashboard } from '@/data/types';
import { formatMoney, formatQty } from '@/lib/format';
import { formatDateLong, formatDayMonth, greeting, weekdayShort, unpaidLabel } from '@/lib/dates';

export function DashboardPage() {
  const { context, tz, today } = useBusiness();
  const query = useDashboard();
  const [openSale, setOpenSale] = useState<string | null>(null);
  const firstName = context.me.display_name.split(' ')[0];

  return (
    <Page>
      <PageHeader
        title={`${greeting(tz)}, ${firstName}`}
        subtitle={`${formatDateLong(today)} · ${context.business.name}`}
        actions={
          <ButtonLink to="/kasir" icon={<Plus size={18} weight="bold" />} className="max-md:hidden">
            Transaksi baru
          </ButtonLink>
        }
      />
      {query.isPending ? (
        <DashboardSkeleton />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : (
        <DashboardBody data={query.data} onOpenSale={setOpenSale} />
      )}
      <SaleDetailSheet saleId={openSale} onClose={() => setOpenSale(null)} />
    </Page>
  );
}

function DashboardBody({ data, onOpenSale }: { data: Dashboard; onOpenSale: (id: string) => void }) {
  const { isOwner, tz, today } = useBusiness();
  const t = data.today;
  const chartData = data.series.map((d) => ({
    key: d.date,
    label: d.date === today ? 'Hari ini' : weekdayShort(d.date),
    title: formatDayMonth(d.date),
    value: d.sales,
  }));

  return (
    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12">
      <section className="card p-5 md:p-6 lg:col-span-7" aria-labelledby="sales-today">
        <p id="sales-today" className="text-[14px] font-semibold text-ink-3">
          Penjualan hari ini
        </p>
        <Money value={t.sales} className="mt-1.5 block text-[44px] font-bold leading-none tracking-[-0.035em] md:text-[54px]" />
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          <Delta
            current={t.sales}
            previous={t.sales_same_time_yesterday}
            label="dari kemarin di jam yang sama"
            emptyLabel="Kemarin di jam ini belum ada penjualan"
          />
          <span className="text-[13px] text-ink-3">
            {t.transactions} transaksi, {formatQty(t.items_sold)} item terjual
          </span>
        </div>
        <ColumnChart
          className="mt-6"
          data={chartData}
          highlightKey={today}
          height={148}
          format={(v) => formatMoney(v)}
          caption="Penjualan 7 hari terakhir"
        />
      </section>

      <div className="grid grid-cols-2 gap-4 lg:col-span-5 lg:content-start">
        {isOwner ? (
          <>
            <StatTile color="mint" icon={<ChartLineUp size={16} weight="bold" />} label="Laba kotor" value={<Money value={t.gross_profit} />} footer={t.sales > 0 && t.gross_profit !== null ? `Margin ${Math.round((t.gross_profit / t.sales) * 100)}%` : 'Penjualan dikurangi modal'} />
            <StatTile color="sky" icon={<Package size={16} weight="bold" />} label="Modal (HPP)" value={<Money value={t.cost} />} footer="Harga modal barang terjual" />
            <StatTile color="lime" icon={<Coins size={16} weight="bold" />} label="Uang masuk" value={<Money value={t.cash_in} />} footer={t.debt_collected > 0 ? `Termasuk ${formatMoney(t.debt_collected)} bayaran hutang` : 'Cash dan transfer hari ini'} />
            <StatTile color="sand" icon={<Wallet size={16} weight="bold" />} label="Pengeluaran" value={<Money value={t.expenses} />} footer={<Link to="/pengeluaran" className="font-semibold underline decoration-ink/25 underline-offset-2 hover:decoration-ink">Catat pengeluaran</Link>} />
          </>
        ) : (
          <>
            <StatTile color="mint" icon={<Receipt size={16} weight="bold" />} label="Transaksimu" value={t.transactions} footer="Hari ini" />
            <StatTile color="sky" icon={<ShoppingBagOpen size={16} weight="bold" />} label="Item terjual" value={formatQty(t.items_sold)} footer="Hari ini" />
            <StatTile color="lime" icon={<Coins size={16} weight="bold" />} label="Uang masuk" value={<Money value={t.cash_in} />} footer="Yang kamu terima" />
            <StatTile color="sand" icon={<Tag size={16} weight="bold" />} label="Diskon" value={<Money value={t.discount} />} footer="Diberikan hari ini" />
          </>
        )}
      </div>

      <ReceivablesCard data={data} className="lg:col-span-6" />
      <LowStockCard data={data} className="lg:col-span-6" />

      <SectionCard
        className="lg:col-span-7"
        padded={false}
        title="Transaksi terakhir"
        action={
          <Link to="/transaksi" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
            Semua <ArrowRight size={14} weight="bold" />
          </Link>
        }
      >
        {data.recent_sales.length === 0 ? (
          <EmptyState icon={<Receipt size={26} />} title="Belum ada transaksi" action={<ButtonLink to="/kasir">Buka kasir</ButtonLink>}>
            Transaksi pertama akan muncul di sini.
          </EmptyState>
        ) : (
          <div className="divide-y divide-line pb-2">
            {data.recent_sales.map((s) => (
              <SaleRow key={s.id} sale={s} tz={tz} onOpen={onOpenSale} />
            ))}
          </div>
        )}
      </SectionCard>

      <div className="grid min-w-0 grid-cols-1 content-start gap-4 lg:col-span-5">
        <TopProductsCard data={data} />
        <MethodsCard data={data} />
      </div>
    </div>
  );
}

function ReceivablesCard({ data, className }: { data: Dashboard; className?: string }) {
  const customers = useCustomers();
  const { tz } = useBusiness();
  const debtors = (customers.data ?? []).filter((c) => c.balance > 0).slice(0, 3);
  return (
    <SectionCard
      className={className}
      title={
        <h2 className="flex items-center gap-2 text-[16px] font-bold">
          <span className="grid size-8 place-items-center rounded-full" style={{ background: 'var(--tint-peach-bg)', color: 'var(--tint-peach-fg)' }}>
            <HandCoins size={17} weight="bold" aria-hidden />
          </span>
          Piutang
        </h2>
      }
      action={
        <Link to="/piutang" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
          Kelola <ArrowRight size={14} weight="bold" />
        </Link>
      }
    >
      <div className="flex items-baseline justify-between gap-3">
        <Money value={data.receivables.total} className="text-[28px] font-bold tracking-[-0.03em]" />
        <span className="text-[13px] text-ink-3">{data.receivables.customers} pelanggan belum lunas</span>
      </div>
      {debtors.length > 0 ? (
        <ul className="mt-4 divide-y divide-line">
          {debtors.map((c) => (
            <li key={c.id}>
              <Link to={`/piutang/${c.id}`} className="-mx-2 flex items-center gap-3 rounded-[12px] px-2 py-2.5 hover:bg-surface-2">
                <Avatar name={c.name} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{c.name}</span>
                  {c.oldest_unpaid_at && <span className="block text-[12.5px] text-ink-3">{unpaidLabel(c.oldest_unpaid_at, tz)}</span>}
                </span>
                <Money value={c.balance} tabular className="text-[14px] font-bold" />
              </Link>
            </li>
          ))}
        </ul>
      ) : data.receivables.total <= 0 ? (
        <p className="mt-3 text-[14px] text-ink-3">Semua pelanggan sudah lunas.</p>
      ) : null}
    </SectionCard>
  );
}

function LowStockCard({ data, className }: { data: Dashboard; className?: string }) {
  const { isOwner } = useBusiness();
  return (
    <SectionCard
      className={className}
      title={
        <h2 className="flex items-center gap-2 text-[16px] font-bold">
          <span className="grid size-8 place-items-center rounded-full" style={{ background: 'var(--tint-rose-bg)', color: 'var(--tint-rose-fg)' }}>
            <WarningCircle size={17} weight="bold" aria-hidden />
          </span>
          Stok menipis
        </h2>
      }
      action={
        <Link to="/produk?filter=menipis" className="inline-flex items-center gap-1 text-[13px] font-semibold text-brand hover:underline">
          {isOwner ? 'Restock' : 'Lihat'} <ArrowRight size={14} weight="bold" />
        </Link>
      }
    >
      {data.low_stock.count === 0 ? (
        <p className="text-[14px] text-ink-3">Semua stok aman. Produk yang stoknya di bawah minimum akan muncul di sini.</p>
      ) : (
        <>
          <p className="text-[13px] text-ink-3">{data.low_stock.count} produk perlu dibeli lagi</p>
          <ul className="mt-3 divide-y divide-line">
            {data.low_stock.items.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0 truncate text-[14px] font-semibold">{item.name}</span>
                <span className="flex shrink-0 items-center gap-2">
                  <span className="text-[12.5px] text-ink-3 tabular">min {formatQty(item.min_stock)}</span>
                  {item.stock <= 0 ? (
                    <Badge tone="danger">Habis</Badge>
                  ) : (
                    <Badge tone="warn">
                      Sisa {formatQty(item.stock)} {item.unit}
                    </Badge>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  );
}

function TopProductsCard({ data }: { data: Dashboard }) {
  const max = Math.max(...data.top_products.map((p) => p.qty), 0);
  return (
    <SectionCard title="Terlaris 7 hari">
      {data.top_products.length === 0 ? (
        <p className="text-[14px] text-ink-3">Belum ada penjualan minggu ini.</p>
      ) : (
        <ol className="grid gap-3.5">
          {data.top_products.map((p, i) => (
            <li key={`${p.product_id ?? p.name}`} className="grid grid-cols-[20px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
              <span className="text-[13px] font-bold text-ink-3 tabular">{i + 1}</span>
              <span className="min-w-0 truncate text-[14px] font-semibold">{p.name}</span>
              <span className="text-[13px] text-ink-2 tabular">
                {formatQty(p.qty)} {p.unit}
              </span>
              <span />
              <InlineBar value={p.qty} max={max} className="col-span-2" />
            </li>
          ))}
        </ol>
      )}
    </SectionCard>
  );
}

function MethodsCard({ data }: { data: Dashboard }) {
  const max = Math.max(...data.cash_in_by_method.map((m) => m.amount), 0);
  return (
    <SectionCard title="Uang masuk per metode">
      {data.cash_in_by_method.length === 0 ? (
        <p className="text-[14px] text-ink-3">Belum ada uang masuk hari ini.</p>
      ) : (
        <ul className="grid gap-3.5">
          {data.cash_in_by_method.map((m) => {
            const Icon = paymentIcon(m.code);
            return (
              <li key={m.code} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-ink-2">
                  <Icon size={15} aria-hidden />
                </span>
                <span className="truncate text-[14px] font-semibold">{m.name}</span>
                <Money value={m.amount} tabular className="text-[14px] font-semibold" />
                <span />
                <InlineBar value={m.amount} max={max} className="col-span-2" />
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

function DashboardSkeleton() {
  return (
    <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-12" aria-busy>
      <div className="card p-6 lg:col-span-7">
        <Skeleton className="h-4 w-36" />
        <Skeleton className="mt-3 h-12 w-56" />
        <Skeleton className="mt-4 h-4 w-48" />
        <Skeleton className="mt-6 h-[148px] w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:col-span-5">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[128px] rounded-[22px]" />
        ))}
      </div>
      <Skeleton className="h-48 rounded-[24px] lg:col-span-6" />
      <Skeleton className="h-48 rounded-[24px] lg:col-span-6" />
      <div className="card lg:col-span-7">
        {Array.from({ length: 4 }, (_, i) => (
          <SaleRowSkeleton key={i} />
        ))}
      </div>
    </div>
  );
}
