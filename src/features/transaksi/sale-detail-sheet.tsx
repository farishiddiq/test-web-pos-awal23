import { useEffect, useState } from 'react';
import { Prohibit, WhatsappLogo } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/choice';
import { Field, TextInput } from '@/components/ui/form';
import { HoldButton } from '@/components/ui/hold-button';
import { ErrorState, Skeleton } from '@/components/ui/display';
import { SaleReceipt } from '@/components/sale/receipt';
import { useBusiness } from '@/data/business';
import { useSale, useVoidSale } from '@/data/queries';
import { saleReceiptText } from '@/lib/share-text';
import { openWhatsApp } from '@/lib/phone';

const VOID_REASONS = ['Salah input', 'Pelanggan batal', 'Barang dikembalikan', 'Lainnya'];

export function SaleDetailSheet({ saleId, onClose }: { saleId: string | null; onClose: () => void }) {
  // simpan id terakhir supaya isi tetap tampil selama animasi keluar
  const [shownId, setShownId] = useState(saleId);
  useEffect(() => {
    if (saleId) setShownId(saleId);
  }, [saleId]);

  const { context, isOwner, tz } = useBusiness();
  const query = useSale(shownId);
  const voidSale = useVoidSale();
  const [voidMode, setVoidMode] = useState(false);
  const [reason, setReason] = useState<string | null>(null);
  const [otherReason, setOtherReason] = useState('');

  useEffect(() => {
    if (!saleId) {
      setVoidMode(false);
      setReason(null);
      setOtherReason('');
    }
  }, [saleId]);

  const sale = query.data;
  const finalReason = reason === 'Lainnya' ? otherReason.trim() : reason;

  const confirmVoid = async () => {
    if (!sale || !finalReason) return;
    await voidSale.mutateAsync({ id: sale.id, reason: finalReason });
    toast.success(`Transaksi #${sale.number} dibatalkan. Stok sudah dikembalikan.`);
    setVoidMode(false);
  };

  const footer = sale ? (
    voidMode ? (
      <div className="grid gap-2">
        <HoldButton onConfirm={confirmVoid} disabled={!finalReason || voidSale.isPending}>
          {voidSale.isPending ? 'Membatalkan…' : 'Tahan untuk membatalkan'}
        </HoldButton>
        <Button variant="ghost" onClick={() => setVoidMode(false)}>
          Jangan batalkan
        </Button>
      </div>
    ) : (
      <div className="grid grid-cols-2 gap-2">
        <Button
          variant="secondary"
          icon={<WhatsappLogo size={19} weight="fill" />}
          onClick={() => openWhatsApp(saleReceiptText(sale, context.business), sale.customer?.phone)}
          className={isOwner && sale.status === 'completed' ? '' : 'col-span-2'}
        >
          Kirim struk
        </Button>
        {isOwner && sale.status === 'completed' && (
          <Button variant="danger" icon={<Prohibit size={19} />} onClick={() => setVoidMode(true)}>
            Batalkan
          </Button>
        )}
      </div>
    )
  ) : null;

  return (
    <Sheet
      open={saleId !== null}
      onOpenChange={(open) => !open && onClose()}
      title={sale ? `Transaksi #${sale.number}` : 'Transaksi'}
      onBack={voidMode ? () => setVoidMode(false) : undefined}
      footer={footer}
    >
      {query.isPending ? (
        <div className="grid gap-3">
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-40 w-full rounded-[18px]" />
          <Skeleton className="h-24 w-full rounded-[18px]" />
        </div>
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      ) : sale && voidMode ? (
        <div className="grid gap-5">
          <div className="rounded-[16px] bg-warn-soft p-4 text-[14px] text-warn-ink">
            Transaksi tidak dihapus, hanya ditandai batal. Stok produk dikembalikan
            {sale.debt_amount > 0 ? ' dan hutang pelanggan dari transaksi ini dihapus' : ''}.
          </div>
          <div>
            <p className="text-[13px] font-semibold text-ink-2">Kenapa dibatalkan?</p>
            <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Alasan pembatalan">
              {VOID_REASONS.map((r) => (
                <Chip key={r} selected={reason === r} onClick={() => setReason(r)}>
                  {r}
                </Chip>
              ))}
            </div>
          </div>
          {reason === 'Lainnya' && (
            <Field label="Tulis alasannya" htmlFor="void-other">
              <TextInput id="void-other" autoFocus value={otherReason} maxLength={180} onChange={(e) => setOtherReason(e.target.value)} />
            </Field>
          )}
        </div>
      ) : sale ? (
        <SaleReceipt sale={sale} tz={tz} showCost={isOwner} />
      ) : null}
    </Sheet>
  );
}
