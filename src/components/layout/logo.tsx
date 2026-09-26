import { cn } from '@/lib/util';

/** Tanda Possir: huruf "p" geometris di atas petak lime */
export function LogoMark({ size = 32, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className={cn('shrink-0', className)}>
      <rect width="32" height="32" rx="10" fill="var(--lime)" />
      <path d="M12 10v14.5" stroke="var(--on-lime)" strokeWidth="3.4" strokeLinecap="round" fill="none" />
      <circle cx="17" cy="14.6" r="4.9" fill="none" stroke="var(--on-lime)" strokeWidth="3.4" />
    </svg>
  );
}

export function Logo({ className, size = 32 }: { className?: string; size?: number }) {
  // kelas tampilan (hidden, xl:inline-flex) dipasang di pembungkus supaya tidak bentrok dengan inline-flex bawaan
  return (
    <span className={className}>
      <span className="inline-flex items-center gap-2.5">
        <LogoMark size={size} />
        <span className="text-[21px] font-extrabold tracking-[-0.04em] text-ink">possir</span>
      </span>
    </span>
  );
}
