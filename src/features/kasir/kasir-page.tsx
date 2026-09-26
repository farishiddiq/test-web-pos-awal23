import { useMemo, useState } from 'react';
import { Package, Lightning, MagnifyingGlass, CaretUp } from '@phosphor-icons/react';
import { toast } from 'sonner';
import { useBusiness } from '@/data/business';
import { useProducts } from '@/data/queries';
import type { Product } from '@/data/types';
import { Sheet } from '@/components/ui/sheet';
import { Chip, ChipRow } from '@/components/ui/choice';
import { Badge, EmptyState, ErrorState, Money, ProductThumb, Skeleton } from '@/components/ui/display';
import { ButtonLink } from '@/components/ui/button';
import { formatQty } from '@/lib/format';
import { normalizeSearch, cn } from '@/lib/util';
import { useIsDesktop } from '@/lib/hooks';
import { useCart } from './cart';
import { OrderPanel } from './order-panel';
import { QuickSaleSheet } from './quick-sale-sheet';

export function KasirPage() {
  const { businessId } = useBusiness();
  const cart = useCart(businessId);
  const desktop = useIsDesktop();
  const [quickOpen, setQuickOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);

  return (
    <div className="md:grid md:grid-cols-[minmax(0,1fr)_360px] xl:grid-cols-[minmax(0,1fr)_400px]">
      <div className="@container min-w-0 px-4 pb-44 md:px-6 md:pb-10 lg:px-8">
        <Catalog onQuickSale={() => setQuickOpen(true)} />
      </div>

      {desktop ? (
        <aside className="sticky top-0 h-dvh border-l border-line bg-surface" aria-label="Pesanan">
          <OrderPanel onQuickSale={() => setQuickOpen(true)} />
        </aside>
      ) : (
        <>
          {cart.state.lines.length > 0 && (
            <div className="fixed inset-x-3 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 transition-[transform,opacity] duration-200 ease-[var(--ease-out)] starting:translate-y-4 starting:opacity-0">
              <button
                type="button"
                onClick={() => setOrderOpen(true)}
                className="pressable flex h-[60px] w-full items-center gap-3 rounded-full bg-ink pl-5 pr-2 text-canvas shadow-[var(--shadow-float)]"
              >
                <CaretUp size={18} weight="bold" aria-hidden />
                <span className="text-[14px] font-semibold">{formatQty(cart.totals.count)} item</span>
                <Money value={cart.totals.total} className="ml-auto text-[17px] font-bold tracking-[-0.02em]" />
                <span className="grid h-11 place-items-center rounded-full bg-lime px-5 text-[14px] font-bold text-on-lime">Bayar</span>
              </button>
            </div>
          )}
          <Sheet open={orderOpen} onOpenChange={setOrderOpen} title="Pesanan" bare>
            <OrderPanel onClose={() => setOrderOpen(false)} onQuickSale={() => setQuickOpen(true)} />
          </Sheet>
        </>
      )}

      <QuickSaleSheet
        open={quickOpen}
        onOpenChange={setQuickOpen}
        onAdd={(line) => {
          cart.addQuick(line);
          toast.success(`${line.name} masuk pesanan`);
        }}
      />
    </div>
  );
}

