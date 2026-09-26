import { useMemo, useState } from 'react';
import { CaretLeft, CaretRight, Plus, Wallet } from '@phosphor-icons/react';
import { Page } from '@/components/layout/app-shell';
import { Button, IconButton } from '@/components/ui/button';
import { EmptyState, ErrorState, Money, PageHeader, SectionCard, Skeleton } from '@/components/ui/display';
import { InlineBar } from '@/components/charts/column-chart';
import { useBusiness } from '@/data/business';
import { useExpenses } from '@/data/queries';
import type { Expense } from '@/data/types';
import { addMonths, endOfMonth, formatMonth, relativeDayLabel, startOfMonth } from '@/lib/dates';
import { cn } from '@/lib/util';
import { ExpenseSheet, expenseIcon } from './expense-sheet';

export function PengeluaranPage() {
  const { today } = useBusiness();
  const [month, setMonth] = useState(startOfMonth(today));
  const [sheet, setSheet] = useState<{ expense: Expense | null } | null>(null);
  const isCurrent = month === startOfMonth(today);
  const from = month;
  const to = isCurrent ? today : endOfMonth(month);
  const query = useExpenses(from, to);
  const data = query.data;

  const groups = useMemo(() => {
    const map = new Map<string, Expense[]>();
    for (const e of data?.items ?? []) map.set(e.spent_on, [...(map.get(e.spent_on) ?? []), e]);
    return [...map.entries()];
  }, [data]);
  const maxCategory = Math.max(0, ...(data?.by_category ?? []).map((c) => c.amount));

  return (
    <Page>
      <PageHeader
        title="Pengeluaran"
        subtitle="Biaya operasional di luar modal barang"
        actions={
          <Button icon={<Plus size={18} weight="bold" />} onClick={() => setSheet({ expense: null })}>
            Catat pengeluaran
          </Button>
        }
      />

      <div className="mt-5 flex items-center gap-2">
        <IconButton label="Bulan sebelumnya" variant="outline" onClick={() => setMonth(addMonths(month, -1))}>
          <CaretLeft size={18} weight="bold" />
        </IconButton>
        <p className="min-w-[150px] text-center text-[16px] font-bold" aria-live="polite">
          {formatMonth(month)}
        </p>
        <IconButton label="Bulan berikutnya" variant="outline" disabled={isCurrent} onClick={() => setMonth(addMonths(month, 1))}>
          <CaretRight size={18} weight="bold" />
        </IconButton>
      </div>

      <div className={cn('mt-5 grid grid-cols-1 gap-4 transition-opacity lg:grid-cols-12', query.isFetching && query.isPlaceholderData && 'opacity-60')}>
        <SectionCard className="lg:col-span-5 lg:self-start" title="Total bulan ini">
          {query.isPending ? (
            <Skeleton className="h-10 w-40" />
          ) : (
            <Money value={data?.total ?? 0} className="block text-[36px] font-bold leading-tight tracking-[-0.03em]" />
          )}
          {data && data.by_category.length > 0 && (
            <ul className="mt-5 grid gap-3.5">
              {data.by_category.map((c) => {
                const I = expenseIcon(c.category);
                return (
                  <li key={c.category} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1.5">
                    <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-ink-2">
                      <I size={15} aria-hidden />
                    </span>
                    <span className="truncate text-[14px] font-semibold">
                      {c.category} <span className="font-medium text-ink-3">({c.count})</span>
                    </span>
                    <Money value={c.amount} tabular className="text-[14px] font-semibold" />
                    <span />
                    <InlineBar value={c.amount} max={maxCategory} className="col-span-2" />
                  </li>
                );
              })}
            </ul>
          )}
        </SectionCard>

        <div className="lg:col-span-7">
          {query.isPending ? (
            <Skeleton className="h-64 rounded-[24px]" />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : groups.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={<Wallet size={26} />}
                title="Belum ada pengeluaran"
                action={
                  <Button icon={<Plus size={18} weight="bold" />} onClick={() => setSheet({ expense: null })}>
                    Catat pengeluaran
                  </Button>
                }
              >
                Catat gas, kemasan, transport, dan biaya lain supaya laba bersih di laporan akurat.
              </EmptyState>
            </div>
          ) : (
            <div className="grid gap-4">
              {groups.map(([day, items]) => (
                <section key={day} className="card overflow-hidden">
                  <header className="flex items-baseline justify-between border-b border-line px-5 py-3">
                    <h2 className="text-[14px] font-bold">{relativeDayLabel(day, today)}</h2>
                    <Money value={items.reduce((t, e) => t + e.amount, 0)} tabular className="text-[13px] font-semibold text-ink-2" />
                  </header>
                  <ul className="divide-y divide-line">
                    {items.map((e) => {
                      const I = expenseIcon(e.category);
                      return (
                        <li key={e.id}>
                          <button type="button" onClick={() => setSheet({ expense: e })} className="flex w-full items-center gap-3 px-5 py-3 text-left transition-colors hover:bg-surface-2">
                            <span className="grid size-10 shrink-0 place-items-center rounded-full" style={{ background: 'var(--tint-sand-bg)', color: 'var(--tint-sand-fg)' }}>
                              <I size={18} aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[14px] font-semibold">{e.category}</span>
                              <span className="block truncate text-[12.5px] text-ink-3">
                                {[e.note, e.method_name].filter(Boolean).join(', ') || 'Tanpa catatan'}
                              </span>
                            </span>
                            <Money value={e.amount} tabular className="shrink-0 text-[14px] font-bold" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      <ExpenseSheet open={sheet !== null} onOpenChange={(o) => !o && setSheet(null)} expense={sheet?.expense ?? null} />
    </Page>
  );
}
