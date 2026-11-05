import React from 'react';
import { CalendarCheck2, FileBarChart, KeyRound, LogOut, ShieldAlert, UserCog, Users } from 'lucide-react';
import { DesktopNavPage } from '../components/layout/Sidebar';
import { User } from '../types';

interface MobileMorePageProps {
  user: User | null;
  onNavigate: (page: DesktopNavPage) => void;
  onChangePassword: () => void;
  onLogout: () => void;
}

export const MobileMorePage: React.FC<MobileMorePageProps> = ({
  user,
  onNavigate,
  onChangePassword,
  onLogout,
}) => {
  const menuItems = [
    { id: 'contacts', label: 'Kontak Peminjam', description: 'Lihat dan kelola kontak peminjam', icon: Users },
    { id: 'activities', label: 'Kegiatan & Saran', description: 'Agenda dan saran kebutuhan', icon: CalendarCheck2 },
    { id: 'reports', label: 'Laporan & Stok', description: 'Ringkasan laporan inventaris', icon: FileBarChart },
    { id: 'audit', label: 'Log Audit Sistem', description: 'Riwayat aktivitas sistem', icon: ShieldAlert },
    ...(user?.role === 'super_admin'
      ? [{ id: 'users' as const, label: 'Kelola Petugas', description: 'Kelola akun dan unit kerja petugas', icon: UserCog }]
      : []),
  ] as const;

  return (
    <div className="p-4 md:p-8 space-y-5 max-w-3xl mx-auto pb-28 md:pb-12">
      <div>
        <h2 className="text-xl font-bold text-slate-900 tracking-tight">Menu Lainnya</h2>
        <p className="text-xs text-slate-500 mt-1">Pilih menu yang tidak tersedia di navigasi bawah.</p>
      </div>

      <nav aria-label="Menu lainnya" className="grid gap-3">
        {menuItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className="w-full flex items-center gap-4 p-4 text-left bg-white rounded-2xl border border-slate-200 shadow-sm hover:border-emerald-300 hover:bg-emerald-50/40 transition-colors"
            >
              <span className="w-11 h-11 flex-shrink-0 rounded-xl bg-emerald-50 text-forest-800 flex items-center justify-center">
                <Icon className="w-5 h-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-semibold text-slate-900">{item.label}</span>
                <span className="block text-xs text-slate-500 mt-0.5">{item.description}</span>
              </span>
              <span aria-hidden="true" className="text-slate-400">›</span>
            </button>
          );
        })}
      </nav>

      <section aria-label="Akun petugas" className="grid gap-3 border-t border-slate-200 pt-5">
        <button
          type="button"
          onClick={onChangePassword}
          className="w-full flex items-center gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-emerald-300 hover:bg-emerald-50/40"
        >
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-forest-800">
            <KeyRound className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-slate-900">Ganti Password</span>
            <span className="mt-0.5 block text-xs text-slate-500">Perbarui password akun petugas</span>
          </span>
          <span aria-hidden="true" className="text-slate-400">›</span>
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="flex w-full items-center gap-3 rounded-2xl border border-rose-200 bg-white p-4 text-left text-sm font-semibold text-rose-700 shadow-sm transition-colors hover:bg-rose-50"
        >
          <LogOut className="h-5 w-5" />
          Keluar Sesi
        </button>
      </section>
    </div>
  );
};
