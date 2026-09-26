import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router';
import { cn } from '@/lib/util';

type Variant = 'primary' | 'secondary' | 'ghost' | 'lime' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const base =
  'pressable inline-flex items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap select-none ' +
  'disabled:cursor-not-allowed disabled:opacity-45';

const variants: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:bg-brand-strong',
  secondary: 'bg-surface-2 text-ink hover:bg-surface-3',
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  lime: 'bg-lime text-on-lime hover:brightness-[0.96]',
  danger: 'bg-danger-soft text-danger-ink hover:brightness-[0.97]',
  outline: 'border border-line bg-surface text-ink hover:bg-surface-2',
};

const sizes: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-[13px]',
  md: 'h-11 px-5 text-[14px]',
  lg: 'h-14 px-6 text-[15px]',
};

export function buttonClass(variant: Variant = 'primary', size: Size = 'md', extra?: string): string {
  return cn(base, variants[variant], sizes[size], extra);
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  loading?: boolean;
  loadingText?: string;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', size = 'md', icon, iconRight, loading, loadingText, block, className, children, disabled, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(buttonClass(variant, size), block && 'w-full', className)}
      {...rest}
    >
      {icon}
      <span>{loading ? (loadingText ?? 'Menyimpan…') : children}</span>
      {iconRight}
    </button>
  );
});

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  iconRight?: ReactNode;
  block?: boolean;
}

export function ButtonLink({ variant = 'primary', size = 'md', icon, iconRight, block, className, children, ...rest }: ButtonLinkProps) {
  return (
    <Link className={cn(buttonClass(variant, size), block && 'w-full', className as string)} {...rest}>
      {icon}
      <span>{children as ReactNode}</span>
      {iconRight}
    </Link>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  variant?: 'ghost' | 'secondary' | 'outline' | 'primary';
  size?: 'sm' | 'md';
}

const iconVariants = {
  ghost: 'text-ink-2 hover:bg-surface-2 hover:text-ink',
  secondary: 'bg-surface-2 text-ink hover:bg-surface-3',
  outline: 'border border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink',
  primary: 'bg-brand text-on-brand hover:bg-brand-strong',
};

/** Tombol ikon bulat; area sentuh tetap >= 44px lewat pseudo-element */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, variant = 'ghost', size = 'md', className, children, type, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      aria-label={label}
      title={label}
      className={cn(
        'pressable relative inline-flex shrink-0 items-center justify-center rounded-full',
        'after:absolute after:-inset-1 after:content-[""] disabled:opacity-40',
        size === 'md' ? 'size-10' : 'size-8',
        iconVariants[variant],
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
});
