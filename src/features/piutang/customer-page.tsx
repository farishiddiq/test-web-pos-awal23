import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import {
  ArrowDownLeft,
  CaretLeft,
  HandCoins,
  NotePencil,
  PencilSimple,
  Plus,
  Prohibit,
  WhatsappLogo,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Page } from '@/components/layout/app-shell';
import { Button } from '@/components/ui/button';
import { Avatar, Badge, EmptyState, ErrorState, Money, Skeleton } from '@/components/ui/display';
import { VoidSheet } from '@/components/ui/void-sheet';
import { summarizeItems } from '@/components/sale/sale-bits';
import { useBusiness } from '@/data/business';
import { useCustomer, useVoidCustomerDebt, useVoidDebtPayment } from '@/data/queries';
import type { DebtEntry, LedgerEntry } from '@/data/types';
import { formatDateShort, formatDateTime } from '@/lib/dates';
import { formatMoney } from '@/lib/format';
import { fillReminder } from '@/lib/share-text';
import { openWhatsApp, toWhatsAppNumber } from '@/lib/phone';
import { cn, roundMoney } from '@/lib/util';
import { CustomerFormSheet, ManualDebtSheet, PaymentSheet } from './customer-sheets';

/** Pembayaran menutup hutang paling lama lebih dulu (FIFO) */
function settleFifo(entries: LedgerEntry[]): Map<string, number> {
  const active = entries.filter((e) => !e.voided_at);
  let paid = active.filter((e) => e.kind === 'payment').reduce((t, e) => t + e.amount, 0);
  const debts = active.filter((e): e is DebtEntry => e.kind === 'debt').sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
  const remaining = new Map<string, number>();
  for (const d of debts) {
    const covered = Math.min(d.amount, paid);
    paid -= covered;
    remaining.set(d.id, roundMoney(d.amount - covered));
  }
  return remaining;
}

