export type UserRole = 'admin' | 'magasinier';

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Category {
  id: number;
  name: string;
  code: string;
  description?: string;
  product_count?: number;
  total_stock?: number;
  total_valuation?: number;
  created_at?: string;
}

export interface Supplier {
  id: number;
  name: string;
  contact_name: string;
  phone: string;
  email?: string;
  address: string;
  notes?: string;
  movements_count?: number;
  total_items_received?: number;
  total_purchased_value?: number;
  created_at?: string;
  updated_at?: string;
}

export interface Product {
  id: number;
  sku: string;
  barcode?: string;
  name: string;
  category_id: number;
  category_name?: string;
  category_code?: string;
  brand: string;
  description?: string;
  purchase_price: number;
  selling_price?: number;
  current_stock: number;
  min_stock_alert: number;
  unit: string;
  location?: string;
  is_archived: number;
  created_at: string;
  updated_at: string;
}

export type MovementType = 'ENTREE' | 'SORTIE' | 'AJUSTEMENT_INVENTAIRE';

export interface StockMovement {
  id: number;
  movement_number: string;
  product_id: number;
  product_name?: string;
  product_sku?: string;
  product_unit?: string;
  category_name?: string;
  type: MovementType;
  quantity: number;
  stock_before: number;
  stock_after: number;
  unit_price?: number;
  reason: string;
  document_reference?: string;
  partner_name?: string;
  supplier_id?: number;
  user_id: number;
  user_name: string;
  comment?: string;
  created_at: string;
}

export interface InventorySession {
  id: number;
  session_number: string;
  status: 'EN_COURS' | 'VALIDE' | 'ANNULE';
  notes?: string;
  user_id: number;
  user_name: string;
  total_items: number;
  total_discrepancies: number;
  created_at: string;
  completed_at?: string;
}

export interface InventoryItem {
  id: number;
  session_id: number;
  product_id: number;
  sku?: string;
  name?: string;
  unit?: string;
  location?: string;
  category_name?: string;
  theoretical_stock: number;
  counted_stock: number;
  discrepancy: number;
  unit_price: number;
  adjusted: number;
  created_at: string;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_name: string;
  action: string;
  details?: string;
  ip_address?: string;
  created_at: string;
}

export interface DashboardStats {
  totalReferences: number;
  totalQuantity: number;
  totalValuation: number;
  lowStockCount: number;
  outOfStockCount: number;
  todayEntriesCount: number;
  todayEntriesQty: number;
  todayExitsCount: number;
  todayExitsQty: number;
  recentMovements: StockMovement[];
  restockNeeded: (Product & { category_name: string })[];
  chartData: { date: string; entries_qty: number; exits_qty: number }[];
  categoryStats: {
    category_name: string;
    product_count: number;
    total_stock: number;
    total_value: number;
  }[];
}
