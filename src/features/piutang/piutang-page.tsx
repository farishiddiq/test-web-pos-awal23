import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CaretRight, HandCoins, MagnifyingGlass, UserPlus } from '@phosphor-icons/react';
import { Page } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Segmented } from '@/components/ui/choice';
import { Avatar, Badge, EmptyState, ErrorState, Money, PageHeader, Skeleton } from '@/components/ui/display';
import { inputClass } from '@/components/ui/form';
import { useBusiness } from '@/data/business';
import { useCustomers } from '@/data/queries';
import type { Customer } from '@/data/types';
import { ageLabel, formatDateShort, unpaidLabel } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { cn, normalizeSearch } from '@/lib/util';
import { CustomerFormSheet } from './customer-sheets';

export function PiutangPage() {
  const { tz, today } = useBusiness();
  const navigate = useNavigate();
  const customers = useCustomers();
  const [view, setView] = useState<'open' | 'all'>('open');
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(false);

  const all = customers.data ?? [];
  const debtors = all.filter((c) => c.balance > 0);
  const total = debtors.reduce((t, c) => t + c.balance, 0);
  const oldest = [...debtors].filter((c) => c.oldest_unpaid_at).sort((a, b) => (a.oldest_unpaid_at! < b.oldest_unpaid_at! ? -1 : 1))[0];
  const overdue = debtors.filter((c) => c.oldest_unpaid_due && c.oldest_unpaid_due < today).length;

  const q = normalizeSearch(search);
  const list = useMemo(
    () => (view === 'open' ? debtors : all).filter((c) => !q || normalizeSearch(c.name).includes(q) || (c.phone ?? '').includes(q)),
    [view, debtors, all, q],
  );

  return (
    <Page>
      <PageHeader
        title="Piutang"
        subtitle="Catatan hutang pelanggan ke usahamu"
        actions={
          <Button variant="secondary" icon={<UserPlus size={18} />} onClick={() => setAdding(true)}>
            Pelanggan baru
          </Button>
        }
      />

      <section className="mt-5 grid gap-4 rounded-[var(--radius-card)] p-5 md:grid-cols-[1.4fr_1fr] md:p-6" style={{ background: 'var(--tint-peach-bg)' }}>
        <div>
          <p className="flex items-center gap-2 text-[14px] font-semibold" style={{ color: 'var(--tint-peach-fg)' }}>
            <HandCoins size={18} weight="bold" aria-hidden /> Belum dibayar
          </p>
          {customers.isPending ? (
            <Skeleton className="mt-2 h-11 w-48" />
          ) : (
            <Money value={total} className="mt-1 block text-[40px] font-bold leading-tight tracking-[-0.035em] text-ink" />
          )}
          {customers.isSuccess && (
            <p className="mt-1 text-[14px] text-ink-2">
              {debtors.length === 0 ? 'Semua pelanggan sudah lunas.' : `${debtors.length} pelanggan belum lunas`}
              {overdue > 0 && <span className="font-semibold text-danger-ink">, {overdue} lewat janji bayar</span>}
            </p>
          )}
        </div>
        {oldest && (
          <Link to={`/piutang/${oldest.id}`} className="pressable flex items-center gap-3 self-end rounded-[18px] bg-surface/80 p-3.5 hover:bg-surface">
            <Avatar name={oldest.name} />
            <span className="min-w-0 flex-1">
              <span className="block text-[12.5px] text-ink-3">Paling lama belum bayar</span>
              <span className="block truncate text-[14px] font-semibold">
                {oldest.name}, {ageLabel(oldest.oldest_unpaid_at!, tz)}
              </span>
            </span>
            <CaretRight size={16} className="text-ink-3" />
          </Link>
        )}
      </section>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <Segmented
          label="Tampilan pelanggan"
          value={view}
          onChange={setView}
          options={[
            { value: 'open', label: `Belum lunas (${debtors.length})` },
            { value: 'all', label: `Semua (${all.length})` },
          ]}
        />
        <label className="relative w-full md:ml-auto md:w-[280px]">
          <span className="sr-only">Cari pelanggan</span>
          <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau nomor" className={cn(inputClass, 'h-11 rounded-full pl-11')} />
        </label>
      </div>

      <div className="card mt-4 overflow-hidden">
        {customers.isPending ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                <Skeleton className="size-10 rounded-full" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        ) : customers.isError ? (
          <ErrorState error={customers.error} onRetry={() => customers.refetch()} />
        ) : list.length === 0 ? (
          <EmptyState
            icon={<HandCoins size={26} />}
            title={view === 'open' && !q ? 'Tidak ada hutang' : 'Tidak ada yang cocok'}
            action={view === 'open' && !q && all.length > 0 ? <Button variant="secondary" onClick={() => setView('all')}>Lihat semua pelanggan</Button> : undefined}
          >
            {view === 'open' && !q
              ? 'Transaksi dengan metode Hutang otomatis tercatat di sini.'
              : 'Coba nama lain, atau tambah pelanggan baru.'}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {list.map((c) => (
              <CustomerRow key={c.id} customer={c} tz={tz} today={today} />
            ))}
          </ul>
        )}
      </div>

      <CustomerFormSheet open={adding} onOpenChange={setAdding} onSaved={(c) => navigate(`/piutang/${c.id}`)} />
    </Page>
  );
}

function CustomerRow({ customer: c, tz, today }: { customer: Customer; tz: string; today: string }) {
  const overdue = c.balance > 0 && c.oldest_unpaid_due && c.oldest_unpaid_due < today;
  return (
    <li>
      <Link to={`/piutang/${c.id}`} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-2 md:px-5">
        <Avatar name={c.name} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14.5px] font-semibold">{c.name}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[12.5px] text-ink-3">
            {c.balance > 0 && c.oldest_unpaid_at ? <span>{unpaidLabel(c.oldest_unpaid_at, tz)}</span> : <span>{c.note ?? c.phone ?? 'Tidak ada hutang'}</span>}
            {c.balance > 0 && c.oldest_unpaid_due && (
              <Badge tone={overdue ? 'danger' : 'neutral'}>{overdue ? 'Lewat janji' : 'Janji'} {formatDateShort(c.oldest_unpaid_due)}</Badge>
            )}
          </span>
        </span>
        <span className="shrink-0 text-right">
          {c.balance > 0 ? (
            <Money value={c.balance} tabular className="text-[15px] font-bold" />
          ) : c.balance < 0 ? (
            <span className="text-[13px] font-semibold text-brand">Lebih bayar {formatMoney(Math.abs(c.balance))}</span>
          ) : (
            <span className="text-[13px] font-semibold text-ink-3">Lunas</span>
          )}
        </span>
        <CaretRight size={16} className="shrink-0 text-ink-3" aria-hidden />
      </Link>
    </li>
  );
}
