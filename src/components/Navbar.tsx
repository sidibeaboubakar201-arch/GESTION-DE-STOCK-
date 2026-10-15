import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Menu,
  Search,
  Bell,
  ArrowDownToLine,
  ArrowUpFromLine,
  AlertTriangle,
  AlertOctagon,
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { NavTab } from './Sidebar.tsx';
import { DashboardStats } from '../types/index.ts';

interface NavbarProps {
  onOpenMobile: () => void;
  onNavigate: (tab: NavTab) => void;
  dashboardStats: DashboardStats | null;
  onSearchSelect?: (sku: string) => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  onOpenMobile,
  onNavigate,
  dashboardStats,
  onSearchSelect
}) => {
  const { user } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const totalAlerts = (dashboardStats?.lowStockCount || 0) + (dashboardStats?.outOfStockCount || 0);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      onNavigate('products');
      if (onSearchSelect) {
        onSearchSelect(searchTerm.trim());
      }
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-slate-200 px-4 sm:px-6 py-3 flex items-center justify-between gap-4">
      {/* Left: Mobile hamburger & Global Search */}
      <div className="flex items-center gap-3 flex-1 max-w-xl">
        <button
          onClick={onOpenMobile}
          className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        <form onSubmit={handleSearchSubmit} className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
            <Search className="w-4 h-4" />
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Rechercher produit, référence SKU, code-barres..."
            className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs sm:text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:bg-white focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all"
          />
        </form>
      </div>

      {/* Right: Quick Action Buttons, Notifications & User Info */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* Quick Stock Action Buttons */}
        <button
          onClick={() => onNavigate('stock-in')}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <ArrowDownToLine className="w-3.5 h-3.5" />
          <span>+ Entrée</span>
        </button>

        <button
          onClick={() => onNavigate('stock-out')}
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
        >
          <ArrowUpFromLine className="w-3.5 h-3.5" />
          <span>- Sortie</span>
        </button>

        {/* Notifications Dropdown for Stock Alerts */}
        <div className="relative">
          <button
            onClick={() => setShowNotifications(!showNotifications)}
            className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Alertes de stock"
          >
            <Bell className="w-5 h-5" />
            {totalAlerts > 0 && (
              <span className="absolute top-1.5 right-1.5 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
                {totalAlerts}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              <div
                className="fixed inset-0 z-40"
                onClick={() => setShowNotifications(false)}
              />
              <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white border border-slate-200 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                <div className="p-3.5 bg-slate-900 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">Alertes de Stock</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 text-[10px] font-bold border border-red-500/30">
                    {totalAlerts} alerte(s)
                  </span>
                </div>

                <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 p-1">
                  {totalAlerts === 0 ? (
                    <div className="p-6 text-center text-slate-500 text-xs">
                      Aucune rupture ni stock critique pour le moment.
                    </div>
                  ) : (
                    <>
                      {dashboardStats?.restockNeeded.map((prod) => (
                        <div
                          key={prod.id}
                          className="p-3 hover:bg-slate-50 flex items-start gap-3 transition-colors cursor-pointer"
                          onClick={() => {
                            setShowNotifications(false);
                            onNavigate('products');
                          }}
                        >
                          {prod.current_stock === 0 ? (
                            <div className="p-1.5 rounded-lg bg-red-100 text-red-600 shrink-0">
                              <AlertOctagon className="w-4 h-4" />
                            </div>
                          ) : (
                            <div className="p-1.5 rounded-lg bg-amber-100 text-amber-600 shrink-0">
                              <AlertTriangle className="w-4 h-4" />
                            </div>
                          )}

                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold text-slate-900 truncate">{prod.name}</span>
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                  prod.current_stock === 0
                                    ? 'bg-red-50 text-red-700'
                                    : 'bg-amber-50 text-amber-700'
                                }`}
                              >
                                {prod.current_stock === 0 ? 'RUPTURE' : `Stock: ${prod.current_stock}`}
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center justify-between mt-0.5">
                              <span>Réf: {prod.sku}</span>
                              <span className="text-slate-400">Seuil min: {prod.min_stock_alert}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                </div>

                <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-center">
                  <button
                    onClick={() => {
                      setShowNotifications(false);
                      onNavigate('products');
                    }}
                    className="text-xs font-bold text-amber-600 hover:text-amber-700 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Consulter tous les articles à réapprovisionner</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* User Mini Avatar Badge */}
        <div className="hidden md:flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 flex items-center justify-center font-bold text-xs shadow-xs">
            {user?.full_name?.charAt(0).toUpperCase()}
          </div>
          <div className="text-left">
            <div className="text-xs font-bold text-slate-800 leading-tight truncate max-w-[120px]">
              {user?.full_name?.split(' ')[0]}
            </div>
            <div className="text-[10px] text-slate-400 capitalize">
              {user?.role === 'admin' ? 'Admin' : 'Magasinier'}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
