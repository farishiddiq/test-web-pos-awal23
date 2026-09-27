import { type ReactNode } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router';
import { LockSimple } from '@phosphor-icons/react';
import { useSession } from '@/data/session';
import { useBusiness, useBusinessState } from '@/data/business';
import { LogoMark } from '@/components/layout/logo';
import { EmptyState, ErrorState } from '@/components/ui/display';
import { Button, ButtonLink } from '@/components/ui/button';
import { Page } from '@/components/layout/app-shell';

const DEMO_STAGE_TEXT = {
  engine: 'Menyalakan database di browser…',
  seed: 'Mengisi 5 minggu data contoh Pasar Asia Ahmad…',
  ready: 'Hampir siap…',
} as const;

export function BootScreen({ message }: { message?: string }) {
  const { demoStage } = useSession();
  const text = message ?? (demoStage ? DEMO_STAGE_TEXT[demoStage] : 'Memuat…');
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="flex flex-col items-center text-center" role="status" aria-live="polite">
        <LogoMark size={52} />
        <p className="mt-5 text-[15px] font-semibold text-ink">{text}</p>
        {demoStage === 'seed' && (
          <p className="mt-1.5 max-w-[32ch] text-[13px] text-ink-3">Sekali saja. Kunjungan berikutnya langsung terbuka.</p>
        )}
        <div className="mt-6 h-1 w-40 overflow-hidden rounded-full bg-surface-3">
          <div className="skeleton h-full w-full rounded-full" />
        </div>
      </div>
    </div>
  );
}

/** Demo gagal dinyalakan: tawarkan coba lagi, bukan melempar ke halaman masuk */
function BootErrorScreen() {
  const { bootError, retryBoot, signOut } = useSession();
  return (
    <div className="grid min-h-dvh place-items-center px-6">
      <div className="flex max-w-[360px] flex-col items-center text-center" role="alert">
        <LogoMark size={52} />
        <h1 className="mt-5 text-[18px] font-bold">Database demo belum bisa dibuka</h1>
        <p className="mt-1.5 text-[14px] text-ink-3">{bootError ?? 'Terjadi gangguan.'} Data demo kamu tetap aman di browser ini.</p>
        <div className="mt-6 grid w-full gap-2">
          <Button size="lg" onClick={retryBoot}>
            Coba lagi
          </Button>
          <Button variant="ghost" onClick={() => void signOut()}>
            Keluar demo
          </Button>
        </div>
      </div>
    </div>
  );
}

export function RequireSession() {
  const { status } = useSession();
  const location = useLocation();
  if (status === 'booting') return <BootScreen />;
  if (status === 'error') return <BootErrorScreen />;
  if (status === 'signed-out') {
    const next = location.pathname + location.search;
    return <Navigate to={next && next !== '/' ? `/masuk?next=${encodeURIComponent(next)}` : '/masuk'} replace />;
  }
  return <Outlet />;
}

export function GuestOnly({ children }: { children: ReactNode }) {
  const { status } = useSession();
  const location = useLocation();
  if (status === 'booting') return <BootScreen />;
  if (status === 'ready') {
    const next = new URLSearchParams(location.search).get('next');
    return <Navigate to={next && next.startsWith('/') ? next : '/'} replace />;
  }
  return <>{children}</>;
}

export function RequireBusiness() {
  const state = useBusinessState();
  if (state.businessesLoading) return <BootScreen message="Membuka usahamu…" />;
  if (state.businessesError) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <ErrorState error={state.businessesError} onRetry={() => state.refetchBusinesses()} />
      </div>
    );
  }
  if (state.businesses.length === 0) return <Navigate to="/mulai" replace />;
  if (state.contextError) {
    return (
      <div className="grid min-h-dvh place-items-center">
        <ErrorState error={state.contextError} onRetry={() => state.refetchContext()} />
      </div>
    );
  }
  if (!state.context) return <BootScreen message="Membuka usahamu…" />;
  return <Outlet />;
}

/** Halaman khusus pemilik: kasir melihat penjelasan singkat, bukan halaman kosong */
export function OwnerOnly({ children }: { children: ReactNode }) {
  const { isOwner } = useBusiness();
  if (isOwner) return <>{children}</>;
  return (
    <Page>
      <EmptyState
        icon={<LockSimple size={26} />}
        title="Khusus pemilik usaha"
        action={
          <ButtonLink to="/kasir" variant="primary">
            Buka kasir
          </ButtonLink>
        }
      >
        Halaman ini berisi modal dan laba, jadi hanya pemilik yang bisa membukanya.
      </EmptyState>
    </Page>
  );
}
