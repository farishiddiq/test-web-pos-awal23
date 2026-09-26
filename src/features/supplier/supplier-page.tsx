import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CaretRight, Plus, Truck } from '@phosphor-icons/react';
import { Page } from '@/components/layout/app-shell';
import { Button, ButtonLink } from '@/components/ui/button';
import { Avatar, Badge, EmptyState, ErrorState, Money, PageHeader, SectionCard, Skeleton } from '@/components/ui/display';
import { useBusiness } from '@/data/business';
import { usePurchases, useSuppliers } from '@/data/queries';
import { formatDateMedium, formatDateShort } from '@/lib/dates';
import { formatMoney, formatQty } from '@/lib/format';
import { cn } from '@/lib/util';
import { SupplierFormSheet } from './supplier-sheets';

export function SupplierPage() {
  const { today } = useBusiness();
  const navigate = useNavigate();
  const suppliers = useSuppliers();
  const purchases = usePurchases(null, null);
  const [adding, setAdding] = useState(false);
  const list = suppliers.data ?? [];
  const owed = list.reduce((t, s) => t + Math.max(0, s.balance), 0);
  const recent = (purchases.data ?? []).slice(0, 8);

  return (
    <Page>
      <PageHeader
        title="Supplier"
        subtitle="Tempat belanja stok dan hutang ke supplier"
        actions={
          <>
            <Button variant="secondary" icon={<Plus size={18} weight="bold" />} onClick={() => setAdding(true)}>
              Supplier baru
            </Button>
            <ButtonLink to="/pembelian/baru" icon={<Truck size={18} />}>
              Catat pembelian
            </ButtonLink>
          </>
        }
      />

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <div className="grid min-w-0 grid-cols-1 content-start gap-4 lg:col-span-7">
          <section className="rounded-[var(--radius-card)] p-5" style={{ background: 'var(--tint-sky-bg)' }}>
            <p className="text-[14px] font-semibold" style={{ color: 'var(--tint-sky-fg)' }}>
              Hutang ke supplier
            </p>
            <Money value={owed} className="mt-1 block text-[34px] font-bold tracking-[-0.03em] text-ink" />
            <p className="text-[13px] text-ink-2">{list.filter((s) => s.balance > 0).length} supplier belum lunas</p>
          </section>

          <div className="card overflow-hidden">
            {suppliers.isPending ? (
              <div className="grid gap-3 p-5">
                {Array.from({ length: 3 }, (_, i) => (
                  <Skeleton key={i} className="h-12" />
                ))}
              </div>
            ) : suppliers.isError ? (
              <ErrorState error={suppliers.error} onRetry={() => suppliers.refetch()} />
            ) : list.length === 0 ? (
              <EmptyState icon={<Truck size={26} />} title="Belum ada supplier" action={<Button onClick={() => setAdding(true)}>Tambah supplier</Button>}>
                Catat tempat kamu belanja stok supaya riwayat pembelian dan hutangnya rapi.
              </EmptyState>
            ) : (
              <ul className="divide-y divide-line">
                {list.map((s) => (
                  <li key={s.id}>
                    <Link to={`/supplier/${s.id}`} className="flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-surface-2">
                      <Avatar name={s.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14.5px] font-semibold">{s.name}</span>
                        <span className="block truncate text-[12.5px] text-ink-3">
                          {s.last_purchase_on ? `Terakhir belanja ${formatDateShort(s.last_purchase_on)}` : (s.note ?? 'Belum ada pembelian')}
                        </span>
                      </span>
                      <span className="shrink-0 text-right">
                        <Money value={s.total_purchases ?? 0} tabular className="block text-[14px] font-semibold" />
                        {s.balance > 0 ? <Badge tone="warn">Hutang {formatMoney(s.balance)}</Badge> : <span className="text-[12px] text-ink-3">Lunas</span>}
                      </span>
                      <CaretRight size={16} className="shrink-0 text-ink-3" aria-hidden />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <SectionCard title="Pembelian terakhir" className="lg:col-span-5 lg:self-start" padded={false}>
          {purchases.isPending ? (
            <div className="grid gap-3 px-5 pb-5">
              <Skeleton className="h-12" />
              <Skeleton className="h-12" />
            </div>
          ) : recent.length === 0 ? (
            <p className="px-5 pb-5 text-[14px] text-ink-3">Belum ada pembelian.</p>
          ) : (
            <ul className="divide-y divide-line pb-2">
              {recent.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    onClick={() => p.supplier_id && navigate(`/supplier/${p.supplier_id}`)}
                    className={cn('flex w-full items-start gap-3 px-5 py-3 text-left', p.supplier_id && 'hover:bg-surface-2')}
                  >
                    <span className="min-w-0 flex-1">
                      <span className={cn('block truncate text-[14px] font-semibold', p.status === 'void' && 'text-ink-3 line-through')}>
                        {(p.items ?? []).map((i) => `${i.name} ×${formatQty(i.qty)}`).join(', ')}
                      </span>
                      <span className="block truncate text-[12.5px] text-ink-3">
                        {p.supplier_name ?? 'Tanpa supplier'}, {p.purchased_on === today ? 'hari ini' : formatDateMedium(p.purchased_on)}
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      <Money value={p.total} tabular className="block text-[14px] font-semibold" />
                      {p.status === 'void' ? <Badge tone="danger">Batal</Badge> : p.debt_amount > 0 ? <Badge tone="warn">Belum lunas</Badge> : null}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SupplierFormSheet open={adding} onOpenChange={setAdding} onSaved={(s) => navigate(`/supplier/${s.id}`)} />
    </Page>
  );
}
