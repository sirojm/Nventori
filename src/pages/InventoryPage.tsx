import React, { useState, useEffect } from 'react';
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
  Trash2
} from 'lucide-react';
import { api } from '../services/api';
import { ItemType, AssetUnit, StockPool, AssetKit, Category, Location } from '../types';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

interface InventoryPageProps {
  onOpenLabelModal: (asset: AssetUnit) => void;
}

interface KitComponentForm {
  component_name: string;
  item_type_id: string;
  asset_unit_id: string;
  quantity: number;
  condition: 'baik' | 'rusak';
  is_required: number;
}

export const InventoryPage: React.FC<InventoryPageProps> = ({ onOpenLabelModal }) => {
  const { user } = useAuth();
  const { success, error } = useToast();

  const [activeTab, setActiveTab] = useState<'items' | 'assets' | 'pools' | 'kits'>('items');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

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
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [showEditKitModal, setShowEditKitModal] = useState(false);
  const [selectedPool, setSelectedPool] = useState<StockPool | null>(null);
  const [editingKit, setEditingKit] = useState<AssetKit | null>(null);
  const [kitForm, setKitForm] = useState({
    name: '',
    kit_code: '',
    location_id: '',
    notes: '',
    components: [] as KitComponentForm[],
  });
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [savingCategory, setSavingCategory] = useState(false);
  const [generatingCode, setGeneratingCode] = useState(false);
  const [categoryForm, setCategoryForm] = useState({ name: '', code: '', description: '' });

  // Form states
  const [newItem, setNewItem] = useState({
    name: '',
    code: '',
    category_id: '',
    brand_model: '',
    unit_of_measure: 'Unit',
    specs: '',
    tracking_mode: 'unique_unit' as 'unique_unit' | 'quantity_pool' | 'consumable',
  });

  const [newAsset, setNewAsset] = useState({
    item_type_id: '',
    asset_code: '',
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
        api.getAssets({ search }),
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
  }, [search, categoryFilter]);

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
      const payload = {
        ...newItem,
        category_id: Number(newItem.category_id),
      };
      const res = editingItemId
        ? await api.updateItem(editingItemId, payload)
        : await api.createItem(payload);
      if (res.success) {
        success(res.message);
        setShowAddItemModal(false);
        setEditingItemId(null);
        setNewItem({
          name: '',
          code: '',
          category_id: '',
          brand_model: '',
          unit_of_measure: 'Unit',
          specs: '',
          tracking_mode: 'unique_unit',
        });
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
    });
    setShowAddItemModal(true);
  };

  const openEditKit = (kit: AssetKit) => {
    setEditingKit(kit);
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
  };

  const handleSaveKit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingKit || !kitForm.name.trim() || !kitForm.kit_code.trim() || !kitForm.location_id) {
      error('Nama paket, kode, dan lokasi wajib diisi.');
      return;
    }

    try {
      const res = await api.updateKit(editingKit.id, {
        ...kitForm,
        location_id: Number(kitForm.location_id),
        components: kitForm.components.map((component) => ({
          ...component,
          item_type_id: component.item_type_id ? Number(component.item_type_id) : null,
          asset_unit_id: component.asset_unit_id ? Number(component.asset_unit_id) : null,
        })),
      });
      if (res.success) {
        success(res.message);
        setShowEditKitModal(false);
        setEditingKit(null);
        await loadAll();
      }
    } catch (err: any) {
      error(err.message || 'Gagal memperbarui paket.');
    }
  };

  const handleCreateAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAsset.item_type_id || !newAsset.asset_code || !newAsset.location_id) {
      error('Harap lengkapi barang, kode aset, dan lokasi simpan.');
      return;
    }
    try {
      const res = await api.createAsset({
        ...newAsset,
        item_type_id: Number(newAsset.item_type_id),
        location_id: Number(newAsset.location_id),
      });
      if (res.success) {
        success(res.message);
        setShowAddAssetModal(false);
        setNewAsset({
          item_type_id: '',
          asset_code: '',
          serial_number: '',
          location_id: '',
          condition: 'baik',
          notes: '',
        });
        loadAll();
      }
    } catch (err: any) {
      error(err.message || 'Gagal menambahkan unit fisik.');
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
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Katalog & Master Inventaris</h2>
          <p className="text-xs text-slate-500">Kelola jenis barang, unit aset unik, stok kuantitas, dan paket kelengkapan</p>
        </div>

        {canManage && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowCategoryModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <Tags className="w-4 h-4 text-slate-500" />
              <span>Kelola Kategori</span>
            </button>
            <button
              onClick={() => {
                setEditingItemId(null);
                setNewItem({
                  name: '',
                  code: '',
                  category_id: '',
                  brand_model: '',
                  unit_of_measure: 'Unit',
                  specs: '',
                  tracking_mode: 'unique_unit',
                });
                setShowAddItemModal(true);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-800 text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-500" />
              <span>Tambah Jenis Barang</span>
            </button>
            <button
              onClick={() => setShowAddAssetModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-sm transition cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Registrasi Unit Fisik</span>
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 overflow-x-auto pb-px">
        {[
          { id: 'items', label: 'Jenis Barang & Katalog', icon: Package, count: items.length },
          { id: 'assets', label: 'Unit Aset Fisik Unik', icon: Box, count: assets.length },
          { id: 'pools', label: 'Stok Kuantitas & Habis Pakai', icon: Layers, count: pools.length },
          { id: 'kits', label: 'Paket Kelengkapan (Kits)', icon: SlidersHorizontal, count: kits.length },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 text-xs font-bold border-b-2 transition whitespace-nowrap cursor-pointer ${
                isActive
                  ? 'border-forest-800 text-forest-800'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
              <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${isActive ? 'bg-emerald-100 text-forest-800' : 'bg-slate-100 text-slate-500'}`}>
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
                  <div className={`grid gap-2 ${it.tracking_mode === 'unique_unit' ? 'grid-cols-1' : 'grid-cols-2'}`}>
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
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Unique Physical Assets */}
      {activeTab === 'assets' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-semibold">
                  <th className="p-3.5">Kode Aset & Serial</th>
                  <th className="p-3.5">Nama Barang</th>
                  <th className="p-3.5">Lokasi Simpan</th>
                  <th className="p-3.5">Kondisi</th>
                  <th className="p-3.5">Status</th>
                  <th className="p-3.5 text-right">Label QR</th>
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
            <table className="w-full text-xs text-left">
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
                      <div className="text-[10px] font-mono text-slate-400">{pool.item_code}</div>
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
                      <td className="p-3.5 text-right">
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
                  <p className="text-xs text-slate-500">{kit.template_name} • {kit.location_name}</p>
                </div>
                {canManage && (
                  <button
                    onClick={() => openEditKit(kit)}
                    disabled={kit.status === 'dipakai'}
                    className="inline-flex flex-shrink-0 items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed text-slate-700 font-semibold text-[11px] transition cursor-pointer"
                    title={kit.status === 'dipakai' ? 'Paket sedang dipakai dan tidak dapat diedit' : 'Edit paket dan kelengkapannya'}
                  >
                    <Edit className="w-3 h-3" />
                    Edit Paket
                  </button>
                )}
              </div>

              {/* Components Breakdown */}
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <span className="text-xs font-bold text-slate-700 block">Komponen Manifest Wajib:</span>
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
      )}

      {/* Modal: Edit Kit */}
      {showEditKitModal && editingKit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <div>
                <h3 className="font-bold text-slate-900 text-sm">Edit Paket & Kelengkapan</h3>
                <p className="text-[11px] text-slate-500 mt-1">Status paket: {editingKit.status.replace('_', ' ')}</p>
              </div>
              <button
                onClick={() => {
                  setShowEditKitModal(false);
                  setEditingKit(null);
                }}
                className="text-slate-400 hover:text-slate-600"
                aria-label="Tutup"
              >
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
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Paket / QR:</label>
                  <input
                    required
                    value={kitForm.kit_code}
                    onChange={(e) => setKitForm({ ...kitForm, kit_code: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Lokasi:</label>
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

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-800">Daftar Kelengkapan</h4>
                  <button
                    type="button"
                    onClick={() => setKitForm({
                      ...kitForm,
                      components: [...kitForm.components, {
                        component_name: '',
                        item_type_id: '',
                        asset_unit_id: '',
                        quantity: 1,
                        condition: 'baik',
                        is_required: 1,
                      }],
                    })}
                    className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-forest-800 font-semibold hover:bg-emerald-100"
                  >
                    <Plus className="w-3 h-3" />
                    Tambah Komponen
                  </button>
                </div>

                {kitForm.components.length === 0 && (
                  <p className="p-3 text-center text-slate-500 border border-dashed rounded-xl">Belum ada komponen. Tambahkan kelengkapan paket.</p>
                )}
                {kitForm.components.map((component, index) => (
                  <div key={index} className="p-3 border border-slate-200 rounded-xl space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="block font-medium text-slate-600 mb-1">Nama Komponen:</label>
                          <input
                            required
                            value={component.component_name}
                            onChange={(e) => setKitForm({
                              ...kitForm,
                              components: kitForm.components.map((entry, i) => i === index ? { ...entry, component_name: e.target.value } : entry),
                            })}
                            className="w-full px-2.5 py-2 border rounded-lg focus:ring-2 focus:ring-emerald-500"
                          />
                        </div>
                        <div>
                          <label className="block font-medium text-slate-600 mb-1">Katalog terkait (opsional):</label>
                          <select
                            value={component.item_type_id}
                            onChange={(e) => setKitForm({
                              ...kitForm,
                              components: kitForm.components.map((entry, i) => i === index ? { ...entry, item_type_id: e.target.value } : entry),
                            })}
                            className="w-full px-2.5 py-2 border rounded-lg bg-white"
                          >
                            <option value="">Tidak ditautkan</option>
                            {items.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                          </select>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setKitForm({
                          ...kitForm,
                          components: kitForm.components.filter((_, i) => i !== index),
                        })}
                        className="mt-5 p-2 text-rose-600 hover:bg-rose-50 rounded-lg"
                        aria-label={`Hapus komponen ${component.component_name || index + 1}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">Unit aset (opsional):</label>
                        <select
                          value={component.asset_unit_id}
                          onChange={(e) => {
                            const selectedAsset = assets.find((asset) => String(asset.id) === e.target.value);
                            setKitForm({
                              ...kitForm,
                              components: kitForm.components.map((entry, i) => i === index
                                ? {
                                    ...entry,
                                    asset_unit_id: e.target.value,
                                    item_type_id: selectedAsset ? String(selectedAsset.item_type_id) : entry.item_type_id,
                                    component_name: selectedAsset?.item_name || entry.component_name,
                                  }
                                : entry),
                            });
                          }}
                          className="w-full px-2.5 py-2 border rounded-lg bg-white"
                        >
                          <option value="">Tidak ditautkan</option>
                          {component.asset_unit_id && !assets.some((asset) => String(asset.id) === component.asset_unit_id) && (
                            <option value={component.asset_unit_id}>Unit aset #{component.asset_unit_id}</option>
                          )}
                          {assets.map((asset) => <option key={asset.id} value={asset.id}>{asset.asset_code} — {asset.item_name}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">Jumlah:</label>
                        <input
                          type="number"
                          min="1"
                          required
                          value={component.quantity}
                          onChange={(e) => setKitForm({
                            ...kitForm,
                            components: kitForm.components.map((entry, i) => i === index ? { ...entry, quantity: Number(e.target.value) } : entry),
                          })}
                          className="w-full px-2.5 py-2 border rounded-lg font-mono"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">Kondisi:</label>
                        <select
                          value={component.condition}
                          onChange={(e) => setKitForm({
                            ...kitForm,
                            components: kitForm.components.map((entry, i) => i === index ? { ...entry, condition: e.target.value as 'baik' | 'rusak' } : entry),
                          })}
                          className="w-full px-2.5 py-2 border rounded-lg bg-white"
                        >
                          <option value="baik">Baik</option>
                          <option value="rusak">Rusak</option>
                        </select>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan:</label>
                <textarea
                  rows={2}
                  value={kitForm.notes}
                  onChange={(e) => setKitForm({ ...kitForm, notes: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowEditKitModal(false);
                    setEditingKit(null);
                  }}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
                >
                  Batal
                </button>
                <button type="submit" className="px-4 py-2 bg-forest-800 hover:bg-forest-900 text-white font-semibold rounded-xl">
                  Simpan Paket
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Manage Categories */}
      {showCategoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-5">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
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
                  onChange={(e) => setNewAsset({ ...newAsset, item_type_id: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">Pilih Jenis Barang</option>
                  {items.filter(i => i.tracking_mode === 'unique_unit').map((i) => (
                    <option key={i.id} value={i.id}>{i.name} ({i.code})</option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kode Aset Unik:</label>
                  <input
                    type="text"
                    required
                    value={newAsset.asset_code}
                    onChange={(e) => setNewAsset({ ...newAsset, asset_code: e.target.value })}
                    placeholder="NV-CAM-003"
                    className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nomor Seri Pabrik:</label>
                  <input
                    type="text"
                    value={newAsset.serial_number}
                    onChange={(e) => setNewAsset({ ...newAsset, serial_number: e.target.value })}
                    placeholder="SN-XXXX"
                    className="w-full px-3 py-2 border rounded-xl font-mono focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>
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
                  Registrasi Aset
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adjust Stock Pool */}
      {showAdjustModal && selectedPool && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
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
