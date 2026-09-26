import { useEffect, useState, type FormEvent } from 'react';
import {
  Basket,
  Car,
  DotsThreeOutline,
  Drop,
  Flame,
  House,
  Lightning,
  Megaphone,
  Moped,
  Package,
  Trash,
  WifiHigh,
  type Icon,
} from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Chip } from '@/components/ui/choice';
import { Field, MoneyInput, TextInput, inputClass } from '@/components/ui/form';
import { useBusiness } from '@/data/business';
import { useSaveExpense, useVoidExpense } from '@/data/queries';
import type { Expense } from '@/data/types';
import { amountToInput, parseAmount } from '@/lib/format';
import { uuid } from '@/lib/util';

export const EXPENSE_CATEGORIES: Array<{ name: string; icon: Icon }> = [
  { name: 'Gas', icon: Flame },
  { name: 'Bahan baku', icon: Basket },
  { name: 'Kemasan', icon: Package },
  { name: 'Transport', icon: Car },
  { name: 'Ongkir', icon: Moped },
  { name: 'Listrik', icon: Lightning },
  { name: 'Air', icon: Drop },
  { name: 'Sewa', icon: House },
  { name: 'Iklan', icon: Megaphone },
  { name: 'Pulsa & internet', icon: WifiHigh },
  { name: 'Lainnya', icon: DotsThreeOutline },
];

export function expenseIcon(category: string): Icon {
  return EXPENSE_CATEGORIES.find((c) => c.name.toLowerCase() === category.toLowerCase())?.icon ?? DotsThreeOutline;
}

export function ExpenseSheet({ open, onOpenChange, expense }: { open: boolean; onOpenChange: (o: boolean) => void; expense: Expense | null }) {
  const { today, activeMethods } = useBusiness();
  const methods = activeMethods.filter((m) => m.kind !== 'debt');
  const save = useSaveExpense();
  const remove = useVoidExpense();
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Gas');
  const [custom, setCustom] = useState('');
  const [date, setDate] = useState(today);
  const [method, setMethod] = useState<string | null>('cash');
  const [note, setNote] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [clientRef, setClientRef] = useState(uuid);

  useEffect(() => {
    if (!open) return;
    setAmount(amountToInput(expense?.amount));
    const known = EXPENSE_CATEGORIES.some((c) => c.name === expense?.category);
    setCategory(expense ? (known ? expense.category : 'custom') : 'Gas');
    setCustom(expense && !known ? expense.category : '');
    setDate(expense?.spent_on ?? today);
    setMethod(expense ? expense.method_code : (methods[0]?.code ?? null));
    setNote(expense?.note ?? '');
    setConfirmDelete(false);
    setClientRef(uuid());
    // isi ulang hanya saat sheet dibuka, bukan setiap data berubah
  }, [open]);

  const value = parseAmount(amount);
  const finalCategory = category === 'custom' ? custom.trim() : category;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (value === null || value <= 0 || !finalCategory) return;
    await save.mutateAsync({
      id: expense?.id,
      client_ref: expense ? undefined : clientRef,
      category: finalCategory,
      amount: value,
      note: note.trim() || null,
      spent_on: date,
      method_code: method,
    });
    toast.success(expense ? 'Pengeluaran diperbarui' : 'Pengeluaran dicatat');
    onOpenChange(false);
  };

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={expense ? 'Ubah pengeluaran' : 'Catat pengeluaran'}
      footer={
        <div className="grid gap-2">
          <Button type="submit" form="expense-form" size="lg" block disabled={value === null || value <= 0 || !finalCategory} loading={save.isPending}>
            Simpan
          </Button>
          {expense && (
            <Button
              variant={confirmDelete ? 'danger' : 'ghost'}
              icon={<Trash size={17} />}
              loading={remove.isPending}
              onClick={async () => {
                if (!confirmDelete) return setConfirmDelete(true);
                await remove.mutateAsync(expense.id);
                toast.success('Pengeluaran dihapus');
                onOpenChange(false);
              }}
            >
              {confirmDelete ? 'Ketuk lagi untuk menghapus' : 'Hapus pengeluaran'}
            </Button>
          )}
        </div>
      }
    >
      <form id="expense-form" onSubmit={submit} className="grid gap-5" noValidate>
        <Field label="Jumlah" htmlFor="exp-amount">
          <MoneyInput id="exp-amount" size="xl" value={amount} onValueChange={setAmount} autoFocus={!expense} />
        </Field>
        <div>
          <p className="text-[13px] font-semibold text-ink-2">Untuk apa?</p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Kategori pengeluaran">
            {EXPENSE_CATEGORIES.map(({ name, icon: I }) => (
              <Chip key={name} selected={category === name} onClick={() => setCategory(name)} icon={<I size={15} />}>
                {name}
              </Chip>
            ))}
            <Chip selected={category === 'custom'} onClick={() => setCategory('custom')}>
              Kategori lain
            </Chip>
          </div>
          {category === 'custom' && (
            <TextInput aria-label="Nama kategori" className="mt-2" value={custom} onChange={(e) => setCustom(e.target.value)} maxLength={40} placeholder="Tulis kategori" />
          )}
          {category === 'Bahan baku' && (
            <p className="mt-2 rounded-[12px] bg-surface-2 px-3 py-2 text-[13px] text-ink-2">
              Kalau harga modal produk sudah diisi, bahan baku sudah terhitung di modal. Mencatatnya lagi di sini membuat laba terlihat lebih kecil.
            </p>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Tanggal" htmlFor="exp-date">
            <input id="exp-date" type="date" max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputClass} />
          </Field>
          <Field label="Catatan" htmlFor="exp-note" optional>
            <TextInput id="exp-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
          </Field>
        </div>
        <div>
          <p className="text-[13px] font-semibold text-ink-2">Dibayar pakai</p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Metode pembayaran">
            {methods.map((m) => (
              <Chip key={m.code} selected={method === m.code} onClick={() => setMethod(m.code)}>
                {m.name}
              </Chip>
            ))}
          </div>
        </div>
      </form>
    </Sheet>
  );
}
