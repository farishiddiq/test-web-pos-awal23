import { useState, type ReactNode } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router';
import { CaretUpDown, CashRegister, HandCoins, House, Receipt, SignOut, SquaresFour, type Icon } from '@phosphor-icons/react';
import { LogoMark, Logo } from './logo';
import { NAV_ITEMS } from './nav';
import { BusinessSwitcherSheet } from './business-switcher';
import { useBusiness } from '@/data/business';
import { useSession } from '@/data/session';
import { Avatar } from '@/components/ui/display';
import { IconButton } from '@/components/ui/button';
import { cn } from '@/lib/util';
import { BUSINESS_TYPE_LABEL } from '@/lib/labels';

export { BUSINESS_TYPE_LABEL };

export function Page({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mx-auto w-full max-w-[1240px] px-4 pb-32 pt-5 md:px-8 md:pb-12 md:pt-8', className)}>{children}</div>;
}

export function AppShell() {
  const { mode } = useSession();
  return (
    <div className="min-h-dvh md:flex">
      <Sidebar />
      <div className="min-w-0 flex-1">
        {mode === 'demo' && <DemoBanner />}
        <main id="main">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}

function DemoBanner() {
  const { signOut } = useSession();
  const navigate = useNavigate();
  return (
    <div className="no-print border-b border-line bg-[color-mix(in_oklab,var(--lime)_32%,var(--canvas))] px-4 py-2 text-[13px] text-ink md:hidden">
      <div className="mx-auto flex max-w-[1240px] items-center justify-between gap-3">
        <p className="min-w-0">
          <span className="font-bold">Mode demo.</span>{' '}
          <span className="text-ink-2">Data contoh tersimpan di browser ini saja.</span>
        </p>
        <button
          type="button"
          onClick={async () => {
            await signOut();
            navigate('/masuk');
          }}
          className="shrink-0 font-bold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
        >
          Keluar demo
        </button>
      </div>
    </div>
  );
}

function Sidebar() {
  const { context, isOwner } = useBusiness();
  const { signOut, mode } = useSession();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  const items = NAV_ITEMS.filter((item) => !item.ownerOnly || isOwner);
  return (
    <aside className="no-print sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-line bg-surface md:flex md:w-[84px] xl:w-[252px]">
      <div className="flex h-[76px] shrink-0 items-center justify-center px-5 xl:justify-start">
        <Link to="/" aria-label="Possir, ke beranda" className="rounded-xl">
          <LogoMark size={36} className="xl:hidden" />
          <Logo className="hidden xl:inline-flex" />
        </Link>
      </div>
      <button
        type="button"
        onClick={() => setSwitching(true)}
        className="pressable mx-4 mb-3 hidden rounded-[18px] bg-surface-2 px-3.5 py-3 text-left hover:bg-surface-3 xl:flex xl:items-center xl:gap-2"
      >
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[14px] font-bold text-ink">{context.business.name}</span>
          <span className="block truncate text-[12.5px] text-ink-3">
            {BUSINESS_TYPE_LABEL[context.business.business_type] ?? 'Usaha'} · {context.role === 'owner' ? 'Pemilik' : 'Kasir'}
          </span>
        </span>
        <CaretUpDown size={16} className="shrink-0 text-ink-3" aria-hidden />
      </button>
      <BusinessSwitcherSheet open={switching} onOpenChange={setSwitching} />
      <nav aria-label="Menu utama" className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-1">
        {items.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            title={item.label}
            className={({ isActive }) =>
              cn(
                'pressable flex h-11 items-center justify-center gap-3 rounded-full px-3.5 text-[14px] font-semibold xl:justify-start',
                isActive ? 'bg-lime text-on-lime' : 'text-ink-2 hover:bg-surface-2 hover:text-ink',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={21} weight={isActive ? 'fill' : 'regular'} aria-hidden />
                <span className="hidden xl:inline">{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>
      {mode === 'demo' && (
        <div className="mx-3 mb-3 rounded-[18px] bg-[color-mix(in_oklab,var(--lime)_38%,var(--surface))] p-3 text-center xl:text-left">
          <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-on-lime xl:text-[13px] xl:normal-case xl:tracking-normal">
            Demo
            <span className="hidden font-semibold xl:inline"> · data di browser ini</span>
          </p>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              navigate('/masuk');
            }}
            className="mt-1 hidden text-[13px] font-bold text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink xl:inline"
          >
            Keluar demo
          </button>
        </div>
      )}
      <div className="flex shrink-0 items-center gap-3 border-t border-line p-4 max-xl:flex-col">
        <Avatar name={context.me.display_name} size="md" />
        <div className="hidden min-w-0 flex-1 xl:block">
          <p className="truncate text-[14px] font-semibold text-ink">{context.me.display_name}</p>
          <p className="text-[12.5px] text-ink-3">{context.role === 'owner' ? 'Pemilik' : 'Kasir'}</p>
        </div>
        <IconButton
          label="Keluar"
          onClick={async () => {
            await signOut();
            navigate('/masuk');
          }}
        >
          <SignOut size={20} />
        </IconButton>
      </div>
    </aside>
  );
}

const MENU_PATHS = ['/menu', '/produk', '/pengeluaran', '/laporan', '/supplier', '/pembelian', '/pengaturan'];

function BottomNav() {
  const { pathname } = useLocation();
  const inMenu = MENU_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  return (
    <nav aria-label="Menu utama" className="no-print material fixed inset-x-0 bottom-0 z-40 border-t border-line/70 md:hidden safe-bottom">
      <div className="mx-auto grid h-[64px] max-w-md grid-cols-5 items-stretch px-1">
        <Tab to="/" label="Beranda" icon={House} end />
        <Tab to="/transaksi" label="Transaksi" icon={Receipt} />
        <NavLink to="/kasir" aria-label="Kasir" className="pressable grid place-items-center">
          {({ isActive }) => (
            <span className="flex flex-col items-center gap-1">
              <span
                className={cn(
                  'grid size-[46px] place-items-center rounded-full bg-lime text-on-lime shadow-[0_6px_16px_-6px_rgb(21_32_27/0.45)]',
                  isActive && 'ring-4 ring-lime/30',
                )}
              >
                <CashRegister size={24} weight="fill" aria-hidden />
              </span>
            </span>
          )}
        </NavLink>
        <Tab to="/piutang" label="Piutang" icon={HandCoins} />
        <Tab to="/menu" label="Lainnya" icon={SquaresFour} forceActive={inMenu} />
      </div>
    </nav>
  );
}

function Tab({ to, label, icon: IconCmp, end, forceActive }: { to: string; label: string; icon: Icon; end?: boolean; forceActive?: boolean }) {
  return (
    <NavLink to={to} end={end} className="pressable flex flex-col items-center justify-center gap-0.5">
      {({ isActive }) => {
        const active = isActive || forceActive;
        return (
          <>
            <IconCmp size={23} weight={active ? 'fill' : 'regular'} className={active ? 'text-ink' : 'text-ink-3'} aria-hidden />
            <span className={cn('text-[11px] font-semibold', active ? 'text-ink' : 'text-ink-3')}>{label}</span>
          </>
        );
      }}
    </NavLink>
  );
}
