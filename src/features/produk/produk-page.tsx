import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { CaretRight, MagnifyingGlass, Package, Plus, Truck, WarningCircle, Coins } from '@phosphor-icons/react';
import { Page } from '@/components/layout/app-shell';
import { Button, ButtonLink } from '@/components/ui/button';
import { Chip, ChipRow } from '@/components/ui/choice';
import { Badge, EmptyState, ErrorState, Money, PageHeader, ProductThumb, Skeleton, StatTile } from '@/components/ui/display';
import { inputClass } from '@/components/ui/form';
import { useBusiness } from '@/data/business';
import { useProducts } from '@/data/queries';
import type { Product } from '@/data/types';
import { formatQty } from '@/lib/format';
import { cn, normalizeSearch } from '@/lib/util';
import { ProductSheet } from './product-sheet';

type Filter = 'all' | 'menipis' | 'arsip';

export function ProdukPage() {
  const { isOwner, context } = useBusiness();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('filter') as Filter) ?? 'all';
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sheet, setSheet] = useState<{ product: Product | null; tab: 'detail' | 'stok' } | null>(
    params.get('baru') ? { product: null, tab: 'detail' } : null,
  );
  const products = useProducts(filter === 'arsip');

  const setFilter = (f: Filter) => {
    const next = new URLSearchParams(params);
    if (f === 'all') next.delete('filter');
    else next.set('filter', f);
    next.delete('baru');
    setParams(next, { replace: true });
  };

  const all = products.data ?? [];
  const active = all.filter((p) => p.is_active);
  const lowCount = active.filter((p) => p.track_stock && p.stock <= p.min_stock).length;
  const stockValue = active.reduce((t, p) => t + (p.track_stock && p.stock > 0 ? p.stock * (p.cost_price ?? 0) : 0), 0);

  const q = normalizeSearch(search);
  const visible = useMemo(
    () =>
      all
        .filter((p) => (filter === 'arsip' ? !p.is_active : p.is_active))
        .filter((p) => (filter === 'menipis' ? p.track_stock && p.stock <= p.min_stock : true))
        .filter((p) => (category === 'all' ? true : p.category_id === category))
        .filter((p) => !q || normalizeSearch(p.name).includes(q) || (p.sku ?? '').toLowerCase().includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, 'id')),
    [all, filter, category, q],
  );

  // produk yang sedang dibuka ikut data terbaru setelah disimpan
  const sheetProduct = sheet?.product ? (all.find((p) => p.id === sheet.product!.id) ?? sheet.product) : null;

  return (
    <Page>
      <PageHeader
        title="Produk & stok"
        subtitle={`${active.length} produk aktif`}
        actions={
          isOwner ? (
            <>
              <ButtonLink to="/pembelian/baru" variant="secondary" icon={<Truck size={18} />} className="max-sm:hidden">
                Catat pembelian
              </ButtonLink>
              <Button icon={<Plus size={18} weight="bold" />} onClick={() => setSheet({ product: null, tab: 'detail' })}>
                Tambah produk
              </Button>
            </>
          ) : undefined
        }
      />

      {isOwner && (
        <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-3">
          <StatTile color="mint" icon={<Package size={16} weight="bold" />} label="Produk aktif" value={active.length} footer={`${active.filter((p) => p.track_stock).length} dengan stok dilacak`} />
          <StatTile color="rose" icon={<WarningCircle size={16} weight="bold" />} label="Stok menipis" value={lowCount} footer={lowCount ? 'Perlu dibeli lagi' : 'Semua aman'} />
          <StatTile color="sky" icon={<Coins size={16} weight="bold" />} label="Nilai stok" value={<Money value={stockValue} />} footer="Dihitung dari harga modal" className="col-span-2 md:col-span-1" />
        </div>
      )}

      <div className="mt-5 grid gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <ChipRow label="Tampilkan" className="flex-1">
            <Chip selected={filter === 'all'} onClick={() => setFilter('all')}>
              Semua
            </Chip>
            <Chip selected={filter === 'menipis'} onClick={() => setFilter('menipis')} count={lowCount}>
              Stok menipis
            </Chip>
            {isOwner && (
              <Chip selected={filter === 'arsip'} onClick={() => setFilter('arsip')}>
                Arsip
              </Chip>
            )}
          </ChipRow>
          <label className="relative w-full md:w-[280px]">
            <span className="sr-only">Cari produk</span>
            <MagnifyingGlass size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-3" aria-hidden />
            <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama atau kode" className={cn(inputClass, 'h-11 rounded-full pl-11')} />
          </label>
        </div>
        {context.categories.length > 0 && (
          <ChipRow label="Kategori">
            <Chip selected={category === 'all'} onClick={() => setCategory('all')}>
              Semua kategori
            </Chip>
            {context.categories.map((c) => (
              <Chip key={c.id} selected={category === c.id} onClick={() => setCategory(c.id)}>
                {c.name}
              </Chip>
            ))}
          </ChipRow>
        )}
      </div>

      <div className="card mt-5 overflow-hidden">
        {products.isPending ? (
          <div className="divide-y divide-line">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="flex items-center gap-3 px-5 py-3.5">
                <Skeleton className="size-12 rounded-[14px]" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3.5 w-2/5" />
                  <Skeleton className="h-3 w-1/4" />
                </div>
              </div>
            ))}
          </div>
        ) : products.isError ? (
          <ErrorState error={products.error} onRetry={() => products.refetch()} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Package size={26} />}
            title={all.length === 0 ? 'Belum ada produk' : filter === 'menipis' ? 'Tidak ada stok menipis' : 'Tidak ada yang cocok'}
            action={
              isOwner && all.length === 0 ? (
                <Button icon={<Plus size={18} weight="bold" />} onClick={() => setSheet({ product: null, tab: 'detail' })}>
                  Tambah produk
                </Button>
              ) : undefined
            }
          >
            {all.length === 0
              ? 'Mulai dari menu yang paling sering dibeli. Harga modal membantu menghitung laba.'
              : filter === 'menipis'
                ? 'Semua produk yang stoknya dilacak masih di atas minimum.'
                : 'Coba kata kunci atau kategori lain.'}
          </EmptyState>
        ) : (
          <>
            <div className="hidden grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_1.1fr_24px] gap-4 border-b border-line px-5 py-3 text-[12.5px] font-semibold text-ink-3 lg:grid">
              <span>Produk</span>
              <span className="text-right">Harga jual</span>
              <span className="text-right">{isOwner ? 'Modal' : ''}</span>
              <span className="text-right">{isOwner ? 'Untung' : ''}</span>
              <span className="text-right">Stok</span>
              <span />
            </div>
            <ul className="divide-y divide-line">
              {visible.map((p) => (
                <ProductRow key={p.id} product={p} canEdit={isOwner} stockFirst={filter === 'menipis'} onOpen={(tab) => setSheet({ product: p, tab })} />
              ))}
            </ul>
          </>
        )}
      </div>

      {isOwner && (
        <ProductSheet
          open={sheet !== null}
          onOpenChange={(o) => {
            if (!o) {
              setSheet(null);
              if (params.get('baru')) {
                const next = new URLSearchParams(params);
                next.delete('baru');
                setParams(next, { replace: true });
              }
            }
          }}
          product={sheetProduct}
          initialTab={sheet?.tab ?? 'detail'}
        />
      )}
    </Page>
  );
}

