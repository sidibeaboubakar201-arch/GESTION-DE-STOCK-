import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { LoginView } from './components/LoginView.tsx';
import { Sidebar, NavTab } from './components/Sidebar.tsx';
import { Navbar } from './components/Navbar.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { ProductsView } from './components/ProductsView.tsx';
import { CategoriesView } from './components/CategoriesView.tsx';
import { StockInView } from './components/StockInView.tsx';
import { StockOutView } from './components/StockOutView.tsx';
import { MovementsView } from './components/MovementsView.tsx';
import { SuppliersView } from './components/SuppliersView.tsx';
import { InventoryView } from './components/InventoryView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { SettingsView } from './components/SettingsView.tsx';

import { DashboardStats, Product, Category, Supplier } from './types/index.ts';
import { api } from './lib/api.ts';

function MainApp() {
  const { user, loading: authLoading } = useAuth();
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  // Global cached data
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);

  // Navigation context
  const [targetProductId, setTargetProductId] = useState<number | undefined>(undefined);
  const [productSearchQuery, setProductSearchQuery] = useState<string>('');

  const refreshAll = async () => {
    try {
      setStatsLoading(true);
      const [dashStats, prods, cats, sups] = await Promise.all([
        api.getDashboardStats(),
        api.getProducts(),
        api.getCategories(),
        api.getSuppliers()
      ]);
      setStats(dashStats);
      setProducts(prods);
      setCategories(cats);
      setSuppliers(sups);
    } catch (err) {
      console.error('Failed to load global data:', err);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      refreshAll();
    }
  }, [user]);

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-slate-400">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-semibold text-slate-300">Initialisation de SecurStock...</p>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const handleGlobalSearch = (query: string) => {
    setProductSearchQuery(query);
    setCurrentTab('products');
  };

  const handleNavigateToStockIn = (productId: number) => {
    setTargetProductId(productId);
    setCurrentTab('stock-in');
  };

  const handleNavigateToStockOut = (productId: number) => {
    setTargetProductId(productId);
    setCurrentTab('stock-out');
  };

  const alertCount = (stats?.lowStockCount || 0) + (stats?.outOfStockCount || 0);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setTargetProductId(undefined);
        }}
        mobileOpen={mobileSidebarOpen}
        onCloseMobile={() => setMobileSidebarOpen(false)}
        alertCount={alertCount}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <Navbar
          onOpenMobile={() => setMobileSidebarOpen(true)}
          onNavigate={(tab) => {
            setCurrentTab(tab);
            setTargetProductId(undefined);
          }}
          dashboardStats={stats}
          onSearchSelect={handleGlobalSearch}
        />

        {/* View Router */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full">
          {currentTab === 'dashboard' && (
            <DashboardView
              stats={stats}
              loading={statsLoading}
              onRefresh={refreshAll}
              onNavigate={(tab) => {
                setCurrentTab(tab);
                setTargetProductId(undefined);
              }}
            />
          )}

          {currentTab === 'products' && (
            <ProductsView
              categories={categories}
              initialSearch={productSearchQuery}
              onRefreshStats={refreshAll}
              onNavigateToStockIn={handleNavigateToStockIn}
              onNavigateToStockOut={handleNavigateToStockOut}
            />
          )}

          {currentTab === 'categories' && (
            <CategoriesView onRefreshCategories={refreshAll} />
          )}

          {currentTab === 'stock-in' && (
            <StockInView
              products={products}
              suppliers={suppliers}
              initialProductId={targetProductId}
              onRefreshAll={refreshAll}
              onNavigate={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'stock-out' && (
            <StockOutView
              products={products}
              initialProductId={targetProductId}
              onRefreshAll={refreshAll}
              onNavigate={(tab) => setCurrentTab(tab)}
            />
          )}

          {currentTab === 'movements' && (
            <MovementsView products={products} categories={categories} />
          )}

          {currentTab === 'suppliers' && (
            <SuppliersView onRefreshSuppliers={refreshAll} />
          )}

          {currentTab === 'inventory' && (
            <InventoryView onRefreshAll={refreshAll} />
          )}

          {currentTab === 'reports' && <ReportsView />}

          {currentTab === 'settings' && <SettingsView />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
