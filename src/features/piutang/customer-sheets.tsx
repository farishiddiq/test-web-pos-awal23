import { useEffect, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/choice';
import { Field, MoneyInput, TextArea, TextInput, inputClass } from '@/components/ui/form';
import { Row, Money } from '@/components/ui/display';
import { useBusiness } from '@/data/business';
import { useAddCustomerDebt, useRecordDebtPayment, useUpsertCustomer } from '@/data/queries';
import type { Customer, CustomerDetail } from '@/data/types';
import { amountToInput, formatMoney, parseAmount } from '@/lib/format';
import { openWhatsApp } from '@/lib/phone';
import { uuid } from '@/lib/util';

export function CustomerFormSheet({
  open,
  onOpenChange,
  customer,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customer?: Customer | null;
  onSaved?: (c: Customer) => void;
}) {
  const upsert = useUpsertCustomer();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [note, setNote] = useState('');
  useEffect(() => {
    if (open) {
      setName(customer?.name ?? '');
      setPhone(customer?.phone ?? '');
      setNote(customer?.note ?? '');
    }
  }, [open, customer]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    const saved = await upsert.mutateAsync({ id: customer?.id, name: name.trim(), phone: phone.trim() || null, note: note.trim() || null });
    toast.success(customer ? 'Data pelanggan diperbarui' : `${saved.name} ditambahkan`);
    onSaved?.(saved);
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={customer ? 'Ubah pelanggan' : 'Pelanggan baru'}
      footer={
        <Button type="submit" form="customer-form" size="lg" block disabled={!name.trim()} loading={upsert.isPending}>
          Simpan
        </Button>
      }
    >
      <form id="customer-form" onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Nama" htmlFor="c-name">
          <TextInput id="c-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="Nomor WhatsApp" htmlFor="c-phone" optional hint="Nomor Mesir (010...) atau Indonesia (08...). Dipakai untuk kirim pengingat.">
          <TextInput id="c-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010 1234 5678" />
        </Field>
        <Field label="Catatan" htmlFor="c-note" optional>
          <TextArea id="c-note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Misal: asrama, lantai, atau teman siapa" />
        </Field>
      </form>
    </Sheet>
  );
}

export function PaymentSheet({ open, onOpenChange, customer }: { open: boolean; onOpenChange: (open: boolean) => void; customer: CustomerDetail }) {
  const { activeMethods, context } = useBusiness();
  const methods = activeMethods.filter((m) => m.kind !== 'debt');
  const record = useRecordDebtPayment();
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState(methods[0]?.code ?? 'cash');
  const [note, setNote] = useState('');
  const [clientRef, setClientRef] = useState(uuid);

  useEffect(() => {
    if (open) {
      setAmount(amountToInput(customer.balance));
      setMethod(methods[0]?.code ?? 'cash');
      setNote('');
      setClientRef(uuid());
    }
  }, [open]);

  const value = parseAmount(amount);
  const remaining = value !== null ? customer.balance - value : customer.balance;
  const tooMuch = value !== null && value > customer.balance;
  const half = Math.round(customer.balance / 2);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (value === null || value <= 0 || tooMuch) return;
    const updated = await record.mutateAsync({ customerId: customer.id, amount: value, method, note: note.trim() || null, clientRef });
    const methodName = methods.find((m) => m.code === method)?.name ?? method;
    const receipt =
      `Terima kasih ${customer.name}, pembayaran ${formatMoney(value)} (${methodName}) sudah diterima ${context.business.name}.` +
      (updated.balance > 0 ? ` Sisa catatan: ${formatMoney(updated.balance)}.` : ' Semua sudah lunas.');
    toast.success(updated.balance > 0 ? `Tercatat. Sisa ${formatMoney(updated.balance)}` : `${customer.name} sudah lunas`, {
      action: { label: 'Kirim bukti', onClick: () => openWhatsApp(receipt, customer.phone) },
      duration: 6000,
    });
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Catat pembayaran"
      description={`${customer.name} masih punya catatan ${formatMoney(customer.balance)}.`}
      footer={
        <Button type="submit" form="payment-form" size="lg" block disabled={value === null || value <= 0 || tooMuch} loading={record.isPending}>
          Simpan pembayaran
        </Button>
      }
    >
      <form id="payment-form" onSubmit={submit} className="grid gap-5" noValidate>
        <Field label="Jumlah dibayar" htmlFor="pay-amount" error={tooMuch ? 'Lebih besar dari sisa hutang.' : null}>
          <MoneyInput id="pay-amount" size="xl" value={amount} onValueChange={setAmount} autoFocus />
        </Field>
        <div className="-mt-2 flex flex-wrap gap-2">
          <Chip selected={value === customer.balance} onClick={() => setAmount(amountToInput(customer.balance))}>
            Lunas semua
          </Chip>
          {half > 0 && half < customer.balance && (
            <Chip selected={value === half} onClick={() => setAmount(amountToInput(half))}>
              Setengah, {formatMoney(half)}
            </Chip>
          )}
        </div>
        <div>
          <p className="text-[13px] font-semibold text-ink-2">Dibayar lewat</p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Metode pembayaran">
            {methods.map((m) => (
              <Chip key={m.code} selected={method === m.code} onClick={() => setMethod(m.code)}>
                {m.name}
              </Chip>
            ))}
          </div>
        </div>
        <Field label="Catatan" htmlFor="pay-note" optional>
          <TextInput id="pay-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </Field>
        <div className="rounded-[16px] bg-surface-2 px-4 py-2">
          <Row label="Hutang sekarang" value={<Money value={customer.balance} />} />
          <Row label="Sisa setelah bayar" value={<Money value={Math.max(remaining, 0)} />} strong />
        </div>
      </form>
    </Sheet>
  );
}

export function ManualDebtSheet({ open, onOpenChange, customer }: { open: boolean; onOpenChange: (open: boolean) => void; customer: Customer }) {
  const { today } = useBusiness();
  const add = useAddCustomerDebt();
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [due, setDue] = useState('');
  useEffect(() => {
    if (open) {
      setAmount('');
      setNote('');
      setDue('');
    }
  }, [open]);
  const value = parseAmount(amount);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (value === null || value <= 0) return;
    await add.mutateAsync({ customerId: customer.id, amount: value, note: note.trim() || null, dueDate: due || null });
    toast.success('Hutang dicatat');
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title="Tambah hutang manual"
      description="Untuk hutang lama sebelum pakai Possir, atau pinjaman di luar transaksi."
      footer={
        <Button type="submit" form="manual-debt" size="lg" block disabled={value === null || value <= 0} loading={add.isPending}>
          Catat hutang
        </Button>
      }
    >
      <form id="manual-debt" onSubmit={submit} className="grid gap-4" noValidate>
        <Field label="Jumlah" htmlFor="md-amount">
          <MoneyInput id="md-amount" size="xl" value={amount} onValueChange={setAmount} autoFocus />
        </Field>
        <Field label="Keterangan" htmlFor="md-note" optional>
          <TextInput id="md-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} placeholder="Misal: hutang bulan lalu" />
        </Field>
        <Field label="Janji bayar" htmlFor="md-due" optional>
          <input id="md-due" type="date" min={today} value={due} onChange={(e) => setDue(e.target.value)} className={inputClass} />
        </Field>
      </form>
    </Sheet>
  );
}
