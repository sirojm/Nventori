import React, { useState } from 'react';
import { ShieldCheck, UserCheck, KeyRound, ArrowRight, AlertCircle, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';

export const LoginPage: React.FC = () => {
  const { login } = useAuth();
  const { error } = useToast();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) {
      setErrorMsg('Harap isi username dan kata sandi.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      await login({ username: username.trim(), password });
    } catch (err: any) {
      setErrorMsg(err.message || 'Login gagal. Periksa kembali akun Anda.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (user: string, pass: string) => {
    setUsername(user);
    setPassword(pass);
    login({ username: user, password: pass }).catch((err: any) => {
      setErrorMsg(err.message || 'Login gagal.');
    });
  };

  return (
    <div className="min-h-screen bg-[#FAFBFB] flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center">
        {/* Logo */}
        <div className="w-14 h-14 rounded-2xl bg-forest-800 text-white flex items-center justify-center font-bold text-2xl mx-auto shadow-lg mb-4 ring-4 ring-emerald-500/10">
          N
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">
          Nventori
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Sistem Terpadu Pengelolaan Inventaris & Peralatan UTIPD
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-6 shadow-xl shadow-slate-200/50 rounded-2xl border border-slate-100 sm:px-10">
          {errorMsg && (
            <div className="mb-5 p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-2.5 text-xs text-rose-800">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Username / Email Petugas
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Contoh: superadmin"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Kata Sandi
              </label>
              <div className="relative">
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full px-3.5 py-2.5 text-xs rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-forest-800 hover:bg-forest-900 disabled:opacity-50 text-white text-xs font-semibold shadow transition cursor-pointer mt-2"
            >
              <span>{loading ? 'Memproses...' : 'Masuk ke Sistem'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          {/* Quick Demo Access Buttons for 3 Roles */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <p className="text-[11px] font-semibold text-slate-500 text-center mb-3">
              Akses Cepat Pengujian (Tiga Level Pengguna):
            </p>
            <div className="grid grid-cols-1 gap-2">
              <button
                type="button"
                onClick={() => handleQuickLogin('superadmin', 'password123')}
                className="w-full text-left p-2.5 rounded-xl border border-emerald-200 bg-emerald-50/50 hover:bg-emerald-50 text-emerald-950 transition cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-xs">Super Admin</div>
                  <div className="text-[10px] text-emerald-700">superadmin / password123 (Akses Penuh & Petugas)</div>
                </div>
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('admin_inv', 'password123')}
                className="w-full text-left p-2.5 rounded-xl border border-blue-200 bg-blue-50/50 hover:bg-blue-50 text-blue-950 transition cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-xs">Admin Inventaris</div>
                  <div className="text-[10px] text-blue-700">admin_inv / password123 (Kelola Master & Stok)</div>
                </div>
                <UserCheck className="w-4 h-4 text-blue-600" />
              </button>

              <button
                type="button"
                onClick={() => handleQuickLogin('operator1', 'password123')}
                className="w-full text-left p-2.5 rounded-xl border border-amber-200 bg-amber-50/50 hover:bg-amber-50 text-amber-950 transition cursor-pointer flex items-center justify-between"
              >
                <div>
                  <div className="font-bold text-xs">Operator</div>
                  <div className="text-[10px] text-amber-700">operator1 / password123 (Transaksi & Pengembalian)</div>
                </div>
                <KeyRound className="w-4 h-4 text-amber-600" />
              </button>
            </div>
          </div>
        </div>

        <p className="text-center text-[11px] text-slate-400 mt-6">
          Nventori v1.5 • Sistem Terpadu Pengelolaan Inventaris & Peralatan UTIPD
        </p>
      </div>
    </div>
  );
};
