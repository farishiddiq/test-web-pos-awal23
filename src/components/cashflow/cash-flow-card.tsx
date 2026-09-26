import { ArrowDownLeft, ArrowUpRight } from '@phosphor-icons/react';
import { ErrorState, Money, Row, SectionCard, Skeleton } from '@/components/ui/display';
import { paymentIcon } from '@/components/sale/sale-bits';
import { useCashFlow } from '@/data/queries';
import { cn } from '@/lib/util';

// Satu sumber hitungan untuk uang masuk dan keluar (fungsi get_cash_flow),
// dipakai di dashboard dan laporan supaya angkanya selalu sama.
export function CashFlowCard({ from, to, title = 'Arus kas', className }: { from: string; to: string; title?: string; className?: string }) {
  const query = useCashFlow(from, to);

  if (query.isPending) {
    return (
      <SectionCard title={title} className={className}>
        <Skeleton className="h-9 w-40" />
        <Skeleton className="mt-4 h-24 w-full" />
      </SectionCard>
    );
  }
  if (query.isError) {
    return (
      <SectionCard title={title} className={className}>
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </SectionCard>
    );
  }

  const cf = query.data;
  const methods = cf.by_method.filter((m) => m.in > 0 || m.out > 0);

  return (
    <SectionCard title={title} className={className}>
      <p className="text-[13px] font-semibold text-ink-3">Sisa uang (masuk dikurangi keluar)</p>
      <Money value={cf.net} sign className={cn('block text-[32px] font-bold tracking-[-0.03em]', cf.net < 0 && 'text-danger')} />

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-[18px] bg-surface-2 px-4 py-2">
          <p className="flex items-center gap-1.5 pt-1.5 text-[13px] font-bold text-brand">
            <ArrowDownLeft size={14} weight="bold" aria-hidden /> Uang masuk
          </p>
          <Row label="Penjualan dibayar" value={<Money value={cf.in.sales} />} />
          <Row label="Bayaran hutang pelanggan" value={<Money value={cf.in.debt_collected} />} />
          <Row label="Total masuk" value={<Money value={cf.in.total} />} strong className="border-t border-dashed border-line pt-2.5" />
        </div>
        <div className="rounded-[18px] bg-surface-2 px-4 py-2">
          <p className="flex items-center gap-1.5 pt-1.5 text-[13px] font-bold text-danger">
            <ArrowUpRight size={14} weight="bold" aria-hidden /> Uang keluar
          </p>
          <Row label="Pengeluaran" value={<Money value={cf.out.expenses} />} />
          <Row label="Belanja stok (dibayar)" value={<Money value={cf.out.purchases} />} />
          <Row label="Bayar hutang supplier" value={<Money value={cf.out.supplier_payments} />} />
          <Row label="Total keluar" value={<Money value={cf.out.total} />} strong className="border-t border-dashed border-line pt-2.5" />
        </div>
      </div>

      {methods.length > 0 && (
        <>
          <p className="mt-5 text-[13px] font-semibold text-ink-3">Sisa per metode (cash di laci, saldo InstaPay, dan lainnya)</p>
          <ul className="mt-2 divide-y divide-line">
            {methods.map((m) => {
              const I = paymentIcon(m.code);
              return (
                <li key={m.code} className="grid grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 py-2.5">
                  <span className="grid size-7 place-items-center rounded-full bg-surface-2 text-ink-2">
                    <I size={15} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[14px] font-semibold">{m.name}</span>
                    <span className="block text-[12px] text-ink-3 tabular">
                      masuk <Money value={m.in} /> · keluar <Money value={m.out} />
                    </span>
                  </span>
                  <Money value={m.net} sign tabular className={cn('text-[14px] font-bold', m.net < 0 && 'text-danger')} />
                </li>
              );
            })}
          </ul>
        </>
      )}
    </SectionCard>
  );
}
