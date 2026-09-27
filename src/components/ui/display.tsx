import { type ReactNode } from 'react';
import { ArrowDownRight, ArrowUpRight, WarningCircle } from '@phosphor-icons/react';
import { Button } from './button';
import { cn, colorFor, roundMoney, type TileColor } from '@/lib/util';
import { formatAmount, formatPercent, initials, toNumber } from '@/lib/format';

/** Jumlah uang: "EGP" kecil di depan angka. Angka besar pakai digit proporsional. */
export function Money({
  value,
  className,
  sign,
  tabular,
}: {
  value: number | null | undefined;
  className?: string;
  sign?: boolean;
  tabular?: boolean;
}) {
  const n = roundMoney(toNumber(value));
  return (
    <span className={cn('whitespace-nowrap', tabular && 'tabular', className)}>
      {n < 0 ? '-' : sign && n > 0 ? '+' : ''}
      <span className="mr-[0.28em] align-[0.06em] text-[0.7em] font-semibold opacity-75">EGP</span>
      {formatAmount(n)}
    </span>
  );
}

type Tone = 'neutral' | 'brand' | 'warn' | 'danger' | 'lime';
const toneClass: Record<Tone, string> = {
  neutral: 'bg-surface-2 text-ink-2',
  brand: 'bg-brand-soft text-brand-ink',
  warn: 'bg-warn-soft text-warn-ink',
  danger: 'bg-danger-soft text-danger-ink',
  lime: 'bg-lime text-on-lime',
};

export function Badge({ tone = 'neutral', children, icon, className }: { tone?: Tone; children: ReactNode; icon?: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-[12px] font-semibold', toneClass[tone], className)}>
      {icon}
      {children}
    </span>
  );
}

export function tintStyle(color: TileColor) {
  return { background: `var(--tint-${color}-bg)`, color: `var(--tint-${color}-fg)` };
}

export function ProductThumb({
  name,
  image,
  color,
  size = 'md',
  className,
}: {
  name: string;
  image?: string | null;
  color?: string | null;
  size?: 'sm' | 'md' | 'lg' | 'fill';
  className?: string;
}) {
  const tile = colorFor(name, color);
  const sizes = {
    sm: 'size-10 rounded-[12px] text-[13px]',
    md: 'size-12 rounded-[14px] text-[15px]',
    lg: 'size-16 rounded-[18px] text-[19px]',
    fill: 'aspect-[16/10] w-full rounded-[14px] text-[22px]',
  };
  return (
    <div className={cn('relative grid shrink-0 place-items-center overflow-hidden font-bold', sizes[size], className)} style={tintStyle(tile)}>
      {image ? (
        <img src={image} alt="" loading="lazy" decoding="async" className="absolute inset-0 size-full object-cover" />
      ) : (
        <span aria-hidden className="tracking-tight">
          {initials(name)}
        </span>
      )}
    </div>
  );
}

export function Avatar({ name, size = 'md', className }: { name: string; size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizes = { sm: 'size-8 text-[12px]', md: 'size-10 text-[14px]', lg: 'size-14 text-[18px]' };
  return (
    <span
      aria-hidden
      className={cn('grid shrink-0 place-items-center rounded-full font-bold', sizes[size], className)}
      style={tintStyle(colorFor(name))}
    >
      {initials(name)}
    </span>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn('skeleton', className)} />;
}

export function EmptyState({
  icon,
  title,
  children,
  action,
  className,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <div className="grid size-14 place-items-center rounded-full bg-brand-soft text-brand-ink">{icon}</div>
      <h3 className="mt-4 text-[16px] font-bold text-ink">{title}</h3>
      {children && <p className="mt-1.5 max-w-[34ch] text-[14px] text-ink-3">{children}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  const message = error instanceof Error ? error.message : 'Terjadi kesalahan.';
  return (
    <div role="alert" className={cn('flex flex-col items-center px-6 py-10 text-center', className)}>
      <div className="grid size-14 place-items-center rounded-full bg-danger-soft text-danger-ink">
        <WarningCircle size={28} />
      </div>
      <h3 className="mt-4 text-[16px] font-bold text-ink">Gagal memuat data</h3>
      <p className="mt-1.5 max-w-[40ch] text-[14px] text-ink-3">{message}</p>
      {onRetry && (
        <Button variant="secondary" className="mt-5" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  );
}

/** Perubahan dibanding periode lain: ikon + tanda, bukan warna saja */
export function Delta({
  current,
  previous,
  label,
  emptyLabel = 'Belum ada pembanding',
  upIsGood = true,
}: {
  current: number;
  previous: number;
  label: string;
  emptyLabel?: string;
  upIsGood?: boolean;
}) {
  if (previous <= 0) return <span className="text-[13px] text-ink-3">{emptyLabel}</span>;
  const ratio = (current - previous) / previous;
  const up = ratio >= 0;
  const good = up === upIsGood;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-ink-3">
      <span
        className={cn(
          'inline-flex h-6 items-center gap-0.5 rounded-full px-1.5 font-semibold',
          good ? 'bg-brand-soft text-brand-ink' : 'bg-danger-soft text-danger-ink',
        )}
      >
        <Icon size={14} weight="bold" aria-hidden />
        {up ? '+' : '-'}
        {formatPercent(Math.abs(ratio))}
      </span>
      {label}
    </span>
  );
}

export function StatTile({
  label,
  value,
  icon,
  color,
  footer,
  className,
}: {
  label: string;
  value: ReactNode;
  icon: ReactNode;
  color: TileColor;
  footer?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-col rounded-[22px] p-4', className)} style={{ background: `var(--tint-${color}-bg)` }}>
      <span aria-hidden className="grid size-8 place-items-center rounded-full bg-surface/70" style={{ color: `var(--tint-${color}-fg)` }}>
        {icon}
      </span>
      <div className="mt-3 text-[13px] font-semibold leading-tight" style={{ color: `var(--tint-${color}-fg)` }}>
        {label}
      </div>
      <div className="mt-1 text-[22px] font-bold leading-tight tracking-[-0.02em] text-ink">{value}</div>
      {footer && <div className="mt-1 text-[12.5px] text-ink-2">{footer}</div>}
    </div>
  );
}

export function SectionCard({
  title,
  action,
  children,
  className,
  padded = true,
}: {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  padded?: boolean;
}) {
  return (
    <section className={cn('card', padded && 'p-5', className)}>
      {(title || action) && (
        <header className={cn('flex items-center justify-between gap-3', padded ? 'mb-4' : 'px-5 pb-2 pt-5')}>
          {typeof title === 'string' ? <h2 className="text-[16px] font-bold tracking-[-0.01em]">{title}</h2> : title}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  className,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('flex flex-wrap items-end justify-between gap-x-4 gap-y-3', className)}>
      <div className="min-w-0">
        <h1 className="text-[26px] font-bold tracking-[-0.025em] md:text-[30px]">{title}</h1>
        {subtitle && <p className="mt-1 text-[14px] text-ink-3">{subtitle}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Baris ringkasan angka (label kiri, nilai kanan) */
export function Row({ label, value, strong, muted, className }: { label: ReactNode; value: ReactNode; strong?: boolean; muted?: boolean; className?: string }) {
  return (
    <div className={cn('flex items-baseline justify-between gap-4 py-1.5', className)}>
      <span className={cn('text-[14px]', strong ? 'font-bold text-ink' : muted ? 'text-ink-3' : 'text-ink-2')}>{label}</span>
      <span className={cn('tabular text-right', strong ? 'text-[16px] font-bold text-ink' : 'text-[14px] font-semibold text-ink')}>{value}</span>
    </div>
  );
}
