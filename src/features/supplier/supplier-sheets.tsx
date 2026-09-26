import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/choice';
import { Field, MoneyInput, TextArea, TextInput } from '@/components/ui/form';
import { useBusiness } from '@/data/business';
import { useRecordSupplierPayment, useUpsertSupplier } from '@/data/queries';
import type { Supplier } from '@/data/types';
import { amountToInput, formatMoney, parseAmount } from '@/lib/format';
import { uuid } from '@/lib/util';

export function SupplierFormSheet({
  open,
  onOpenChange,
  supplier,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  supplier?: Supplier | null;
  onSaved?: (s: Supplier) => void;
}) {
  const upsert = useUpsertSupplier();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) {
      setName(supplier?.name ?? '');
      setPhone(supplier?.phone ?? '');
      setNote(supplier?.note ?? '');
    }
  }, [open, supplier]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const saved = await upsert.mutateAsync({ id: supplier?.id, name: name.trim(), phone: phone.trim() || null, note: note.trim() || null });
    toast.success(supplier ? 'Supplier diperbarui' : `${saved.name} ditambahkan`);
    onSaved?.(saved);
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={supplier ? 'Ubah supplier' : 'Supplier baru'}
      footer={
        <Button type="submit" form="supplier-form" size="lg" block disabled={!name.trim()} loading={upsert.isPending}>
          Simpan
        </Button>
      }
    >
      <form id="supplier-form" onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Nama supplier" htmlFor="s-name">
          <TextInput id="s-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Misal: Grosir Hay Asyir" />
        </Field>
        <Field label="Nomor WhatsApp" htmlFor="s-phone" optional>
          <TextInput id="s-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </Field>
        <Field label="Catatan" htmlFor="s-note" optional>
          <TextArea id="s-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Barang apa, jadwal antar, dll." />
        </Field>
      </form>
    </Sheet>
  );
}

export function SupplierPaymentSheet({ open, onOpenChange, supplier }: { open: boolean; onOpenChange: (o: boolean) => void; supplier: Supplier }) {
  const { activeMethods } = useBusiness();
  const methods = activeMethods.filter((m) => m.kind !== 'debt');
  const pay = useRecordSupplierPayment();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(methods[0]?.code ?? 'cash');
  const [note, setNote] = useState('');
  const [ref, setRef] = useState(uuid);
  useEffect(() => {
    if (open) {
      setAmount(amountToInput(supplier.balance));
      setNote('');
      setRef(uuid());
    }
  }, [open, supplier.balance]);
  const value = parseAmount(amount);
  const tooMuch = value !== null && value > supplier.balance;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (value === null || value <= 0 || tooMuch) return;
    const updated = await pay.mutateAsync({ supplierId: supplier.id, amount: value, method, note: note.trim() || null, clientRef: ref });
    toast.success(updated.balance > 0 ? `Tercatat. Sisa hutang ${formatMoney(updated.balance)}` : 'Hutang ke supplier lunas');
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Bayar hutang supplier"
      description={`Hutang ke ${supplier.name}: ${formatMoney(supplier.balance)}.`}
      footer={
        <Button type="submit" form="supplier-pay" size="lg" block disabled={value === null || value <= 0 || tooMuch} loading={pay.isPending}>
          Simpan pembayaran
        </Button>
      }
    >
      <form id="supplier-pay" onSubmit={submit} className="grid gap-5" noValidate>
        <Field label="Jumlah" htmlFor="sp-amount" error={tooMuch ? 'Lebih besar dari sisa hutang.' : null}>
          <MoneyInput id="sp-amount" size="xl" value={amount} onValueChange={setAmount} autoFocus />
        </Field>
        <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Metode pembayaran">
          {methods.map((m) => (
            <Chip key={m.code} selected={method === m.code} onClick={() => setMethod(m.code)}>
              {m.name}
            </Chip>
          ))}
        </div>
        <Field label="Catatan" htmlFor="sp-note" optional>
          <TextInput id="sp-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </Field>
      </form>
    </Sheet>
  );
}
