const API_BASE = '/api';

export function getToken(): string | null {
  return localStorage.getItem('nventori_token');
}

export function setToken(token: string) {
  localStorage.setItem('nventori_token', token);
}

export function removeToken() {
  localStorage.removeItem('nventori_token');
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({ success: false, message: 'Response format error' }));

  if (!response.ok) {
    if (response.status === 401) {
      removeToken();
      window.dispatchEvent(new Event('auth_unauthorized'));
    }
    throw new Error(data.message || `Request failed with status ${response.status}`);
  }

  return data;
}

export const api = {
  // Auth
  login: (credentials: { username: string; password: string }) =>
    request<{ success: boolean; token: string; user: any; message: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),
  changePassword: (data: { current_password: string; new_password: string }) =>
    request<{ success: boolean; message: string }>('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getMe: () => request<{ success: boolean; user: any }>('/auth/me'),
  getUsers: () => request<{ success: boolean; users: any[] }>('/auth/users'),
  getUnits: () => request<{ success: boolean; units: any[] }>('/auth/units'),
  createUser: (userData: any) =>
    request<{ success: boolean; message: string }>('/auth/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),
  updateUser: (id: number, userData: any) =>
    request<{ success: boolean; message: string }>(`/auth/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    }),
  toggleUser: (id: number) =>
    request<{ success: boolean; message: string }>(`/auth/users/${id}/toggle`, {
      method: 'PUT',
    }),

  // Inventory
  getCategories: (includeInactive = false) =>
    request<{ success: boolean; categories: any[] }>(`/inventory/categories${includeInactive ? '?include_inactive=true' : ''}`),
  createCategory: (data: { name: string; code: string; description?: string }) =>
    request<{ success: boolean; message: string }>('/inventory/categories', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateCategory: (id: number, data: { name: string; code: string; description?: string; is_active: number }) =>
    request<{ success: boolean; message: string }>(`/inventory/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deactivateCategory: (id: number) =>
    request<{ success: boolean; message: string }>(`/inventory/categories/${id}`, {
      method: 'DELETE',
    }),
  generateItemCode: (data: { name: string; category_id: number }) =>
    request<{ success: boolean; code: string }>('/inventory/items/generate-code', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getLocations: () => request<{ success: boolean; locations: any[] }>('/inventory/locations'),
  createLocation: (data: any) =>
    request<{ success: boolean; message: string }>('/inventory/locations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getItems: (params: any = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<{ success: boolean; items: any[] }>(`/inventory/items?${q}`);
  },
  createItem: (data: any) =>
    request<{ success: boolean; message: string }>('/inventory/items', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  importItems: (rows: Array<Record<string, string>>) =>
    request<{ success: boolean; imported: number; message: string }>('/inventory/items/import', {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }),
  updateItem: (id: number, data: any) =>
    request<{ success: boolean; message: string }>(`/inventory/items/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  deleteItem: (id: number) =>
    request<{ success: boolean; message: string }>(`/inventory/items/${id}`, { method: 'DELETE' }),
  restoreItem: (id: number) =>
    request<{ success: boolean; message: string }>(`/inventory/items/${id}/restore`, { method: 'POST' }),
  getAssets: (params: any = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<{ success: boolean; assets: any[] }>(`/inventory/assets?${q}`);
  },
  createAsset: (data: {
    item_type_id: number;
    quantity: number;
    location_id: number;
    condition: string;
    serial_number?: string;
  }) =>
    request<{ success: boolean; message: string; asset_codes: string[] }>('/inventory/assets/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  deleteAsset: (id: number) =>
    request<{ success: boolean; message: string }>(`/inventory/assets/${id}`, { method: 'DELETE' }),
  restoreAsset: (id: number) =>
    request<{ success: boolean; message: string }>(`/inventory/assets/${id}/restore`, { method: 'POST' }),
  updateAsset: (id: number, data: {
    item_type_id: number;
    asset_code: string;
    serial_number: string;
    location_id: number;
    condition: string;
  }) =>
    request<{ success: boolean; message: string }>(`/inventory/assets/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getStockPools: () => request<{ success: boolean; pools: any[] }>('/inventory/stock-pools'),
  adjustStockPool: (data: { pool_id: number; new_quantity: number; reason: string }) =>
    request<{ success: boolean; message: string }>('/inventory/stock-pools/adjust', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getKits: () => request<{ success: boolean; kits: any[] }>('/inventory/kits'),
  getKitById: (id: number | string) => request<{ success: boolean; kit: any }>(`/inventory/kits/${id}`),
  updateKit: (id: number, data: any) =>
    request<{ success: boolean; message: string }>(`/inventory/kits/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),
  getKitTemplates: () => request<{ success: boolean; templates: any[] }>('/inventory/kit-templates'),

  // Contacts
  getContacts: (params: any = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<{ success: boolean; contacts: any[] }>(`/contacts?${q}`);
  },
  getContactById: (id: number | string) => request<{ success: boolean; contact: any }>(`/contacts/${id}`),
  createContact: (data: any) =>
    request<{ success: boolean; message: string; contact_id: number; potential_duplicate?: string }>('/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Transactions
  getTransactions: (params: any = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<{ success: boolean; transactions: any[] }>(`/transactions?${q}`);
  },
  getTransactionById: (id: number | string) =>
    request<{ success: boolean; transaction: any }>(`/transactions/${id}`),
  getReceiptProof: (id: number | string, type: 'handover' | 'return') =>
    request<{
      success: boolean;
      proof: {
        verification_path: string;
        transaction_code: string;
        document_type: 'handover' | 'return';
        issued_by: string;
        issued_at: string;
      };
    }>(`/transactions/${id}/receipt-proof?type=${type}`),
  createTransaction: (data: any) =>
    request<{ success: boolean; message: string; transaction_id: number; transaction_code: string }>('/transactions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  handoverTransaction: (id: number | string, data: any) =>
    request<{ success: boolean; message: string }>(`/transactions/${id}/handover`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  returnTransaction: (id: number | string, data: any) =>
    request<{ success: boolean; message: string; is_fully_returned: boolean; status: string }>(`/transactions/${id}/returns`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Activities & Recommendations
  getActivities: (params: any = {}) => {
    const q = new URLSearchParams(params).toString();
    return request<{ success: boolean; activities: any[] }>(`/activities?${q}`);
  },
  createActivity: (data: any) =>
    request<{ success: boolean; message: string; id: number }>('/activities', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  getActivityTemplates: () => request<{ success: boolean; templates: any[] }>('/activities/templates'),
  getRecommendations: (data: { template_id: number; scale_factor?: number; start_date?: string; expected_return_date?: string }) =>
    request<{ success: boolean; template_name: string; recommendations: any[] }>('/activities/recommend', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // QR
  resolveQR: (code: string) => request<{ success: boolean; type: string; data: any }>(`/qr/resolve/${encodeURIComponent(code)}`),
  getQRImage: (text: string) => request<{ success: boolean; dataUrl: string }>(`/qr/image?text=${encodeURIComponent(text)}`),

  // Reports & Dashboard
  getDashboardStats: () => request<{ success: boolean; stats: any; overdue_items: any[]; upcoming_activities: any[]; recent_transactions: any[] }>('/reports/dashboard'),
  getAuditLogs: (limit = 50) => request<{ success: boolean; logs: any[] }>(`/reports/audit?limit=${limit}`),
  getNotifications: () => request<{ success: boolean; notifications: any[] }>('/reports/notifications'),
};