function Catalog({ onQuickSale }: { onQuickSale: () => void }) {
  const { businessId, context, isOwner } = useBusiness();
  const cart = useCart(businessId);
  const products = useProducts();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<string>('all');

  const qtyInCart = useMemo(() => {
    const map = new Map<string, number>();
    for (const l of cart.state.lines) if (l.productId) map.set(l.productId, l.qty);
    return map;
  }, [cart.state.lines]);

  const all = products.data ?? [];
  const categories = context.categories.filter((c) => all.some((p) => p.category_id === c.id));
  const q = normalizeSearch(query);
  const visible = all
    .filter((p) => (category === 'all' ? true : p.category_id === category))
    .filter((p) => !q || normalizeSearch(p.name).includes(q) || (p.sku ?? '').toLowerCase().includes(q))
    .sort((a, b) => (b.sold_30d ?? 0) - (a.sold_30d ?? 0) || a.name.localeCompare(b.name, 'id'));

  return (
    <>
      <div className="sticky top-0 z-20 -mx-4 bg-canvas/92 px-4 pb-3 pt-4 backdrop-blur-md md:-mx-6 md:px-6 md:pt-7 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-3">
          <h1 className="hidden text-[26px] font-bold tracking-[-0.025em] md:block md:text-[30px]">Kasir</h1>
          <label className="relative flex-1 md:ml-auto md:max-w-[340px]">
            <span className="sr-only">Cari produk</span>
            <MagnifyingGlass size={19} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari produk atau kode"
              className="h-12 w-full rounded-full border border-field bg-surface pl-11 pr-4 text-[16px] outline-none placeholder:text-ink-3 focus:border-brand focus:ring-[3px] focus:ring-brand/20"
            />
          </label>
        </div>
        {categories.length > 0 && (
          <ChipRow label="Kategori" className="mt-3">
            <Chip selected={category === 'all'} onClick={() => setCategory('all')}>
              Semua
            </Chip>
            {categories.map((c) => (
              <Chip key={c.id} selected={category === c.id} onClick={() => setCategory(c.id)}>
                {c.name}
              </Chip>
            ))}
          </ChipRow>
        )}
      </div>

      {products.isPending ? (
        <div className="mt-2 grid grid-cols-2 gap-3 @[500px]:grid-cols-3 @[700px]:grid-cols-4 @[940px]:grid-cols-5">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[196px] rounded-[20px]" />
          ))}
        </div>
      ) : products.isError ? (
        <ErrorState error={products.error} onRetry={() => products.refetch()} />
      ) : all.length === 0 ? (
        <div className="card mt-2">
          <EmptyState
            icon={<Package size={26} />}
            title="Belum ada produk"
            action={
              <div className="flex flex-wrap justify-center gap-2">
                {isOwner && <ButtonLink to="/produk?baru=1">Tambah produk</ButtonLink>}
                <button type="button" onClick={onQuickSale} className="h-11 rounded-full bg-surface-2 px-5 text-[14px] font-semibold">
                  Jual cepat
                </button>
              </div>
            }
          >
            Tambahkan menu atau barang jualanmu, atau langsung pakai jual cepat.
          </EmptyState>
        </div>
      ) : (
        <div className="mt-2 grid grid-cols-2 gap-3 @[500px]:grid-cols-3 @[700px]:grid-cols-4 @[940px]:grid-cols-5">
          <button
            type="button"
            onClick={onQuickSale}
            className="pressable flex min-h-[176px] flex-col items-center justify-center gap-2 rounded-[20px] border-2 border-dashed border-field/60 p-3 text-center hover:bg-surface"
          >
            <span className="grid size-12 place-items-center rounded-full bg-lime text-on-lime">
              <Lightning size={22} weight="fill" />
            </span>
            <span className="text-[14px] font-bold">Jual cepat</span>
            <span className="text-[12.5px] leading-snug text-ink-3">Item tanpa produk</span>
          </button>
          {visible.map((p) => (
            <ProductCard key={p.id} product={p} inCart={qtyInCart.get(p.id) ?? 0} onAdd={() => cart.addProduct(p)} />
          ))}
          {visible.length === 0 && (
            <p className="col-span-full py-8 text-center text-[14px] text-ink-3">Tidak ada produk yang cocok dengan "{query}".</p>
          )}
        </div>
      )}
    </>
  );
}

function ProductCard({ product, inCart, onAdd }: { product: Product; inCart: number; onAdd: () => void }) {
  const out = product.track_stock && product.stock <= 0;
  const low = product.track_stock && !out && product.stock <= product.min_stock;
  return (
    <button
      type="button"
      onClick={onAdd}
      aria-label={`${product.name}, ${inCart > 0 ? `${formatQty(inCart)} di pesanan` : 'tambah ke pesanan'}`}
      className={cn('pressable card relative flex flex-col p-2 text-left', inCart > 0 && 'ring-2 ring-brand')}
    >
      {/* Tanpa foto cukup petak kecil berinisial, supaya lebih banyak produk muat di layar HP */}
      {product.image_url ? (
        <ProductThumb name={product.name} image={product.image_url} color={product.color} size="fill" />
      ) : (
        <ProductThumb name={product.name} color={product.color} size="md" className="m-1.5" />
      )}
      {inCart > 0 && (
        <span className="absolute right-3 top-3 grid h-7 min-w-7 place-items-center rounded-full bg-brand px-2 text-[13px] font-bold text-on-brand tabular">
          {formatQty(inCart)}
        </span>
      )}
      <span className="flex flex-1 flex-col px-1.5 pb-1 pt-2">
        <span className="line-clamp-2 min-h-[2.5em] text-[14px] font-semibold leading-[1.25]">{product.name}</span>
        <span className="mt-2 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <Money value={product.price} className="text-[15px] font-bold tracking-[-0.01em]" />
          {out ? (
            <Badge tone="danger">Habis</Badge>
          ) : low ? (
            <Badge tone="warn">Sisa {formatQty(product.stock)}</Badge>
          ) : product.track_stock ? (
            <span className="text-[12px] text-ink-3 tabular">stok {formatQty(product.stock)}</span>
          ) : null}
        </span>
      </span>
    </button>
  );
}
