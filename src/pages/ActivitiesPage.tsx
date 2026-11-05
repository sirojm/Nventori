import React, { useState, useEffect } from 'react';
import {
  Calendar,
  Sparkles,
  Plus,
  Clock,
  MapPin,
  Users,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sliders,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { Activity, BorrowerContact } from '../types';
import { useToast } from '../context/ToastContext';

interface ActivitiesPageProps {
  onNavigateNewTxWithItems?: (items: any[]) => void;
}

export const ActivitiesPage: React.FC<ActivitiesPageProps> = () => {
  const { success, error } = useToast();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [contacts, setContacts] = useState<BorrowerContact[]>([]);
  const [loading, setLoading] = useState(false);

  // Recommendation engine state
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [scaleFactor, setScaleFactor] = useState<number>(1.0);
  const [recommendationResult, setRecommendationResult] = useState<any>(null);
  const [calcLoading, setCalcLoading] = useState(false);

  // Add Activity Modal
  const [showAddModal, setShowAddModal] = useState(false);
  const [newActivity, setNewActivity] = useState({
    name: '',
    activity_type: 'Akademik',
    location: '',
    start_time: new Date().toISOString().slice(0, 16),
    end_time: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
    pic_contact_id: '',
    pic_name: '',
    notes: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [actRes, tplRes, cRes] = await Promise.all([
        api.getActivities(),
        api.getActivityTemplates(),
        api.getContacts(),
      ]);
      if (actRes.success) setActivities(actRes.activities);
      if (tplRes.success) {
        setTemplates(tplRes.templates);
        if (tplRes.templates.length > 0) {
          setSelectedTemplateId(String(tplRes.templates[0].id));
        }
      }
      if (cRes.success) setContacts(cRes.contacts);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCalculateRecommendations = async () => {
    if (!selectedTemplateId) return;
    setCalcLoading(true);
    try {
      const res = await api.getRecommendations({
        template_id: Number(selectedTemplateId),
        scale_factor: scaleFactor,
      });
      if (res.success) {
        setRecommendationResult(res);
      }
    } catch (err: any) {
      error(err.message || 'Gagal menghitung rekomendasi.');
    } finally {
      setCalcLoading(false);
    }
  };

  const handleCreateActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newActivity.name || !newActivity.location || !newActivity.pic_name) {
      error('Harap lengkapi nama kegiatan, tempat, dan PIC.');
      return;
    }

    try {
      const res = await api.createActivity({
        ...newActivity,
        pic_contact_id: newActivity.pic_contact_id ? Number(newActivity.pic_contact_id) : null,
      });
      if (res.success) {
        success(res.message);
        setShowAddModal(false);
        setNewActivity({
          name: '',
          activity_type: 'Akademik',
          location: '',
          start_time: new Date().toISOString().slice(0, 16),
          end_time: new Date(Date.now() + 24 * 3600 * 1000).toISOString().slice(0, 16),
          pic_contact_id: '',
          pic_name: '',
          notes: '',
        });
        loadData();
      }
    } catch (err: any) {
      error(err.message || 'Gagal menambahkan kegiatan.');
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto pb-24 md:pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Agenda Kegiatan & Saran Kebutuhan Alat</h2>
          <p className="text-xs text-slate-500">
            Penyusunan kebutuhan alat berdasarkan template kegiatan dan analisis ketersediaan stok riil
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-sm transition cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Agenda Baru</span>
        </button>
      </div>

      {/* Smart Recommendation Engine Box (Blueprint Section 8) */}
      <div className="p-5 md:p-6 rounded-2xl bg-gradient-to-br from-emerald-50/80 via-white to-slate-50 border border-emerald-200/80 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-forest-800 text-white flex items-center justify-center shadow">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-slate-900">Rekomendasi Pintar Kebutuhan Peralatan</h3>
              <p className="text-[11px] text-slate-500">
                Hitung jumlah kebutuhan alat dan cek benturan ketersediaan stok secara otomatis
              </p>
            </div>
          </div>
        </div>

        {/* Inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Pilih Template Acara:</label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              className="w-full px-3 py-2 border rounded-xl bg-white focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.event_category})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">
              Faktor Skala / Estimasi Peserta: ({scaleFactor}x)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min="0.5"
                max="3.0"
                step="0.5"
                value={scaleFactor}
                onChange={(e) => setScaleFactor(Number(e.target.value))}
                className="w-full accent-emerald-700"
              />
              <span className="font-mono font-bold text-slate-800 w-10 text-center">{scaleFactor}x</span>
            </div>
          </div>

          <div className="flex items-end">
            <button
              onClick={handleCalculateRecommendations}
              disabled={calcLoading}
              className="w-full py-2 px-4 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:opacity-50 text-white text-xs font-semibold shadow transition cursor-pointer flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              <span>{calcLoading ? 'Menganalisis Stok...' : 'Hitung Kebutuhan & Cek Stok'}</span>
            </button>
          </div>
        </div>

        {/* Recommendations Result */}
        {recommendationResult && (
          <div className="mt-4 pt-4 border-t border-slate-200/80 space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-slate-900">
                Hasil Analisis: {recommendationResult.template_name} (Skala {recommendationResult.scale_factor}x)
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {recommendationResult.recommendations?.map((rec: any, idx: number) => (
                <div
                  key={idx}
                  className={`p-3.5 rounded-xl border text-xs flex flex-col justify-between space-y-2 ${
                    rec.is_sufficient
                      ? 'bg-white border-emerald-200'
                      : 'bg-rose-50/50 border-rose-200'
                  }`}
                >
                  <div>
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-slate-900">{rec.item_name}</span>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        rec.is_sufficient ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                      }`}>
                        {rec.is_sufficient ? 'Stok Cukup' : `Kurang ${rec.shortage} unit`}
                      </span>
                    </div>
                    {rec.brand_model && <div className="text-[11px] text-slate-500">{rec.brand_model}</div>}
                    {rec.notes && <div className="text-[11px] text-slate-400 mt-1 italic">{rec.notes}</div>}
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <div>
                      <span className="text-[10px] text-slate-400 block">Kebutuhan:</span>
                      <span className="font-bold text-slate-800">{rec.required_quantity} {rec.unit_of_measure}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-slate-400 block">Tersedia di Gudang:</span>
                      <span className="font-bold text-emerald-800">{rec.available_quantity} {rec.unit_of_measure}</span>
                    </div>
                  </div>

                  {!rec.is_sufficient && rec.alternative_item_name && (
                    <div className="p-2 bg-amber-50 rounded-lg text-[11px] text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      <span>Saran Alternatif: <strong>{rec.alternative_item_name}</strong></span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Activities List */}
      <div className="space-y-3">
        <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
          Daftar Seluruh Agenda Kegiatan
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {activities.map((act) => (
            <div key={act.id} className="p-5 rounded-2xl bg-white border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 capitalize">
                    {act.activity_type}
                  </span>
                  <h4 className="font-bold text-base text-slate-900 mt-1">{act.name}</h4>
                </div>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 capitalize">
                  {act.status}
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span>{act.location}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span>
                    {new Date(act.start_time).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} s/d{' '}
                    {new Date(act.end_time).toLocaleDateString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Users className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                  <span>PIC: {act.pic_name} {act.pic_phone && `(${act.pic_phone})`}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Add Activity Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-100 p-6 space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-900 text-sm">Tambah Agenda Kegiatan Baru</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateActivity} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Kegiatan:</label>
                <input
                  type="text"
                  required
                  value={newActivity.name}
                  onChange={(e) => setNewActivity({ ...newActivity, name: e.target.value })}
                  placeholder="Contoh: Sidang Senat Terbuka Wisuda Sarjana"
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori:</label>
                  <select
                    value={newActivity.activity_type}
                    onChange={(e) => setNewActivity({ ...newActivity, activity_type: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="Seremonial">Seremonial</option>
                    <option value="Akademik">Akademik</option>
                    <option value="Kemahasiswaan">Kemahasiswaan</option>
                    <option value="Rapat Resmi">Rapat Resmi</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Lokasi:</label>
                  <input
                    type="text"
                    required
                    value={newActivity.location}
                    onChange={(e) => setNewActivity({ ...newActivity, location: e.target.value })}
                    placeholder="Auditorium Gedung A"
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Waktu Mulai:</label>
                  <input
                    type="datetime-local"
                    required
                    value={newActivity.start_time}
                    onChange={(e) => setNewActivity({ ...newActivity, start_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Waktu Selesai:</label>
                  <input
                    type="datetime-local"
                    required
                    value={newActivity.end_time}
                    onChange={(e) => setNewActivity({ ...newActivity, end_time: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pilih PIC dari Kontak:</label>
                <select
                  value={newActivity.pic_contact_id}
                  onChange={(e) => {
                    const cId = e.target.value;
                    const found = contacts.find((c) => String(c.id) === cId);
                    setNewActivity({
                      ...newActivity,
                      pic_contact_id: cId,
                      pic_name: found ? found.full_name : newActivity.pic_name,
                    });
                  }}
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="">-- Ketik Nama PIC Manual di Bawah --</option>
                  {contacts.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.full_name} ({c.institution})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama PIC Penanggung Jawab:</label>
                <input
                  type="text"
                  required
                  value={newActivity.pic_name}
                  onChange={(e) => setNewActivity({ ...newActivity, pic_name: e.target.value })}
                  placeholder="Contoh: Maya Anggraini, S.Kom"
                  className="w-full px-3 py-2 border rounded-xl focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:text-slate-800"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-forest-800 hover:bg-forest-900 text-white font-semibold rounded-xl"
                >
                  Simpan Agenda
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
