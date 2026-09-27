import { useEffect, useMemo, useState } from 'react';
import {
  CaretLeft,
  Check,
  Lightning,
  Minus,
  NotePencil,
  Plus,
  ShoppingCartSimple,
  Tag,
  Trash,
  UserCircle,
  UserPlus,
  WhatsappLogo,
  X,
} from '@phosphor-icons/react';
import { Button, IconButton } from '@/components/ui/button';
import { Chip, OptionCard } from '@/components/ui/choice';
import { Field, MoneyInput, TextArea, TextInput } from '@/components/ui/form';
import { Avatar, Money, ProductThumb, Row } from '@/components/ui/display';
import { paymentIcon } from '@/components/sale/sale-bits';
import { useBusiness } from '@/data/business';
import { useCreateSale, useCustomers } from '@/data/queries';
import type { Sale, SaleInput } from '@/data/types';
import { amountToInput, formatMoney, formatQty, parseAmount, parseQty } from '@/lib/format';
import { addDays, endOfMonth, formatDateShort } from '@/lib/dates';
import { toast } from 'sonner';
import { normalizeSearch, roundMoney } from '@/lib/util';
import { saleReceiptText } from '@/lib/share-text';
import { openWhatsApp } from '@/lib/phone';
import { useCart, type CartCustomer, type CartLine } from './cart';

type View = 'cart' | 'customer' | 'success';
type DueOption = 'none' | 'tomorrow' | 'week' | 'month-end';

const DUE_OPTIONS: Array<{ value: DueOption; label: string }> = [
  { value: 'none', label: 'Belum tahu' },
  { value: 'tomorrow', label: 'Besok' },
  { value: 'week', label: 'Minggu depan' },
  { value: 'month-end', label: 'Akhir bulan' },
];

function dueDateFor(option: DueOption, today: string): string | null {
  if (option === 'tomorrow') return addDays(today, 1);
  if (option === 'week') return addDays(today, 7);
  if (option === 'month-end') {
    const end = endOfMonth(today);
    return end === today ? endOfMonth(addDays(today, 1)) : end;
  }
  return null;
}