function StockBadge({ product }: { product: Product }) {
  if (!product.track_stock) return <span className="text-[12.5px] text-ink-3">Tidak dilacak</span>;
  if (product.stock <= 0) return <Badge tone="danger">Habis</Badge>;
  if (product.stock <= product.min_stock)
    return (
      <Badge tone="warn">
        {formatQty(product.stock)} {product.unit}
      </Badge>
    );
  return (
    <span className="text-[14px] font-semibold tabular">
      {formatQty(product.stock)} <span className="font-medium text-ink-3">{product.unit}</span>
    </span>
  );
}

function ProductRow({ product: p, canEdit, stockFirst, onOpen }: { product: Product; canEdit: boolean; stockFirst: boolean; onOpen: (tab: 'detail' | 'stok') => void }) {
  const margin = p.cost_price !== null ? p.price - p.cost_price : null;
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <ProductThumb name={p.name} image={p.image_url} color={p.color} />
        <span className="min-w-0">
          <span className="block truncate text-[14.5px] font-semibold">{p.name}</span>
          <span className="block truncate text-[12.5px] text-ink-3">
            {p.category_name ?? 'Tanpa kategori'}
            {p.sku ? ` · ${p.sku}` : ''}
          </span>
        </span>
      </span>
      <span className="hidden text-right lg:block">
        <Money value={p.price} tabular className="text-[14px] font-semibold" />
      </span>
      <span className="hidden text-right text-ink-2 lg:block">{canEdit && p.cost_price !== null && <Money value={p.cost_price} tabular className="text-[14px]" />}</span>
      <span className="hidden text-right lg:block">
        {canEdit && margin !== null && (
          <span className={cn('text-[14px] font-semibold tabular', margin < 0 ? 'text-danger' : 'text-brand')}>
            {p.price > 0 ? `${Math.round((margin / p.price) * 100)}%` : '-'}
          </span>
        )}
      </span>
      <span className="flex flex-col items-end gap-1 lg:block lg:text-right">
        <Money value={p.price} tabular className="text-[14px] font-bold lg:hidden" />
        <StockBadge product={p} />
      </span>
      <span className="hidden text-ink-3 lg:block">{canEdit && <CaretRight size={16} />}</span>
    </>
  );
  const cls =
    'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-3 text-left md:px-5 lg:grid-cols-[minmax(0,2.4fr)_1fr_1fr_1fr_1.1fr_24px]';
  return (
    <li>
      {canEdit ? (
        <button type="button" onClick={() => onOpen(stockFirst && p.track_stock ? 'stok' : 'detail')} className={cn(cls, 'transition-colors hover:bg-surface-2')}>
          {content}
        </button>
      ) : (
        <div className={cls}>{content}</div>
      )}
    </li>
  );
}
