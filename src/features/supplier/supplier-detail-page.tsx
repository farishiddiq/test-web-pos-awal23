import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { CaretLeft, HandCoins, PencilSimple, Truck, WhatsappLogo } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Page } from '@/components/layout/app-shell';
import { Button, ButtonLink } from '@/components/ui/button';
import { Avatar, Badge, ErrorState, Money, SectionCard, Skeleton } from '@/components/ui/display';
import { VoidSheet } from '@/components/ui/void-sheet';
import { useBusiness } from '@/data/business';
import { useSupplier, useVoidPurchase } from '@/data/queries';
import type { Purchase } from '@/data/types';
import { formatDateMedium, formatDateTime } from '@/lib/dates';
import { formatMoney, formatQty } from '@/lib/format';
import { openWhatsApp, toWhatsAppNumber } from '@/lib/phone';
import { cn } from '@/lib/util';
import { SupplierFormSheet, SupplierPaymentSheet } from './supplier-sheets';

export function SupplierDetailPage() {
  const { id } = useParams();
  const { tz } = useBusiness();
  const query = useSupplier(id);
  const voidPurchase = useVoidPurchase();
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [voiding, setVoiding] = useState<Purchase | null>(null);
  const s = query.data;

  if (query.isPending) {
    return (
      <Page>
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-5 h-44 rounded-[24px]" />
      </Page>
    );
  }
  if (query.isError || !s) {
    return (
      <Page>
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Page>
    );
  }

  return (
    <Page>
      <Link to="/supplier" className="inline-flex items-center gap-1 text-[14px] font-semibold text-ink-2 hover:text-ink">
        <CaretLeft size={16} weight="bold" /> Supplier
      </Link>

      <section className="card mt-4 p-5 md:p-6">
        <div className="flex items-start gap-4">
          <Avatar name={s.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-bold leading-tight tracking-[-0.025em]">{s.name}</h1>
            <p className="mt-1 text-[14px] text-ink-3">
              {s.phone ?? 'Tanpa nomor'}
              {s.note ? ` · ${s.note}` : ''}
            </p>
          </div>
          <Button variant="ghost" size="sm" icon={<PencilSimple size={16} />} onClick={() => setEditing(true)}>
            Ubah
          </Button>
        </div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-[14px] font-semibold text-ink-3">Hutang ke supplier</p>
            <Money value={Math.max(s.balance, 0)} className="mt-0.5 block text-[36px] font-bold leading-tight tracking-[-0.03em]" />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-ink-3">Total belanja</p>
            <Money value={s.total_purchases} className="mt-0.5 block text-[24px] font-bold leading-tight tracking-[-0.02em] text-ink-2" />
          </div>
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <ButtonLink to={`/pembelian/baru?supplier=${s.id}`} icon={<Truck size={18} />}>
            Catat pembelian
          </ButtonLink>
          <Button variant="secondary" icon={<HandCoins size={18} />} disabled={s.balance <= 0} onClick={() => setPaying(true)}>
            Bayar hutang
          </Button>
          {toWhatsAppNumber(s.phone) && (
            <Button variant="secondary" icon={<WhatsappLogo size={18} weight="fill" />} onClick={() => openWhatsApp('', s.phone)}>
              Chat
            </Button>
          )}
        </div>
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        <SectionCard title="Pembelian" className="lg:col-span-7" padded={false}>
          {s.purchases.length === 0 ? (
            <p className="px-5 pb-5 text-[14px] text-ink-3">Belum ada pembelian dari supplier ini.</p>
          ) : (
            <ul className="divide-y divide-line pb-2">
              {s.purchases.map((p) => (
                <li key={p.id} className="px-5 py-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className={cn('text-[14px] font-semibold', p.status === 'void' && 'text-ink-3 line-through')}>
                        Pembelian #{p.number}, {formatDateMedium(p.purchased_on)}
                      </p>
                      <p className="text-[12.5px] text-ink-3">
                        {p.items.map((i) => `${i.name} ${formatQty(i.qty)} ${i.unit} @ ${formatMoney(i.unit_cost)}`).join(', ')}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        {p.status === 'void' ? (
                          <Badge tone="danger">Dibatalkan: {p.void_reason}</Badge>
                        ) : p.debt_amount > 0 ? (
                          <Badge tone="warn">Dibayar {formatMoney(p.paid_amount)}, hutang {formatMoney(p.debt_amount)}</Badge>
                        ) : (
                          <Badge tone="brand">Lunas{p.method_name ? `, ${p.method_name}` : ''}</Badge>
                        )}
                        {p.status === 'completed' && (
                          <button type="button" onClick={() => setVoiding(p)} className="text-[12.5px] font-semibold text-ink-3 hover:text-danger hover:underline">
                            Batalkan
                          </button>
                        )}
                      </div>
                    </div>
                    <Money value={p.total} tabular className={cn('shrink-0 text-[14.5px] font-bold', p.status === 'void' && 'text-ink-3 line-through')} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>

        <SectionCard title="Pembayaran hutang" className="lg:col-span-5 lg:self-start" padded={false}>
          {s.payments.length === 0 ? (
            <p className="px-5 pb-5 text-[14px] text-ink-3">Belum ada pembayaran.</p>
          ) : (
            <ul className="divide-y divide-line pb-2">
              {s.payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold">Bayar lewat {p.method_name}</p>
                    <p className="truncate text-[12.5px] text-ink-3">
                      {formatDateTime(p.created_at, tz)}
                      {p.note ? `, ${p.note}` : ''}
                    </p>
                  </div>
                  <Money value={p.amount} tabular className="text-[14px] font-bold text-brand" />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>

      <SupplierFormSheet open={editing} onOpenChange={setEditing} supplier={s} />
      <SupplierPaymentSheet open={paying} onOpenChange={setPaying} supplier={s} />
      <VoidSheet
        open={voiding !== null}
        onOpenChange={(o) => !o && setVoiding(null)}
        title={`Batalkan pembelian #${voiding?.number ?? ''}`}
        description="Stok dari pembelian ini akan dikurangi lagi. Harga modal produk tidak diubah."
        busy={voidPurchase.isPending}
        onConfirm={async (reason) => {
          if (!voiding) return;
          await voidPurchase.mutateAsync({ id: voiding.id, reason });
          toast.success('Pembelian dibatalkan, stok sudah dikurangi');
          setVoiding(null);
        }}
      />
    </Page>
  );
}
