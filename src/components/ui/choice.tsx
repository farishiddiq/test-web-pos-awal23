import { type ReactNode } from 'react';
import { cn } from '@/lib/util';

/** Chip pilihan. Lime = sedang dipilih (sama dengan navigasi aktif). */
export function Chip({
  selected,
  onClick,
  children,
  icon,
  count,
  className,
}: {
  selected?: boolean;
  onClick?: () => void;
  children: ReactNode;
  icon?: ReactNode;
  count?: number;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        'pressable inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold',
        selected
          ? 'border-transparent bg-lime text-on-lime'
          : 'border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink',
        className,
      )}
    >
      {icon}
      {children}
      {count !== undefined && (
        <span className={cn('tabular text-[12px]', selected ? 'text-on-lime/70' : 'text-ink-3')}>{count}</span>
      )}
    </button>
  );
}

/** Deretan chip yang bisa digeser ke samping di HP */
export function ChipRow({ children, className, label }: { children: ReactNode; className?: string; label: string }) {
  return (
    <div
      role="group"
      aria-label={label}
      className={cn('no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 md:mx-0 md:flex-wrap md:px-0', className)}
    >
      {children}
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
}

/** Kontrol tersegmentasi gaya iOS untuk mengganti tampilan */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentOption<T>[];
  label: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={cn('inline-flex rounded-full bg-surface-3/70 p-1', className)}>
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(opt.value)}
            className={cn(
              'pressable h-9 min-w-[88px] shrink-0 grow basis-auto whitespace-nowrap rounded-full px-4 text-[13px] font-semibold transition-[background-color,color,box-shadow]',
              active ? 'bg-surface text-ink shadow-[0_1px_3px_rgb(21_32_27/0.12)]' : 'text-ink-2 hover:text-ink',
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/** Kartu pilihan besar (metode bayar, jenis usaha) */
export function OptionCard({
  selected,
  onClick,
  icon,
  title,
  description,
  className,
}: {
  selected: boolean;
  onClick: () => void;
  icon?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cn(
        'pressable flex min-h-[52px] items-center gap-2.5 rounded-[var(--radius-tile)] border px-3.5 py-2.5 text-left',
        selected ? 'border-transparent bg-lime text-on-lime' : 'border-line bg-surface text-ink hover:bg-surface-2',
        className,
      )}
    >
      {icon && <span className={cn('shrink-0', selected ? 'text-on-lime' : 'text-ink-2')}>{icon}</span>}
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold leading-tight">{title}</span>
        {description && (
          <span className={cn('mt-0.5 block text-[12px] leading-snug', selected ? 'text-on-lime/75' : 'text-ink-3')}>
            {description}
          </span>
        )}
      </span>
    </button>
  );
}
