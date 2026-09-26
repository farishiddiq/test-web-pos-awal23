import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router';
import { CaretLeft, Plus, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Page } from '@/components/layout/app-shell';
import { Button, IconButton } from '@/components/ui/button';
import { Chip, Segmented } from '@/components/ui/choice';
import { Field, MoneyInput, SwitchRow, TextInput, inputClass } from '@/components/ui/form';
import { Money, PageHeader, Row } from '@/components/ui/display';
import { useBusiness } from '@/data/business';
import { useCreatePurchase, useProducts, useSuppliers } from '@/data/queries';
import { amountToInput, formatMoney, parseAmount, parseQty } from '@/lib/format';
import { cn, roundMoney, uuid } from '@/lib/util';

interface Line {
  key: string;
  productId: string;
  qty: string;
  cost: string;
}

export function PurchaseFormPage() {
  const { today, activeMethods } = useBusiness();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const suppliers = useSuppliers();
  const products = useProducts();
  const create = useCreatePurchase();
  const methods = activeMethods.filter((m) => m.kind !== 'debt');

  const [supplierMode, setSupplierMode] = useState<'existing' | 'new' | 'none'>('existing');
  const [supplierId, setSupplierId] = useState<string>(params.get('supplier') ?? '');
  const [newName, setNewName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [date, setDate] = useState(today);
  const [lines, setLines] = useState<Line[]>([{ key: uuid(), productId: '', qty: '', cost: '' }]);
  const [paid, setPaid] = useState('');
  const [paidTouched, setPaidTouched] = useState(false);
  const [method, setMethod] = useState(methods[0]?.code ?? 'cash');
  const [updateCost, setUpdateCost] = useState(true);
  const [note, setNote] = useState('');
  const [clientRef] = useState(uuid);
  const [error, setError] = useState<string | null>(null);

  const productList = (products.data ?? []).slice().sort((a, b) => a.name.localeCompare(b.name, 'id'));
  const supplierList = suppliers.data ?? [];

  useEffect(() => {
    if (!supplierId && supplierList.length > 0 && supplierMode === 'existing') setSupplierId(supplierList[0].id);
    if (supplierList.length === 0 && suppliers.isSuccess && supplierMode === 'existing') setSupplierMode('new');
  }, [supplierList, supplierId, supplierMode, suppliers.isSuccess]);

  const total = useMemo(
    () => roundMoney(lines.reduce((t, l) => t + (parseQty(l.qty) ?? 0) * (parseAmount(l.cost) ?? 0), 0)),
    [lines],
  );
  useEffect(() => {
    if (!paidTouched) setPaid(amountToInput(total));
  }, [total, paidTouched]);

  const paidValue = parseAmount(paid) ?? 0;
  const debt = Math.max(0, roundMoney(total - paidValue));

  const updateLine = (key: string, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    const items = lines
      .filter((l) => l.productId)
      .map((l) => ({ product_id: l.productId, qty: parseQty(l.qty) ?? 0, unit_cost: parseAmount(l.cost) ?? 0 }));
    if (items.length === 0) return setError('Pilih minimal satu produk.');
    if (items.some((i) => i.qty <= 0)) return setError('Isi jumlah setiap barang.');
    if (paidValue > total) return setError('Jumlah dibayar lebih besar dari total.');
    if (debt > 0 && supplierMode === 'none') return setError('Pilih supplier kalau pembelian belum lunas.');
    if (supplierMode === 'new' && !newName.trim()) return setError('Isi nama supplier baru.');

    const purchase = await create.mutateAsync({
      client_ref: clientRef,
      supplier_id: supplierMode === 'existing' ? supplierId || null : null,
      new_supplier: supplierMode === 'new' ? { name: newName.trim(), phone: newPhone.trim() || null } : null,
      items,
      paid_amount: paidValue,
      method_code: paidValue > 0 ? method : null,
      purchased_on: date,
      note: note.trim() || null,
      update_cost: updateCost,
    });
    toast.success(`Pembelian #${purchase.number} tersimpan. Stok sudah bertambah.`);
    navigate(purchase.supplier ? `/supplier/${purchase.supplier.id}` : '/produk');
  };

  return (
    <Page className="max-w-[860px]">
      <Link to="/supplier" className="inline-flex items-center gap-1 text-[14px] font-semibold text-ink-2 hover:text-ink">
        <CaretLeft size={16} weight="bold" /> Supplier
      </Link>
      <PageHeader className="mt-3" title="Catat pembelian" subtitle="Stok bertambah otomatis dan harga modal ikut diperbarui." />

      <form onSubmit={submit} className="mt-6 grid gap-4" noValidate>
        <section className="card grid gap-4 p-5 md:p-6">
          <h2 className="text-[16px] font-bold">Dari mana?</h2>
          <Segmented
            label="Supplier"
            value={supplierMode}
            onChange={setSupplierMode}
            options={[
              { value: 'existing', label: 'Supplier' },
              { value: 'new', label: 'Baru' },
              { value: 'none', label: 'Tanpa' },
            ]}
          />
          {supplierMode === 'existing' && (
            <Field label="Pilih supplier" htmlFor="pf-supplier">
              <select id="pf-supplier" value={supplierId} onChange={(e) => setSupplierId(e.target.value)} className={inputClass}>
                {supplierList.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                    {s.balance > 0 ? ` (hutang ${formatMoney(s.balance)})` : ''}
                  </option>
                ))}
              </select>
            </Field>
          )}
          {supplierMode === 'new' && (
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nama supplier" htmlFor="pf-new-name">
                <TextInput id="pf-new-name" value={newName} onChange={(e) => setNewName(e.target.value)} maxLength={80} />
              </Field>
              <Field label="Nomor WhatsApp" htmlFor="pf-new-phone" optional>
                <TextInput id="pf-new-phone" type="tel" inputMode="tel" value={newPhone} onChange={(e) => setNewPhone(e.target.value)} />
              </Field>
            </div>
          )}
          <Field label="Tanggal beli" htmlFor="pf-date" className="max-w-[240px]">
            <input id="pf-date" type="date" max={today} value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className={inputClass} />
          </Field>
        </section>

        <section className="card grid gap-4 p-5 md:p-6">
          <h2 className="text-[16px] font-bold">Barang yang dibeli</h2>
          {productList.length === 0 && <p className="text-[14px] text-ink-3">Tambahkan produk dulu di menu Produk.</p>}
          <ul className="grid gap-3">
            {lines.map((l, i) => {
              const product = productList.find((p) => p.id === l.productId);
              const lineTotal = (parseQty(l.qty) ?? 0) * (parseAmount(l.cost) ?? 0);
              return (
                <li key={l.key} className="grid gap-3 rounded-[18px] border border-line p-3.5 sm:grid-cols-[minmax(0,1.6fr)_90px_minmax(0,1fr)_auto] sm:items-end">
                  <Field label={`Produk ${i + 1}`} htmlFor={`pf-p-${l.key}`}>
                    <select
                      id={`pf-p-${l.key}`}
                      value={l.productId}
                      onChange={(e) => {
                        const p = productList.find((x) => x.id === e.target.value);
                        updateLine(l.key, { productId: e.target.value, cost: l.cost || amountToInput(p?.cost_price ?? 0) });
                      }}
                      className={inputClass}
                    >
                      <option value="">Pilih produk</option>
                      {productList.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                          {p.track_stock ? ` (stok ${p.stock})` : ''}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={product ? `Jumlah (${product.unit})` : 'Jumlah'} htmlFor={`pf-q-${l.key}`}>
                    <TextInput id={`pf-q-${l.key}`} inputMode="decimal" value={l.qty} onChange={(e) => updateLine(l.key, { qty: e.target.value })} className="tabular" />
                  </Field>
                  <Field label="Harga beli / satuan" htmlFor={`pf-c-${l.key}`}>
                    <MoneyInput id={`pf-c-${l.key}`} value={l.cost} onValueChange={(t) => updateLine(l.key, { cost: t })} />
                  </Field>
                  <div className="flex items-center justify-between gap-3 sm:h-12 sm:justify-end">
                    <span className="text-[13px] text-ink-3 sm:hidden">Subtotal {formatMoney(lineTotal)}</span>
                    <IconButton label="Hapus baris" disabled={lines.length === 1} onClick={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}>
                      <Trash size={18} />
                    </IconButton>
                  </div>
                  {product && !product.track_stock && (
                    <p className="text-[12.5px] text-warn-ink sm:col-span-4">Stok produk ini tidak dilacak, jadi hanya harga modalnya yang diperbarui.</p>
                  )}
                </li>
              );
            })}
          </ul>
          <Button variant="secondary" icon={<Plus size={17} weight="bold" />} className="justify-self-start" onClick={() => setLines((ls) => [...ls, { key: uuid(), productId: '', qty: '', cost: '' }])}>
            Tambah barang
          </Button>
          <div className="rounded-[16px] bg-surface-2 px-4 py-2">
            <Row label="Total belanja" value={<Money value={total} />} strong />
          </div>
          <div className="rounded-[18px] border border-line px-4">
            <SwitchRow title="Perbarui harga modal produk" description="Harga modal produk diganti dengan harga beli ini, supaya laba di laporan akurat." checked={updateCost} onChange={setUpdateCost} />
          </div>
        </section>

        <section className="card grid gap-4 p-5 md:p-6">
          <h2 className="text-[16px] font-bold">Pembayaran</h2>
          <Field label="Dibayar sekarang" htmlFor="pf-paid" hint={debt > 0 ? `Sisa ${formatMoney(debt)} dicatat sebagai hutang ke supplier.` : 'Lunas.'}>
            <MoneyInput
              id="pf-paid"
              value={paid}
              onValueChange={(t) => {
                setPaid(t);
                setPaidTouched(true);
              }}
            />
          </Field>
          {paidValue > 0 && (
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Metode pembayaran">
              {methods.map((m) => (
                <Chip key={m.code} selected={method === m.code} onClick={() => setMethod(m.code)}>
                  {m.name}
                </Chip>
              ))}
            </div>
          )}
          <Field label="Catatan" htmlFor="pf-note" optional>
            <TextInput id="pf-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />
          </Field>
        </section>

        {error && (
          <p role="alert" className="rounded-[12px] bg-danger-soft px-4 py-3 text-[14px] font-medium text-danger-ink">
            {error}
          </p>
        )}
        <div className={cn('sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-10 md:bottom-4')}>
          <Button type="submit" size="lg" block loading={create.isPending} className="shadow-[var(--shadow-float)]">
            Simpan pembelian, {formatMoney(total)}
          </Button>
        </div>
      </form>
    </Page>
  );
}
