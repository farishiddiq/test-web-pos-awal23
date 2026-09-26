import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Archive, ArrowCounterClockwise, Camera, Minus, Plus, Scales, Trash } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { Sheet } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Chip, Segmented } from '@/components/ui/choice';
import { Field, MoneyInput, SwitchRow, TextInput } from '@/components/ui/form';
import { Badge, ProductThumb, Skeleton } from '@/components/ui/display';
import { useBusiness } from '@/data/business';
import {
  useAdjustStock,
  useDeleteProduct,
  useSetProductActive,
  useStockMovements,
  useUpsertCategory,
  useUpsertProduct,
} from '@/data/queries';
import { backend } from '@/data/backend';
import type { Product, StockMovement } from '@/data/types';
import { amountToInput, formatMoney, formatQty, parseAmount, parseQty } from '@/lib/format';
import { formatDateTime } from '@/lib/dates';
import { TILE_COLORS, cn } from '@/lib/util';
import { resizeImage } from '@/lib/image';

const UNITS = ['pcs', 'porsi', 'pack', 'bungkus', 'botol', 'gelas', 'kg', 'liter'];

export function ProductSheet({
  product,
  open,
  onOpenChange,
  initialTab = 'detail',
}: {
  product: Product | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: 'detail' | 'stok';
}) {
  const [tab, setTab] = useState<'detail' | 'stok'>(initialTab);
  useEffect(() => {
    if (open) setTab(initialTab);
  }, [open, initialTab]);
  const isNew = !product;
  const showStockTab = !!product && product.track_stock;

  return (
    <Sheet
      open={open}
      onOpenChange={onOpenChange}
      title={isNew ? 'Produk baru' : product.name}
      description={isNew ? 'Harga modal membantu Possir menghitung laba.' : undefined}
      toolbar={
        showStockTab ? (
          <Segmented
            label="Bagian produk"
            className="w-full"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'detail', label: 'Detail' },
              { value: 'stok', label: `Stok: ${formatQty(product.stock)} ${product.unit}` },
            ]}
          />
        ) : undefined
      }
    >
      {tab === 'stok' && product ? (
        <StockPanel product={product} />
      ) : (
        <ProductForm key={product?.id ?? 'new'} product={product} onDone={() => onOpenChange(false)} />
      )}
    </Sheet>
  );
}

