import { type CSSProperties, type ReactNode } from 'react';
import { Drawer } from 'vaul';
import { CaretLeft, X } from '@phosphor-icons/react';
import { IconButton } from './button';
import { useIsDesktop } from '@/lib/hooks';
import { cn } from '@/lib/util';

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  /** Header kustom di bawah judul (mis. tab) */
  toolbar?: ReactNode;
  wide?: boolean;
  /** Tombol kembali untuk langkah di dalam sheet */
  onBack?: () => void;
  dismissible?: boolean;
  /** Isi mengatur tata letaknya sendiri (tanpa header dan padding bawaan) */
  bare?: boolean;
}

/**
 * Sheet responsif: bottom sheet yang bisa ditarik turun di HP (Vaul),
 * panel mengambang dari kanan di tablet/desktop. Masuk dan keluar lewat jalur yang sama.
 */
export function Sheet({ open, onOpenChange, title, description, children, footer, toolbar, wide, onBack, dismissible = true, bare }: SheetProps) {
  const desktop = useIsDesktop();
  return (
    <Drawer.Root
      open={open}
      onOpenChange={onOpenChange}
      direction={desktop ? 'right' : 'bottom'}
      dismissible={dismissible}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-[var(--scrim)]" />
        <Drawer.Content
          className={cn(
            'fixed z-50 flex flex-col bg-surface text-ink shadow-[var(--shadow-float)] outline-none',
            desktop
              ? cn('bottom-3 right-3 top-3 rounded-[28px]', wide ? 'w-[min(560px,calc(100vw-24px))]' : 'w-[min(460px,calc(100vw-24px))]')
              : 'inset-x-0 bottom-0 max-h-[94dvh] rounded-t-[28px]',
          )}
          style={desktop ? ({ '--initial-transform': 'calc(100% + 12px)' } as CSSProperties) : undefined}
        >
          {!desktop && <div aria-hidden className="mx-auto mt-2.5 h-1.5 w-10 shrink-0 rounded-full bg-surface-3" />}
          {bare ? (
            <>
              <Drawer.Title className="sr-only">{title}</Drawer.Title>
              <Drawer.Description className="sr-only">{typeof title === 'string' ? title : 'Detail'}</Drawer.Description>
              <div className="flex min-h-0 flex-1 flex-col">{children}</div>
            </>
          ) : (
          <>
          <div className={cn('flex shrink-0 items-start gap-2 px-5', desktop ? 'pt-5' : 'pt-3')}>
            {onBack && (
              <IconButton label="Kembali" onClick={onBack} className="-ml-2">
                <CaretLeft size={20} weight="bold" />
              </IconButton>
            )}
            <div className="min-w-0 flex-1 py-1.5">
              <Drawer.Title className="text-[19px] font-bold tracking-[-0.02em] text-ink">{title}</Drawer.Title>
              {description ? (
                <Drawer.Description className="mt-1 text-[14px] text-ink-3">{description}</Drawer.Description>
              ) : (
                <Drawer.Description className="sr-only">{typeof title === 'string' ? title : 'Detail'}</Drawer.Description>
              )}
            </div>
            <Drawer.Close asChild>
              <IconButton label="Tutup" className="-mr-2">
                <X size={20} weight="bold" />
              </IconButton>
            </Drawer.Close>
          </div>
          {toolbar && <div className="shrink-0 px-5 pt-3">{toolbar}</div>}
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-5 pt-3">{children}</div>
          {footer && (
            <div className="shrink-0 border-t border-line px-5 pt-3 pb-[max(12px,env(safe-area-inset-bottom))]">{footer}</div>
          )}
          </>
          )}
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
