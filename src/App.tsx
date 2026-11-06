import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import { LoginPage } from './pages/LoginPage';
import { Sidebar, DesktopNavPage } from './components/layout/Sidebar';
import { Topbar } from './components/layout/Topbar';
import { MobileNavbar, MobileTab } from './components/layout/MobileNavbar';

import { DashboardPage } from './pages/DashboardPage';
import { InventoryPage } from './pages/InventoryPage';
import { TransactionsPage } from './pages/TransactionsPage';
import { NewTransactionPage } from './pages/NewTransactionPage';
import { ContactsPage } from './pages/ContactsPage';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { ReportsPage } from './pages/ReportsPage';
import { AuditLogsPage } from './pages/AuditLogsPage';
import { UsersPage } from './pages/UsersPage';
import { MobileMorePage } from './pages/MobileMorePage';

import { QRScannerModal } from './components/scanner/QRScannerModal';
import { ReturnModal } from './pages/ReturnModal';
import { LabelPrintModal } from './components/print/LabelPrintModal';
import { ReceiptPrintModal } from './components/print/ReceiptPrintModal';
import { ChangePasswordModal } from './components/auth/ChangePasswordModal';

import { AssetUnit, Transaction } from './types';

const AppContent: React.FC = () => {
  const { user, loading, isAuthenticated, logout } = useAuth();

  // Navigation State
  const [currentPage, setCurrentPage] = useState<DesktopNavPage | 'new_transaction' | 'more'>('dashboard');
  const [mobileTab, setMobileTab] = useState<MobileTab>('beranda');

  // Modals
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isReturnModalOpen, setIsReturnModalOpen] = useState(false);
  const [selectedTxForReturn, setSelectedTxForReturn] = useState<Transaction | null>(null);

  const [inventoryFocus, setInventoryFocus] = useState<{ tab: 'assets' | 'kits'; search: string; nonce: number } | null>(null);
  const [isLabelModalOpen, setIsLabelModalOpen] = useState(false);
  const [selectedAssetForLabel, setSelectedAssetForLabel] = useState<AssetUnit | null>(null);

  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [selectedTxForReceipt, setSelectedTxForReceipt] = useState<Transaction | null>(null);
  const [receiptType, setReceiptType] = useState<'handover' | 'return'>('handover');

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FAFBFB]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-forest-800 text-white flex items-center justify-center font-bold text-xl shadow-lg animate-bounce">
            N
          </div>
          <span className="text-xs font-semibold text-slate-500">Memuat Sistem Nventori...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Handle Mobile Tab Change mapping
  const handleMobileTabChange = (tab: MobileTab) => {
    setMobileTab(tab);
    switch (tab) {
      case 'beranda':
        setCurrentPage('dashboard');
        break;
      case 'inventaris':
        setCurrentPage('inventory');
        break;
      case 'transaksi':
        setCurrentPage('transactions');
        break;
      case 'lainnya':
        setCurrentPage('more');
        break;
      default:
        break;
    }
  };

  const handleDesktopNavigate = (page: DesktopNavPage) => {
    setCurrentPage(page);
    // sync mobile tab icon
    if (page === 'dashboard') setMobileTab('beranda');
    else if (page === 'inventory') setMobileTab('inventaris');
    else if (page === 'transactions') setMobileTab('transaksi');
    else setMobileTab('lainnya');
  };

  const handleScannerResult = (result: { type: 'transaction' | 'asset' | 'kit'; data: any }) => {
    if (result.type === 'transaction') {
      setSelectedTxForReturn(result.data);
      setIsReturnModalOpen(true);
    } else if (result.type === 'asset') {
      // Show the scanned asset in Inventaris (not the QR print dialog)
      setInventoryFocus({ tab: 'assets', search: result.data.asset_code, nonce: Date.now() });
      handleDesktopNavigate('inventory');
    } else if (result.type === 'kit') {
      setInventoryFocus({ tab: 'kits', search: '', nonce: Date.now() });
      handleDesktopNavigate('inventory');
    }
  };

  // Title Mapping
  const titles: Record<string, string> = {
    dashboard: 'Beranda & Dasbor',
    inventory: 'Master Inventaris & Paket',
    transactions: 'Transaksi Alat',
    new_transaction: 'Pencatatan Pinjaman Baru',
    contacts: 'Buku Kontak Peminjam',
    activities: 'Agenda & Saran Kebutuhan',
    reports: 'Laporan & Rekapitulasi',
    audit: 'Log Audit Sistem',
    users: 'Kelola Akun Petugas',
    more: 'Menu Lainnya',
  };

  return (
    <div className="flex min-h-screen bg-[#FAFBFB]">
      {/* Desktop Sidebar */}
      <Sidebar
        currentPage={currentPage as DesktopNavPage}
        onNavigate={handleDesktopNavigate}
        onOpenScanner={() => setIsScannerOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <Topbar
          title={titles[currentPage] || 'Nventori'}
          onOpenScanner={() => setIsScannerOpen(true)}
          onOpenNotifications={() => setCurrentPage('dashboard')}
          onChangePassword={() => setIsChangePasswordOpen(true)}
        />

        <main className="flex-1">
          {currentPage === 'dashboard' && (
            <DashboardPage
              onNavigate={(page) => setCurrentPage(page)}
              onOpenScanner={() => setIsScannerOpen(true)}
              onOpenReturnModal={(tx) => {
                setSelectedTxForReturn(tx);
                setIsReturnModalOpen(true);
              }}
              onOpenReceiptModal={(tx) => {
                setSelectedTxForReceipt(tx);
                setReceiptType('handover');
                setIsReceiptModalOpen(true);
              }}
            />
          )}

          {currentPage === 'inventory' && (
            <InventoryPage
              focusRequest={inventoryFocus}
              onOpenLabelModal={(asset) => {
                setSelectedAssetForLabel(asset);
                setIsLabelModalOpen(true);
              }}
            />
          )}

          {currentPage === 'transactions' && (
            <TransactionsPage
              onNavigateNew={() => setCurrentPage('new_transaction')}
              onOpenReturnModal={(tx) => {
                setSelectedTxForReturn(tx);
                setIsReturnModalOpen(true);
              }}
              onOpenReceiptModal={(tx, type) => {
                setSelectedTxForReceipt(tx);
                setReceiptType(type);
                setIsReceiptModalOpen(true);
              }}
            />
          )}

          {currentPage === 'new_transaction' && (
            <NewTransactionPage
              onBack={() => setCurrentPage('transactions')}
              onSuccess={(txId) => {
                setCurrentPage('transactions');
              }}
            />
          )}

          {currentPage === 'contacts' && <ContactsPage />}

          {currentPage === 'activities' && <ActivitiesPage />}

          {currentPage === 'reports' && <ReportsPage />}

          {currentPage === 'audit' && <AuditLogsPage />}

          {currentPage === 'users' && user?.role === 'super_admin' && <UsersPage />}

          {currentPage === 'more' && (
            <MobileMorePage
              user={user}
              onNavigate={handleDesktopNavigate}
              onChangePassword={() => setIsChangePasswordOpen(true)}
              onLogout={logout}
            />
          )}
        </main>

        {/* Mobile Curved Bottom Navbar (Figma-accurate) */}
        <MobileNavbar
          activeTab={mobileTab}
          onTabChange={handleMobileTabChange}
          onOpenScanner={() => setIsScannerOpen(true)}
        />
      </div>

      {/* Modals */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => setIsScannerOpen(false)}
        onSelectResult={handleScannerResult}
      />

      <ChangePasswordModal
        isOpen={isChangePasswordOpen}
        onClose={() => setIsChangePasswordOpen(false)}
      />

      <ReturnModal
        isOpen={isReturnModalOpen}
        onClose={() => {
          setIsReturnModalOpen(false);
          setSelectedTxForReturn(null);
        }}
        transaction={selectedTxForReturn}
        onSuccess={() => {
          // reload current page if needed
        }}
      />

      <LabelPrintModal
        isOpen={isLabelModalOpen}
        onClose={() => {
          setIsLabelModalOpen(false);
          setSelectedAssetForLabel(null);
        }}
        asset={selectedAssetForLabel}
      />

      <ReceiptPrintModal
        isOpen={isReceiptModalOpen}
        onClose={() => {
          setIsReceiptModalOpen(false);
          setSelectedTxForReceipt(null);
        }}
        transaction={selectedTxForReceipt}
        receiptType={receiptType}
      />
    </div>
  );
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <ToastProvider>
        <AppContent />
      </ToastProvider>
    </AuthProvider>
  );
};

export default App;
