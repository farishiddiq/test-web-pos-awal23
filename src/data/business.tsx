import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useSession } from './session';
import type { BusinessContext, BusinessSummary, PaymentMethod, Role } from './types';
import { storage } from '@/lib/util';
import { todayKey } from '@/lib/dates';

interface BusinessValue {
  businesses: BusinessSummary[];
  businessesLoading: boolean;
  businessesError: Error | null;
  refetchBusinesses(): Promise<unknown>;
  businessId: string | null;
  context: BusinessContext | null;
  contextLoading: boolean;
  contextError: Error | null;
  refetchContext(): Promise<unknown>;
  selectBusiness(id: string): void;
  setContext(ctx: BusinessContext): void;
}

const BusinessContextReact = createContext<BusinessValue | null>(null);

export function BusinessProvider({ children }: { children: ReactNode }) {
  const { user, status } = useSession();
  const queryClient = useQueryClient();
  const storageKey = user ? `possir.business.${user.id}` : null;
  const [override, setOverride] = useState<{ userId: string; id: string } | null>(null);
  const picked =
    override && override.userId === user?.id
      ? override.id
      : storageKey
        ? storage.get<string | null>(storageKey, null)
        : null;

  const businessesQuery = useQuery({
    queryKey: ['businesses', user?.id],
    queryFn: api.myBusinesses,
    enabled: status === 'ready' && !!user,
    staleTime: 60_000,
  });
  const businesses = useMemo(() => businessesQuery.data ?? [], [businessesQuery.data]);
  const businessId = useMemo(() => {
    if (businesses.length === 0) return null;
    return businesses.some((b) => b.id === picked) ? picked : businesses[0].id;
  }, [businesses, picked]);

  const contextQuery = useQuery({
    queryKey: ['biz', businessId, 'context'],
    queryFn: () => api.context(businessId!),
    enabled: !!businessId,
    staleTime: 5 * 60_000,
  });

  const selectBusiness = useCallback(
    (id: string) => {
      if (!user || !storageKey) return;
      setOverride({ userId: user.id, id });
      storage.set(storageKey, id);
    },
    [user, storageKey],
  );

  const setContext = useCallback(
    (ctx: BusinessContext) => {
      queryClient.setQueryData(['biz', ctx.business.id, 'context'], ctx);
      queryClient.invalidateQueries({ queryKey: ['businesses'] });
    },
    [queryClient],
  );

  const value = useMemo<BusinessValue>(
    () => ({
      businesses,
      businessesLoading: businessesQuery.isPending && status === 'ready',
      businessesError: businessesQuery.error,
      refetchBusinesses: businessesQuery.refetch,
      businessId,
      context: contextQuery.data ?? null,
      contextLoading: contextQuery.isPending && !!businessId,
      contextError: contextQuery.error,
      refetchContext: contextQuery.refetch,
      selectBusiness,
      setContext,
    }),
    [businesses, businessesQuery.isPending, businessesQuery.error, businessesQuery.refetch, status, businessId,
      contextQuery.data, contextQuery.isPending, contextQuery.error, contextQuery.refetch, selectBusiness, setContext],
  );

  return <BusinessContextReact.Provider value={value}>{children}</BusinessContextReact.Provider>;
}

export function useBusinessState(): BusinessValue {
  const ctx = useContext(BusinessContextReact);
  if (!ctx) throw new Error('useBusinessState harus di dalam BusinessProvider');
  return ctx;
}

export interface ActiveBusiness {
  businessId: string;
  context: BusinessContext;
  role: Role;
  isOwner: boolean;
  tz: string;
  today: string;
  activeMethods: PaymentMethod[];
  businesses: BusinessSummary[];
  selectBusiness(id: string): void;
  setContext(ctx: BusinessContext): void;
}

/** Dipakai di halaman dalam aplikasi, setelah RequireBusiness memastikan konteks siap. */
export function useBusiness(): ActiveBusiness {
  const state = useBusinessState();
  if (!state.businessId || !state.context) throw new Error('Konteks usaha belum siap');
  const ctx = state.context;
  const tz = ctx.business.timezone;
  return {
    businessId: state.businessId,
    context: ctx,
    role: ctx.role,
    isOwner: ctx.role === 'owner',
    tz,
    today: todayKey(tz),
    activeMethods: ctx.payment_methods.filter((m) => m.is_active),
    businesses: state.businesses,
    selectBusiness: state.selectBusiness,
    setContext: state.setContext,
  };
}
