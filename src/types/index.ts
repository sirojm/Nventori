export type UserRole = 'super_admin' | 'admin_inventaris' | 'operator';

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  role: UserRole;
  unit_id?: number | null;
  unit_name?: string;
  is_active: number;
  created_at?: string;
}

export interface BorrowerContact {
  id: number;
  full_name: string;
  institution: string;
  phone_wa: string;
  email: string;
  notes?: string;
  is_active: number;
  total_transactions?: number;
  active_loans?: number;
  created_at?: string;
}

export type TrackingMode = 'unique_unit' | 'quantity_pool' | 'consumable';

export interface Category {
  id: number;
  name: string;
  code: string;
  description?: string;
  item_count?: number;
  is_active: number;
}

export interface Location {
  id: number;
  name: string;
  code: string;
  description?: string;
  asset_count?: number;
  is_active: number;
}

export interface ItemType {
  id: number;
  name: string;
  code: string;
  category_id: number;
  category_name?: string;
  brand_model?: string;
  unit_of_measure: string;
  specs?: string;
  tracking_mode: TrackingMode;
  photo_url?: string;
  is_active: number;
  units_available?: number;
  units_in_use?: number;
  units_total?: number;
  pool_total?: number;
  pool_available?: number;
  accessories?: ItemAccessory[];
}

export interface ItemAccessory {
  name: string;
  quantity: number;
}

export type AssetCondition = 'baik' | 'rusak_ringan' | 'rusak_berat' | 'perawatan';
export type AssetStatus = 'tersedia' | 'dipesan' | 'dipakai' | 'nonaktif';

export interface AssetUnit {
  id: number;
  item_type_id: number;
  item_name?: string;
  brand_model?: string;
  category_name?: string;
  location_name?: string;
  unit_name?: string;
  unit_of_measure?: string;
  asset_code: string;
  serial_number?: string;
  location_id: number;
  unit_id?: number;
  condition: AssetCondition;
  status: AssetStatus;
  qr_code: string;
  notes?: string;
}

export interface StockPool {
  id: number;
  item_type_id: number;
  item_name: string;
  item_code: string;
  unit_of_measure: string;
  tracking_mode: TrackingMode;
  location_id: number;
  location_name: string;
  quantity_total: number;
  quantity_available: number;
  quantity_reserved: number;
  quantity_checked_out: number;
  condition: 'baik' | 'rusak';
  updated_at: string;
}

export interface KitComponent {
  id: number;
  asset_kit_id: number;
  item_type_id?: number;
  component_name: string;
  asset_unit_id?: number;
  asset_code?: string;
  item_name?: string;
  quantity: number;
  condition: 'baik' | 'rusak';
  is_required: number;
}

export interface AssetKit {
  id: number;
  kit_template_id: number;
  template_name?: string;
  name: string;
  kit_code: string;
  primary_asset_id?: number;
  location_id: number;
  location_name?: string;
  status: 'siap_lengkap' | 'tidak_lengkap' | 'dipakai' | 'perawatan';
  notes?: string;
  qr_code: string;
  component_count?: number;
  good_component_count?: number;
  components?: KitComponent[];
}

export type TransactionType = 'internal_usage' | 'inter_unit_loan';
export type TransactionStatus = 'draft' | 'dipesan' | 'diserahkan' | 'kembali_sebagian' | 'selesai' | 'dibatalkan';

export interface TransactionLine {
  id: number;
  transaction_id: number;
  item_type_id: number;
  item_name: string;
  brand_model?: string;
  unit_of_measure: string;
  asset_unit_id?: number;
  asset_code?: string;
  asset_kit_id?: number;
  kit_name?: string;
  kit_code?: string;
  tracking_mode: TrackingMode;
  quantity_requested: number;
  quantity_handed_over: number;
  quantity_returned: number;
  notes?: string;
}

export interface KitManifestItem {
  id: number;
  transaction_id: number;
  asset_kit_id: number;
  kit_name?: string;
  component_name: string;
  asset_unit_id?: number;
  asset_code?: string;
  quantity_handed_over: number;
  quantity_returned: number;
  condition_out: string;
  condition_in?: string;
  is_completed: number;
}

export interface Transaction {
  id: number;
  transaction_code: string;
  transaction_type: TransactionType;
  status: TransactionStatus;
  borrower_contact_id?: number;
  borrower_name: string;
  borrower_unit: string;
  borrower_phone: string;
  borrower_email: string;
  event_name: string;
  location_name: string;
  start_date: string;
  expected_return_date: string;
  actual_return_date?: string;
  operator_id: number;
  operator_name?: string;
  notes?: string;
  qr_token: string;
  created_at: string;
  letter_number?: string;
  letter_date?: string;
  sender_unit?: string;
  letter_notes?: string;
  lines?: TransactionLine[];
  manifest_items?: KitManifestItem[];
  handovers?: any[];
  returns?: any[];
  total_lines?: number;
}

export interface Activity {
  id: number;
  name: string;
  activity_type: string;
  location: string;
  start_time: string;
  end_time: string;
  pic_contact_id?: number;
  pic_name: string;
  pic_phone?: string;
  pic_email?: string;
  pic_institution?: string;
  status: 'terjadwal' | 'berlangsung' | 'selesai' | 'batal';
  notes?: string;
}

export interface AuditLog {
  id: number;
  user_id?: number;
  user_name: string;
  user_role: string;
  action: string;
  entity_type: string;
  entity_id: string;
  details: string;
  created_at: string;
}
