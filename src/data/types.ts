// Bentuk data yang dikembalikan fungsi RPC (lihat supabase/migrations/*_possir_api.sql)
export type Role = 'owner' | 'cashier';
export type BusinessType = 'makanan' | 'katering' | 'frozen' | 'toko' | 'jasa' | 'jastip' | 'pulsa' | 'lainnya';
export type PaymentKind = 'cash' | 'wallet' | 'bank' | 'debt' | 'other';

export interface BusinessSummary {
  id: string;
  name: string;
  business_type: BusinessType;
  currency: string;
  timezone: string;
  role: Role;
  joined_at: string;
}

export interface Business {
  id: string;
  name: string;
  business_type: BusinessType;
  currency: string;
  timezone: string;
  phone: string | null;
  address: string | null;
  receipt_footer: string | null;
  debt_reminder_template: string | null;
  created_at: string;
}

export interface PaymentMethod {
  id: string;
  code: string;
  name: string;
  kind: PaymentKind;
  is_active: boolean;
  sort_order: number;
}

export interface Category {
  id: string;
  name: string;
  sort_order: number;
}

export interface BusinessContext {
  business: Business;
  role: Role;
  me: { user_id: string; display_name: string };
  payment_methods: PaymentMethod[];
  categories: Category[];
  today: string;
}

export interface Product {
  id: string;
  name: string;
  category_id: string | null;
  category_name: string | null;
  sku: string | null;
  unit: string;
  price: number;
  cost_price: number | null;
  track_stock: boolean;
  stock: number;
  min_stock: number;
  image_url: string | null;
  color: string | null;
  is_active: boolean;
  sold_30d?: number;
  created_at: string;
  updated_at: string;
}

export interface ProductInput {
  id?: string;
  name: string;
  category_id: string | null;
  sku: string | null;
  unit: string;
  price: number;
  cost_price: number;
  track_stock: boolean;
  stock?: number;
  min_stock: number;
  image_url?: string | null;
  color?: string | null;
}

