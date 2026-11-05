import React from 'react';
import {
  LayoutDashboard,
  Package,
  ArrowLeftRight,
  Users,
  CalendarCheck2,
  FileBarChart,
  ShieldAlert,
  UserCog,
  QrCode,
  LogOut,
  Building2
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type DesktopNavPage =
  | 'dashboard'
  | 'inventory'
  | 'transactions'
  | 'contacts'
  | 'activities'
  | 'reports'
  | 'audit'
  | 'users';

interface SidebarProps {
  currentPage: DesktopNavPage;
  onNavigate: (page: DesktopNavPage) => void;
  onOpenScanner: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentPage,
  onNavigate,
  onOpenScanner,
}) => {
  const { user, logout } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Beranda', icon: LayoutDashboard },
    { id: 'inventory', label: 'Inventaris & Paket', icon: Package },
    { id: 'transactions', label: 'Transaksi Alat', icon: ArrowLeftRight },
    { id: 'contacts', label: 'Kontak Peminjam', icon: Users },
    { id: 'activities', label: 'Kegiatan & Saran', icon: CalendarCheck2 },
    { id: 'reports', label: 'Laporan & Stok', icon: FileBarChart },
    { id: 'audit', label: 'Log Audit Sistem', icon: ShieldAlert },
  ] as const;

  const roleLabelMap: Record<string, { label: string; color: string }> = {
    super_admin: { label: 'SUPER ADMIN', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
    admin_inventaris: { label: 'ADMIN INVENTARIS', color: 'bg-blue-100 text-blue-800 border-blue-300' },
    operator: { label: 'OPERATOR', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  };

  const currentRole = user ? roleLabelMap[user.role] : { label: 'PETUGAS', color: 'bg-slate-100 text-slate-800' };

  return (
    <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200 h-screen sticky top-0 z-30 select-none">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-forest-800 text-white flex items-center justify-center font-bold text-xl shadow-md">
            N
          </div>
          <div>
            <h1 className="font-bold text-lg text-slate-900 leading-tight">Nventori</h1>
            <p className="text-xs text-slate-500 font-medium">Manajemen Inventaris Kantor</p>
          </div>
        </div>

        {/* User Card */}
        <div className="mt-4 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <div className="flex items-center justify-between">
            <span className="font-semibold text-xs text-slate-900 truncate max-w-[130px]">{user?.name}</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${currentRole.color}`}>
              {currentRole.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5 mt-1 text-[11px] text-slate-500">
            <Building2 className="w-3 h-3 text-slate-400" />
            <span className="truncate">{user?.unit_name || 'Kantor Pusat'}</span>
          </div>
        </div>
      </div>

      {/* Quick Scanner Action */}
      <div className="px-4 py-3">
        <button
          onClick={onOpenScanner}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-forest-800 hover:bg-forest-900 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
        >
          <QrCode className="w-4 h-4" />
          <span>Pindai QR Aset / Bukti</span>
        </button>
      </div>

      {/* Navigation List */}
      <nav className="flex-1 px-3 py-2 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentPage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as DesktopNavPage)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${
                isActive
                  ? 'bg-emerald-50 text-forest-800 font-semibold'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-forest-800' : 'text-slate-400'}`} />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Super Admin User Management */}
        {user?.role === 'super_admin' && (
          <button
            onClick={() => onNavigate('users')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors cursor-pointer text-left ${
              currentPage === 'users'
                ? 'bg-emerald-50 text-forest-800 font-semibold'
                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
            }`}
          >
            <UserCog className={`w-4 h-4 ${currentPage === 'users' ? 'text-forest-800' : 'text-slate-400'}`} />
            <span>Kelola Petugas</span>
          </button>
        )}
      </nav>

      {/* Logout Footer */}
      <div className="p-3 border-t border-slate-100">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer text-left"
        >
          <LogOut className="w-4 h-4" />
          <span>Keluar Sesi</span>
        </button>
      </div>
    </aside>
  );
};
