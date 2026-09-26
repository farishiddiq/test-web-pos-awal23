import { useMemo, useState } from 'react';
import { MagnifyingGlass, Receipt } from '@phosphor-icons/react';
import { Page } from '@/components/layout/app-shell';
import { Chip, ChipRow } from '@/components/ui/choice';
import { EmptyState, ErrorState, Money, PageHeader } from '@/components/ui/display';
import { inputClass } from '@/components/ui/form';
import { ButtonLink } from '@/components/ui/button';
import { SaleRow, SaleRowSkeleton } from '@/components/sale/sale-bits';
import { useBusiness } from '@/data/business';
import { useSales } from '@/data/queries';
import type { SaleListItem } from '@/data/types';
import { addDays, dateKey, relativeDayLabel, startOfMonth } from '@/lib/dates';
import { formatCount } from '@/lib/format';
import { cn, normalizeSearch } from '@/lib/util';
import { SaleDetailSheet } from './sale-detail-sheet';

type RangeKey = 'today' | 'yesterday' | 'week' | 'month' | 'custom';
type StatusKey = 'all' | 'paid' | 'debt' | 'void';

const RANGES: Array<{ key: RangeKey; label: string }> = [
  { key: 'today', label: 'Hari ini' },
  { key: 'yesterday', label: 'Kemarin' },
  { key: 'week', label: '7 hari' },
  { key: 'month', label: 'Bulan ini' },
  { key: 'custom', label: 'Pilih tanggal' },
];

const STATUSES: Array<{ key: StatusKey; label: string }> = [
  { key: 'all', label: 'Semua' },
  { key: 'paid', label: 'Lunas' },
  { key: 'debt', label: 'Hutang' },
  { key: 'void', label: 'Dibatalkan' },
];

export function TransaksiPage() {
  const { tz, today } = useBusiness();
  const [range, setRange] = useState<RangeKey>('today');
  const [customFrom, setCustomFrom] = useState(addDays(today, -6));
  const [customTo, setCustomTo] = useState(today);
  const [status, setStatus] = useState<StatusKey>('all');
  const [search, setSearch] = useState('');
  const [openSale, setOpenSale] = useState<string | null>(null);

  const { from, to } = useMemo(() => {
    switch (range) {
      case 'today':
        return { from: today, to: today };
      case 'yesterday':
        return { from: addDays(today, -1), to: addDays(today, -1) };
      case 'week':
        return { from: addDays(today, -6), to: today };
      case 'month':
        return { from: startOfMonth(today), to: today };
      default:
        return customFrom <= customTo ? { from: customFrom, to: customTo } : { from: customTo, to: customFrom };
    }
  }, [range, today, customFrom, customTo]);

  const query = useSales({ from, to, status: status === 'all' ? null : status });
  const q = normalizeSearch(search);
  const items = useMemo(() => {
    const all = query.data?.items ?? [];
    if (!q) return all;
    return all.filter(
      (s) =>
        String(s.number).includes(q) ||
        normalizeSearch(s.customer_name ?? '').includes(q) ||
        (s.items ?? []).some((i) => normalizeSearch(i.name).includes(q)),
    );
  }, [query.data, q]);

  const groups = useMemo(() => {
    const map = new Map<string, SaleListItem[]>();
    for (const s of items) {
      const key = dateKey(s.created_at, tz);
      map.set(key, [...(map.get(key) ?? []), s]);
    }
    return [...map.entries()];
  }, [items, tz]);

  const completed = items.filter((s) => s.status === 'completed');
  const total = completed.reduce((t, s) => t + s.total, 0);

  return (
    <Page>
      <PageHeader
        title="Transaksi"
        subtitle={
          query.isSuccess ? (
            <>
              {formatCount(completed.length)} transaksi, total <Money value={total} className="font-semibold text-ink-2" />
            </>
          ) : (
            'Riwayat penjualan'
          )
        }
      />

      <div className="mt-5 grid gap-3">
        <ChipRow label="Rentang tanggal">
          {RANGES.map((r) => (
            <Chip key={r.key} selected={range === r.key} onClick={() => setRange(r.key)}>
              {r.label}
            </Chip>
          ))}
        </ChipRow>
        {range === 'custom' && (
          <div className="flex flex-wrap items-center gap-2">
            <input type="date" aria-label="Dari tanggal" value={customFrom} max={today} onChange={(e) => e.target.value && setCustomFrom(e.target.value)} className={cn(inputClass, 'w-auto')} />
            <span className="text-[13px] text-ink-3">sampai</span>
            <input type="date" aria-label="Sampai tanggal" value={customTo} max={today} onChange={(e) => e.target.value && setCustomTo(e.target.value)} className={cn(inputClass, 'w-auto')} />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <ChipRow label="Status" className="flex-1">
            {STATUSES.map((s) => (
              <Chip key={s.key} selected={status === s.key} onClick={() => setStatus(s.key)}>
                {s.label}
              </Chip>
            ))}
          </ChipRow>
          <label className="relative w-full md:w-[280px]">
            <span className="sr-only">Cari transaksi</span>
            <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor, pelanggan, item"
              className={cn(inputClass, 'h-11 rounded-full pl-11')}
            />
          </label>
        </div>
      </div>

      <div className={cn('mt-5 transition-opacity', query.isFetching && query.isPlaceholderData && 'opacity-60')}>
        {query.isPending ? (
          <div className="card py-2">
            {Array.from({ length: 6 }, (_, i) => (
              <SaleRowSkeleton key={i} />
            ))}
          </div>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : groups.length === 0 ? (
          <div className="card">
            <EmptyState
              icon={<Receipt size={26} />}
              title={search ? 'Tidak ada yang cocok' : 'Belum ada transaksi'}
              action={!search && range === 'today' ? <ButtonLink to="/kasir">Buka kasir</ButtonLink> : undefined}
            >
              {search ? 'Coba kata kunci lain atau ganti rentang tanggal.' : 'Tidak ada transaksi di rentang tanggal ini.'}
            </EmptyState>
          </div>
        ) : (
          <div className="grid gap-4">
            {groups.map(([day, sales]) => {
              const dayTotal = sales.filter((s) => s.status === 'completed').reduce((t, s) => t + s.total, 0);
              return (
                <section key={day} className="card overflow-hidden" aria-label={relativeDayLabel(day, today)}>
                  <header className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-3 md:px-5">
                    <h2 className="text-[14px] font-bold">{relativeDayLabel(day, today)}</h2>
                    <span className="text-[13px] text-ink-3">
                      {sales.length} transaksi, <Money value={dayTotal} className="font-semibold text-ink-2" tabular />
                    </span>
                  </header>
                  <div className="divide-y divide-line">
                    {sales.map((s) => (
                      <SaleRow key={s.id} sale={s} tz={tz} onOpen={setOpenSale} />
                    ))}
                  </div>
                </section>
              );
            })}
            {query.data && query.data.total_count > query.data.items.length && (
              <p className="text-center text-[13px] text-ink-3">
                Menampilkan {query.data.items.length} dari {query.data.total_count} transaksi. Persempit rentang tanggal untuk melihat sisanya.
              </p>
            )}
          </div>
        )}
      </div>
      <SaleDetailSheet saleId={openSale} onClose={() => setOpenSale(null)} />
    </Page>
  );
}