export interface StockMovement {
  id: string;
  type: 'initial' | 'sale' | 'sale_void' | 'purchase' | 'purchase_void' | 'adjustment';
  reason: 'restock' | 'damaged' | 'lost' | 'expired' | 'correction' | 'other' | null;
  qty_change: number;
  qty_after: number;
  unit_cost: number | null;
  sale_id: string | null;
  sale_number: number | null;
  purchase_id: string | null;
  purchase_number: number | null;
  note: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface SaleItem {
  id: string;
  product_id: string | null;
  name: string;
  unit: string;
  qty: number;
  unit_price: number;
  line_total: number;
  unit_cost: number | null;
}

export interface SalePayment {
  method_code: string;
  method_name: string;
  method_kind: PaymentKind;
  amount: number;
}

export interface Sale {
  id: string;
  number: number;
  status: 'completed' | 'void';
  created_at: string;
  customer: { id: string; name: string; phone: string | null } | null;
  payment_method_code: string;
  payment_method_name: string;
  subtotal: number;
  discount: number;
  total: number;
  cost_total: number | null;
  paid_amount: number;
  debt_amount: number;
  cash_received: number | null;
  note: string | null;
  cashier_id: string | null;
  cashier_name: string | null;
  voided_at: string | null;
  voided_by_name: string | null;
  void_reason: string | null;
  due_date: string | null;
  items: SaleItem[];
  payments: SalePayment[];
}

export interface LineSummary {
  name: string;
  qty: number;
  unit: string;
}

export interface SaleListItem {
  id: string;
  number: number;
  status: 'completed' | 'void';
  created_at: string;
  total: number;
  discount: number;
  paid_amount: number;
  debt_amount: number;
  payment_method_code: string;
  payment_method_name: string;
  customer_id: string | null;
  customer_name: string | null;
  cashier_name: string | null;
  void_reason: string | null;
  items: LineSummary[] | null;
}

export interface SaleList {
  items: SaleListItem[];
  total_count: number;
  limit: number;
}

export interface SaleInput {
  client_ref: string;
  items: Array<
    | { product_id: string; qty: number; unit_price?: number }
    | { name: string; qty: number; unit_price: number; unit_cost?: number; unit?: string }
  >;
  discount: number;
  payment_method: string;
  cash_received?: number | null;
  customer_id?: string | null;
  new_customer?: { name: string; phone?: string | null } | null;
  down_payment?: number;
  down_payment_method?: string;
  due_date?: string | null;
  note?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  is_active: boolean;
  created_at: string;
  balance: number;
  debt_total?: number;
  paid_total?: number;
  last_activity_at?: string | null;
  oldest_unpaid_at?: string | null;
  oldest_unpaid_due?: string | null;
}

export interface DebtEntry {
  id: string;
  kind: 'debt';
  amount: number;
  created_at: string;
  due_date: string | null;
  note: string | null;
  sale_id: string | null;
  sale_number: number | null;
  items: LineSummary[] | null;
  voided_at: string | null;
  void_reason: string | null;
}

export interface PaymentEntry {
  id: string;
  kind: 'payment';
  amount: number;
  created_at: string;
  method_code: string;
  method_name: string;
  note: string | null;
  created_by_name: string | null;
  voided_at: string | null;
  void_reason: string | null;
}

export type LedgerEntry = DebtEntry | PaymentEntry;

export interface CustomerDetail extends Customer {
  entries: LedgerEntry[];
}

export interface Expense {
  id: string;
  category: string;
  amount: number;
  note: string | null;
  spent_on: string;
  method_code: string | null;
  method_name: string | null;
  created_by_name: string | null;
  created_at: string;
}

export interface ExpenseList {
  items: Expense[];
  total: number;
  by_category: Array<{ category: string; amount: number; count: number }>;
}

export interface ExpenseInput {
  id?: string;
  client_ref?: string;
  category: string;
  amount: number;
  note: string | null;
  spent_on: string;
  method_code: string | null;
}

export interface Supplier {
  id: string;
  name: string;
  phone: string | null;
  note: string | null;
  is_active?: boolean;
  created_at?: string;
  total_purchases?: number;
  purchase_count?: number;
  last_purchase_on?: string | null;
  balance: number;
}

export interface PurchaseItem {
  id: string;
  product_id: string | null;
  name: string;
  unit: string;
  qty: number;
  unit_cost: number;
  line_total: number;
}

export interface Purchase {
  id: string;
  number: number;
  status: 'completed' | 'void';
  purchased_on: string;
  created_at: string;
  supplier: { id: string; name: string; phone: string | null } | null;
  total: number;
  paid_amount: number;
  debt_amount: number;
  method_code: string | null;
  method_name: string | null;
  note: string | null;
  created_by_name: string | null;
  voided_at: string | null;
  void_reason: string | null;
  items: PurchaseItem[];
}

export interface PurchaseListItem {
  id: string;
  number: number;
  status: 'completed' | 'void';
  purchased_on: string;
  created_at: string;
  supplier_id: string | null;
  supplier_name: string | null;
  total: number;
  paid_amount: number;
  debt_amount: number;
  method_name: string | null;
  note: string | null;
  void_reason: string | null;
  items: Array<{ name: string; qty: number; unit: string; unit_cost: number }> | null;
}

export interface SupplierDetail extends Supplier {
  total_purchases: number;
  purchases: Purchase[];
  payments: Array<{
    id: string;
    amount: number;
    method_code: string;
    method_name: string;
    note: string | null;
    created_by_name: string | null;
    created_at: string;
    voided_at: string | null;
  }>;
}

export interface PurchaseInput {
  client_ref: string;
  supplier_id?: string | null;
  new_supplier?: { name: string; phone?: string | null } | null;
  items: Array<{ product_id: string; qty: number; unit_cost: number }>;
  paid_amount: number;
  method_code: string | null;
  purchased_on: string;
  note: string | null;
  update_cost: boolean;
}

export interface Dashboard {
  date: string;
  role: Role;
  today: {
    sales: number;
    cost: number | null;
    gross_profit: number | null;
    expenses: number | null;
    discount: number;
    transactions: number;
    items_sold: number;
    voids: number;
    debt_new: number;
    debt_collected: number;
    cash_in: number;
    sales_same_time_yesterday: number;
  };
  cash_in_by_method: Array<{ code: string; name: string; amount: number }>;
  series: Array<{ date: string; sales: number; gross_profit: number | null; transactions: number }>;
  receivables: { total: number; customers: number };
  low_stock: { count: number; items: Array<{ id: string; name: string; stock: number; min_stock: number; unit: string }> };
  top_products: Array<{ product_id: string | null; name: string; unit: string; qty: number; revenue: number }>;
  recent_sales: Array<{
    id: string;
    number: number;
    status: 'completed' | 'void';
    created_at: string;
    total: number;
    debt_amount: number;
    payment_method_name: string;
    payment_method_code: string;
    customer_name: string | null;
    items: LineSummary[] | null;
  }>;
}

export interface Report {
  business: { id: string; name: string; currency: string; timezone: string; phone: string | null; address: string | null };
  from: string;
  to: string;
  generated_at: string;
  summary: {
    revenue: number;
    gross_sales: number;
    discount: number;
    cogs: number;
    gross_profit: number;
    expenses: number;
    net_profit: number;
    transactions: number;
    avg_ticket: number;
    items_sold: number;
    voids: number;
    void_total: number;
    debt_new: number;
    debt_collected: number;
    cash_in: number;
    purchases: number;
    receivables_now: number;
  };
  by_method: Array<{ code: string; name: string; kind: PaymentKind; sales: number; debt_payments: number; total: number }>;
  top_products: Array<{ product_id: string | null; name: string; unit: string; qty: number; revenue: number; cogs: number; profit: number }>;
  expenses_by_category: Array<{ category: string; amount: number; count: number }>;
  series: Array<{ date: string; revenue: number; gross_profit: number; transactions: number; expenses: number }>;
  by_hour: Array<{ hour: number; revenue: number; transactions: number }>;
}

export interface CashFlow {
  from: string;
  to: string;
  in: { sales: number; debt_collected: number; total: number };
  out: { expenses: number; purchases: number; supplier_payments: number; total: number };
  net: number;
  by_method: Array<{ code: string; name: string; in: number; out: number; net: number }>;
}

export interface Member {
  user_id: string;
  display_name: string | null;
  email: string | null;
  role: Role;
  joined_at: string;
  is_me: boolean;
}

export interface Invite {
  id: string;
  code: string;
  role: Role;
  created_at: string;
  expires_at: string;
}

export interface Members {
  members: Member[];
  invites: Invite[];
}

export interface AuditLog {
  id: number;
  action: string;
  entity: string;
  entity_id: string | null;
  actor_name: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
