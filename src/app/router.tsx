import { createBrowserRouter } from 'react-router';
import { AppShell } from '@/components/layout/app-shell';
import { GuestOnly, OwnerOnly, RequireBusiness, RequireSession } from './guards';
import { AuthPage } from '@/features/auth/auth-page';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { KasirPage } from '@/features/kasir/kasir-page';
import { TransaksiPage } from '@/features/transaksi/transaksi-page';
import { ProdukPage } from '@/features/produk/produk-page';
import { PiutangPage } from '@/features/piutang/piutang-page';
import { CustomerPage } from '@/features/piutang/customer-page';
import { MenuPage } from '@/features/menu/menu-page';
import { NotFoundPage } from '@/features/not-found-page';

// Halaman harian ada di bundle utama. Yang jarang dibuka dimuat saat dibutuhkan
// supaya pembukaan pertama tetap ringan di jaringan HP.
const ownerOnly = (load: () => Promise<React.ComponentType>) => async () => {
  const Page = await load();
  return { Component: () => <OwnerOnly><Page /></OwnerOnly> };
};

export const router = createBrowserRouter([
  { path: '/masuk', element: <GuestOnly><AuthPage mode="login" /></GuestOnly> },
  { path: '/daftar', element: <GuestOnly><AuthPage mode="register" /></GuestOnly> },
  { path: '/lupa-sandi', element: <GuestOnly><AuthPage mode="forgot" /></GuestOnly> },
  { path: '/atur-sandi', lazy: async () => ({ Component: (await import('@/features/auth/reset-password-page')).ResetPasswordPage }) },
  {
    element: <RequireSession />,
    children: [
      { path: '/mulai', lazy: async () => ({ Component: (await import('@/features/onboarding/onboarding-page')).OnboardingPage }) },
      { path: '/gabung', lazy: async () => ({ Component: (await import('@/features/onboarding/join-page')).JoinPage }) },
      {
        element: <RequireBusiness />,
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <DashboardPage /> },
              { path: 'kasir', element: <KasirPage /> },
              { path: 'transaksi', element: <TransaksiPage /> },
              { path: 'produk', element: <ProdukPage /> },
              { path: 'piutang', element: <PiutangPage /> },
              { path: 'piutang/:id', element: <CustomerPage /> },
              { path: 'menu', element: <MenuPage /> },
              { path: 'pengeluaran', lazy: ownerOnly(async () => (await import('@/features/pengeluaran/pengeluaran-page')).PengeluaranPage) },
              { path: 'laporan', lazy: ownerOnly(async () => (await import('@/features/laporan/laporan-page')).LaporanPage) },
              { path: 'supplier', lazy: ownerOnly(async () => (await import('@/features/supplier/supplier-page')).SupplierPage) },
              { path: 'supplier/:id', lazy: ownerOnly(async () => (await import('@/features/supplier/supplier-detail-page')).SupplierDetailPage) },
              { path: 'pembelian/baru', lazy: ownerOnly(async () => (await import('@/features/supplier/purchase-form-page')).PurchaseFormPage) },
              { path: 'pengaturan', lazy: async () => ({ Component: (await import('@/features/pengaturan/pengaturan-page')).PengaturanPage }) },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
]);