export function CustomerPage() {
  const { id } = useParams();
  const { isOwner, tz, today, context } = useBusiness();
  const query = useCustomer(id);
  const voidPayment = useVoidDebtPayment();
  const voidDebt = useVoidCustomerDebt();
  const [paying, setPaying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [addingDebt, setAddingDebt] = useState(false);
  const [voiding, setVoiding] = useState<LedgerEntry | null>(null);

  const customer = query.data;
  const remaining = useMemo(() => (customer ? settleFifo(customer.entries) : new Map<string, number>()), [customer]);

  if (query.isPending) {
    return (
      <Page>
        <Skeleton className="h-6 w-24" />
        <Skeleton className="mt-5 h-48 rounded-[24px]" />
        <Skeleton className="mt-4 h-64 rounded-[24px]" />
      </Page>
    );
  }
  if (query.isError || !customer) {
    return (
      <Page>
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </Page>
    );
  }

  const hasWa = !!toWhatsAppNumber(customer.phone);
  const remind = () =>
    openWhatsApp(
      fillReminder(context.business.debt_reminder_template, { nama: customer.name.split(' ')[0], toko: context.business.name, sisa: customer.balance }),
      customer.phone,
    );

  return (
    <Page>
      <Link to="/piutang" className="inline-flex items-center gap-1 text-[14px] font-semibold text-ink-2 hover:text-ink">
        <CaretLeft size={16} weight="bold" /> Piutang
      </Link>

      <section className="card mt-4 p-5 md:p-6">
        <div className="flex items-start gap-4">
          <Avatar name={customer.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[24px] font-bold leading-tight tracking-[-0.025em]">{customer.name}</h1>
            <p className="mt-1 text-[14px] text-ink-3">
              {customer.phone ?? 'Belum ada nomor WhatsApp'}
              {customer.note ? ` · ${customer.note}` : ''}
            </p>
          </div>
          {isOwner && (
            <Button variant="ghost" size="sm" icon={<PencilSimple size={16} />} onClick={() => setEditing(true)}>
              Ubah
            </Button>
          )}
        </div>

        <div className="mt-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[14px] font-semibold text-ink-3">{customer.balance < 0 ? 'Lebih bayar (titipan)' : 'Sisa hutang'}</p>
            <Money value={Math.abs(customer.balance)} className="mt-0.5 block text-[40px] font-bold leading-tight tracking-[-0.035em]" />
            {customer.balance === 0 && <Badge tone="brand" className="mt-1">Lunas</Badge>}
          </div>
          <div className="flex w-full flex-wrap gap-2 sm:w-auto">
            <Button icon={<HandCoins size={18} />} disabled={customer.balance <= 0} onClick={() => setPaying(true)} className="flex-1 sm:flex-none">
              Catat pembayaran
            </Button>
            <Button
              variant="secondary"
              icon={<WhatsappLogo size={18} weight="fill" />}
              disabled={customer.balance <= 0}
              onClick={remind}
              className="flex-1 sm:flex-none"
              title={hasWa ? undefined : 'Tanpa nomor: pilih kontak sendiri di WhatsApp'}
            >
              Kirim pengingat
            </Button>
          </div>
        </div>
      </section>

      <section className="card mt-4 overflow-hidden">
        <header className="flex items-center justify-between gap-3 px-5 pb-2 pt-5">
          <h2 className="text-[16px] font-bold">Riwayat</h2>
          {isOwner && (
            <Button variant="ghost" size="sm" icon={<Plus size={16} weight="bold" />} onClick={() => setAddingDebt(true)}>
              Hutang manual
            </Button>
          )}
        </header>
        {customer.entries.length === 0 ? (
          <EmptyState icon={<NotePencil size={26} />} title="Belum ada catatan">
            Hutang dari transaksi dan pembayaran akan muncul di sini.
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {customer.entries.map((e) => {
              const voided = !!e.voided_at;
              const left = e.kind === 'debt' ? remaining.get(e.id) : undefined;
              const canVoid = isOwner && !voided && (e.kind === 'payment' || (e.kind === 'debt' && !e.sale_id));
              return (
                <li key={`${e.kind}-${e.id}`} className="flex gap-3 px-5 py-3.5">
                  <span
                    className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-full"
                    style={
                      e.kind === 'debt'
                        ? { background: 'var(--tint-peach-bg)', color: 'var(--tint-peach-fg)' }
                        : { background: 'var(--tint-mint-bg)', color: 'var(--tint-mint-fg)' }
                    }
                  >
                    {e.kind === 'debt' ? <HandCoins size={17} /> : <ArrowDownLeft size={17} weight="bold" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cn('text-[14px] font-semibold', voided && 'text-ink-3 line-through')}>
                      {e.kind === 'debt'
                        ? e.sale_number
                          ? `Belanja, transaksi #${e.sale_number}`
                          : `Hutang manual${e.note ? `: ${e.note}` : ''}`
                        : `Bayar lewat ${e.method_name}`}
                    </p>
                    <p className="truncate text-[12.5px] text-ink-3">
                      {formatDateTime(e.created_at, tz)}
                      {e.kind === 'debt' && e.items ? `, ${summarizeItems(e.items, 2)}` : ''}
                      {e.kind === 'payment' && e.note ? `, ${e.note}` : ''}
                    </p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {voided ? (
                        <Badge tone="danger" icon={<Prohibit size={13} />}>
                          Dibatalkan{e.void_reason ? `: ${e.void_reason}` : ''}
                        </Badge>
                      ) : e.kind === 'debt' ? (
                        left === 0 ? (
                          <Badge tone="brand">Lunas</Badge>
                        ) : (
                          <>
                            <Badge tone="warn">Sisa {formatMoney(left ?? e.amount)}</Badge>
                            {e.due_date && (
                              <Badge tone={e.due_date < today ? 'danger' : 'neutral'}>Janji {formatDateShort(e.due_date)}</Badge>
                            )}
                          </>
                        )
                      ) : null}
                      {canVoid && (
                        <button type="button" onClick={() => setVoiding(e)} className="text-[12.5px] font-semibold text-ink-3 underline-offset-2 hover:text-danger hover:underline">
                          Batalkan
                        </button>
                      )}
                    </div>
                  </div>
                  <Money
                    value={e.kind === 'debt' ? e.amount : -e.amount}
                    sign={e.kind === 'debt'}
                    tabular
                    className={cn('shrink-0 text-[14.5px] font-bold', voided ? 'text-ink-3 line-through' : e.kind === 'debt' ? 'text-ink' : 'text-brand')}
                  />
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <PaymentSheet open={paying} onOpenChange={setPaying} customer={customer} />
      {isOwner && (
        <>
          <CustomerFormSheet open={editing} onOpenChange={setEditing} customer={customer} />
          <ManualDebtSheet open={addingDebt} onOpenChange={setAddingDebt} customer={customer} />
          <VoidSheet
            open={voiding !== null}
            onOpenChange={(o) => !o && setVoiding(null)}
            title={voiding?.kind === 'payment' ? 'Batalkan pembayaran' : 'Batalkan hutang manual'}
            description={
              voiding?.kind === 'payment'
                ? `Pembayaran ${formatMoney(voiding.amount)} akan ditandai batal, jadi sisa hutang ${customer.name} bertambah lagi.`
                : `Catatan hutang ${formatMoney(voiding?.amount ?? 0)} akan ditandai batal.`
            }
            busy={voidPayment.isPending || voidDebt.isPending}
            onConfirm={async (reason) => {
              if (!voiding) return;
              if (voiding.kind === 'payment') await voidPayment.mutateAsync({ id: voiding.id, reason });
              else await voidDebt.mutateAsync({ id: voiding.id, reason });
              toast.success('Catatan dibatalkan');
              setVoiding(null);
            }}
          />
        </>
      )}
    </Page>
  );
}