function ProductForm({ product, onDone }: { product: Product | null; onDone: () => void }) {
  const { businessId, context, isOwner } = useBusiness();
  const upsert = useUpsertProduct();
  const setActive = useSetProductActive();
  const remove = useDeleteProduct();
  const addCategory = useUpsertCategory();
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(product?.name ?? '');
  const [categoryId, setCategoryId] = useState<string | null>(product?.category_id ?? context.categories[0]?.id ?? null);
  const [price, setPrice] = useState(amountToInput(product?.price));
  const [cost, setCost] = useState(amountToInput(product?.cost_price));
  const [unit, setUnit] = useState(product?.unit ?? 'pcs');
  const [trackStock, setTrackStock] = useState(product?.track_stock ?? false);
  const [stock, setStock] = useState('');
  const [minStock, setMinStock] = useState(product ? formatQty(product.min_stock) : '5');
  const [sku, setSku] = useState(product?.sku ?? '');
  const [color, setColor] = useState<string | null>(product?.color ?? null);
  const [image, setImage] = useState<string | null>(product?.image_url ?? null);
  const [uploading, setUploading] = useState(false);
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const priceValue = parseAmount(price);
  const costValue = parseAmount(cost) ?? 0;
  const margin = priceValue !== null && priceValue > 0 ? priceValue - costValue : null;

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUploading(true);
    try {
      const demo = backend().kind === 'demo';
      const blob = await resizeImage(file, demo ? 320 : 720, demo ? 0.72 : 0.82);
      const url = await backend().uploadProductImage(businessId, blob);
      setImage(url);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Foto gagal diunggah.');
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) return setError('Isi nama produk.');
    if (priceValue === null) return setError('Isi harga jual.');
    const stockValue = trackStock && !product ? (parseQty(stock) ?? 0) : undefined;
    const saved = await upsert.mutateAsync({
      id: product?.id,
      name: name.trim(),
      category_id: categoryId,
      sku: sku.trim() || null,
      unit: unit.trim() || 'pcs',
      price: priceValue,
      cost_price: costValue,
      track_stock: trackStock,
      stock: stockValue,
      min_stock: trackStock ? (parseQty(minStock) ?? 0) : 0,
      image_url: image,
      color,
    });
    toast.success(product ? 'Produk diperbarui' : `${saved.name} ditambahkan`);
    onDone();
  };

  if (!isOwner) return null;

  return (
    <form onSubmit={submit} className="grid gap-5" noValidate>
      <div className="flex items-center gap-4">
        <ProductThumb name={name || 'Produk'} image={image} color={color} size="lg" />
        <div className="flex flex-wrap gap-2">
          <input ref={fileRef} type="file" accept="image/*" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} />
          <Button variant="secondary" size="sm" icon={<Camera size={16} />} onClick={() => fileRef.current?.click()} loading={uploading} loadingText="Mengunggah…">
            {image ? 'Ganti foto' : 'Tambah foto'}
          </Button>
          {image && (
            <Button variant="ghost" size="sm" onClick={() => setImage(null)}>
              Hapus foto
            </Button>
          )}
        </div>
      </div>
      {!image && (
        <div>
          <p className="text-[13px] font-semibold text-ink-2">Warna petak</p>
          <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Warna petak produk">
            {TILE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={cn('pressable size-8 rounded-full ring-offset-2 ring-offset-surface', color === c && 'ring-2 ring-ink')}
                style={{ background: `var(--tint-${c}-bg)`, boxShadow: `inset 0 0 0 1px var(--tint-${c}-fg)` }}
              />
            ))}
          </div>
        </div>
      )}

      <Field label="Nama produk" htmlFor="p-name">
        <TextInput id="p-name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Misal: Nasi Ayam Geprek" />
      </Field>

      <div>
        <p className="text-[13px] font-semibold text-ink-2">Kategori</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {context.categories.map((c) => (
            <Chip key={c.id} selected={categoryId === c.id} onClick={() => setCategoryId(c.id)}>
              {c.name}
            </Chip>
          ))}
          <Chip selected={categoryId === null} onClick={() => setCategoryId(null)}>
            Tanpa kategori
          </Chip>
          {newCategory === null ? (
            <Chip icon={<Plus size={14} weight="bold" />} onClick={() => setNewCategory('')}>
              Baru
            </Chip>
          ) : (
            <span className="flex items-center gap-2">
              <TextInput
                aria-label="Nama kategori baru"
                autoFocus
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
                className="h-9 w-40 rounded-full px-3.5 text-[14px]"
                maxLength={40}
              />
              <Button
                size="sm"
                variant="secondary"
                disabled={!newCategory.trim()}
                loading={addCategory.isPending}
                loadingText="…"
                onClick={async () => {
                  const ctx = await addCategory.mutateAsync({ name: newCategory.trim() });
                  const created = ctx.categories.find((c) => c.name.toLowerCase() === newCategory.trim().toLowerCase());
                  if (created) setCategoryId(created.id);
                  setNewCategory(null);
                }}
              >
                Tambah
              </Button>
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Harga jual" htmlFor="p-price">
          <MoneyInput id="p-price" value={price} onValueChange={setPrice} placeholder="0" />
        </Field>
        <Field label="Harga modal" htmlFor="p-cost">
          <MoneyInput id="p-cost" value={cost} onValueChange={setCost} placeholder="0" />
        </Field>
      </div>
      {margin !== null && (
        <p className={cn('-mt-2 rounded-[14px] px-3.5 py-2.5 text-[14px]', margin >= 0 ? 'bg-brand-soft text-brand-ink' : 'bg-danger-soft text-danger-ink')}>
          {margin >= 0 ? 'Untung' : 'Rugi'} <b>{formatMoney(Math.abs(margin))}</b> per {unit || 'item'}
          {priceValue && priceValue > 0 && margin >= 0 ? ` (${Math.round((margin / priceValue) * 100)}% dari harga jual)` : ''}
        </p>
      )}

      <div>
        <p className="text-[13px] font-semibold text-ink-2">Satuan</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {UNITS.map((u) => (
            <Chip key={u} selected={unit === u} onClick={() => setUnit(u)}>
              {u}
            </Chip>
          ))}
          {!UNITS.includes(unit) && (
            <Chip selected onClick={() => undefined}>
              {unit}
            </Chip>
          )}
        </div>
        <TextInput aria-label="Satuan lain" className="mt-2 h-10 max-w-[200px] text-[14px]" placeholder="Satuan lain" maxLength={20} onChange={(e) => e.target.value.trim() && setUnit(e.target.value.trim())} />
      </div>

      <div className="rounded-[18px] border border-line px-4">
        <SwitchRow
          title="Lacak stok"
          description="Nyalakan untuk barang jadi (frozen, botolan). Matikan untuk makanan yang dimasak saat dipesan."
          checked={trackStock}
          onChange={setTrackStock}
        />
        {trackStock && (
          <div className="grid grid-cols-2 gap-3 border-t border-line py-4">
            {!product ? (
              <Field label="Stok awal" htmlFor="p-stock">
                <TextInput id="p-stock" inputMode="decimal" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="0" className="tabular" />
              </Field>
            ) : (
              <div className="grid gap-1.5">
                <span className="text-[13px] font-semibold text-ink-2">Stok sekarang</span>
                <span className="flex h-12 items-center text-[16px] font-bold tabular">
                  {formatQty(product.stock)} {product.unit}
                </span>
              </div>
            )}
            <Field label="Stok minimum" htmlFor="p-min" hint="Muncul di Stok menipis.">
              <TextInput id="p-min" inputMode="decimal" value={minStock} onChange={(e) => setMinStock(e.target.value)} className="tabular" />
            </Field>
          </div>
        )}
      </div>

      <Field label="Kode / barcode" htmlFor="p-sku" optional>
        <TextInput id="p-sku" value={sku} onChange={(e) => setSku(e.target.value)} maxLength={64} />
      </Field>

      {error && (
        <p role="alert" className="text-[14px] font-medium text-danger">
          {error}
        </p>
      )}

      <div className="grid gap-2">
        <Button type="submit" size="lg" block loading={upsert.isPending}>
          {product ? 'Simpan perubahan' : 'Tambah produk'}
        </Button>
        {product && (
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant="secondary"
              icon={product.is_active ? <Archive size={17} /> : <ArrowCounterClockwise size={17} />}
              loading={setActive.isPending}
              onClick={async () => {
                await setActive.mutateAsync({ id: product.id, active: !product.is_active });
                toast.success(product.is_active ? 'Produk diarsipkan. Tidak tampil di kasir.' : 'Produk aktif lagi');
                onDone();
              }}
            >
              {product.is_active ? 'Arsipkan' : 'Aktifkan'}
            </Button>
            <Button
              variant="danger"
              icon={<Trash size={17} />}
              loading={remove.isPending}
              onClick={async () => {
                await remove.mutateAsync(product.id);
                toast.success('Produk dihapus');
                onDone();
              }}
            >
              Hapus
            </Button>
          </div>
        )}
      </div>
    </form>
  );
}

