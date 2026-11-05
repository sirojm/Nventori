import React from 'react';
import { Home, Package, QrCode, ArrowLeftRight, MoreHorizontal } from 'lucide-react';

export type MobileTab = 'beranda' | 'inventaris' | 'pindai' | 'transaksi' | 'lainnya';

interface MobileNavbarProps {
  activeTab: MobileTab;
  onTabChange: (tab: MobileTab) => void;
  onOpenScanner: () => void;
}

export const MobileNavbar: React.FC<MobileNavbarProps> = ({
  activeTab,
  onTabChange,
  onOpenScanner,
}) => {
  const tabs = [
    { id: 'beranda', label: 'Beranda', icon: Home },
    { id: 'inventaris', label: 'Inventaris', icon: Package },
    { id: 'pindai', label: 'Pindai', icon: QrCode, isScanner: true },
    { id: 'transaksi', label: 'Transaksi', icon: ArrowLeftRight },
    { id: 'lainnya', label: 'Lainnya', icon: MoreHorizontal },
  ] as const;

  const activeIndex = tabs.findIndex((t) => t.id === activeTab);
  // Center of each tab slot in percentage (0%, 20%, 40%, 60%, 80% + 10%)
  const cutoutPercent = activeIndex >= 0 ? 10 + activeIndex * 20 : 50;

  return (
    <nav
      aria-label="Navigasi Bawah Mobile"
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-3 pt-1 pointer-events-none"
    >
      <div className="relative max-w-md mx-auto pointer-events-auto">
        {/* SVG background with curved cutout centered on the active tab */}
        <div className="absolute inset-0 -top-5 filter drop-shadow-[0_8px_20px_rgba(15,23,42,0.12)]">
          <svg
            className="w-full h-[76px]"
            viewBox="0 0 350 76"
            fill="none"
            preserveAspectRatio="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d={`
                M 0,28
                Q 0,16 16,16
                L ${cutoutPercent * 3.5 - 34},16
                C ${cutoutPercent * 3.5 - 22},16 ${cutoutPercent * 3.5 - 18},2 ${cutoutPercent * 3.5},2
                C ${cutoutPercent * 3.5 + 18},2 ${cutoutPercent * 3.5 + 22},16 ${cutoutPercent * 3.5 + 34},16
                L 334,16
                Q 350,16 350,28
                L 350,76
                L 0,76
                Z
              `}
              fill="rgba(255, 255, 255, 0.94)"
              stroke="rgba(226, 232, 240, 0.85)"
              strokeWidth="1"
            />
          </svg>
        </div>

        {/* Tab Items Row */}
        <div className="relative flex items-center justify-around h-16 pt-1">
          {tabs.map((tab, idx) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                onClick={() => {
                  if (tab.isScanner) {
                    onOpenScanner();
                  }
                  onTabChange(tab.id as MobileTab);
                }}
                className={`relative flex flex-col items-center justify-center w-16 h-12 transition-all duration-200 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 rounded-xl ${
                  isActive ? '-translate-y-4' : 'text-slate-600 hover:text-slate-900'
                }`}
                aria-label={tab.label}
              >
                {isActive ? (
                  /* Floating elevated bubble circle */
                  <div className="flex flex-col items-center">
                    <div className="w-12 h-12 rounded-full bg-forest-800 text-white flex items-center justify-center shadow-[0_6px_16px_rgba(27,67,50,0.35)] border-2 border-white ring-2 ring-emerald-500/20 transform active:scale-95 transition-transform">
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="text-[11px] font-bold text-forest-800 mt-1">
                      {tab.label}
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center pt-2">
                    <Icon className="w-5 h-5 text-slate-500" />
                    <span className="text-[10px] font-medium text-slate-600 mt-0.5">
                      {tab.label}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};
