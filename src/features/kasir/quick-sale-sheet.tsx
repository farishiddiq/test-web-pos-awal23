import { useEffect, useState, type FormEvent } from 'react';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Field, MoneyInput, TextInput } from '@/components/ui/form';
import { formatMoney, parseAmount, parseQty } from '@/lib/format';

/** Jual cepat: item yang belum ada di daftar produk, tanpa harus membuat produk dulu */
export function QuickSaleSheet({
  open,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (line: { name: string; price: number; qty: number; unitCost?: number }) => void;
}) {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [qty, setQty] = useState('1');
  const [cost, setCost] = useState('');
  const [showCost, setShowCost] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setName('');
      setPrice('');
      setQty('1');
      setCost('');
      setShowCost(false);
      setError(null);
    }
  }, [open]);

  const priceValue = parseAmount(price);
  const qtyValue = parseQty(qty);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError('Isi nama item.');
    if (priceValue === null) return setError('Isi harga item.');
    if (!qtyValue) return setError('Jumlah harus lebih dari 0.');
    onAdd({ name: name.trim(), price: priceValue, qty: qtyValue, unitCost: parseAmount(cost) ?? undefined });
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Jual cepat"
      description="Untuk item yang belum ada di daftar produk."
      footer={
        <Button type="submit" form="quick-sale" size="lg" block>
          {priceValue !== null && qtyValue ? `Tambah ke pesanan, ${formatMoney(priceValue * qtyValue)}` : 'Tambah ke pesanan'}
        </Button>
      }
    >
      <form id="quick-sale" onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Nama item" htmlFor="qs-name">
          <TextInput id="qs-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Misal: Nasi Ayam" maxLength={80} />
        </Field>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label="Harga satuan" htmlFor="qs-price">
            <MoneyInput id="qs-price" value={price} onValueChange={setPrice} placeholder="0" />
          </Field>
          <Field label="Jumlah" htmlFor="qs-qty">
            <TextInput id="qs-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="text-center tabular" />
          </Field>
        </div>
        {showCost ? (
          <Field label="Modal per item" htmlFor="qs-cost" optional hint="Diisi supaya laba di laporan tetap akurat.">
            <MoneyInput id="qs-cost" value={cost} onValueChange={setCost} placeholder="0" />
          </Field>
        ) : (
          <button type="button" onClick={() => setShowCost(true)} className="justify-self-start text-[14px] font-semibold text-brand hover:underline">
            Isi modal biar laba akurat
          </button>
        )}
        {error && (
          <p role="alert" className="text-[14px] font-medium text-danger">
            {error}
          </p>
        )}
      </form>
    </Sheet>
  );
}
