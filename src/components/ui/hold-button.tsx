import { useEffect, useRef, useState, type ReactNode } from 'react';
import { cn } from '@/lib/util';

/**
 * Tahan untuk konfirmasi: untuk tindakan yang tidak bisa dibatalkan (void transaksi).
 * Isian berjalan pelan saat ditahan (linear), lepas lebih cepat kembali (ease-out).
 */
export function HoldButton({
  onConfirm,
  children,
  holdingLabel = 'Terus tahan…',
  duration = 1100,
  disabled,
  className,
}: {
  onConfirm: () => void;
  children: ReactNode;
  holdingLabel?: string;
  duration?: number;
  disabled?: boolean;
  className?: string;
}) {
  const [holding, setHolding] = useState(false);
  const timer = useRef<number | null>(null);

  const stop = () => {
    if (timer.current) window.clearTimeout(timer.current);
    timer.current = null;
    setHolding(false);
  };

  const start = () => {
    if (disabled || timer.current) return;
    setHolding(true);
    timer.current = window.setTimeout(() => {
      timer.current = null;
      setHolding(false);
      navigator.vibrate?.(15);
      onConfirm();
    }, duration);
  };

  useEffect(() => () => stop(), []);

  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        try {
          // tetap terhitung menahan walau jari bergeser sedikit keluar tombol
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // pointer sudah tidak aktif: tetap mulai tanpa capture
        }
        start();
      }}
      onPointerUp={stop}
      onPointerCancel={stop}
      onLostPointerCapture={stop}
      onKeyDown={(e) => {
        if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) {
          e.preventDefault();
          start();
        }
      }}
      onKeyUp={(e) => {
        if (e.key === ' ' || e.key === 'Enter') stop();
      }}
      onContextMenu={(e) => e.preventDefault()}
      className={cn(
        'pressable relative h-14 w-full select-none overflow-hidden rounded-full bg-danger-soft text-[15px] font-semibold text-danger-ink',
        '[-webkit-touch-callout:none] [touch-action:none] disabled:opacity-45',
        className,
      )}
    >
      <span className="relative">{holding ? holdingLabel : children}</span>
      {/* Salinan label di atas isian merah, ikut terpotong clip-path supaya warna teks pas dengan isian */}
      <span
        aria-hidden
        className="absolute inset-0 grid place-items-center bg-danger text-surface"
        style={{
          clipPath: holding ? 'inset(0 0 0 0)' : 'inset(0 100% 0 0)',
          transition: holding ? `clip-path ${duration}ms linear` : 'clip-path 200ms var(--ease-out)',
        }}
      >
        {holding ? holdingLabel : children}
      </span>
    </button>
  );
}
