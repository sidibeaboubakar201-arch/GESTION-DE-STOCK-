import { Product, Category, Supplier, StockMovement, InventorySession, InventoryItem, DashboardStats, User, AuditLog } from '../types/index.ts';

const TOKEN_KEY = 'securstock_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch {}
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers = new Headers(options.headers || {});

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const res = await fetch(endpoint, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    // Auth error
    setStoredToken(null);
    window.dispatchEvent(new CustomEvent('auth-expired'));
  }

  if (!res.ok) {
    let errorMsg = 'Une erreur est survenue';
    try {
      const data = await res.json();
      errorMsg = data.error || errorMsg;
    } catch {
      errorMsg = `Erreur HTTP ${res.status}: ${res.statusText}`;
    }
    throw new Error(errorMsg);
  }

  // Handle CSV/Blob downloads
  const contentType = res.headers.get('content-type');
  if (contentType && contentType.includes('text/csv')) {
    return (await res.blob()) as unknown as T;
  }

  return res.json();
}

export const api = {
  // Auth
  login: (credentials: { email: string; password: string }) =>
    request<{ token: string; user: User }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  getCurrentUser: () => request<{ user: User }>('/api/auth/me'),

  changePassword: (data: { currentPassword: string; newPassword: string }) =>
    request<{ success: boolean; message: string }>('/api/auth/change-password', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Dashboard
  getDashboardStats: () => request<DashboardStats>('/api/dashboard/stats'),

  // Products
  getProducts: (params?: { search?: string; category_id?: number | string; status?: string; sort_by?: string; sort_dir?: string }) => {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.category_id) query.set('category_id', String(params.category_id));
    if (params?.status) query.set('status', params.status);
    if (params?.sort_by) query.set('sort_by', params.sort_by);
    if (params?.sort_dir) query.set('sort_dir', params.sort_dir);
    return request<Product[]>(`/api/products?${query.toString()}`);
  },

  getProduct: (id: number) => request<Product & { movements: StockMovement[] }>(`/api/products/${id}`),

  createProduct: (data: Partial<Product>) =>
    request<Product>('/api/products', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateProduct: (id: number, data: Partial<Product>) =>
    request<Product>(`/api/products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  toggleArchiveProduct: (id: number) =>
    request<{ success: boolean; is_archived: number; message: string }>(`/api/products/${id}/archive`, {
      method: 'POST',
    }),

  importProductsCsv: (items: any[]) =>
    request<{ success: boolean; createdCount: number; updatedCount: number; errors: string[] }>('/api/products/import/csv', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),

  exportProductsCsvUrl: () => '/api/products/export/csv',

  // Categories
  getCategories: () => request<Category[]>('/api/categories'),

  createCategory: (data: { name: string; code: string; description?: string }) =>
    request<Category>('/api/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCategory: (id: number, data: { name: string; code: string; description?: string }) =>
    request<Category>(`/api/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCategory: (id: number) =>
    request<{ success: boolean; message: string }>(`/api/categories/${id}`, {
      method: 'DELETE',
    }),

  // Suppliers
  getSuppliers: () => request<Supplier[]>('/api/suppliers'),

  getSupplier: (id: number) => request<Supplier & { history: StockMovement[] }>(`/api/suppliers/${id}`),

  createSupplier: (data: Partial<Supplier>) =>
    request<Supplier>('/api/suppliers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateSupplier: (id: number, data: Partial<Supplier>) =>
    request<Supplier>(`/api/suppliers/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteSupplier: (id: number) =>
    request<{ success: boolean; message: string }>(`/api/suppliers/${id}`, {
      method: 'DELETE',
    }),

  // Stock movements
  createStockIn: (data: {
    product_id: number;
    quantity: number;
    unit_price?: number;
    supplier_id?: number;
    document_reference?: string;
    reason: string;
    comment?: string;
  }) =>
    request<{ success: boolean; movement: StockMovement; new_stock: number }>('/api/movements/in', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  createStockOut: (data: {
    product_id: number;
    quantity: number;
    reason: string;
    recipient_name?: string;
    document_reference?: string;
    comment?: string;
  }) =>
    request<{ success: boolean; movement: StockMovement; new_stock: number }>('/api/movements/out', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  getMovements: (params?: {
    type?: string;
    product_id?: number;
    category_id?: number;
    start_date?: string;
    end_date?: string;
    search?: string;
    limit?: number;
    offset?: number;
  }) => {
    const query = new URLSearchParams();
    if (params?.type) query.set('type', params.type);
    if (params?.product_id) query.set('product_id', String(params.product_id));
    if (params?.category_id) query.set('category_id', String(params.category_id));
    if (params?.start_date) query.set('start_date', params.start_date);
    if (params?.end_date) query.set('end_date', params.end_date);
    if (params?.search) query.set('search', params.search);
    if (params?.limit) query.set('limit', String(params.limit));
    if (params?.offset) query.set('offset', String(params.offset));
    return request<{ movements: StockMovement[]; totalCount: number }>(`/api/movements?${query.toString()}`);
  },

  exportMovementsCsvUrl: () => '/api/movements/export/csv',

  // Inventory
  getActiveInventory: () =>
    request<{ activeSession: InventorySession | null; items: InventoryItem[]; catalogProducts: any[] }>('/api/inventory/active'),

  startInventory: (notes?: string) =>
    request<{ success: boolean; session: InventorySession }>('/api/inventory/start', {
      method: 'POST',
      body: JSON.stringify({ notes }),
    }),

  saveInventoryCounts: (session_id: number, counts: Record<number, number>) =>
    request<{ success: boolean; message: string }>('/api/inventory/save-counts', {
      method: 'POST',
      body: JSON.stringify({ session_id, counts }),
    }),

  validateInventory: (session_id: number, notes?: string) =>
    request<{ success: boolean; message: string; adjustedCount: number }>('/api/inventory/validate', {
      method: 'POST',
      body: JSON.stringify({ session_id, notes }),
    }),

  cancelInventory: (session_id: number) =>
    request<{ success: boolean; message: string }>('/api/inventory/cancel', {
      method: 'POST',
      body: JSON.stringify({ session_id }),
    }),

  getInventoryHistory: () => request<InventorySession[]>('/api/inventory/history'),

  // Reports
  getValuationReport: () =>
    request<{
      byCategory: any[];
      topValuedProducts: any[];
      globalTotal: { total_products: number; total_quantity: number; total_valuation: number };
    }>('/api/reports/valuation'),

  getPeriodicMovementsReport: (months: number = 6) =>
    request<any[]>(`/api/reports/movements-period?months=${months}`),

  // Users & Admin
  getUsers: () => request<User[]>('/api/users'),

  createUser: (data: Partial<User> & { password: string }) =>
    request<User>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateUser: (id: number, data: Partial<User> & { password?: string }) =>
    request<User>(`/api/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteUser: (id: number) =>
    request<{ success: boolean; message: string }>(`/api/users/${id}`, {
      method: 'DELETE',
    }),

  getAuditLogs: () => request<AuditLog[]>('/api/audit-logs'),

  getBackupExportUrl: () => '/api/backup/export',
};
