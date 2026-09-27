import { useEffect, useRef, type CSSProperties, type ReactNode, type RefObject } from 'react';
import {
  Bank,
  CashRegister,
  ChartLineUp,
  Coins,
  DeviceMobile,
  ForkKnife,
  MapPin,
  Money,
  Package,
  Receipt,
  ShoppingBag,
  Storefront,
  TrendUp,
  WashingMachine,
  Wrench,
} from '@phosphor-icons/react';
import { LogoMark } from '@/components/layout/logo';
import { cn } from '@/lib/util';

/**
 * Panel identitas POSSIR di halaman masuk. Logo sebagai titik fokus, tagline, lalu
 * komposisi POS: screenshot dashboard asli di HP dikelilingi kartu mini seperti di aplikasi.
 * Angka di kartu mini diambil dari data demo "Pasar Asia Ahmad".
 */
export function AuthBrand({ className }: { className?: string }) {
  const panelRef = useRef<HTMLElement>(null);
  useDepthParallax(panelRef);
  return (
    <section
      ref={panelRef}
      aria-label="Tentang POSSIR"
      className={cn(
        'brand-panel relative isolate flex min-w-0 flex-col overflow-hidden rounded-[26px] bg-[var(--deep)] px-6 pb-6 pt-6 text-[var(--on-deep)] md:px-10 md:pt-8 lg:min-h-0',
        className,
      )}
    >
      <span aria-hidden className="brand-rings -right-40 -top-44 -z-10 size-[520px] border-[80px]" />
      <span aria-hidden className="brand-rings -bottom-56 -left-44 -z-10 size-[420px] border-[64px] max-lg:hidden" />

      {/* logo sebagai titik fokus */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3.5">
          <LogoMark size={52} className="drop-shadow-[0_8px_24px_rgb(212_242_107/0.25)]" />
          <span className="text-[34px] font-extrabold leading-none tracking-[-0.05em] md:text-[40px]">possir</span>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-[12.5px] font-semibold text-[var(--on-deep-2)]">
          <MapPin size={14} weight="fill" className="text-lime" aria-hidden />
          Kairo, Mesir · EGP
        </span>
      </div>

      <div className="mt-6 lg:mt-7 lg:[@media(max-height:820px)]:mt-4">
        <h2 className="max-w-[21ch] text-[30px] font-bold leading-[1.08] tracking-[-0.035em] md:text-[36px] xl:text-[42px] lg:[@media(max-height:820px)]:text-[32px]">
          POS untuk bisnis <span className="text-lime">mahasiswa Indonesia di Mesir.</span>
        </h2>
        <p className="mt-3 max-w-[52ch] text-[15px] leading-relaxed text-[var(--on-deep-2)] md:text-[16px]">
          Kelola transaksi, produk, stok, dan laporan usaha dalam satu tempat.
        </p>
      </div>

      {/* HP: dua kartu mini saja, tetap terasa seperti aplikasi */}
      <div className="mt-5 grid grid-cols-2 gap-2.5 lg:hidden">
        <SalesCard compact />
        <StockCard compact />
      </div>

      {/* Laptop: komposisi POS lengkap */}
      <div className="relative mt-4 hidden min-h-0 flex-1 lg:block" aria-hidden>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="relative h-full max-h-[540px] py-3">
            <div data-depth="4" style={i(0)} className="brand-in h-full rounded-[40px] bg-ink p-[9px] shadow-[0_30px_60px_-24px_rgb(0_0_0/0.6)] dark:bg-surface-3">
              <img
                src="/screens/dashboard-mobile.webp"
                alt=""
                width={390}
                height={844}
                className="block h-full w-auto rounded-[32px] object-cover object-top"
              />
            </div>

            {/* pembungkus: posisi, muncul bertahap (translate/scale/opacity), dan kedalaman (transform) */}
            <div data-depth="14" style={i(1)} className="brand-in absolute right-[calc(100%-26px)] top-[9%]">
              <SalesCard className="w-[190px] -rotate-2 xl:w-[210px]" />
            </div>
            <div data-depth="10" style={i(2)} className="brand-in absolute left-[calc(100%-26px)] top-[15%]">
              <StockCard className="w-[190px] rotate-2 xl:w-[205px]" />
            </div>
            <div data-depth="18" style={i(3)} className="brand-in absolute bottom-[14%] right-[calc(100%-18px)] hidden xl:block">
              <TransactionCard className="w-[230px] rotate-1" />
            </div>
            <div data-depth="12" style={i(4)} className="brand-in absolute bottom-[10%] left-[calc(100%-18px)] hidden xl:block">
              <ReportCard className="w-[225px] -rotate-1" />
            </div>

            <IconBubble depth={24} index={5} className="absolute -left-[16%] top-[-1%]"><CashRegister size={20} weight="fill" /></IconBubble>
            <IconBubble depth={20} index={5} className="absolute -right-[16%] top-[-3%]"><Money size={20} weight="fill" /></IconBubble>
            <IconBubble depth={22} index={6} className="absolute -right-[12%] bottom-[-1%]"><Storefront size={20} weight="fill" /></IconBubble>
            <IconBubble depth={26} index={6} className="absolute -left-[12%] bottom-[-2%]"><Coins size={20} weight="fill" /></IconBubble>
          </div>
        </div>
      </div>

      {/* untuk siapa */}
      <ul className="mt-5 flex flex-wrap gap-2 lg:[@media(max-height:760px)]:hidden">
        {(
          [
            [ForkKnife, 'Warung makan'],
            [Storefront, 'Toko & kios'],
            [WashingMachine, 'Laundry'],
            [Wrench, 'Jasa'],
            [ShoppingBag, 'Jastip & online'],
          ] as const
        ).map(([I, label]) => (
          <li key={label} className="inline-flex h-8 items-center gap-1.5 rounded-full bg-white/[0.08] px-3 text-[12.5px] font-semibold text-[var(--on-deep-2)] ring-1 ring-inset ring-white/10">
            <I size={14} className="text-lime" aria-hidden />
            {label}
          </li>
        ))}
      </ul>
    </section>
  );
}

function MiniCard({ icon, label, children, className, compact }: { icon: ReactNode; label: string; children: ReactNode; className?: string; compact?: boolean }) {
  return (
    <div className={cn('rounded-[18px] bg-surface text-ink shadow-[0_20px_40px_-20px_rgb(0_0_0/0.55)]', compact ? 'p-3' : 'p-3.5', className)}>
      <div className="flex items-center gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-brand-soft text-brand-ink">{icon}</span>
        <span className="truncate text-[12px] font-semibold text-ink-3">{label}</span>
      </div>
      {children}
    </div>
  );
}

function SalesCard({ className, compact }: { className?: string; compact?: boolean }) {
  const bars = [52, 38, 70, 58, 84, 46, 64];
  return (
    <MiniCard icon={<Receipt size={14} weight="bold" />} label={compact ? 'Hari ini' : 'Penjualan hari ini'} className={className} compact={compact}>
      <p className="mt-2 text-[20px] font-bold leading-none tracking-[-0.02em] tabular">
        <span className="mr-1 text-[0.62em] font-semibold text-ink-3">EGP</span>2.310
      </p>
      <p className="mt-1 flex items-center gap-1 text-[11.5px] font-semibold text-brand">
        <TrendUp size={13} weight="bold" aria-hidden /> 19 transaksi
      </p>
      {!compact && (
        <div className="mt-2.5 flex h-9 items-end gap-1">
          {bars.map((h, n) => (
            <span
              key={n}
              className={cn('bar-grow flex-1 rounded-t-[3px]', n === bars.length - 1 ? 'bg-brand' : 'bg-surface-3')}
              style={{ height: `${h}%`, '--i': n } as CSSProperties}
            />
          ))}
        </div>
      )}
    </MiniCard>
  );
}

function TransactionCard({ className }: { className?: string }) {
  return (
    <MiniCard icon={<CashRegister size={14} weight="bold" />} label="Transaksi #1029" className={className}>
      <div className="mt-2 flex items-baseline justify-between gap-2">
        <span className="truncate text-[12.5px] text-ink-2">Indomie ×5, Kecap Bango</span>
        <span className="shrink-0 text-[14px] font-bold tabular">EGP 225</span>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className="inline-flex h-6 items-center gap-1 rounded-full bg-lime px-2 text-[11px] font-bold text-on-lime">
          <DeviceMobile size={12} weight="bold" aria-hidden /> Vodafone Cash
        </span>
        <span className="inline-flex h-6 items-center gap-1 rounded-full bg-surface-2 px-2 text-[11px] font-semibold text-ink-2">
          <Bank size={12} aria-hidden /> InstaPay
        </span>
      </div>
    </MiniCard>
  );
}

function StockCard({ className, compact }: { className?: string; compact?: boolean }) {
  return (
    <MiniCard icon={<Package size={14} weight="bold" />} label={compact ? 'Stok' : 'Stok produk'} className={className} compact={compact}>
      <p className="mt-2 truncate text-[13.5px] font-bold">{compact ? 'Kecap Bango' : 'Kecap Bango 220 ml'}</p>
      <div className="mt-1 flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="whitespace-nowrap text-[12px] text-ink-3 tabular">Sisa 2 botol</span>
        <span className="rounded-full bg-[var(--warn-soft,#fcefd3)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--warn-ink,#8a5600)]">Menipis</span>
      </div>
    </MiniCard>
  );
}

function ReportCard({ className }: { className?: string }) {
  return (
    <MiniCard icon={<ChartLineUp size={14} weight="bold" />} label="Laporan September" className={className}>
      <p className="mt-2 text-[11.5px] text-ink-3">Laba bersih</p>
      <p className="text-[20px] font-bold leading-tight tracking-[-0.02em] tabular">
        <span className="mr-1 text-[0.62em] font-semibold text-ink-3">EGP</span>16.187
      </p>
      <p className="mt-1 text-[11.5px] text-ink-3 tabular">Omzet EGP 66.384 · 287 transaksi</p>
    </MiniCard>
  );
}

function IconBubble({ children, className, depth, index }: { children: ReactNode; className?: string; depth: number; index: number }) {
  return (
    <span
      data-depth={depth}
      style={i(index)}
      className={cn('brand-in grid size-11 place-items-center rounded-full bg-white/10 text-lime ring-1 ring-inset ring-white/15 backdrop-blur-sm', className)}
    >
      {children}
    </span>
  );
}

/** Urutan muncul untuk kelas .brand-in (jedanya dihitung di CSS) */
function i(n: number): CSSProperties {
  return { '--i': n } as CSSProperties;
}

/**
 * Efek kedalaman: elemen [data-depth] bergeser sedikit mengikuti kursor di atas panel.
 * Hanya untuk mouse (bukan layar sentuh) dan mati saat "kurangi gerak". Transform ditulis
 * langsung ke tiap elemen (bukan variabel CSS di induk) dengan interpolasi ringan per frame,
 * jadi gerakannya halus, bisa berbalik kapan saja, dan berhenti sendiri saat diam.
 */
function useDepthParallax(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const panel = ref.current;
    if (!panel) return;
    const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fine || reduce) return;
    const layers = [...panel.querySelectorAll<HTMLElement>('[data-depth]')].map((el) => ({ el, depth: Number(el.dataset.depth) }));
    const target = { x: 0, y: 0 };
    const current = { x: 0, y: 0 };
    let frame = 0;
    const tick = () => {
      current.x += (target.x - current.x) * 0.1;
      current.y += (target.y - current.y) * 0.1;
      for (const { el, depth } of layers) {
        el.style.transform = `translate3d(${(current.x * depth).toFixed(2)}px, ${(current.y * depth).toFixed(2)}px, 0)`;
      }
      const settled = Math.abs(target.x - current.x) < 0.001 && Math.abs(target.y - current.y) < 0.001;
      frame = settled ? 0 : requestAnimationFrame(tick);
    };
    const start = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };
    const onMove = (e: PointerEvent) => {
      const r = panel.getBoundingClientRect();
      // -1..1 dari tengah panel; geser maksimal = nilai data-depth (px)
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      start();
    };
    const onLeave = () => {
      target.x = 0;
      target.y = 0;
      start();
    };
    panel.addEventListener('pointermove', onMove);
    panel.addEventListener('pointerleave', onLeave);
    return () => {
      panel.removeEventListener('pointermove', onMove);
      panel.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(frame);
      for (const { el } of layers) el.style.transform = '';
    };
  }, [ref]);
}
