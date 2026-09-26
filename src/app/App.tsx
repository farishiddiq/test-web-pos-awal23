import { StrictMode } from 'react';
import { MutationCache, QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router/dom';
import { Toaster, toast } from 'sonner';
import { SessionProvider } from '@/data/session';
import { BusinessProvider } from '@/data/business';
import { ApiError } from '@/data/backend';
import { router } from './router';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      retry: (count, error) => count < 2 && error instanceof ApiError && error.code === 'NETWORK',
    },
    mutations: { retry: false },
  },
  // Satu tempat untuk pesan gagal simpan. Form tetap menampilkan validasinya sendiri.
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.meta?.silent) return;
      toast.error(error instanceof Error ? error.message : 'Gagal menyimpan.');
    },
  }),
});

export function App() {
  return (
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <SessionProvider>
          <BusinessProvider>
            <RouterProvider router={router} />
          </BusinessProvider>
        </SessionProvider>
        <Toaster position="top-center" offset={16} mobileOffset={12} toastOptions={{ duration: 3200 }} />
      </QueryClientProvider>
    </StrictMode>
  );
}
