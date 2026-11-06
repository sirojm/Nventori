import React, { useState, useEffect, useRef } from 'react';
import {
  Package,
  Layers,
  Box,
  Plus,
  Search,
  Filter,
  Printer,
  QrCode,
  AlertCircle,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
  X,
  Edit,
  RotateCcw,
  Sparkles,
  Tags,
  Trash2,
  Download,
  FileUp
} from 'lucide-react';
import { api } from '../services/api';
import { QRScannerModal } from '../components/scanner/QRScannerModal';
import { WarehouseModal } from '../components/inventory/WarehouseModal';
import { ReconcileModal } from '../components/inventory/ReconcileModal';
import { ItemType, AssetUnit, StockPool, AssetKit, Category, Location } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface InventoryPageProps {
  onOpenLabelModal: (asset: AssetUnit) => void;
  focusRequest?: { tab: 'assets' | 'kits'; search: string; nonce: number } | null;
}

interface KitComponentForm {
  component_name: string;
  item_type_id: string;
  asset_unit_id: string;
  quantity: number;
  condition: 'baik' | 'rusak';
  is_required: number;
}

interface AccessoryForm {
  name: string;
  quantity: number;
}

const ACCESSORY_SUGGESTIONS = ['Charger', 'Baterai', 'Kabel', 'Tas / Case', 'Lensa kit', 'Remote', 'Memory card'];

const emptyItemForm = () => ({
  name: '',
  code: '',
  category_id: '',
  brand_model: '',
  unit_of_measure: 'Unit',
  specs: '',
  tracking_mode: 'unique_unit' as 'unique_unit' | 'quantity_pool' | 'consumable',
  accessories: [] as AccessoryForm[],
});

const importHeaders = [
  'nama_barang',
  'kode_katalog',
  'kode_kategori',
  'merek_model',
  'satuan',
  'mode_pelacakan',
  'spesifikasi',
  'stok_awal',
  'kode_lokasi',
  'kondisi_stok',
];
// Optional columns: older CSV files without them still import fine.
const optionalImportHeaders = ['kelengkapan'];

const parseCsv = (source: string): string[][] => {
  const text = source.replace(/^\uFEFF/, '');
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delimiter = (firstLine.match(/;/g) || []).length > (firstLine.match(/,/g) || []).length ? ';' : ',';
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field.length === 0) {
      quoted = true;
    } else if (char === delimiter) {
      record.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && text[i + 1] === '\n') i += 1;
      record.push(field);
      if (record.some((value) => value.trim())) records.push(record);
      record = [];
      field = '';
    } else {
      field += char;
    }
  }
  if (quoted) throw new Error('CSV memiliki tanda kutip yang belum ditutup.');
  record.push(field);
  if (record.some((value) => value.trim())) records.push(record);
  return records;
};

