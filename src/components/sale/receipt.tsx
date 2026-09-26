import { Prohibit, User } from '@phosphor-icons/react';
import { Money, Row } from '@/components/ui/display';
import { formatQty } from '@/lib/format';
import { dateKey, formatDateLong, formatDateMedium, formatDateTime, formatTime } from '@/lib/dates';
import type { Sale } from '@/data/types';

export function SaleReceipt({ sale, tz, showCost }: { sale: Sale; tz: string; showCost: boolean }) {
  const change = sale.cash_received && sale.cash_received > sale.total ? sale.cash_received - sale.total : null;
  return (
    <div className="grid gap-4">
      {sale.status === 'void' && (
        <div role="note" className="flex gap-3 rounded-[16px] bg-danger-soft p-3.5 text-[14px] text-danger-ink">
          <Prohibit size={20} className="mt-0.5 shrink-0" aria-hidden />
          <p>
            <b>Dibatalkan</b>
            {sale.voided_by_name ? ` oleh ${sale.voided_by_name}` : ''}
            {sale.voided_at ? `, ${formatDateTime(sale.voided_at, tz)}` : ''}. Alasan: {sale.void_reason}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-ink-3">
        <span>
          {formatDateLong(dateKey(sale.created_at, tz))}, {formatTime(sale.created_at, tz)}
        </span>
        {sale.cashier_name && <span>Kasir: {sale.cashier_name}</span>}
      </div>

      <ul className="divide-y divide-line rounded-[18px] border border-line">
        {sale.items.map((item) => (
          <li key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="text-[14px] font-semibold">{item.name}</p>
              <p className="text-[13px] text-ink-3">
                {formatQty(item.qty)} {item.unit} × <Money value={item.unit_price} />
              </p>
            </div>
            <Money value={item.line_total} tabular className="text-[14px] font-semibold" />
          </li>
        ))}
      </ul>

      <div className="px-1">
        <Row label="Subtotal" value={<Money value={sale.subtotal} />} />
        {sale.discount > 0 && <Row label="Diskon" value={<Money value={-sale.discount} />} />}
        <Row label="Total" value={<Money value={sale.total} />} strong className="mt-1 border-t border-dashed border-line pt-2.5" />
        {sale.payments.map((p) => (
          <Row
            key={p.method_code + p.method_kind}
            label={p.method_kind === 'debt' ? 'Masuk hutang' : `Dibayar, ${p.method_name}`}
            value={<Money value={p.amount} />}
          />
        ))}
        {change !== null && (
          <>
            <Row label="Uang diterima" value={<Money value={sale.cash_received} />} muted />
            <Row label="Kembalian" value={<Money value={change} />} muted />
          </>
        )}
        {showCost && sale.cost_total !== null && sale.status === 'completed' && (
          <div className="mt-2 rounded-[14px] bg-surface-2 px-3 py-1">
            <Row label="Modal (HPP)" value={<Money value={sale.cost_total} />} muted />
            <Row label="Laba kotor" value={<Money value={sale.total - sale.cost_total} />} />
          </div>
        )}
      </div>

      {sale.customer && (
        <div className="flex items-center gap-3 rounded-[16px] bg-surface-2 px-4 py-3">
          <User size={20} className="text-ink-2" aria-hidden />
          <div className="min-w-0 text-[14px]">
            <p className="font-semibold">{sale.customer.name}</p>
            {sale.due_date && <p className="text-[13px] text-ink-3">Jatuh tempo {formatDateMedium(sale.due_date)}</p>}
          </div>
        </div>
      )}
      {sale.note && <p className="rounded-[16px] bg-surface-2 px-4 py-3 text-[14px] text-ink-2">Catatan: {sale.note}</p>}
    </div>
  );
}
