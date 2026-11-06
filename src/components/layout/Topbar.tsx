import React, { useState, useEffect } from 'react';
import { Bell, KeyRound, Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';

interface TopbarProps {
  onOpenScanner: () => void;
  onOpenNotifications: () => void;
  onChangePassword: () => void;
  title?: string;
}

export const Topbar: React.FC<TopbarProps> = ({
  onOpenScanner,
  onOpenNotifications,
  onChangePassword,
  title = 'Beranda',
}) => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [notificationCount, setNotificationCount] = useState<number>(0);

  useEffect(() => {
    api.getDashboardStats().then((res) => {
      if (res.success && res.overdue_items) {
        setNotificationCount(res.overdue_items.length);
      }
    }).catch(() => {});
  }, []);

  return (
    <header className="sticky top-0 z-20 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 md:px-8 py-3.5 flex items-center justify-between">
      {/* Page Title (Mobile & Desktop) */}
      <div className="flex items-center gap-3">
        <div className="md:hidden w-8 h-8 rounded-lg bg-forest-800 text-white flex items-center justify-center font-bold text-sm shadow">
          N
        </div>
        <div>
          <h2 className="text-base md:text-lg font-bold text-slate-900 leading-tight">
            {title}
          </h2>
          <p className="text-[11px] text-slate-500 hidden sm:block">
            {new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} • Asia/Jakarta
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 sm:gap-3">
        <button
          onClick={onChangePassword}
          className="flex h-9 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-2.5 text-slate-600 transition-colors hover:bg-slate-50 sm:px-3"
          aria-label="Ganti Password"
          title="Ganti Password"
        >
          <KeyRound className="h-4 w-4" />
          <span className="hidden text-xs font-medium sm:inline">Ganti Password</span>
        </button>

        {/* Light / Dark mode toggle */}
        <button
          onClick={(e) => {
            const r = e.currentTarget.getBoundingClientRect();
            toggleTheme({ x: r.left + r.width / 2, y: r.top + r.height / 2 });
          }}
          className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer overflow-hidden active:scale-95"
          aria-label={theme === 'dark' ? 'Ganti ke mode terang' : 'Ganti ke mode malam'}
          title={theme === 'dark' ? 'Mode terang' : 'Mode malam'}
        >
          <Sun
            className="absolute w-4 h-4"
            style={{
              transition: 'transform 500ms cubic-bezier(0.32,0.72,0,1), opacity 300ms ease',
              transform: theme === 'dark' ? 'rotate(0deg) scale(1)' : 'rotate(-90deg) scale(0.3)',
              opacity: theme === 'dark' ? 1 : 0,
            }}
          />
          <Moon
            className="absolute w-4 h-4"
            style={{
              transition: 'transform 500ms cubic-bezier(0.32,0.72,0,1), opacity 300ms ease',
              transform: theme === 'dark' ? 'rotate(90deg) scale(0.3)' : 'rotate(0deg) scale(1)',
              opacity: theme === 'dark' ? 0 : 1,
            }}
          />
        </button>

        {/* Notifications Alert Bell */}
        <button
          onClick={onOpenNotifications}
          className="relative flex items-center justify-center w-9 h-9 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 transition-colors cursor-pointer"
          aria-label="Pemberitahuan Sistem"
        >
          <Bell className="w-4 h-4" />
          {notificationCount > 0 && (
            <span className="absolute -top-1 -right-1 flex h-4 min-w-[16px] px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-bold text-white shadow-sm">
              {notificationCount}
            </span>
          )}
        </button>
      </div>
    </header>
  );
};
