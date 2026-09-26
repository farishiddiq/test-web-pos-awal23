import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from './api';
import { useBusiness } from './business';
import type { BusinessContext, ExpenseInput, ProductInput, PurchaseInput, Role, SaleInput } from './types';

// ---------------------------------------------------------------------
// Baca
// ---------------------------------------------------------------------
export function useDashboard() {
  const { businessId, today } = useBusiness();
  return useQuery({
    queryKey: ['biz', businessId, 'dashboard', today],
    queryFn: () => api.dashboard(businessId, today),
    refetchInterval: 60_000,
  });
}

export function useProducts(includeInactive = false) {
  const { businessId } = useBusiness();
  return useQuery({
    queryKey: ['biz', businessId, 'products', includeInactive],
    queryFn: () => api.products(businessId, includeInactive),
    staleTime: 30_000,
  });
}

export function useStockMovements(productId: string | null) {
  const { businessId, isOwner } = useBusiness();
  return useQuery({
    queryKey: ['biz', businessId, 'stock-movements', productId],
    queryFn: () => api.stockMovements(businessId, productId!),
    enabled: !!productId && isOwner,
  });
}

export function useCustomers() {
  const { businessId } = useBusiness();
  return useQuery({
    queryKey: ['biz', businessId, 'customers'],
    queryFn: () => api.customers(businessId),
    staleTime: 30_000,
  });
}

export function useCustomer(id: string | undefined) {
  const { businessId } = useBusiness();
  return useQuery({
    queryKey: ['biz', businessId, 'customer', id],
    queryFn: () => api.customer(businessId, id!),
    enabled: !!id,
  });
}

export function useSales(filters: { from?: string | null; to?: string | null; status?: string | null; customerId?: string | null }) {
  const { businessId } = useBusiness();
  return useQuery({
    queryKey: ['biz', businessId, 'sales', filters],
    queryFn: () => api.sales(businessId, filters),
    placeholderData: keepPreviousData,
  });
}

export function useSale(id: string | null) {
  const { businessId } = useBusiness();
  return useQuery({
    queryKey: ['biz', businessId, 'sale', id],
    queryFn: () => api.sale(businessId, id!),
    enabled: !!id,
  });
}

export function useExpenses(from: string, to: string) {
  const { businessId, isOwner } = useBusiness();
  return useQuery({
    queryKey: ['biz', businessId, 'expenses', from, to],
    queryFn: () => api.expenses(businessId, from, to),
    enabled: isOwner,
    placeholderData: keepPreviousData,
  });
}

export function useReport(from: string, to: string) {
  const { businessId, isOwner } = useBusiness();
  return useQuery({
    queryKey: ['biz', businessId, 'report', from, to],
    queryFn: () => api.report(businessId, from, to),
    enabled: isOwner,
    placeholderData: keepPreviousData,
  });
}

export function useCashFlow(from: string, to: string) {
  const { businessId, isOwner } = useBusiness();
  return useQuery({
    queryKey: ['biz', businessId, 'cashflow', from, to],
    queryFn: () => api.cashFlow(businessId, from, to),
    enabled: isOwner,
    placeholderData: keepPreviousData,
  });
}

export function useSuppliers() {
  const { businessId, isOwner } = useBusiness();
  return useQuery({
    queryKey: ['biz', businessId, 'suppliers'],
    queryFn: () => api.suppliers(businessId),
    enabled: isOwner,
  });
}

export function useSupplier(id: string | undefined) {
  const { businessId, isOwner } = useBusiness();
  return useQuery({
    queryKey: ['biz', businessId, 'supplier', id],
    queryFn: () => api.supplier(businessId, id!),
    enabled: !!id && isOwner,
  });
}

export function usePurchases(from: string | null, to: string | null) {
  const { businessId, isOwner } = useBusiness();
  return useQuery({
    queryKey: ['biz', businessId, 'purchases', from, to],
    queryFn: () => api.purchases(businessId, from, to),
    enabled: isOwner,
    placeholderData: keepPreviousData,
  });
}

export function useMembers() {
  const { businessId, isOwner } = useBusiness();
  return useQuery({
    queryKey: ['biz', businessId, 'members'],
    queryFn: () => api.members(businessId),
    enabled: isOwner,
  });
}

export function useAuditLogs(enabled: boolean) {
  const { businessId, isOwner } = useBusiness();
  return useQuery({
    queryKey: ['biz', businessId, 'audit'],
    queryFn: () => api.auditLogs(businessId),
    enabled: enabled && isOwner,
  });
}

// ---------------------------------------------------------------------
// Tulis. Setelah berhasil, semua data usaha ini disegarkan supaya stok,
// piutang, dan laporan selalu sinkron.
// ---------------------------------------------------------------------
function useBizMutation<TArgs, TResult>(fn: (businessId: string, args: TArgs) => Promise<TResult>) {
  const { businessId } = useBusiness();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => fn(businessId, args),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['biz', businessId] }),
  });
}

