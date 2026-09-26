import { Bank, DeviceMobile, HandCoins, Money as MoneyIcon, Wallet, type Icon } from '@phosphor-icons/react';
import { Badge, Money } from '@/components/ui/display';
import { formatQty } from '@/lib/format';
import { formatTime } from '@/lib/dates';
import { cn } from '@/lib/util';
import type { LineSummary, PaymentKind } from '@/data/types';

export function paymentIcon(code: string, kind?: PaymentKind | null): Icon {
  if (code === 'cash' || kind === 'cash') return MoneyIcon;
  if (code === 'hutang' || kind === 'debt') return HandCoins;
  if (code === 'instapay' || code === 'bank_transfer' || kind === 'bank') return Bank;
  if (kind === 'wallet' || code.endsWith('_cash')) return DeviceMobile;
  return Wallet;
}

export function summarizeItems(items: LineSummary[] | null | undefined, max = 3): string {
  if (!items || items.length === 0) return 'Tanpa item';
  const parts = items.slice(0, max).map((i) => `${i.name} ×${formatQty(i.qty)}`);
  const rest = items.length - max;
  return rest > 0 ? `${parts.join(', ')} +${rest} lagi` : parts.join(', ');
}

export interface SaleRowData {
  id: string;
  number: number;
  status: 'completed' | 'void';
  created_at: string;
  total: number;
  debt_amount: number;
  payment_method_code: string;
  payment_method_name: string;
  customer_name: string | null;
  items: LineSummary[] | null;
}

export function SaleRow({ sale, tz, onOpen }: { sale: SaleRowData; tz: string; onOpen: (id: string) => void }) {
  const PayIcon = paymentIcon(sale.payment_method_code);
  const isVoid = sale.status === 'void';
  return (
    <button
      type="button"
      onClick={() => onOpen(sale.id)}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 md:px-5"
    >
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', isVoid ? 'bg-danger-soft text-danger-ink' : 'bg-surface-2 text-ink-2')}>
        <PayIcon size={19} aria-hidden />
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn('block truncate text-[14px] font-semibold', isVoid && 'text-ink-3')}>{summarizeItems(sale.items)}</span>
        <span className="block truncate text-[12.5px] text-ink-3">
          {formatTime(sale.created_at, tz)} · {sale.customer_name ?? `#${sale.number}`}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <Money value={sale.total} tabular className={cn('text-[14px] font-bold', isVoid && 'text-ink-3 line-through')} />
        {isVoid ? (
          <Badge tone="danger">Batal</Badge>
        ) : sale.debt_amount > 0 ? (
          <Badge tone="warn">Hutang</Badge>
        ) : (
          <span className="text-[12px] text-ink-3">{sale.payment_method_name}</span>
        )}
      </span>
    </button>
  );
}

export function SaleRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 md:px-5">
      <div className="skeleton size-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-3.5 w-3/5" />
        <div className="skeleton h-3 w-2/5" />
      </div>
      <div className="skeleton h-4 w-16" />
    </div>
  );
}