export function OrderPanel({ onClose, onQuickSale }: { onClose?: () => void; onQuickSale: () => void }) {
  const { businessId, context, activeMethods, today } = useBusiness();
  const cart = useCart(businessId);
  const createSale = useCreateSale();
  const { lines, customer, discount, note } = cart.state;
  const { subtotal, total, count } = cart.totals;

  const payMethods = activeMethods;
  const plainMethods = activeMethods.filter((m) => m.kind !== 'debt');
  const defaultMethod = plainMethods.find((m) => m.code === 'cash')?.code ?? plainMethods[0]?.code ?? 'cash';

  const [view, setView] = useState<View>('cart');
  const [method, setMethod] = useState(defaultMethod);
  const [cashText, setCashText] = useState('');
  const [dpText, setDpText] = useState('');
  const [dpMethod, setDpMethod] = useState(defaultMethod);
  const [due, setDue] = useState<DueOption>('none');
  const [discountOpen, setDiscountOpen] = useState(discount > 0);
  const [discountText, setDiscountText] = useState(discount > 0 ? amountToInput(discount) : '');
  const [noteOpen, setNoteOpen] = useState(note.length > 0);
  const [editing, setEditing] = useState<string | null>(null);
  const [lastSale, setLastSale] = useState<Sale | null>(null);

  const selected = payMethods.find((m) => m.code === method) ?? payMethods[0];
  useEffect(() => {
    if (!payMethods.some((m) => m.code === method)) setMethod(defaultMethod);
  }, [payMethods, method, defaultMethod]);

  // Menambah produk saat layar sukses tampil langsung membuka pesanan baru
  useEffect(() => {
    if (view === 'success' && lines.length > 0) setView('cart');
  }, [lines.length, view]);

  const isDebt = selected?.kind === 'debt';
  const isCash = selected?.kind === 'cash';
  const cash = parseAmount(cashText);
  const dp = isDebt ? (parseAmount(dpText) ?? 0) : 0;

  const problem = useMemo(() => {
    if (lines.length === 0) return 'Keranjang masih kosong.';
    if (!selected) return 'Aktifkan minimal satu metode bayar di Pengaturan.';
    if (isDebt && !customer) return 'Pilih pelanggan untuk mencatat hutang.';
    if (isDebt && dp >= total) return 'Uang muka sama dengan total. Pilih metode bayar biasa.';
    if (isCash && cash !== null && cash < total) return `Uang diterima kurang ${formatMoney(total - cash)}.`;
    return null;
  }, [lines.length, selected, isDebt, customer, dp, total, isCash, cash]);

  const resetPayment = () => {
    setMethod(defaultMethod);
    setCashText('');
    setDpText('');
    setDue('none');
    setDiscountOpen(false);
    setDiscountText('');
    setNoteOpen(false);
    setEditing(null);
  };

  const save = async () => {
    if (problem || !selected) return;
    const payload: SaleInput = {
      client_ref: cart.state.clientRef,
      items: lines.map((l) =>
        l.productId
          ? { product_id: l.productId, qty: l.qty, unit_price: l.price }
          : { name: l.name, qty: l.qty, unit_price: l.price, unit_cost: l.unitCost ?? 0, unit: l.unit },
      ),
      discount,
      payment_method: selected.code,
      cash_received: isCash && cash !== null ? cash : null,
      customer_id: customer?.id ?? null,
      new_customer: customer && !customer.id ? { name: customer.name, phone: customer.phone ?? null } : null,
      down_payment: isDebt ? dp : 0,
      down_payment_method: dpMethod,
      due_date: isDebt ? dueDateFor(due, today) : null,
      note: note.trim() || null,
    };
    const sale = await createSale.mutateAsync(payload);
    navigator.vibrate?.(12);
    setLastSale(sale);
    setView('success');
    cart.clear();
    resetPayment();
  };

  if (view === 'success' && lastSale) {
    return (
      <SaleSuccess
        sale={lastSale}
        onNew={() => {
          setView('cart');
          setLastSale(null);
          onClose?.();
        }}
        onShare={() => openWhatsApp(saleReceiptText(lastSale, context.business), lastSale.customer?.phone)}
      />
    );
  }

  if (view === 'customer') {
    return (
      <CustomerPicker
        onBack={() => setView('cart')}
        onPick={(c) => {
          cart.setCustomer(c);
          setView('cart');
        }}
      />
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-2 px-5 pb-3 pt-4">
        <div className="min-w-0 flex-1">
          <h2 className="text-[19px] font-bold tracking-[-0.02em]">Pesanan</h2>
          <p className="text-[13px] text-ink-3">{lines.length === 0 ? 'Belum ada item' : `${formatQty(count)} item`}</p>
        </div>
        {lines.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const previous = cart.state;
              cart.clear();
              toast('Pesanan dikosongkan', { action: { label: 'Urungkan', onClick: () => cart.restore(previous) } });
            }}
          >
            Kosongkan
          </Button>
        )}
        {onClose && (
          <IconButton label="Tutup" onClick={onClose} className="-mr-2">
            <X size={20} weight="bold" />
          </IconButton>
        )}
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5">
        {lines.length === 0 ? (
          <div className="flex flex-col items-center px-4 py-12 text-center">
            <div className="grid size-14 place-items-center rounded-full bg-surface-2 text-ink-3">
              <ShoppingCartSimple size={26} />
            </div>
            <p className="mt-4 text-[15px] font-semibold">Ketuk produk untuk menambah</p>
            <p className="mt-1 max-w-[28ch] text-[13px] text-ink-3">Atau pakai jual cepat untuk item yang belum ada di daftar produk.</p>
            <Button variant="secondary" size="sm" className="mt-4" icon={<Lightning size={16} weight="fill" />} onClick={onQuickSale}>
              Jual cepat
            </Button>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-line">
              {lines.map((line) => (
                <CartLineRow
                  key={line.key}
                  line={line}
                  editing={editing === line.key}
                  onToggle={() => setEditing((k) => (k === line.key ? null : line.key))}
                  onStep={(d) => cart.step(line.key, d)}
                  onQty={(q) => cart.setQty(line.key, q)}
                  onPrice={(p) => cart.setPrice(line.key, p)}
                  onRemove={() => cart.remove(line.key)}
                />
              ))}
            </ul>

            <div className="mt-3 flex items-center gap-2 rounded-[16px] border border-line py-1.5 pl-3.5 pr-1.5">
              <UserCircle size={22} className="shrink-0 text-ink-3" aria-hidden />
              <button type="button" onClick={() => setView('customer')} className="min-w-0 flex-1 py-1.5 text-left">
                {customer ? (
                  <>
                    <span className="block truncate text-[14px] font-semibold">
                      {customer.name}
                      {!customer.id && <span className="font-medium text-ink-3"> (baru)</span>}
                    </span>
                    {!!customer.balance && customer.balance > 0 && (
                      <span className="block text-[12.5px] text-warn-ink">Hutang sebelumnya {formatMoney(customer.balance)}</span>
                    )}
                  </>
                ) : (
                  <span className="text-[14px] font-semibold text-ink-2">
                    Pelanggan <span className="font-medium text-ink-3">{isDebt ? '(wajib untuk hutang)' : '(opsional)'}</span>
                  </span>
                )}
              </button>
              {customer ? (
                <IconButton label="Hapus pelanggan" size="sm" onClick={() => cart.setCustomer(null)}>
                  <X size={16} weight="bold" />
                </IconButton>
              ) : (
                <Button variant="secondary" size="sm" onClick={() => setView('customer')}>
                  Pilih
                </Button>
              )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              {!discountOpen && (
                <Chip icon={<Tag size={15} />} onClick={() => setDiscountOpen(true)}>
                  Diskon
                </Chip>
              )}
              {!noteOpen && (
                <Chip icon={<NotePencil size={15} />} onClick={() => setNoteOpen(true)}>
                  Catatan
                </Chip>
              )}
            </div>

            {discountOpen && (
              <div className="mt-3 rounded-[16px] border border-line p-3.5">
                <Field
                  label="Diskon"
                  htmlFor="cart-discount"
                  aside={
                    <button
                      type="button"
                      className="text-[13px] font-semibold text-ink-3 hover:text-ink"
                      onClick={() => {
                        cart.setDiscount(0);
                        setDiscountText('');
                        setDiscountOpen(false);
                      }}
                    >
                      Hapus
                    </button>
                  }
                  error={discount > subtotal ? 'Diskon lebih besar dari subtotal.' : null}
                >
                  <MoneyInput
                    id="cart-discount"
                    value={discountText}
                    onValueChange={(t) => {
                      setDiscountText(t);
                      cart.setDiscount(parseAmount(t) ?? 0);
                    }}
                    placeholder="0"
                  />
                </Field>
                <div className="mt-2 flex gap-2">
                  {[5, 10, 20].map((pct) => {
                    const value = roundMoney(Math.round((subtotal * pct) / 100));
                    return (
                      <Chip
                        key={pct}
                        selected={discount === value && value > 0}
                        onClick={() => {
                          cart.setDiscount(value);
                          setDiscountText(amountToInput(value));
                        }}
                      >
                        {pct}%
                      </Chip>
                    );
                  })}
                </div>
              </div>
            )}

            {noteOpen && (
              <div className="mt-3">
                <Field label="Catatan" htmlFor="cart-note" optional>
                  <TextArea
                    id="cart-note"
                    rows={2}
                    maxLength={300}
                    value={note}
                    onChange={(e) => cart.setNote(e.target.value)}
                    placeholder="Misal: pedas, antar ke Buuts lantai 3"
                  />
                </Field>
              </div>
            )}

            <section className="mt-5" aria-labelledby="pay-title">
              <h3 id="pay-title" className="text-[13px] font-semibold text-ink-2">
                Metode bayar
              </h3>
              <div role="radiogroup" aria-labelledby="pay-title" className="mt-2 grid grid-cols-2 gap-2">
                {payMethods.map((m) => {
                  const Icon = paymentIcon(m.code, m.kind);
                  return (
                    <OptionCard
                      key={m.code}
                      selected={selected?.code === m.code}
                      onClick={() => setMethod(m.code)}
                      icon={<Icon size={20} weight={selected?.code === m.code ? 'fill' : 'regular'} />}
                      title={m.name}
                    />
                  );
                })}
              </div>

              {isCash && (
                <CashReceived total={total} text={cashText} onText={setCashText} cash={cash} />
              )}

              {isDebt && (
                <div className="mt-3 grid gap-3.5 rounded-[18px] bg-surface-2 p-3.5">
                  <Field label="Bayar sebagian sekarang" htmlFor="cart-dp" optional hint="Sisanya masuk piutang pelanggan.">
                    <MoneyInput id="cart-dp" value={dpText} onValueChange={setDpText} placeholder="0" />
                  </Field>
                  {dp > 0 && (
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Uang muka dibayar dengan">
                      {plainMethods.map((m) => (
                        <Chip key={m.code} selected={dpMethod === m.code} onClick={() => setDpMethod(m.code)}>
                          {m.name}
                        </Chip>
                      ))}
                    </div>
                  )}
                  <div>
                    <p className="text-[13px] font-semibold text-ink-2">Janji bayar</p>
                    <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Janji bayar">
                      {DUE_OPTIONS.map((o) => (
                        <Chip key={o.value} selected={due === o.value} onClick={() => setDue(o.value)}>
                          {o.label}
                          {o.value !== 'none' && (
                            <span className="font-medium opacity-70">{formatDateShort(dueDateFor(o.value, today)!)}</span>
                          )}
                        </Chip>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {lines.length > 0 && (
        <footer className="shrink-0 border-t border-line px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
          {discount > 0 && (
            <>
              <Row label="Subtotal" value={<Money value={subtotal} />} className="py-0.5" />
              <Row label="Diskon" value={<Money value={-Math.min(discount, subtotal)} />} className="py-0.5" />
            </>
          )}
          {isDebt && dp > 0 && dp < total && (
            <Row label="Masuk piutang" value={<Money value={total - dp} />} className="py-0.5" />
          )}
          <div className="flex items-baseline justify-between gap-3 py-1">
            <span className="text-[15px] font-bold">Total</span>
            <Money value={total} className="text-[26px] font-bold tracking-[-0.03em]" />
          </div>
          {problem && lines.length > 0 && (
            <p className="mb-2 text-[13px] font-medium text-warn-ink" role="status">
              {problem}
            </p>
          )}
          <Button size="lg" block className="mt-1" disabled={!!problem} loading={createSale.isPending} onClick={save}>
            {isDebt ? 'Simpan sebagai hutang' : 'Simpan transaksi'}
          </Button>
        </footer>
      )}
    </div>
  );
}

function CartLineRow({
  line,
  editing,
  onToggle,
  onStep,
  onQty,
  onPrice,
  onRemove,
}: {
  line: CartLine;
  editing: boolean;
  onToggle: () => void;
  onStep: (delta: number) => void;
  onQty: (qty: number) => void;
  onPrice: (price: number) => void;
  onRemove: () => void;
}) {
  const [qtyText, setQtyText] = useState(formatQty(line.qty));
  const [priceText, setPriceText] = useState(amountToInput(line.price));
  useEffect(() => setQtyText(formatQty(line.qty)), [line.qty]);
  useEffect(() => setPriceText(amountToInput(line.price)), [line.price]);
  const lowStock = line.trackStock && line.stock !== undefined && line.qty > line.stock;

  return (
    <li className="py-3">
      <div className="flex items-center gap-3">
        <ProductThumb name={line.name} image={line.image} color={line.color} size="sm" />
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left" aria-expanded={editing}>
          <span className="block truncate text-[14px] font-semibold">{line.name}</span>
          <span className="block text-[12.5px] text-ink-3 tabular">
            {formatQty(line.qty)} × {formatMoney(line.price)}
            {line.price !== line.basePrice && <span className="text-warn-ink"> (harga diubah)</span>}
          </span>
        </button>
        <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-surface-2 p-0.5">
          <IconButton label={line.qty <= 1 ? `Hapus ${line.name}` : `Kurangi ${line.name}`} size="sm" onClick={() => onStep(-1)}>
            {line.qty <= 1 ? <Trash size={16} /> : <Minus size={16} weight="bold" />}
          </IconButton>
          <span className="min-w-7 text-center text-[14px] font-bold tabular" aria-live="polite">
            {formatQty(line.qty)}
          </span>
          <IconButton label={`Tambah ${line.name}`} size="sm" onClick={() => onStep(1)}>
            <Plus size={16} weight="bold" />
          </IconButton>
        </div>
      </div>
      {lowStock && (
        <p className="ml-[52px] mt-1.5 text-[12.5px] font-medium text-warn-ink">
          Stok di sistem tinggal {formatQty(line.stock ?? 0)}. Tetap bisa dijual.
        </p>
      )}
      {editing && (
        <div className="ml-[52px] mt-3 grid grid-cols-2 gap-2.5">
          <Field label="Jumlah" htmlFor={`qty-${line.key}`}>
            <TextInput
              id={`qty-${line.key}`}
              inputMode="decimal"
              value={qtyText}
              onChange={(e) => setQtyText(e.target.value)}
              onBlur={() => {
                const q = parseQty(qtyText);
                if (q) onQty(q);
                else setQtyText(formatQty(line.qty));
              }}
            />
          </Field>
          <Field label="Harga satuan" htmlFor={`price-${line.key}`}>
            <MoneyInput
              id={`price-${line.key}`}
              value={priceText}
              onValueChange={setPriceText}
              onBlur={() => {
                const p = parseAmount(priceText);
                if (p !== null) onPrice(p);
                else setPriceText(amountToInput(line.price));
              }}
            />
          </Field>
          <Button variant="ghost" size="sm" className="col-span-2 justify-self-start text-danger" icon={<Trash size={16} />} onClick={onRemove}>
            Hapus dari pesanan
          </Button>
        </div>
      )}
    </li>
  );
}

function CashReceived({ total, text, onText, cash }: { total: number; text: string; onText: (t: string) => void; cash: number | null }) {
  // Uang kertas Mesir terbesar EGP 200: tawarkan jumlah berikutnya yang wajar dibayar dengan 50, 100, 200
  const suggestions = useMemo(() => {
    const set = new Set<number>();
    for (const step of [50, 100, 200]) {
      const v = (Math.floor(total / step) + 1) * step;
      if (v > total) set.add(v);
    }
    return [...set].sort((a, b) => a - b).slice(0, 3);
  }, [total]);
  const change = cash !== null && cash > total ? roundMoney(cash - total) : 0;

  return (
    <div className="mt-3 rounded-[18px] bg-surface-2 p-3.5">
      <p className="text-[13px] font-semibold text-ink-2">
        Uang diterima <span className="font-medium text-ink-3">(untuk hitung kembalian)</span>
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <Chip selected={cash === total} onClick={() => onText(amountToInput(total))}>
          Uang pas
        </Chip>
        {suggestions.map((v) => (
          <Chip key={v} selected={cash === v} onClick={() => onText(amountToInput(v))}>
            {formatMoney(v)}
          </Chip>
        ))}
      </div>
      <MoneyInput className="mt-2.5" value={text} onValueChange={onText} placeholder="Jumlah lain" aria-label="Uang diterima" />
      {change > 0 && (
        <div className="mt-3 flex items-baseline justify-between rounded-[14px] bg-lime px-3.5 py-2.5 text-on-lime">
          <span className="text-[14px] font-bold">Kembalian</span>
          <Money value={change} className="text-[20px] font-bold" />
        </div>
      )}
    </div>
  );
}

function CustomerPicker({ onBack, onPick }: { onBack: () => void; onPick: (c: CartCustomer) => void }) {
  const customers = useCustomers();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const q = normalizeSearch(query);
  const list = (customers.data ?? []).filter((c) => !q || normalizeSearch(c.name).includes(q));

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex shrink-0 items-center gap-1 px-3 pb-2 pt-4">
        <IconButton label="Kembali ke pesanan" onClick={onBack}>
          <CaretLeft size={20} weight="bold" />
        </IconButton>
        <h2 className="text-[19px] font-bold tracking-[-0.02em]">Pilih pelanggan</h2>
      </header>
      <div className="shrink-0 px-5 pb-3">
        <TextInput
          type="search"
          autoFocus
          placeholder="Cari nama pelanggan"
          aria-label="Cari nama pelanggan"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5">
        {adding ? (
          <form
            className="grid gap-3 rounded-[18px] border border-line p-4"
            onSubmit={(e) => {
              e.preventDefault();
              if (!name.trim()) return;
              onPick({ id: null, name: name.trim(), phone: phone.trim() || null });
            }}
          >
            <Field label="Nama pelanggan" htmlFor="new-cust-name">
              <TextInput id="new-cust-name" autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </Field>
            <Field label="Nomor WhatsApp" htmlFor="new-cust-phone" optional hint="Untuk kirim struk dan pengingat. Nomor Mesir atau Indonesia.">
              <TextInput id="new-cust-phone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="010 1234 5678" />
            </Field>
            <div className="flex gap-2">
              <Button type="submit" disabled={!name.trim()}>
                Pakai pelanggan ini
              </Button>
              <Button variant="ghost" onClick={() => setAdding(false)}>
                Batal
              </Button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => {
              setAdding(true);
              setName(query.trim());
            }}
            className="pressable flex w-full items-center gap-3 rounded-[16px] border border-dashed border-field px-4 py-3 text-left hover:bg-surface-2"
          >
            <UserPlus size={22} className="text-brand" />
            <span className="text-[14px] font-semibold">
              Pelanggan baru{query.trim() && <span className="text-ink-3">: {query.trim()}</span>}
            </span>
          </button>
        )}
        <ul className="mt-3 divide-y divide-line">
          {list.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => onPick({ id: c.id, name: c.name, phone: c.phone, balance: c.balance })}
                className="flex w-full items-center gap-3 py-3 text-left"
              >
                <Avatar name={c.name} size="sm" />
                <span className="min-w-0 flex-1 truncate text-[14px] font-semibold">{c.name}</span>
                {c.balance > 0 && (
                  <span className="text-[12.5px] font-semibold text-warn-ink tabular">hutang {formatMoney(c.balance)}</span>
                )}
              </button>
            </li>
          ))}
        </ul>
        {customers.isSuccess && list.length === 0 && !adding && (
          <p className="mt-4 text-center text-[13px] text-ink-3">{query ? 'Nama ini belum ada.' : 'Belum ada pelanggan.'}</p>
        )}
      </div>
    </div>
  );
}

function SaleSuccess({ sale, onNew, onShare }: { sale: Sale; onNew: () => void; onShare: () => void }) {
  const change = sale.cash_received && sale.cash_received > sale.total ? roundMoney(sale.cash_received - sale.total) : 0;
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-5 py-10 text-center">
        <div className="success-pop mx-auto grid size-16 place-items-center rounded-full bg-brand text-on-brand">
          <Check size={32} weight="bold" />
        </div>
        <h2 className="mt-5 text-[22px] font-bold tracking-[-0.02em]">Transaksi tersimpan</h2>
        <p className="mt-1 text-[14px] text-ink-3">
          #{sale.number}, {sale.payment_method_name}
        </p>
        <Money value={sale.total} className="mt-4 block text-[40px] font-bold tracking-[-0.03em]" />
        {change > 0 && (
          <div className="mx-auto mt-5 max-w-[300px] rounded-[20px] bg-lime p-4 text-on-lime">
            <p className="text-[14px] font-bold">Kembalian</p>
            <Money value={change} className="mt-0.5 block text-[30px] font-bold tracking-[-0.03em]" />
          </div>
        )}
        {sale.debt_amount > 0 && sale.customer && (
          <div className="mx-auto mt-5 max-w-[320px] rounded-[20px] bg-warn-soft p-4 text-[14px] text-warn-ink">
            <b>{formatMoney(sale.debt_amount)}</b> masuk piutang {sale.customer.name}
            {sale.due_date ? `, janji bayar ${formatDateShort(sale.due_date)}` : ''}.
          </div>
        )}
      </div>
      <footer className="grid shrink-0 gap-2 border-t border-line px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-3">
        <Button size="lg" block onClick={onNew} autoFocus>
          Transaksi baru
        </Button>
        <Button variant="secondary" size="lg" block icon={<WhatsappLogo size={19} weight="fill" />} onClick={onShare}>
          Kirim struk
        </Button>
      </footer>
    </div>
  );
}

