import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { CaretRight, SignOut, Storefront } from '@phosphor-icons/react';
import { Page, BUSINESS_TYPE_LABEL } from '@/components/layout/app-shell';
import { NAV_ITEMS } from '@/components/layout/nav';
import { BusinessSwitcherSheet } from '@/components/layout/business-switcher';
import { Avatar, PageHeader } from '@/components/ui/display';
import { Button } from '@/components/ui/button';
import { useBusiness } from '@/data/business';
import { useSession } from '@/data/session';

const DESCRIPTIONS: Record<string, string> = {
  '/produk': 'Menu, harga, dan stok',
  '/pengeluaran': 'Gas, kemasan, transport',
  '/laporan': 'Laba harian dan bulanan',
  '/supplier': 'Belanja stok dan hutang',
  '/pengaturan': 'Usaha, metode bayar, kasir',
};

const TILE_TINT: Record<string, string> = {
  '/produk': 'mint',
  '/pengeluaran': 'sand',
  '/laporan': 'lime',
  '/supplier': 'sky',
  '/pengaturan': 'stone',
};

export function MenuPage() {
  const { context, isOwner } = useBusiness();
  const { user, signOut } = useSession();
  const navigate = useNavigate();
  const [switching, setSwitching] = useState(false);
  const items = NAV_ITEMS.filter((i) => DESCRIPTIONS[i.to] && (!i.ownerOnly || isOwner));

  return (
    <Page>
      <PageHeader title="Lainnya" />
      <button
        type="button"
        onClick={() => setSwitching(true)}
        className="pressable card mt-5 flex w-full items-center gap-3 p-4 text-left"
      >
        <span className="grid size-11 place-items-center rounded-[14px] bg-lime text-on-lime">
          <Storefront size={22} weight="fill" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[16px] font-bold">{context.business.name}</span>
          <span className="block text-[13px] text-ink-3">
            {BUSINESS_TYPE_LABEL[context.business.business_type]}, {isOwner ? 'pemilik' : 'kasir'}
          </span>
        </span>
        <span className="text-[13px] font-semibold text-brand">Ganti</span>
      </button>

      <nav aria-label="Menu lainnya" className="mt-4 grid grid-cols-2 gap-3">
        {items.map((item) => (
          <Link key={item.to} to={item.to} className="pressable card flex flex-col p-4">
            <span className="grid size-10 place-items-center rounded-full" style={{ background: `var(--tint-${TILE_TINT[item.to]}-bg)`, color: `var(--tint-${TILE_TINT[item.to]}-fg)` }}>
              <item.icon size={20} weight="bold" aria-hidden />
            </span>
            <span className="mt-3 text-[15px] font-bold">{item.label}</span>
            <span className="mt-0.5 text-[12.5px] leading-snug text-ink-3">{DESCRIPTIONS[item.to]}</span>
          </Link>
        ))}
      </nav>

      <div className="card mt-4 flex items-center gap-3 p-4">
        <Avatar name={context.me.display_name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-semibold">{context.me.display_name}</p>
          <p className="truncate text-[12.5px] text-ink-3">{user?.email}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<SignOut size={17} />}
          onClick={async () => {
            await signOut();
            navigate('/masuk');
          }}
        >
          Keluar
        </Button>
      </div>
      <Link to="/pengaturan" className="mt-3 flex items-center justify-center gap-1 py-2 text-[13px] font-semibold text-ink-3 hover:text-ink">
        Pengaturan akun dan tema <CaretRight size={13} weight="bold" />
      </Link>
      <BusinessSwitcherSheet open={switching} onOpenChange={setSwitching} />
    </Page>
  );
}