export const InventoryPage: React.FC<InventoryPageProps> = ({ onOpenLabelModal, focusRequest }) => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'items' | 'assets' | 'pools' | 'kits'>('items');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [showInactiveItems, setShowInactiveItems] = useState(false);
  const [inactiveItems, setInactiveItems] = useState<ItemType[]>([]);
  const [showInactiveAssets, setShowInactiveAssets] = useState(false);

  // Jump to a specific tab/search (e.g. after scanning a QR)
  useEffect(() => {
    if (!focusRequest) return;
    setActiveTab(focusRequest.tab);
    setSearch(focusRequest.search);
  }, [focusRequest?.nonce]);

  // Data
  const [items, setItems] = useState<ItemType[]>([]);
  const [assets, setAssets] = useState<AssetUnit[]>([]);
  const [pools, setPools] = useState<StockPool[]>([]);
  const [kits, setKits] = useState<AssetKit[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);

  // Modals
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [showAddAssetModal, setShowAddAssetModal] = useState(false);
  const [editingAsset, setEditingAsset] = useState<AssetUnit | null>(null);
  const [assetCatalogItems, setAssetCatalogItems] = useState<ItemType[]>([]);
  const [assetEditForm, setAssetEditForm] = useState({
    item_type_id: '',
    asset_code: '',
    serial_number: '',
    location_id: '',
    condition: 'baik',
  });
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showEditKitModal, setShowEditKitModal] = useState(false);
  const [isCreatingKit, setIsCreatingKit] = useState(false);
  const [savingKit, setSavingKit] = useState(false);
  const [kitToDelete, setKitToDelete] = useState<AssetKit | null>(null);
  const [deletingKit, setDeletingKit] = useState(false);
  const [kitPickerSearch, setKitPickerSearch] = useState('');
  const [showKitScanner, setShowKitScanner] = useState(false);
  const [showWarehouseModal, setShowWarehouseModal] = useState(false);
  const [showManageMenu, setShowManageMenu] = useState(false);
  const manageMenuRef = useRef<HTMLDivElement>(null);

  // Close the "Kelola" menu on outside click / Escape
  useEffect(() => {
    if (!showManageMenu) return;
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (manageMenuRef.current && !manageMenuRef.current.contains(event.target as Node)) setShowManageMenu(false);
    };
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setShowManageMenu(false);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [showManageMenu]);
  const [showReconcileModal, setShowReconcileModal] = useState(false);
  const kitFormRef = useRef<typeof kitForm | null>(null);
  const [poolToDelete, setPoolToDelete] = useState<StockPool | null>(null);
  const [deletingPool, setDeletingPool] = useState(false);
  // Unfiltered lists for the kit picker (the page lists above depend on the search box)
  const [kitCatalog, setKitCatalog] = useState<{ items: ItemType[]; assets: AssetUnit[] }>({ items: [], assets: [] });
  const [showImportModal, setShowImportModal] = useState(false);
  const [importRows, setImportRows] = useState<Array<Record<string, string>>>([]);
  const [importFileName, setImportFileName] = useState('');
  const [importError, setImportError] = useState('');
  const [importing, setImporting] = useState(false);
  const importFileRef = useRef<HTMLInputElement>(null);
  const [selectedPool, setSelectedPool] = useState<StockPool | null>(null);
  const [editingKit, setEditingKit] = useState<AssetKit | null>(null);
  const [kitForm, setKitForm] = useState({
    name: '',
    kit_code: '',
    location_id: '',
    notes: '',
    components: [] as KitComponentForm[],
  });
  kitFormRef.current = kitForm;
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', code: '', description: '' });

  // Form states
  const [newItem, setNewItem] = useState(emptyItemForm);
  const [accessoryDraft, setAccessoryDraft] = useState({ name: '', quantity: 1 });
  const [showAccessoryEditor, setShowAccessoryEditor] = useState(false);

  const [newAsset, setNewAsset] = useState({
    item_type_id: '',
    quantity: 1,
    serial_number: '',
    location_id: '',
    condition: 'baik',
    notes: '',
  });

  const [adjustData, setAdjustData] = useState({
    new_quantity: 0,
    reason: '',
  });

  const canManage = user?.role === 'super_admin' || user?.role === 'admin_inventaris';

  const loadAll = async () => {
    setLoading(true);
    try {
      const [itRes, asRes, spRes, ktRes, catRes, locRes] = await Promise.all([
        api.getItems({ search, category_id: categoryFilter }),
        api.getAssets({ search, include_inactive: showInactiveAssets }),
        api.getStockPools(),
        api.getKits(),
        api.getCategories(true),
        api.getLocations(),
      ]);

      if (itRes.success) setItems(itRes.items);
      if (asRes.success) setAssets(asRes.assets);
      if (spRes.success) setPools(spRes.pools);
      if (ktRes.success) setKits(ktRes.kits);
      if (catRes.success) setCategories(catRes.categories);
      if (locRes.success) setLocations(locRes.locations);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, [search, categoryFilter, showInactiveAssets]);

  const loadInactiveItems = async () => {
    try {
      const result = await api.getItems({ include_inactive: true });
      setInactiveItems(result.items.filter((item) => !item.is_active));
    } catch (err) {
      error(err instanceof Error ? err.message : 'Gagal memuat katalog nonaktif.');
    }
  };

  const resetCategoryForm = () => {
    setEditingCategoryId(null);
    setCategoryForm({ name: '', code: '', description: '' });
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!categoryForm.name.trim() || !categoryForm.code.trim()) {
      error('Nama dan kode kategori wajib diisi.');
      return;
    }

    setSavingCategory(true);
    try {
      const res = editingCategoryId
        ? await api.updateCategory(editingCategoryId, {
            ...categoryForm,
            is_active: categories.find((category) => category.id === editingCategoryId)?.is_active ?? 1,
          })
        : await api.createCategory(categoryForm);
      if (res.success) {
        success(res.message);
        resetCategoryForm();
        await loadAll();
      }
    } catch (err: any) {
      error(err.message || 'Gagal menyimpan kategori.');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleToggleCategory = async (category: Category) => {
    try {
      const res = category.is_active
        ? await api.deactivateCategory(category.id)
        : await api.updateCategory(category.id, {
            name: category.name,
            code: category.code,
            description: category.description || '',
            is_active: 1,
          });
      if (res.success) {
        success(res.message);
        if (category.is_active && categoryFilter === String(category.id)) setCategoryFilter('');
        await loadAll();
      }
    } catch (err: any) {
      error(err.message || 'Gagal mengubah status kategori.');
    }
  };

  const handleGenerateItemCode = async () => {
    if (!newItem.name.trim() || !newItem.category_id) {
      error('Isi nama barang dan pilih kategori terlebih dahulu.');
      return;
    }
    setGeneratingCode(true);
    try {
      const res = await api.generateItemCode({
        name: newItem.name,
        category_id: Number(newItem.category_id),
      });
      if (res.success) setNewItem((item) => ({ ...item, code: res.code }));
    } catch (err: any) {
      error(err.message || 'Gagal membuat kode katalog otomatis.');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCreateItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItem.name || !newItem.code || !newItem.category_id) {
      error('Harap lengkapi nama, kode, dan kategori barang.');
      return;
    }
    try {
      // Include a half-typed accessory so it is not silently lost on save
      const pendingName = accessoryDraft.name.trim();
      const accessories = pendingName && !newItem.accessories.some((a) => a.name.toLowerCase() === pendingName.toLowerCase())
        ? [...newItem.accessories, { name: pendingName, quantity: accessoryDraft.quantity }]
        : newItem.accessories;
      const payload = {
        ...newItem,
        accessories,
        category_id: Number(newItem.category_id),
      };
      const res = editingItemId
        ? await api.updateItem(editingItemId, payload)
        : await api.createItem(payload);
      if (res.success) {
        success(res.message);
        setShowAddItemModal(false);
        setEditingItemId(null);
        setNewItem(emptyItemForm());
        setAccessoryDraft({ name: '', quantity: 1 });
        loadAll();
      }
    } catch (err: any) {
      error(err.message || 'Gagal menambahkan jenis barang.');
    }
  };

  const openEditItem = (item: ItemType) => {
    setEditingItemId(item.id);
    setNewItem({
      name: item.name,
      code: item.code,
      category_id: String(item.category_id),
      brand_model: item.brand_model || '',
      unit_of_measure: item.unit_of_measure,
      specs: item.specs || '',
      tracking_mode: item.tracking_mode,
      accessories: (item.accessories || []).map((accessory) => ({ name: accessory.name, quantity: accessory.quantity })),
    });
    setAccessoryDraft({ name: '', quantity: 1 });
    setShowAccessoryEditor((item.accessories || []).length > 0);
    setShowAddItemModal(true);
  };

  const addAccessory = (rawName: string, quantity = 1) => {
    const name = rawName.trim().replace(/\s+/g, ' ');
    if (!name) return;
    if (newItem.accessories.some((accessory) => accessory.name.toLowerCase() === name.toLowerCase())) {
      error(`"${name}" sudah ada di daftar kelengkapan.`);
      return;
    }
    setNewItem((item) => ({
      ...item,
      accessories: [...item.accessories, { name, quantity: Math.min(99, Math.max(1, Math.round(quantity) || 1)) }],
    }));
    setAccessoryDraft({ name: '', quantity: 1 });
  };

  const removeAccessory = (name: string) =>
    setNewItem((item) => ({ ...item, accessories: item.accessories.filter((accessory) => accessory.name !== name) }));

  const loadKitCatalog = async () => {
    try {
      const [itemRes, assetRes] = await Promise.all([api.getItems({}), api.getAssets({})]);
      setKitCatalog({
        items: itemRes.success ? itemRes.items : [],
        assets: assetRes.success ? assetRes.assets : [],
      });
    } catch (err) {
      error(err instanceof Error ? err.message : 'Gagal memuat katalog untuk paket.');
    }
  };

  const closeKitModal = () => {
    setShowEditKitModal(false);
    setEditingKit(null);
    setIsCreatingKit(false);
    setKitPickerSearch('');
  };

  const openCreateKit = () => {
    setEditingKit(null);
    setIsCreatingKit(true);
    setKitPickerSearch('');
    setKitForm({
      name: '',
      kit_code: '',
      location_id: locations[0] ? String(locations[0].id) : '',
      notes: '',
      components: [],
    });
    setShowEditKitModal(true);
    loadKitCatalog();
  };

  const openEditKit = (kit: AssetKit) => {
    setEditingKit(kit);
    setIsCreatingKit(false);
    setKitPickerSearch('');
    setKitForm({
      name: kit.name,
      kit_code: kit.kit_code,
      location_id: String(kit.location_id),
      notes: kit.notes || '',
      components: (kit.components || []).map((component) => ({
        component_name: component.component_name,
        item_type_id: component.item_type_id ? String(component.item_type_id) : '',
        asset_unit_id: component.asset_unit_id ? String(component.asset_unit_id) : '',
        quantity: component.quantity,
        condition: component.condition,
        is_required: component.is_required,
      })),
    });
    setShowEditKitModal(true);
    loadKitCatalog();
  };

  const addKitComponent = (item: ItemType) => {
    setKitForm((form) => {
      const existingIndex = form.components.findIndex(
        (component) => component.item_type_id === String(item.id) && !component.asset_unit_id
      );
      if (existingIndex >= 0) {
        return {
          ...form,
          components: form.components.map((component, i) =>
            i === existingIndex ? { ...component, quantity: component.quantity + 1 } : component
          ),
        };
      }
      return {
        ...form,
        components: [
          ...form.components,
          {
            component_name: item.name,
            item_type_id: String(item.id),
            asset_unit_id: '',
            quantity: 1,
            condition: 'baik' as const,
            is_required: 1,
          },
        ],
      };
    });
  };

  const kitPickerItems = kitCatalog.items.filter((item) => {
    const q = kitPickerSearch.trim().toLowerCase();
    if (!q) return true;
    return [item.name, item.code, item.brand_model, item.category_name]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(q));
  });

  // Scanner callback outlives the render that created it, so read the form through a ref.
  const addKitAssetFromScan = (asset: AssetUnit): 'added' | 'duplicate' | 'unavailable' => {
    const current = kitFormRef.current;
    if (!current) return 'unavailable';
    if (current.components.some((component) => component.asset_unit_id === String(asset.id))) return 'duplicate';
    const next = {
      ...current,
      components: [
        ...current.components,
        {
          component_name: asset.item_name || asset.asset_code,
          item_type_id: String(asset.item_type_id),
          asset_unit_id: String(asset.id),
          quantity: 1,
          condition: 'baik' as const,
          is_required: 1,
        },
      ],
    };
    kitFormRef.current = next;
    setKitForm(next);
    return 'added';
  };

  const handleDeletePool = async () => {
    if (!poolToDelete) return;
    setDeletingPool(true);
    try {
      const res = await api.deleteStockPool(poolToDelete.id);
      if (res.success) {
        success(res.message);
        setPoolToDelete(null);
        await loadAll();
      }
    } catch (err: any) {
      error(err.message || 'Gagal menghapus catatan stok.');
      setPoolToDelete(null);
    } finally {
      setDeletingPool(false);
    }
  };

  const handleSaveKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!kitForm.name.trim() || !kitForm.location_id || (editingKit && !kitForm.kit_code.trim())) {
      error('Nama paket, kode, dan lokasi wajib diisi.');
      return;
    }
    if (!kitForm.components.length) {
      error('Tambahkan minimal satu komponen ke paket.');
      return;
    }

    setSavingKit(true);
    try {
      const payload = {
        ...kitForm,
        location_id: Number(kitForm.location_id),
        components: kitForm.components.map((component) => ({
          ...component,
          item_type_id: component.item_type_id ? Number(component.item_type_id) : null,
          asset_unit_id: component.asset_unit_id ? Number(component.asset_unit_id) : null,
        })),
      };
      const res = editingKit ? await api.updateKit(editingKit.id, payload) : await api.createKit(payload);
      if (res.success) {
        success(res.message);
        closeKitModal();
        await loadAll();
      }
    } catch (err: any) {
      error(err.message || 'Gagal menyimpan paket.');
    } finally {
      setSavingKit(false);
    }
  };

  const handleDeleteKit = async () => {
    if (!kitToDelete) return;
    setDeletingKit(true);
    try {
      const res = await api.deleteKit(kitToDelete.id);
      if (res.success) {
        success(res.message);
        setKitToDelete(null);
        await loadAll();
      }
    } catch (err: any) {
      error(err.message || 'Gagal menghapus paket.');
      setKitToDelete(null);
    } finally {
      setDeletingKit(false);
    }
  };

  const handleDownloadImportTemplate = () => {
    const csv = `\uFEFF${[...importHeaders, ...optionalImportHeaders].join(';')}\r\n`;
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = 'template-import-katalog-nventori.csv';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (file?: File) => {
    setImportRows([]);
    setImportError('');
    setImportFileName(file?.name || '');
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setImportError('Pilih file CSV. Untuk Excel, gunakan Simpan Sebagai lalu pilih CSV UTF-8.');
      return;
    }

    try {
      const records = parseCsv(await file.text());
      if (records.length < 2) throw new Error('CSV harus berisi header dan minimal satu baris barang.');
      const headers = records[0].map((header) => header.trim().toLowerCase());
      const missingHeaders = importHeaders.filter((header) => !headers.includes(header));
      if (missingHeaders.length) {
        throw new Error(`Kolom wajib tidak ditemukan: ${missingHeaders.join(', ')}.`);
      }

      const allHeaders = [...importHeaders, ...optionalImportHeaders];
      const headerIndexes = allHeaders.map((header) => headers.indexOf(header));
      const dataRows = records.slice(1);
      if (dataRows.length > 500) throw new Error('Maksimal 500 baris barang dapat diimpor sekaligus.');

      const parsedRows = dataRows.map((record, rowIndex) => {
        if (record.length !== headers.length) {
          throw new Error(`Jumlah kolom pada baris ${rowIndex + 2} tidak sesuai dengan header.`);
        }
        return Object.fromEntries(
          allHeaders.map((header, index) => [header, headerIndexes[index] >= 0 ? record[headerIndexes[index]]?.trim() || '' : ''])
        );
      });
      setImportRows(parsedRows.map((row) => ({
        name: row.nama_barang,
        code: row.kode_katalog,
        category_code: row.kode_kategori,
        brand_model: row.merek_model,
        unit_of_measure: row.satuan,
        tracking_mode: row.mode_pelacakan,
        specs: row.spesifikasi,
        opening_stock: row.stok_awal,
        location_code: row.kode_lokasi,
        condition: row.kondisi_stok,
        accessories: row.kelengkapan,
      })));
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Gagal membaca file CSV.');
    }
  };

  const handleImportItems = async () => {
    if (!importRows.length) return;
    setImporting(true);
    setImportError('');
    try {
      const result = await api.importItems(importRows);
      success(result.message);
      setShowImportModal(false);
      setImportRows([]);
      setImportFileName('');
      if (importFileRef.current) importFileRef.current.value = '';
      await loadAll();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Gagal mengimpor katalog.';
      setImportError(message);
      error(message);
    } finally {
      setImporting(false);
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.item_type_id || !newAsset.location_id ||
      !Number.isInteger(newAsset.quantity) || newAsset.quantity < 1 || newAsset.quantity > 500) {
      error('Pilih barang dan lokasi, serta masukkan jumlah unit antara 1 dan 500.');
      return;
    }
    try {
      const res = await api.createAsset({
        item_type_id: Number(newAsset.item_type_id),
        quantity: newAsset.quantity,
        serial_number: newAsset.quantity === 1 ? newAsset.serial_number : '',
        location_id: Number(newAsset.location_id),
        condition: newAsset.condition,
      });
      if (res.success) {
        const codeSummary = res.asset_codes?.length
          ? ` Kode pertama: ${res.asset_codes[0]}${res.asset_codes.length > 1 ? `, terakhir: ${res.asset_codes[res.asset_codes.length - 1]}` : ''}.`
          : '';
        success(`${res.message}${codeSummary}`);
        setShowAddAssetModal(false);
        setActiveTab('assets');
        setNewAsset({
          item_type_id: '',
          quantity: 1,
          serial_number: '',
          location_id: '',
          condition: 'baik',
          notes: '',
        });
        if (search) setSearch('');
        else await loadAll();
      }
    } catch (err: any) {
      error(err.message || 'Gagal menambahkan unit fisik.');
    }
  };

  const openEditAsset = async (asset: AssetUnit) => {
    try {
      const result = await api.getItems({ tracking_mode: 'unique_unit' });
      setAssetCatalogItems(result.items);
      setEditingAsset(asset);
      setAssetEditForm({
        item_type_id: String(asset.item_type_id),
        asset_code: asset.asset_code,
        serial_number: asset.serial_number || '',
        location_id: String(asset.location_id),
        condition: asset.condition,
      });
    } catch (err) {
      error(err instanceof Error ? err.message : 'Gagal memuat katalog aset.');
    }
  };

  const handleUpdateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingAsset || !assetEditForm.item_type_id || !assetEditForm.asset_code.trim() ||
      !assetEditForm.location_id) {
      error('Barang, kode aset, dan lokasi wajib diisi.');
      return;
    }

    try {
      const res = await api.updateAsset(editingAsset.id, {
        item_type_id: Number(assetEditForm.item_type_id),
        asset_code: assetEditForm.asset_code.trim(),
        serial_number: assetEditForm.serial_number.trim(),
        location_id: Number(assetEditForm.location_id),
        condition: assetEditForm.condition,
      });
      if (res.success) {
        success(res.message);
        setEditingAsset(null);
        await loadAll();
      }
    } catch (err) {
      error(err instanceof Error ? err.message : 'Gagal memperbarui data aset fisik.');
    }
  };

  const handleDeleteItem = async (item: ItemType) => {
    const stockNote =
      item.tracking_mode !== 'unique_unit' && (item.pool_total || 0) > 0
        ? ` Stok tercatat ${item.pool_total} ${item.unit_of_measure} akan ikut dihapus.`
        : '';
    if (!window.confirm(`Hapus katalog "${item.name}"?${stockNote} Riwayat transaksi tidak ikut dihapus. Barang yang masih dipakai di transaksi aktif tidak dapat dihapus.`)) return;
    try {
      const result = await api.deleteItem(item.id, { clear_stock: true });
      success(result.message);
      await loadAll();
      if (showInactiveItems) await loadInactiveItems();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Gagal menghapus katalog.');
    }
  };

  const handleRestoreItem = async (item: ItemType) => {
    try {
      const result = await api.restoreItem(item.id);
      success(result.message);
      await loadAll();
      await loadInactiveItems();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Gagal mengaktifkan kembali katalog.');
    }
  };

  const handleDeleteAsset = async (asset: AssetUnit) => {
    if (!window.confirm(`Hapus aset ${asset.asset_code} dari daftar aktif? Riwayat stok dan transaksi tetap tersimpan.`)) return;
    try {
      const result = await api.deleteAsset(asset.id);
      success(result.message);
      await loadAll();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Gagal menghapus aset fisik.');
    }
  };

  const handleRestoreAsset = async (asset: AssetUnit) => {
    try {
      const result = await api.restoreAsset(asset.id);
      success(result.message);
      await loadAll();
    } catch (err) {
      error(err instanceof Error ? err.message : 'Gagal mengaktifkan kembali aset fisik.');
    }
  };

  const handleAdjustStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPool || !adjustData.reason) {
      error('Alasan penyesuaian wajib diisi untuk catatan jejak audit.');
      return;
    }
    try {
      const res = await api.adjustStockPool({
        pool_id: selectedPool.id,
        new_quantity: Number(adjustData.new_quantity),
        reason: adjustData.reason,
      });
      if (res.success) {
        success(res.message);
        setShowAdjustModal(false);
        setSelectedPool(null);
        setAdjustData({ new_quantity: 0, reason: '' });
        loadAll();
      }
    } catch (err: any) {
      error(err.message || 'Gagal menyesuaikan stok.');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto pb-24 md:pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Katalog & Master Inventaris</h2>
          <p className="text-xs text-slate-500">Kelola jenis barang, unit aset unik, stok kuantitas, dan paket kelengkapan</p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            {/* Secondary actions live in one menu so the header never overflows */}
            <div className="relative" ref={manageMenuRef}>
              <button
                type="button"
                onClick={() => setShowManageMenu((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={showManageMenu}
                className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-sm transition cursor-pointer whitespace-nowrap"
              >
                <SlidersHorizontal className="w-4 h-4 text-slate-500" />
                <span>Kelola</span>
                <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${showManageMenu ? 'rotate-180' : ''}`} />
              </button>
              {showManageMenu && (
                <div
                  role="menu"
                  className="absolute left-0 sm:left-auto sm:right-0 top-full mt-2 z-30 w-64 rounded-2xl bg-white border border-slate-200 shadow-xl p-1.5 animate-in fade-in zoom-in-95 duration-100"
                >
                  {[
                    { icon: FileUp, label: 'Import CSV', desc: 'Impor katalog barang dari file', action: () => setShowImportModal(true) },
                    { icon: Tags, label: 'Kelola Kategori', desc: 'Tambah, ubah, nonaktifkan kategori', action: () => setShowCategoryModal(true) },
                    { icon: Layers, label: 'Kelola Gudang', desc: 'Tambah, ubah, hapus gudang', action: () => setShowWarehouseModal(true) },
                    { icon: RotateCcw, label: 'Sinkronkan Data', desc: 'Cocokkan stok & status dengan transaksi', action: () => setShowReconcileModal(true) },
                  ].map((entry) => {
                    const Icon = entry.icon;
                    return (
                      <button
                        key={entry.label}
                        type="button"
                        role="menuitem"
                        onClick={() => {
                          setShowManageMenu(false);
                          entry.action();
                        }}
                        className="w-full flex items-start gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 text-left cursor-pointer"
                      >
                        <span className="mt-0.5 w-8 h-8 rounded-lg bg-slate-100 text-slate-500 flex items-center justify-center flex-shrink-0">
                          <Icon className="w-4 h-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-semibold text-slate-800">{entry.label}</span>
                          <span className="block text-[11px] text-slate-500 leading-snug">{entry.desc}</span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              onClick={() => {
                setEditingItemId(null);
                setNewItem(emptyItemForm());
                setAccessoryDraft({ name: '', quantity: 1 });
                setShowAccessoryEditor(false);
                setShowAddItemModal(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Jenis Barang</span>
            </button>
            <button
              onClick={() => {
                setNewAsset({
                  item_type_id: '',
                  quantity: 1,
                  serial_number: '',
                  location_id: '',
                  condition: 'baik',
                  notes: '',
                });
                setShowAddAssetModal(true);
              }}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-sm transition cursor-pointer whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              <span>Unit Fisik</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs: 2x2 grid on phones (no sideways scrolling), underline tabs from sm up */}
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2 sm:border-b sm:border-slate-200 sm:overflow-x-auto sm:pb-px">
        {[
          { id: 'items', label: 'Jenis Barang & Katalog', short: 'Jenis Barang', icon: Package, count: items.length },
          { id: 'assets', label: 'Unit Aset Fisik Unik', short: 'Unit Aset', icon: Box, count: assets.length },
          { id: 'pools', label: 'Stok Kuantitas & Habis Pakai', short: 'Stok', icon: Layers, count: pools.length },
          { id: 'kits', label: 'Paket Kelengkapan (Kits)', short: 'Paket', icon: SlidersHorizontal, count: kits.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              aria-pressed={isActive}
              className={`flex items-center gap-2 min-w-0 px-3 py-2.5 sm:px-4 text-xs font-bold border rounded-xl sm:rounded-none sm:border-0 sm:border-b-2 transition sm:whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-forest-800 text-forest-800 bg-emerald-50 sm:bg-transparent'
                  : 'border-slate-200 bg-white text-slate-600 sm:bg-transparent sm:border-transparent sm:text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <span className="truncate sm:hidden">{tab.short}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              <span className={`ml-auto sm:ml-0 flex-shrink-0 px-1.5 py-0.5 rounded-full text-[10px] ${isActive ? 'bg-emerald-100 text-forest-800' : 'bg-slate-100 text-slate-500'}`}>
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row items-center gap-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari berdasarkan nama, kode aset, merek..."
            className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          />
        </div>

        {activeTab === 'items' && (
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="w-full sm:w-48 px-3 py-2 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
          >
            <option value="">Semua Kategori</option>
            {categories.filter((category) => category.is_active).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Tab 1: Item Types Catalog */}
      {activeTab === 'items' && (
        <div className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <button
                onClick={async () => {
                  const nextValue = !showInactiveItems;
                  setShowInactiveItems(nextValue);
                  if (nextValue) await loadInactiveItems();
                }}
                className="text-xs font-semibold text-slate-600 hover:text-forest-800"
              >
                {showInactiveItems ? 'Sembunyikan katalog nonaktif' : 'Tampilkan katalog nonaktif'}
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.map((it) => (
            <div key={it.id} className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col justify-between space-y-3">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 uppercase tracking-wider">
                    {it.category_name}
                  </span>
                  <span className="text-[10px] font-mono text-slate-400 font-bold">{it.code}</span>
                </div>
                <h3 className="font-bold text-sm text-slate-900 mt-2">{it.name}</h3>
                {it.brand_model && <p className="text-xs text-slate-500">{it.brand_model}</p>}
                {it.specs && <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{it.specs}</p>}
                {!!it.accessories?.length && (
                  <div className="mt-2 flex flex-wrap gap-1" title="Kelengkapan barang">
                    {it.accessories.slice(0, 4).map((accessory) => (
                      <span key={accessory.name} className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600">
                        {accessory.name}{accessory.quantity > 1 ? ` ×${accessory.quantity}` : ''}
                      </span>
                    ))}
                    {it.accessories.length > 4 && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">
                        +{it.accessories.length - 4} lagi
                      </span>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-slate-100 space-y-3 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[10px] text-slate-400 block">Pelacakan:</span>
                    <span className="font-semibold text-slate-700 capitalize">
                      {it.tracking_mode === 'unique_unit'
                        ? 'Unit Unik (QR)'
                        : it.tracking_mode === 'quantity_pool'
                        ? 'Stok Kuantitas'
                        : 'Habis Pakai'}
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-slate-400 block">Ketersediaan:</span>
                    <span className="font-bold text-forest-800">
                      {it.tracking_mode === 'unique_unit'
                        ? `${it.units_available || 0} / ${it.units_total || 0} ${it.unit_of_measure}`
                        : `${it.pool_available || 0} / ${it.pool_total || 0} ${it.unit_of_measure}`}
                    </span>
                  </div>
                </div>
                {canManage && (
                  <div className={`grid gap-2 ${it.tracking_mode === 'unique_unit' ? 'grid-cols-2' : 'grid-cols-3'}`}>
                    {it.tracking_mode !== 'unique_unit' && (
                      <button
                        onClick={() => {
                          setSearch(it.code);
                          setActiveTab('pools');
                        }}
                        className="w-full inline-flex justify-center items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-forest-800 font-semibold text-[11px] transition cursor-pointer"
                        aria-label={`Edit stok ${it.name}`}
                      >
                        <Edit className="w-3 h-3" />
                        Edit Stok
                      </button>
                    )}
                    <button
                      onClick={() => openEditItem(it)}
                      className="w-full inline-flex justify-center items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition cursor-pointer"
                      aria-label={`Edit katalog ${it.name}`}
                    >
                      <Edit className="w-3 h-3" />
                      Edit Katalog
                    </button>
                    <button
                      onClick={() => handleDeleteItem(it)}
                      className="w-full inline-flex justify-center items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-700 font-semibold text-[11px] transition cursor-pointer"
                      aria-label={`Hapus katalog ${it.name}`}
                    >
                      <Trash2 className="w-3 h-3" />
                      Hapus
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
          </div>
          {canManage && showInactiveItems && inactiveItems.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-sm font-bold text-slate-700">Katalog nonaktif</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {inactiveItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-3 p-4 rounded-2xl bg-slate-50 border border-slate-200">
                    <div className="min-w-0">
                      <div className="font-bold text-sm text-slate-800 truncate">{item.name}</div>
                      <div className="text-[10px] font-mono text-slate-500">{item.code}</div>
                    </div>
                    <button
                      onClick={() => handleRestoreItem(item)}
                      className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-white text-slate-700 font-semibold text-[11px]"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Aktifkan
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {/* Tab 2: Unique Physical Assets */}
      {activeTab === 'assets' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {canManage && (
            <div className="flex justify-end px-4 py-3 border-b border-slate-100">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showInactiveAssets}
                  onChange={(e) => setShowInactiveAssets(e.target.checked)}
                  className="rounded border-slate-300 text-forest-800 focus:ring-emerald-500"
                />
                Tampilkan aset nonaktif
              </label>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="rt w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-3.5">Kode Aset & Serial</th>
                  <th className="p-3.5">Nama Barang</th>
                  <th className="p-3.5">Lokasi Simpan</th>
                  <th className="p-3.5">Kondisi</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">{canManage ? 'Aksi' : 'Label QR'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assets.map((asset) => (
                  <tr key={asset.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3.5 font-mono">
                      <div className="font-bold text-slate-900">{asset.asset_code}</div>
                      {asset.serial_number && (
                        <div className="text-[10px] text-slate-400">SN: {asset.serial_number}</div>
                      )}
                    </td>
                    <td className="p-3.5">
                      <div className="font-bold text-slate-800">{asset.item_name}</div>
                      <div className="text-[11px] text-slate-500">{asset.category_name}</div>
                    </td>
                    <td className="p-3.5 text-slate-700">{asset.location_name}</td>
                    <td className="p-3.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold capitalize bg-emerald-100 text-emerald-800">
                        {asset.condition}
                      </span>
                    </td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold capitalize ${
                        asset.status === 'tersedia' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        asset.status === 'dipakai' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                        asset.status === 'dipesan' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-slate-100 text-slate-600'
                      }`}>
                        {asset.status}
                      </span>
                    </td>
                    <td className="p-3.5 text-right">
                      {canManage && asset.status === 'nonaktif' ? (
                        <button
                          onClick={() => handleRestoreAsset(asset)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition cursor-pointer mr-2"
                          title="Aktifkan kembali aset"
                        >
                          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                          <span>Aktifkan</span>
                        </button>
                      ) : canManage && (
                        <button
                          onClick={() => openEditAsset(asset)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition cursor-pointer mr-2"
                          title="Edit data aset"
                        >
                          <Edit className="w-3.5 h-3.5 text-slate-500" />
                          <span>Edit</span>
                        </button>
                      )}
                      {canManage && asset.status !== 'nonaktif' && (
                        <button
                          onClick={() => handleDeleteAsset(asset)}
                          disabled={asset.status !== 'tersedia'}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-red-200 hover:bg-red-50 text-red-700 font-semibold text-[11px] transition cursor-pointer mr-2 disabled:opacity-40 disabled:cursor-not-allowed"
                          title={asset.status === 'tersedia' ? 'Hapus aset dari daftar aktif' : 'Aset yang sedang dipinjam atau dipesan tidak dapat dihapus'}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>Hapus</span>
                        </button>
                      )}
                      <button
                        onClick={() => onOpenLabelModal(asset)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 font-semibold text-[11px] transition cursor-pointer"
                        title="Cetak Label QR"
                      >
                        <Printer className="w-3.5 h-3.5 text-slate-500" />
                        <span>Cetak</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Quantity Pools */}
      {activeTab === 'pools' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="rt w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-3.5">Nama Item Stok</th>
                  <th className="p-3.5">Lokasi Gudang</th>
                  <th className="p-3.5 text-center">Total Stok</th>
                  <th className="p-3.5 text-center">Tersedia</th>
                  <th className="p-3.5 text-center">Dipinjam</th>
                  {canManage && <th className="p-3.5 text-right">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {pools
                  .filter((pool) => {
                    const query = search.trim().toLowerCase();
                    return !query || pool.item_name.toLowerCase().includes(query) ||
                      pool.item_code.toLowerCase().includes(query) ||
                      pool.location_name.toLowerCase().includes(query);
                  })
                  .map((pool) => (
                  <tr key={pool.id} className="hover:bg-slate-50/60 transition">
                    <td className="p-3.5">
                      <div className="font-bold text-slate-900">{pool.item_name}</div>
                      <div className="text-[10px] font-mono text-slate-400">
                        {pool.item_code}
                        {pool.condition === 'rusak' && (
                          <span className="ml-1.5 font-sans font-bold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-700">Rusak</span>
                        )}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-700">{pool.location_name}</td>
                    <td className="p-3.5 text-center font-bold text-slate-900">
                      {pool.quantity_total} {pool.unit_of_measure}
                    </td>
                    <td className="p-3.5 text-center font-bold text-emerald-700">
                      {pool.quantity_available} {pool.unit_of_measure}
                    </td>
                    <td className="p-3.5 text-center font-bold text-amber-700">
                      {pool.quantity_checked_out} {pool.unit_of_measure}
                    </td>
                    {canManage && (
                      <td className="p-3.5 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setSelectedPool(pool);
                              setAdjustData({ new_quantity: pool.quantity_total, reason: '' });
                              setShowAdjustModal(true);
                            }}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-forest-800 font-semibold text-[11px] transition cursor-pointer"
                          >
                            Edit Stok
                          </button>
                          {(() => {
                            const isOnlyPool = pools.filter((entry) => entry.item_type_id === pool.item_type_id).length <= 1;
                            const inUse = pool.quantity_checked_out > 0 || pool.quantity_reserved > 0;
                            const blocked = isOnlyPool || inUse;
                            return (
                              <button
                                onClick={() => setPoolToDelete(pool)}
                                disabled={blocked}
                                title={
                                  isOnlyPool
                                    ? 'Satu-satunya catatan stok barang ini. Gunakan Edit Stok atau hapus barang dari katalog.'
                                    : inUse
                                      ? 'Masih ada stok yang dipesan/dipinjam'
                                      : 'Hapus catatan stok ini'
                                }
                                aria-label={`Hapus catatan stok ${pool.item_name}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed font-semibold text-[11px] transition cursor-pointer"
                              >
                                <Trash2 className="w-3 h-3" />
                                Hapus
                              </button>
                            );
                          })()}
                        </div>
                      </td>
                    )}
                  </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Kits / Packages (e.g. Drone 01 per Blueprint Section 5) */}
      {activeTab === 'kits' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-50/60 border border-emerald-100 kit-banner">
            <p className="text-xs text-emerald-900">
              <span className="font-bold">Paket</span> mengelompokkan alat yang dipakai untuk kegiatan tertentu, misalnya seminar atau liputan.
              Komponennya diambil dari katalog dan aset yang sudah terdaftar.
            </p>
            {canManage && (
              <button
                onClick={openCreateKit}
                className="flex-shrink-0 inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Buat Paket Baru</span>
              </button>
            )}
          </div>
          {kits.length === 0 && (
            <div className="p-8 text-center text-xs text-slate-500 rounded-2xl border border-dashed border-slate-200">
              Belum ada paket. {canManage ? 'Klik "Buat Paket Baru" untuk mulai mengelompokkan alat.' : ''}
            </div>
          )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {kits.map((kit) => (
            <div key={kit.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-xs text-forest-800 bg-emerald-50 px-2 py-0.5 rounded">
                      {kit.kit_code}
                    </span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full capitalize bg-emerald-100 text-emerald-800">
                      {kit.status.replace('_', ' ')}
                    </span>
                  </div>
                  <h3 className="font-bold text-base text-slate-900 mt-1">{kit.name}</h3>
                  <p className="text-xs text-slate-500">{kit.location_name} • {kit.components?.length || 0} komponen</p>
                  {kit.notes && <p className="text-[11px] text-slate-400 mt-0.5 line-clamp-2">{kit.notes}</p>}
                </div>
                {canManage && (
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    <button
                      onClick={() => openEditKit(kit)}
                      disabled={kit.status === 'dipakai'}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-semibold text-[11px] transition cursor-pointer"
                      title={kit.status === 'dipakai' ? 'Paket sedang dipakai dan tidak dapat diedit' : 'Edit paket dan isinya'}
                    >
                      <Edit className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => setKitToDelete(kit)}
                      disabled={kit.status === 'dipakai'}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 disabled:opacity-40 disabled:cursor-not-allowed text-rose-600 font-semibold text-[11px] transition cursor-pointer"
                      title={kit.status === 'dipakai' ? 'Paket sedang dipakai dan tidak dapat dihapus' : 'Hapus paket'}
                      aria-label={`Hapus paket ${kit.name}`}
                    >
                      <Trash2 className="w-3 h-3" />
                      Hapus
                    </button>
                  </div>
                )}
              </div>

              {/* Components Breakdown */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700 block">Isi Paket:</span>
                <div className="space-y-1.5">
                  {kit.components?.map((c) => (
                    <div key={c.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                      <span className="font-medium text-slate-800">
                        {c.component_name} {c.asset_code && <span className="font-mono text-slate-400">({c.asset_code})</span>}
                      </span>
                      <span className="font-mono font-bold text-slate-600">
                        {c.quantity} unit • <span className="text-emerald-700 capitalize">{c.condition}</span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
        </div>
      )}

      {/* Modal: Import Catalog CSV */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Import Katalog Barang</h3>
                <p className="text-[11px] text-slate-500 mt-1">Impor CSV akan membuat katalog dan stok awal secara sekaligus.</p>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-emerald-50 border border-emerald-100">
              <div className="text-xs text-emerald-900">
                <p className="font-bold">1. Unduh template, isi di Excel, lalu simpan sebagai CSV UTF-8.</p>
                <p className="mt-1 text-[11px]">File .xlsx perlu disimpan sebagai .csv sebelum diunggah.</p>
              </div>
              <button
                type="button"
                onClick={handleDownloadImportTemplate}
                className="flex-shrink-0 inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-white border border-emerald-200 text-emerald-900 text-xs font-semibold hover:bg-emerald-100"
              >
                <Download className="w-4 h-4" />
                Unduh Template CSV
              </button>
            </div>

            <div className="space-y-2 text-[11px] text-slate-600">
              <p><strong>Kolom wajib:</strong> nama_barang, kode_katalog, kode_kategori, merek_model, satuan, mode_pelacakan, spesifikasi, stok_awal, kode_lokasi, kondisi_stok.</p>
              <p><strong>Kolom opsional:</strong> kelengkapan — pisahkan dengan <span className="font-mono">|</span>, jumlah setelah titik dua (default 1). Contoh: <span className="font-mono">Charger kamera|Baterai:2|Lensa kit</span>. Kelengkapan hanya menjadi keterangan barang, bukan katalog atau aset baru.</p>
              <p><strong>Mode:</strong> unique_unit, quantity_pool, atau consumable. unique_unit harus stok_awal 0 dan unit fisiknya didaftarkan terpisah.</p>
              <p><strong>Kondisi stok:</strong> baik atau rusak. Untuk stok kuantitas, kode_lokasi harus menunjuk lokasi aktif.</p>
              <div>
                <p className="font-semibold text-slate-700">Kode kategori aktif:</p>
                <p className="font-mono break-words">{categories.filter((category) => category.is_active).map((category) => `${category.code} (${category.name})`).join(', ') || 'Belum ada kategori aktif.'}</p>
              </div>
              <div>
                <p className="font-semibold text-slate-700">Kode lokasi aktif:</p>
                <p className="font-mono break-words">{locations.filter((location) => location.is_active).map((location) => `${location.code} (${location.name})`).join(', ') || 'Belum ada lokasi aktif.'}</p>
              </div>
            </div>

            <div>
              <label className="block font-semibold text-slate-700 text-xs mb-1">2. Pilih file CSV:</label>
              <input
                ref={importFileRef}
                type="file"
                accept=".csv,text/csv"
                onChange={(e) => handleImportFile(e.target.files?.[0])}
                className="block w-full text-xs text-slate-600 file:mr-3 file:px-3 file:py-2 file:rounded-lg file:border-0 file:bg-slate-100 file:text-slate-700 file:font-semibold hover:file:bg-slate-200"
              />
              {importFileName && <p className="mt-1 text-[11px] text-slate-500">{importFileName}</p>}
            </div>

            {importRows.length > 0 && (
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                <p className="font-semibold text-slate-800">{importRows.length} baris siap diimpor.</p>
                <p className="text-slate-500 mt-1">Impor dibatalkan seluruhnya jika ditemukan baris tidak valid atau kode duplikat.</p>
              </div>
            )}
            {importError && (
              <div role="alert" className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                {importError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleImportItems}
                disabled={!importRows.length || importing}
                className="px-4 py-2 bg-forest-800 hover:bg-forest-900 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl"
              >
                {importing ? 'Mengimpor...' : `Import ${importRows.length || ''} Barang`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Kit (activity package) */}
      {showEditKitModal && (editingKit || isCreatingKit) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-3xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 sm:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3 border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{editingKit ? 'Edit Paket' : 'Buat Paket Baru'}</h3>
                <p className="text-[11px] text-slate-500 mt-1">
                  Paket mengelompokkan alat untuk satu kegiatan (misalnya Seminar). Komponen dipilih dari katalog dan aset yang sudah terdaftar.
                </p>
              </div>
              <button onClick={closeKitModal} className="text-slate-400 hover:text-slate-600" aria-label="Tutup">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveKit} className="space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Paket:</label>
                  <input
                    required
                    value={kitForm.name}
                    onChange={(e) => setKitForm({ ...kitForm, name: e.target.value })}
                    placeholder="Contoh: Paket Seminar"
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Paket / QR:</label>
                  <input
                    required={!!editingKit}
                    value={kitForm.kit_code}
                    onChange={(e) => setKitForm({ ...kitForm, kit_code: e.target.value.toUpperCase() })}
                    placeholder={editingKit ? '' : 'Kosongkan untuk dibuat otomatis'}
                    className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lokasi Penyimpanan:</label>
                <select
                  required
                  value={kitForm.location_id}
                  onChange={(e) => setKitForm({ ...kitForm, location_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">Pilih lokasi</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </select>
              </div>

              {/* Catalog picker */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <div className="p-3 bg-slate-50 border-b border-slate-200 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800">Pilih dari Katalog</h4>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-500 hidden sm:inline">{kitCatalog.items.length} barang terdaftar</span>
                      <button
                        type="button"
                        onClick={() => setShowKitScanner(true)}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-forest-800 hover:bg-forest-900 text-white font-semibold cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        Scan QR
                      </button>
                    </div>
                  </div>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={kitPickerSearch}
                      onChange={(e) => setKitPickerSearch(e.target.value)}
                      placeholder="Cari nama, kode, atau merek barang..."
                      className="w-full pl-8 pr-3 py-2 border rounded-lg bg-white focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>
                </div>
                <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                  {kitPickerItems.length === 0 && (
                    <p className="p-4 text-center text-slate-500">
                      {kitCatalog.items.length === 0
                        ? 'Katalog masih kosong. Daftarkan barang terlebih dahulu.'
                        : 'Tidak ada barang yang cocok.'}
                    </p>
                  )}
                  {kitPickerItems.map((item) => {
                    const addedQty = kitForm.components
                      .filter((component) => component.item_type_id === String(item.id))
                      .reduce((sum, component) => sum + component.quantity, 0);
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-slate-800 truncate">{item.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono truncate">
                            {item.code} · {item.category_name}
                            {item.tracking_mode === 'unique_unit'
                              ? ` · ${item.units_available || 0} unit tersedia`
                              : ` · stok ${item.pool_available || 0} ${item.unit_of_measure}`}
                          </div>
                        </div>
                        {addedQty > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                            {addedQty} di paket
                          </span>
                        )}
                        <button
                          type="button"
                          onClick={() => addKitComponent(item)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-forest-800 font-semibold hover:bg-emerald-100 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          Tambah
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Components in this package */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800">Isi Paket ({kitForm.components.length} komponen)</h4>
                  {kitForm.components.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setKitForm({ ...kitForm, components: [] })}
                      className="text-[11px] font-semibold text-slate-500 hover:text-rose-600 cursor-pointer"
                    >
                      Kosongkan
                    </button>
                  )}
                </div>

                {kitForm.components.length === 0 && (
                  <p className="p-4 text-center text-slate-500 border border-dashed rounded-xl">
                    Belum ada komponen. Pilih barang dari katalog di atas.
                  </p>
                )}

                {kitForm.components.map((component, index) => {
                  const item = kitCatalog.items.find((entry) => String(entry.id) === component.item_type_id);
                  const isUnique = item?.tracking_mode === 'unique_unit';
                  const unitOptions = kitCatalog.assets.filter(
                    (asset) =>
                      String(asset.item_type_id) === component.item_type_id &&
                      (asset.status === 'tersedia' || String(asset.id) === component.asset_unit_id)
                  );
                  const takenUnits = new Set(
                    kitForm.components.filter((_, i) => i !== index).map((entry) => entry.asset_unit_id).filter(Boolean)
                  );
                  const update = (patch: Partial<KitComponentForm>) =>
                    setKitForm({
                      ...kitForm,
                      components: kitForm.components.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)),
                    });
                  return (
                    <div key={index} className="p-3 border border-slate-200 rounded-xl">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="font-bold text-slate-800 truncate">{component.component_name || item?.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono">
                            {item ? item.code : (
                              <span className="text-amber-700 font-sans font-semibold">Belum tertaut ke katalog (data lama)</span>
                            )}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => setKitForm({
                            ...kitForm,
                            components: kitForm.components.filter((_, i) => i !== index),
                          })}
                          className="p-1.5 text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                          aria-label={`Hapus komponen ${component.component_name || index + 1}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {isUnique && (
                          <div className="col-span-2">
                            <label className="block font-medium text-slate-600 mb-1">Unit spesifik (opsional):</label>
                            <select
                              value={component.asset_unit_id}
                              onChange={(e) => update({
                                asset_unit_id: e.target.value,
                                quantity: e.target.value ? 1 : component.quantity,
                              })}
                              className="w-full px-2.5 py-2 border rounded-lg bg-white"
                            >
                              <option value="">Tanpa unit tertentu</option>
                              {unitOptions.map((asset) => (
                                <option key={asset.id} value={asset.id} disabled={takenUnits.has(String(asset.id))}>
                                  {asset.asset_code}{asset.serial_number ? ` · SN ${asset.serial_number}` : ''}
                                  {takenUnits.has(String(asset.id)) ? ' (sudah di paket)' : ''}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                        <div>
                          <label className="block font-medium text-slate-600 mb-1">Jumlah:</label>
                          <input
                            type="number"
                            min="1"
                            required
                            disabled={!!component.asset_unit_id}
                            value={component.quantity}
                            onChange={(e) => update({ quantity: Math.max(1, Number(e.target.value) || 1) })}
                            className="w-full px-2.5 py-2 border rounded-lg font-mono disabled:bg-slate-50 disabled:text-slate-400"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-slate-600 mb-1">Kondisi:</label>
                          <select
                            value={component.condition}
                            onChange={(e) => update({ condition: e.target.value as 'baik' | 'rusak' })}
                            className="w-full px-2.5 py-2 border rounded-lg bg-white"
                          >
                            <option value="baik">Baik</option>
                            <option value="rusak">Rusak</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan:</label>
                <textarea
                  rows={2}
                  value={kitForm.notes}
                  onChange={(e) => setKitForm({ ...kitForm, notes: e.target.value })}
                  placeholder="Keterangan kegiatan atau catatan penggunaan paket..."
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={closeKitModal} className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800">
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={savingKit}
                  className="px-4 py-2 bg-forest-800 hover:bg-forest-900 disabled:opacity-60 text-white font-semibold rounded-xl"
                >
                  {savingKit ? 'Menyimpan...' : editingKit ? 'Simpan Paket' : 'Buat Paket'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Scanner for adding assets to the kit (rendered after the kit modal so it stacks on top) */}
      <QRScannerModal
        isOpen={showKitScanner}
        onClose={() => setShowKitScanner(false)}
        onSelectResult={() => {}}
        mode="asset-selection"
        onSelectAsset={addKitAssetFromScan}
        listName="daftar paket"
      />

      {/* Modal: Confirm delete stock pool */}
      {poolToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-sm">Hapus catatan stok ini?</h3>
                <p className="text-xs text-slate-600 mt-1">
                  <span className="font-semibold">{poolToDelete.item_name}</span> di {poolToDelete.location_name}
                  {poolToDelete.condition === 'rusak' ? ' (kondisi rusak)' : ''} dengan stok{' '}
                  <strong>{poolToDelete.quantity_total} {poolToDelete.unit_of_measure}</strong> akan dihapus.
                  Penghapusan tercatat di riwayat pergerakan stok dan log audit. Barang di katalog tidak ikut terhapus.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setPoolToDelete(null)}
                disabled={deletingPool}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleDeletePool}
                disabled={deletingPool}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold cursor-pointer"
              >
                {deletingPool ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Confirm delete kit */}
      {kitToDelete && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="min-w-0">
                <h3 className="font-bold text-slate-900 text-sm">Hapus paket ini?</h3>
                <p className="text-xs text-slate-600 mt-1">
                  Paket <span className="font-semibold">{kitToDelete.name}</span> ({kitToDelete.kit_code}) akan dihapus.
                  Barang dan aset di dalamnya <strong>tidak ikut terhapus</strong>, dan riwayat transaksi tetap tersimpan.
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2 text-xs">
              <button
                onClick={() => setKitToDelete(null)}
                disabled={deletingKit}
                className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800 cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={handleDeleteKit}
                disabled={deletingKit}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 disabled:opacity-60 text-white font-semibold cursor-pointer"
              >
                {deletingKit ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      <WarehouseModal
        isOpen={showWarehouseModal}
        onClose={() => setShowWarehouseModal(false)}
        onChanged={loadAll}
      />
      <ReconcileModal
        isOpen={showReconcileModal}
        onClose={() => setShowReconcileModal(false)}
        onApplied={loadAll}
      />

      {/* Modal: Manage Categories */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 sm:p-6 space-y-5">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Kelola Kategori Katalog</h3>
                <p className="text-[11px] text-slate-500 mt-1">Kategori yang dinonaktifkan tetap tersimpan pada katalog lama.</p>
              </div>
              <button
                onClick={() => {
                  setShowCategoryModal(false);
                  resetCategoryForm();
                }}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Tutup"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3 text-xs">
              <h4 className="font-bold text-slate-800">{editingCategoryId ? 'Edit Kategori' : 'Tambah Kategori'}</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Kategori:</label>
                  <input
                    required
                    value={categoryForm.name}
                    onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                    placeholder="Contoh: Peralatan Audio"
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Kategori:</label>
                  <input
                    required
                    value={categoryForm.code}
                    onChange={(e) => setCategoryForm({ ...categoryForm, code: e.target.value.toUpperCase() })}
                    placeholder="Contoh: AUDIO"
                    className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi (opsional):</label>
                <input
                  value={categoryForm.description}
                  onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>
              <div className="flex justify-end gap-2">
                {editingCategoryId && (
                  <button
                    type="button"
                    onClick={resetCategoryForm}
                    className="px-3 py-2 font-semibold text-slate-600 hover:text-slate-800"
                  >
                    Batal Edit
                  </button>
                )}
                <button
                  type="submit"
                  disabled={savingCategory}
                  className="px-4 py-2 bg-forest-800 hover:bg-forest-900 disabled:opacity-50 text-white font-semibold rounded-xl"
                >
                  {savingCategory ? 'Menyimpan...' : editingCategoryId ? 'Simpan Kategori' : 'Tambah Kategori'}
                </button>
              </div>
            </form>

            <div className="space-y-2">
              <h4 className="font-bold text-xs text-slate-800">Daftar Kategori</h4>
              {categories.length === 0 ? (
                <p className="p-4 text-xs text-slate-500 text-center border border-dashed rounded-xl">Belum ada kategori.</p>
              ) : categories.map((category) => (
                <div key={category.id} className="flex items-center gap-3 p-3 rounded-xl border border-slate-200">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-xs text-slate-900 truncate">{category.name}</span>
                      <span className="font-mono text-[10px] text-slate-500">{category.code}</span>
                      {!category.is_active && (
                        <span className="px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[9px] font-bold">NONAKTIF</span>
                      )}
                    </div>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {category.item_count || 0} katalog aktif{category.description ? ` · ${category.description}` : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingCategoryId(category.id);
                      setCategoryForm({
                        name: category.name,
                        code: category.code,
                        description: category.description || '',
                      });
                    }}
                    className="p-2 rounded-lg text-slate-600 hover:bg-slate-100"
                    aria-label={`Edit ${category.name}`}
                    title="Edit kategori"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleToggleCategory(category)}
                    className={`p-2 rounded-lg ${category.is_active ? 'text-rose-600 hover:bg-rose-50' : 'text-emerald-700 hover:bg-emerald-50'}`}
                    aria-label={category.is_active ? `Nonaktifkan ${category.name}` : `Aktifkan ${category.name}`}
                    title={category.is_active ? 'Nonaktifkan kategori' : 'Aktifkan kembali kategori'}
                  >
                    {category.is_active ? <Trash2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Item Type */}
      {showAddItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-lg max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">{editingItemId ? 'Edit Katalog Barang' : 'Tambah Jenis Barang Baru'}</h3>
              <button
                onClick={() => {
                  setShowAddItemModal(false);
                  setEditingItemId(null);
                }}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateItem} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Barang:</label>
                <input
                  type="text"
                  required
                  value={newItem.name}
                  onChange={(e) => setNewItem({ ...newItem, name: e.target.value, code: '' })}
                  placeholder="Contoh: Kamera Mirrorless Sony A7 IV"
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kategori:</label>
                <select
                  required
                  value={newItem.category_id}
                  onChange={(e) => setNewItem({ ...newItem, category_id: e.target.value, code: '' })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Pilih Kategori</option>
                  {categories.filter((category) => category.is_active).map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block font-semibold text-slate-700">Kode Unik Katalog:</label>
                    <button
                      type="button"
                      onClick={handleGenerateItemCode}
                      disabled={generatingCode || !newItem.name.trim() || !newItem.category_id}
                      className="inline-flex items-center gap-1 text-[10px] font-semibold text-forest-800 hover:text-forest-900 disabled:text-slate-400 disabled:cursor-not-allowed"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      {generatingCode ? 'Membuat...' : 'Generate Otomatis'}
                    </button>
                  </div>
                  <input
                    type="text"
                    required
                    value={newItem.code}
                    onChange={(e) => setNewItem({ ...newItem, code: e.target.value })}
                    placeholder="Pilih kategori dan isi nama untuk generate"
                    className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500 uppercase"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Kode disusun dari kode kategori, nama barang, dan nomor urut unik. Kode tetap bisa diedit.</p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Merek / Model:</label>
                  <input
                    type="text"
                    value={newItem.brand_model}
                    onChange={(e) => setNewItem({ ...newItem, brand_model: e.target.value })}
                    placeholder="Sony Alpha A7 IV"
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Satuan:</label>
                  <input
                    type="text"
                    value={newItem.unit_of_measure}
                    onChange={(e) => setNewItem({ ...newItem, unit_of_measure: e.target.value })}
                    placeholder="Unit / Buah / Pack"
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mode Pelacakan:</label>
                <select
                  value={newItem.tracking_mode}
                  onChange={(e) => setNewItem({ ...newItem, tracking_mode: e.target.value as any })}
                  disabled={!!editingItemId}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="unique_unit">Unit Unik (Barcode / QR per unit fisik)</option>
                  <option value="quantity_pool">Kuantitas Dapat Kembali (Jumlah pool stok)</option>
                  <option value="consumable">Habis Pakai (Pengeluaran langsung)</option>
                </select>
                {editingItemId && <p className="text-[10px] text-slate-500 mt-1">Mode pelacakan dikunci saat edit agar data stok dan aset tetap konsisten.</p>}
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Spesifikasi Singkat:</label>
                <textarea
                  rows={2}
                  value={newItem.specs}
                  onChange={(e) => setNewItem({ ...newItem, specs: e.target.value })}
                  placeholder="Sensor 33MP, lensa 24-70mm f/2.8 GM..."
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              {/* Kelengkapan (optional, descriptive only) */}
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <button
                  type="button"
                  onClick={() => setShowAccessoryEditor((open) => !open)}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2.5 bg-slate-50 hover:bg-slate-100 text-left cursor-pointer"
                  aria-expanded={showAccessoryEditor}
                >
                  <span>
                    <span className="font-semibold text-slate-700">Kelengkapan</span>
                    <span className="text-slate-400"> (opsional)</span>
                    {newItem.accessories.length > 0 && (
                      <span className="ml-2 text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                        {newItem.accessories.length}
                      </span>
                    )}
                  </span>
                  <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${showAccessoryEditor ? 'rotate-180' : ''}`} />
                </button>
                {showAccessoryEditor && (
                  <div className="p-3 space-y-2.5">
                    <p className="text-[10px] text-slate-500">
                      Catat perlengkapan bawaan barang ini, misalnya charger atau baterai. Kelengkapan hanya menjadi keterangan —
                      <strong> tidak dibuat sebagai katalog atau aset</strong>. Jika perlu dipinjam terpisah, daftarkan sebagai barang sendiri.
                    </p>
                    {newItem.accessories.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {newItem.accessories.map((accessory) => (
                          <span
                            key={accessory.name}
                            className="inline-flex items-center gap-1 pl-2.5 pr-1 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-forest-800 font-medium"
                          >
                            {accessory.name}{accessory.quantity > 1 ? ` ×${accessory.quantity}` : ''}
                            <button
                              type="button"
                              onClick={() => removeAccessory(accessory.name)}
                              className="p-0.5 rounded-full hover:bg-emerald-100 cursor-pointer"
                              aria-label={`Hapus kelengkapan ${accessory.name}`}
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={accessoryDraft.name}
                        onChange={(e) => setAccessoryDraft({ ...accessoryDraft, name: e.target.value })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            addAccessory(accessoryDraft.name, accessoryDraft.quantity);
                          }
                        }}
                        maxLength={80}
                        placeholder="Contoh: Charger kamera"
                        className="flex-1 min-w-0 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                      />
                      <input
                        type="number"
                        min="1"
                        max="99"
                        value={accessoryDraft.quantity}
                        onChange={(e) => setAccessoryDraft({ ...accessoryDraft, quantity: Math.max(1, Number(e.target.value) || 1) })}
                        className="w-16 px-2 py-2 border rounded-lg font-mono text-center"
                        aria-label="Jumlah"
                      />
                      <button
                        type="button"
                        onClick={() => addAccessory(accessoryDraft.name, accessoryDraft.quantity)}
                        disabled={!accessoryDraft.name.trim()}
                        className="px-3 py-2 rounded-lg bg-forest-800 hover:bg-forest-900 disabled:opacity-40 text-white font-semibold cursor-pointer"
                      >
                        Tambah
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {ACCESSORY_SUGGESTIONS.filter(
                        (suggestion) => !newItem.accessories.some((a) => a.name.toLowerCase() === suggestion.toLowerCase())
                      ).map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => addAccessory(suggestion)}
                          className="px-2 py-1 rounded-full border border-dashed border-slate-300 text-[11px] text-slate-600 hover:border-emerald-400 hover:text-forest-800 hover:bg-emerald-50 cursor-pointer"
                        >
                          + {suggestion}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddItemModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-forest-800 hover:bg-forest-900 text-white font-semibold rounded-xl"
                >
                  {editingItemId ? 'Simpan Perubahan Katalog' : 'Simpan Jenis Barang'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Add Physical Asset Unit */}
      {showAddAssetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Registrasi Unit Aset Fisik Baru</h3>
              <button onClick={() => setShowAddAssetModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateAsset} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jenis Barang:</label>
                <select
                  required
                  value={newAsset.item_type_id}
                  onChange={(e) => setNewAsset({ ...newAsset, item_type_id: e.target.value, serial_number: '' })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Pilih Jenis Barang</option>
                  {items.filter(i => i.tracking_mode === 'unique_unit').map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jumlah Unit Fisik:</label>
                <input
                  type="number"
                  required
                  min={1}
                  max={500}
                  step={1}
                  value={newAsset.quantity}
                  onChange={(e) => setNewAsset({
                    ...newAsset,
                    quantity: Number(e.target.value),
                    serial_number: e.target.value === '1' ? newAsset.serial_number : '',
                  })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Kode aset dibuat otomatis dari kode katalog (contoh: {items.find((item) => String(item.id) === newAsset.item_type_id)?.code || 'KODE-KATALOG'}-001), berurutan untuk setiap unit. Maksimal 500 per pendaftaran.
                </p>
              </div>
              {newAsset.quantity === 1 && (
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor Seri Pabrik (opsional):</label>
                  <input
                    type="text"
                    value={newAsset.serial_number}
                    onChange={(e) => setNewAsset({ ...newAsset, serial_number: e.target.value })}
                    placeholder="SN-XXXX"
                    className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}
              <p className="rounded-lg bg-slate-50 p-2 text-[10px] text-slate-600">
                Barang yang cukup dilacak berdasarkan jumlah, seperti kursi identik, tidak perlu didaftarkan sebagai unit fisik. Gunakan mode <strong>Stok Kuantitas</strong> pada katalog.
              </p>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lokasi Penyimpanan:</label>
                <select
                  required
                  value={newAsset.location_id}
                  onChange={(e) => setNewAsset({ ...newAsset, location_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Pilih Lokasi</option>
                  {locations.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kondisi Awal:</label>
                <select
                  value={newAsset.condition}
                  onChange={(e) => setNewAsset({ ...newAsset, condition: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="baik">Kondisi Baik</option>
                  <option value="rusak_ringan">Rusak Ringan</option>
                  <option value="perawatan">Dalam Perawatan</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddAssetModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-forest-800 hover:bg-forest-900 text-white font-semibold rounded-xl"
                >
                  Registrasi {newAsset.quantity > 0 ? newAsset.quantity : ''} Unit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingAsset && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Edit Data Aset Fisik</h3>
                <p className="text-[10px] text-slate-500 mt-1">Status transaksi tidak dapat diubah dari formulir ini.</p>
              </div>
              <button onClick={() => setEditingAsset(null)} className="text-slate-400 hover:text-slate-600" aria-label="Tutup">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleUpdateAsset} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jenis Barang:</label>
                <select
                  required
                  value={assetEditForm.item_type_id}
                  onChange={(e) => setAssetEditForm({ ...assetEditForm, item_type_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Pilih Jenis Barang</option>
                  {assetCatalogItems.map((item) => (
                    <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kode Aset:</label>
                <input
                  type="text"
                  required
                  value={assetEditForm.asset_code}
                  onChange={(e) => setAssetEditForm({ ...assetEditForm, asset_code: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">QR aset akan mengikuti kode yang disimpan.</p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nomor Seri Pabrik (opsional):</label>
                <input
                  type="text"
                  value={assetEditForm.serial_number}
                  onChange={(e) => setAssetEditForm({ ...assetEditForm, serial_number: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lokasi Penyimpanan:</label>
                <select
                  required
                  value={assetEditForm.location_id}
                  disabled={editingAsset.status === 'dipakai' || editingAsset.status === 'dipesan'}
                  onChange={(e) => setAssetEditForm({ ...assetEditForm, location_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  <option value="">Pilih Lokasi</option>
                  {locations.map((location) => (
                    <option key={location.id} value={location.id}>{location.name}</option>
                  ))}
                </select>
                {(editingAsset.status === 'dipakai' || editingAsset.status === 'dipesan') && (
                  <p className="text-[10px] text-amber-700 mt-1">Lokasi tidak dapat diubah saat aset sedang dipinjam atau dipesan.</p>
                )}
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Kondisi:</label>
                <select
                  value={assetEditForm.condition}
                  onChange={(e) => setAssetEditForm({ ...assetEditForm, condition: e.target.value as AssetUnit['condition'] })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="baik">Baik</option>
                  <option value="rusak_ringan">Rusak Ringan</option>
                  <option value="rusak_berat">Rusak Berat</option>
                  <option value="perawatan">Dalam Perawatan</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setEditingAsset(null)} className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800">
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 bg-forest-800 hover:bg-forest-900 text-white font-semibold rounded-xl">
                  Simpan Perubahan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adjust Stock Pool */}
      {showAdjustModal && selectedPool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto p-2 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md max-h-[calc(100dvh-1rem)] sm:max-h-[calc(100dvh-2rem)] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 p-4 sm:p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Penyesuaian Stok Kuantitas</h3>
              <button onClick={() => setShowAdjustModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAdjustStock} className="space-y-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl">
                <div className="font-bold text-slate-900">{selectedPool.item_name}</div>
                <div className="text-slate-500">
                  Total: {selectedPool.quantity_total} {selectedPool.unit_of_measure}
                  {' · '}Tersedia: {selectedPool.quantity_available}
                  {' · '}Dipesan: {selectedPool.quantity_reserved}
                  {' · '}Dipinjam: {selectedPool.quantity_checked_out}
                </div>
                <p className="text-[10px] text-slate-500 mt-1">Jumlah total baru tidak dapat lebih kecil dari stok yang sedang dipesan atau dipinjam.</p>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Jumlah Total Baru:</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={adjustData.new_quantity}
                  onChange={(e) => setAdjustData({ ...adjustData, new_quantity: Number(e.target.value) })}
                  className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Alasan Penyesuaian (Wajib Audit):</label>
                <textarea
                  rows={2}
                  required
                  value={adjustData.reason}
                  onChange={(e) => setAdjustData({ ...adjustData, reason: e.target.value })}
                  placeholder="Contoh: Stok opname fisik semester II / penambahan unit pengadaan baru"
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-forest-800 hover:bg-forest-900 text-white font-semibold rounded-xl"
                >
                  Simpan Perubahan Stok
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
