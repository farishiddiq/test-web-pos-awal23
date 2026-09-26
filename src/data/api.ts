import { backend } from './backend';
import type {
  AuditLog,
  BusinessContext,
  BusinessSummary,
  BusinessType,
  Customer,
  CustomerDetail,
  Dashboard,
  Expense,
  ExpenseInput,
  ExpenseList,
  Members,
  Invite,
  PaymentKind,
  Product,
  ProductInput,
  Purchase,
  PurchaseInput,
  PurchaseListItem,
  Report,
  Role,
  Sale,
  SaleInput,
  SaleList,
  StockMovement,
  Supplier,
  SupplierDetail,
} from './types';

const rpc = <T>(fn: string, args?: Record<string, unknown>) => backend().rpc<T>(fn, args);

export const api = {
  // usaha & akun
  myBusinesses: () => rpc<BusinessSummary[]>('get_my_businesses'),
  context: (b: string) => rpc<BusinessContext>('get_business_context', { p_business_id: b }),
  createBusiness: (name: string, type: BusinessType, ownerName: string | null) =>
    rpc<BusinessContext>('create_business', { p_name: name, p_business_type: type, p_owner_name: ownerName }),
  updateBusiness: (b: string, patch: Record<string, unknown>) =>
    rpc<BusinessContext>('update_business', { p_business_id: b, p_patch: patch }),
  updateMyProfile: (b: string, displayName: string) =>
    rpc<BusinessContext>('update_my_profile', { p_business_id: b, p_display_name: displayName }),

  // metode bayar & kategori
  setPaymentMethod: (b: string, code: string, isActive: boolean, name?: string) =>
    rpc<BusinessContext>('set_payment_method', { p_business_id: b, p_code: code, p_is_active: isActive, p_name: name ?? null }),
  addPaymentMethod: (b: string, name: string, kind: Exclude<PaymentKind, 'debt'>) =>
    rpc<BusinessContext>('add_payment_method', { p_business_id: b, p_name: name, p_kind: kind }),
  upsertCategory: (b: string, name: string, id?: string) =>
    rpc<BusinessContext>('upsert_category', { p_business_id: b, p_name: name, p_id: id ?? null }),
  deleteCategory: (b: string, id: string) => rpc<BusinessContext>('delete_category', { p_business_id: b, p_id: id }),

  // produk & stok
  products: (b: string, includeInactive = false) =>
    rpc<Product[]>('list_products', { p_business_id: b, p_include_inactive: includeInactive }),
  upsertProduct: (b: string, product: ProductInput) =>
    rpc<Product>('upsert_product', { p_business_id: b, p_product: product }),
  setProductActive: (b: string, id: string, active: boolean) =>
    rpc<Product>('set_product_active', { p_business_id: b, p_product_id: id, p_is_active: active }),
  deleteProduct: (b: string, id: string) =>
    rpc<{ id: string; deleted: boolean }>('delete_product', { p_business_id: b, p_product_id: id }),
  adjustStock: (b: string, id: string, mode: 'add' | 'remove' | 'set', qty: number, reason: string | null, note: string | null) =>
    rpc<Product>('adjust_stock', { p_business_id: b, p_product_id: id, p_mode: mode, p_qty: qty, p_reason: reason, p_note: note }),
  stockMovements: (b: string, productId: string) =>
    rpc<StockMovement[]>('list_stock_movements', { p_business_id: b, p_product_id: productId, p_limit: 60 }),

  // pelanggan & piutang
  customers: (b: string, includeInactive = false) =>
    rpc<Customer[]>('list_customers', { p_business_id: b, p_include_inactive: includeInactive }),
  customer: (b: string, id: string) => rpc<CustomerDetail>('get_customer', { p_business_id: b, p_customer_id: id }),
  upsertCustomer: (b: string, customer: { id?: string; name: string; phone: string | null; note: string | null }) =>
    rpc<Customer>('upsert_customer', { p_business_id: b, p_customer: customer }),
  setCustomerActive: (b: string, id: string, active: boolean) =>
    rpc<Customer>('set_customer_active', { p_business_id: b, p_customer_id: id, p_is_active: active }),
  recordDebtPayment: (b: string, customerId: string, amount: number, method: string, note: string | null, clientRef: string) =>
    rpc<CustomerDetail>('record_debt_payment', {
      p_business_id: b, p_customer_id: customerId, p_amount: amount, p_method_code: method, p_note: note, p_client_ref: clientRef,
    }),
  addCustomerDebt: (b: string, customerId: string, amount: number, note: string | null, dueDate: string | null) =>
    rpc<CustomerDetail>('add_customer_debt', {
      p_business_id: b, p_customer_id: customerId, p_amount: amount, p_note: note, p_due_date: dueDate,
    }),
  voidDebtPayment: (b: string, paymentId: string, reason: string) =>
    rpc<CustomerDetail>('void_debt_payment', { p_business_id: b, p_payment_id: paymentId, p_reason: reason }),
  voidCustomerDebt: (b: string, debtId: string, reason: string) =>
    rpc<CustomerDetail>('void_customer_debt', { p_business_id: b, p_debt_id: debtId, p_reason: reason }),

  // penjualan
  createSale: (b: string, sale: SaleInput) => rpc<Sale>('create_sale', { p_business_id: b, p_sale: sale }),
  voidSale: (b: string, id: string, reason: string) =>
    rpc<Sale>('void_sale', { p_business_id: b, p_sale_id: id, p_reason: reason }),
  sale: (b: string, id: string) => rpc<Sale>('get_sale', { p_business_id: b, p_sale_id: id }),
  sales: (b: string, f: { from?: string | null; to?: string | null; status?: string | null; customerId?: string | null; limit?: number }) =>
    rpc<SaleList>('list_sales', {
      p_business_id: b, p_from: f.from ?? null, p_to: f.to ?? null, p_status: f.status ?? null,
      p_customer_id: f.customerId ?? null, p_limit: f.limit ?? 300,
    }),

  // pengeluaran
  expenses: (b: string, from: string, to: string) =>
    rpc<ExpenseList>('list_expenses', { p_business_id: b, p_from: from, p_to: to }),
  saveExpense: (b: string, expense: ExpenseInput) => rpc<Expense>('save_expense', { p_business_id: b, p_expense: expense }),
  voidExpense: (b: string, id: string, reason?: string) =>
    rpc<{ id: string; voided: boolean }>('void_expense', { p_business_id: b, p_expense_id: id, p_reason: reason ?? null }),

  // supplier & pembelian
  suppliers: (b: string) => rpc<Supplier[]>('list_suppliers', { p_business_id: b }),
  supplier: (b: string, id: string) => rpc<SupplierDetail>('get_supplier', { p_business_id: b, p_supplier_id: id }),
  upsertSupplier: (b: string, supplier: { id?: string; name: string; phone: string | null; note: string | null }) =>
    rpc<Supplier>('upsert_supplier', { p_business_id: b, p_supplier: supplier }),
  createPurchase: (b: string, purchase: PurchaseInput) =>
    rpc<Purchase>('create_purchase', { p_business_id: b, p_purchase: purchase }),
  voidPurchase: (b: string, id: string, reason: string) =>
    rpc<Purchase>('void_purchase', { p_business_id: b, p_purchase_id: id, p_reason: reason }),
  recordSupplierPayment: (b: string, supplierId: string, amount: number, method: string, note: string | null, clientRef: string) =>
    rpc<SupplierDetail>('record_supplier_payment', {
      p_business_id: b, p_supplier_id: supplierId, p_amount: amount, p_method_code: method, p_note: note, p_client_ref: clientRef,
    }),
  purchases: (b: string, from: string | null, to: string | null) =>
    rpc<PurchaseListItem[]>('list_purchases', { p_business_id: b, p_from: from, p_to: to }),

  // laporan
  dashboard: (b: string, date?: string) => rpc<Dashboard>('get_dashboard', { p_business_id: b, p_date: date ?? null }),
  report: (b: string, from: string, to: string) => rpc<Report>('get_report', { p_business_id: b, p_from: from, p_to: to }),

  // anggota
  members: (b: string) => rpc<Members>('list_members', { p_business_id: b }),
  createInvite: (b: string, role: Role) => rpc<Invite>('create_invite', { p_business_id: b, p_role: role }),
  revokeInvite: (b: string, id: string) => rpc<Members>('revoke_invite', { p_business_id: b, p_invite_id: id }),
  acceptInvite: (code: string, displayName: string | null) =>
    rpc<BusinessContext>('accept_invite', { p_code: code, p_display_name: displayName }),
  removeMember: (b: string, userId: string) => rpc<Members>('remove_member', { p_business_id: b, p_user_id: userId }),
  auditLogs: (b: string) => rpc<AuditLog[]>('list_audit_logs', { p_business_id: b, p_limit: 150 }),
};
