import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/util';
import { formatMoney, parseAmount } from '@/lib/format';

export function Field({
  label,
  htmlFor,
  hint,
  error,
  optional,
  children,
  className,
  aside,
}: {
  label: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: ReactNode;
  className?: string;
  aside?: ReactNode;
}) {
  return (
    <div className={cn('grid gap-1.5', className)}>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={htmlFor} className="text-[13px] font-semibold text-ink-2">
          {label}
          {optional && <span className="font-medium text-ink-3"> (opsional)</span>}
        </label>
        {aside}
      </div>
      {children}
      {error ? (
        <p className="text-[13px] font-medium text-danger" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-[13px] text-ink-3">{hint}</p>
      ) : null}
    </div>
  );
}

export const inputClass =
  'h-12 w-full rounded-[var(--radius-field)] border border-field bg-surface px-4 text-[16px] text-ink ' +
  'placeholder:text-ink-3 outline-none transition-[border-color,box-shadow] duration-150 ' +
  'focus:border-brand focus:ring-[3px] focus:ring-brand/20 disabled:opacity-60 aria-[invalid=true]:border-danger';

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function TextInput(
  { className, ...rest },
  ref,
) {
  return <input ref={ref} className={cn(inputClass, className)} {...rest} />;
});

export const TextArea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(function TextArea(
  { className, rows = 3, ...rest },
  ref,
) {
  return <textarea ref={ref} rows={rows} className={cn(inputClass, 'h-auto resize-none py-3 leading-relaxed', className)} {...rest} />;
});

interface MoneyInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'size'> {
  value: string;
  onValueChange: (text: string) => void;
  size?: 'md' | 'xl';
}

/** Input uang: keyboard angka di HP, awalan EGP, dan pratinjau format untuk angka besar */
export const MoneyInput = forwardRef<HTMLInputElement, MoneyInputProps>(function MoneyInput(
  { value, onValueChange, size = 'md', className, ...rest },
  ref,
) {
  const parsed = parseAmount(value);
  const showPreview = parsed !== null && parsed >= 1000 && !/[.,]/.test(value);
  // className dipasang di pembungkus supaya margin tidak menggeser posisi awalan "EGP"
  return (
    <div className={cn('relative', className)}>
      <span
        className={cn(
          'pointer-events-none absolute top-1/2 -translate-y-1/2 font-semibold text-ink-3',
          size === 'xl' ? 'left-5 text-[15px]' : 'left-4 text-[13px]',
        )}
      >
        EGP
      </span>
      <input
        ref={ref}
        inputMode="decimal"
        autoComplete="off"
        enterKeyHint="done"
        value={value}
        onChange={(e) => onValueChange(e.target.value.replace(/[^0-9.,]/g, ''))}
        className={cn(
          inputClass,
          'tabular',
          size === 'xl' ? 'h-16 pl-[68px] text-[28px] font-bold tracking-tight' : 'pl-[52px] font-semibold',
          showPreview && 'pr-28',
        )}
        {...rest}
      />
      {showPreview && (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-medium text-ink-3 tabular">
          {formatMoney(parsed)}
        </span>
      )}
    </div>
  );
});

export function Switch({
  checked,
  onChange,
  label,
  disabled,
  id,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
  id?: string;
}) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      data-on={checked}
      className={cn(
        'relative inline-flex h-[30px] w-[50px] shrink-0 items-center rounded-full transition-colors duration-200',
        'bg-ink-3/40 data-[on=true]:bg-brand disabled:opacity-50',
        'after:absolute after:-inset-2 after:content-[""]',
      )}
    >
      <span
        data-on={checked}
        className={cn(
          'absolute left-[3px] size-6 rounded-full bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.25)]',
          'transition-transform duration-200 ease-[var(--ease-out)] data-[on=true]:translate-x-5',
        )}
      />
    </button>
  );
}

/** Baris pengaturan: label + deskripsi di kiri, kontrol di kanan */
export function SwitchRow({
  title,
  description,
  checked,
  onChange,
  disabled,
}: {
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
}) {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <label htmlFor={id} className="min-w-0 cursor-pointer">
        <span className="block text-[15px] font-semibold text-ink">{title}</span>
        {description && <span className="mt-0.5 block text-[13px] text-ink-3">{description}</span>}
      </label>
      <Switch id={id} checked={checked} onChange={onChange} disabled={disabled} label={typeof title === 'string' ? title : 'Ubah'} />
    </div>
  );
}