function useContextMutation<TArgs>(fn: (businessId: string, args: TArgs) => Promise<BusinessContext>) {
  const { businessId, setContext } = useBusiness();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (args: TArgs) => fn(businessId, args),
    onSuccess: (ctx) => {
      setContext(ctx);
      queryClient.invalidateQueries({ queryKey: ['biz', businessId], predicate: (q) => q.queryKey[2] !== 'context' });
    },
  });
}

export const useCreateSale = () => useBizMutation((b, sale: SaleInput) => api.createSale(b, sale));
export const useVoidSale = () => useBizMutation((b, a: { id: string; reason: string }) => api.voidSale(b, a.id, a.reason));

export const useUpsertProduct = () => useBizMutation((b, p: ProductInput) => api.upsertProduct(b, p));
export const useSetProductActive = () =>
  useBizMutation((b, a: { id: string; active: boolean }) => api.setProductActive(b, a.id, a.active));
export const useDeleteProduct = () => useBizMutation((b, id: string) => api.deleteProduct(b, id));
export const useAdjustStock = () =>
  useBizMutation((b, a: { id: string; mode: 'add' | 'remove' | 'set'; qty: number; reason: string | null; note: string | null }) =>
    api.adjustStock(b, a.id, a.mode, a.qty, a.reason, a.note));

export const useUpsertCustomer = () =>
  useBizMutation((b, c: { id?: string; name: string; phone: string | null; note: string | null }) => api.upsertCustomer(b, c));
export const useSetCustomerActive = () =>
  useBizMutation((b, a: { id: string; active: boolean }) => api.setCustomerActive(b, a.id, a.active));
export const useRecordDebtPayment = () =>
  useBizMutation((b, a: { customerId: string; amount: number; method: string; note: string | null; clientRef: string }) =>
    api.recordDebtPayment(b, a.customerId, a.amount, a.method, a.note, a.clientRef));
export const useAddCustomerDebt = () =>
  useBizMutation((b, a: { customerId: string; amount: number; note: string | null; dueDate: string | null }) =>
    api.addCustomerDebt(b, a.customerId, a.amount, a.note, a.dueDate));
export const useVoidDebtPayment = () =>
  useBizMutation((b, a: { id: string; reason: string }) => api.voidDebtPayment(b, a.id, a.reason));
export const useVoidCustomerDebt = () =>
  useBizMutation((b, a: { id: string; reason: string }) => api.voidCustomerDebt(b, a.id, a.reason));

export const useSaveExpense = () => useBizMutation((b, e: ExpenseInput) => api.saveExpense(b, e));
export const useVoidExpense = () => useBizMutation((b, id: string) => api.voidExpense(b, id));

export const useUpsertSupplier = () =>
  useBizMutation((b, s: { id?: string; name: string; phone: string | null; note: string | null }) => api.upsertSupplier(b, s));
export const useCreatePurchase = () => useBizMutation((b, p: PurchaseInput) => api.createPurchase(b, p));
export const useVoidPurchase = () =>
  useBizMutation((b, a: { id: string; reason: string }) => api.voidPurchase(b, a.id, a.reason));
export const useRecordSupplierPayment = () =>
  useBizMutation((b, a: { supplierId: string; amount: number; method: string; note: string | null; clientRef: string }) =>
    api.recordSupplierPayment(b, a.supplierId, a.amount, a.method, a.note, a.clientRef));

export const useCreateInvite = () => useBizMutation((b, role: Role) => api.createInvite(b, role));
export const useRevokeInvite = () => useBizMutation((b, id: string) => api.revokeInvite(b, id));
export const useRemoveMember = () => useBizMutation((b, userId: string) => api.removeMember(b, userId));

export const useUpdateBusiness = () =>
  useContextMutation((b, patch: Record<string, unknown>) => api.updateBusiness(b, patch));
export const useUpdateMyProfile = () => useContextMutation((b, name: string) => api.updateMyProfile(b, name));
export const useSetPaymentMethod = () =>
  useContextMutation((b, a: { code: string; active: boolean; name?: string }) => api.setPaymentMethod(b, a.code, a.active, a.name));
export const useAddPaymentMethod = () =>
  useContextMutation((b, a: { name: string; kind: 'cash' | 'wallet' | 'bank' | 'other' }) => api.addPaymentMethod(b, a.name, a.kind));
export const useUpsertCategory = () =>
  useContextMutation((b, a: { name: string; id?: string }) => api.upsertCategory(b, a.name, a.id));
export const useDeleteCategory = () => useContextMutation((b, id: string) => api.deleteCategory(b, id));