const REASON_LABEL: Record<string, string> = {
  restock: 'Tambah stok',
  damaged: 'Rusak',
  lost: 'Hilang',
  expired: 'Kedaluwarsa',
  correction: 'Koreksi',
  other: 'Lainnya',
};

function movementLabel(m: StockMovement): string {
  switch (m.type) {
    case 'initial':
      return 'Stok awal';
    case 'sale':
      return `Terjual, transaksi #${m.sale_number ?? '-'}`;
    case 'sale_void':
      return `Transaksi #${m.sale_number ?? '-'} dibatalkan`;
    case 'purchase':
      return `Pembelian #${m.purchase_number ?? '-'}`;
    case 'purchase_void':
      return `Pembelian #${m.purchase_number ?? '-'} dibatalkan`;
    default:
      return REASON_LABEL[m.reason ?? 'other'] ?? 'Penyesuaian';
  }
}

function StockPanel({ product }: { product: Product }) {
  const { tz } = useBusiness();
  const movements = useStockMovements(product.id);
  const adjust = useAdjustStock();
  const [mode, setMode] = useState<'add' | 'remove' | 'set'>('add');
  const [qty, setQty] = useState('');
  const [reason, setReason] = useState<string>('damaged');
  const [note, setNote] = useState('');
  const qtyValue = parseQty(qty) ?? (mode === 'set' && qty.trim() === '0' ? 0 : null);
  const diff = mode === 'set' && qtyValue !== null ? qtyValue - product.stock : null;

  const preview = useMemo(() => {
    if (qtyValue === null) return null;
    if (mode === 'add') return product.stock + qtyValue;
    if (mode === 'remove') return product.stock - qtyValue;
    return qtyValue;
  }, [mode, qtyValue, product.stock]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (qtyValue === null) return;
    await adjust.mutateAsync({
      id: product.id,
      mode,
      qty: qtyValue,
      reason: mode === 'add' ? 'restock' : mode === 'remove' ? reason : 'correction',
      note: note.trim() || null,
    });
    toast.success('Stok diperbarui');
    setQty('');
    setNote('');
  };

  return (
    <div className="grid gap-6">
      <div className="flex items-end justify-between rounded-[20px] bg-surface-2 p-4">
        <div>
          <p className="text-[13px] font-semibold text-ink-3">Stok di sistem</p>
          <p className="mt-0.5 text-[32px] font-bold leading-none tracking-[-0.03em]">
            {formatQty(product.stock)} <span className="text-[16px] font-semibold text-ink-3">{product.unit}</span>
          </p>
        </div>
        {product.stock <= 0 ? <Badge tone="danger">Habis</Badge> : product.stock <= product.min_stock ? <Badge tone="warn">Menipis</Badge> : <Badge tone="brand">Aman</Badge>}
      </div>

      <form onSubmit={submit} className="grid gap-4">
        <Segmented
          label="Jenis perubahan stok"
          className="w-full"
          value={mode}
          onChange={(m) => {
            setMode(m);
            setQty('');
          }}
          options={[
            { value: 'add', label: 'Tambah' },
            { value: 'remove', label: 'Kurangi' },
            { value: 'set', label: 'Opname' },
          ]}
        />
        <Field
          label={mode === 'add' ? 'Jumlah masuk' : mode === 'remove' ? 'Jumlah keluar' : 'Jumlah hasil hitung fisik'}
          htmlFor="adj-qty"
          hint={mode === 'add' ? 'Beli dari supplier? Catat lewat menu Supplier supaya hutang dan modalnya ikut tercatat.' : undefined}
        >
          <div className="flex items-center gap-2">
            <span className="grid size-12 shrink-0 place-items-center rounded-[14px] bg-surface-2 text-ink-2">
              {mode === 'add' ? <Plus size={18} weight="bold" /> : mode === 'remove' ? <Minus size={18} weight="bold" /> : <Scales size={18} />}
            </span>
            <TextInput id="adj-qty" inputMode="decimal" value={qty} onChange={(e) => setQty(e.target.value)} className="tabular" placeholder="0" />
          </div>
        </Field>
        {mode === 'remove' && (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Alasan">
            {['damaged', 'lost', 'expired', 'other'].map((r) => (
              <Chip key={r} selected={reason === r} onClick={() => setReason(r)}>
                {REASON_LABEL[r]}
              </Chip>
            ))}
          </div>
        )}
        <Field label="Catatan" htmlFor="adj-note" optional>
          <TextInput id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
        </Field>
        {preview !== null && (
          <p className="text-[14px] text-ink-2">
            Stok jadi <b className="tabular">{formatQty(preview)} {product.unit}</b>
            {diff !== null && diff !== 0 && (
              <span className={diff < 0 ? 'text-danger' : 'text-brand'}> (selisih {diff > 0 ? '+' : ''}{formatQty(diff)})</span>
            )}
          </p>
        )}
        <Button type="submit" block disabled={qtyValue === null || (mode !== 'set' && qtyValue === 0)} loading={adjust.isPending}>
          Simpan perubahan stok
        </Button>
      </form>

      <section>
        <h3 className="text-[15px] font-bold">Riwayat stok</h3>
        {movements.isPending ? (
          <div className="mt-3 grid gap-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10" />
            ))}
          </div>
        ) : (
          <ul className="mt-2 divide-y divide-line">
            {(movements.data ?? []).map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[14px] font-semibold">{movementLabel(m)}</p>
                  <p className="truncate text-[12.5px] text-ink-3">
                    {formatDateTime(m.created_at, tz)}
                    {m.note ? `, ${m.note}` : ''}
                  </p>
                </div>
                <div className="shrink-0 text-right tabular">
                  <p className={cn('text-[14px] font-bold', m.qty_change < 0 ? 'text-danger' : 'text-brand')}>
                    {m.qty_change > 0 ? '+' : ''}
                    {formatQty(m.qty_change)}
                  </p>
                  <p className="text-[12px] text-ink-3">sisa {formatQty(m.qty_after)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

