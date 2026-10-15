import React from 'react';
import { DashboardStats } from '../types/index.ts';
import { formatFCFA, formatNumber, formatDate, getStockStatus } from '../lib/utils.ts';
import {
  Package,
  Layers,
  Coins,
  AlertTriangle,
  AlertOctagon,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrendingUp,
  Clock,
  ArrowRight,
  ShieldCheck,
  RefreshCw,
  Plus
} from 'lucide-react';
import { NavTab } from './Sidebar.tsx';

interface DashboardViewProps {
  stats: DashboardStats | null;
  loading: boolean;
  onRefresh: () => void;
  onNavigate: (tab: NavTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  stats,
  loading,
  onRefresh,
  onNavigate
}) => {
  if (loading && !stats) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-slate-500">
        <div className="w-10 h-10 border-4 border-amber-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-sm font-medium">Chargement des données du magasin en temps réel...</p>
      </div>
    );
  }

  const chartData = stats?.chartData || [];
  const maxQty = Math.max(
    ...chartData.map((d) => Math.max(d.entries_qty, d.exits_qty)),
    10
  );

  return (
    <div className="space-y-6">
      {/* Top Banner & Quick Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 p-5 rounded-2xl text-white shadow-lg border border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight">Tableau de Bord Magasin</h1>
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-xs font-semibold">
              Temps Réel
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Supervision du stock de matériel de sécurité • Valeur comptable au prix d'achat
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onRefresh}
            className="p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition-colors cursor-pointer"
            title="Rafraîchir les statistiques"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => onNavigate('stock-in')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
          >
            <ArrowDownToLine className="w-4 h-4" />
            <span>Réception Marchandise</span>
          </button>

          <button
            onClick={() => onNavigate('stock-out')}
            className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <ArrowUpFromLine className="w-4 h-4" />
            <span>Sortie Matériel</span>
          </button>
        </div>
      </div>

      {/* Primary KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Valorisation totale du stock */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Valeur du Stock (Achat)</span>
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <Coins className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatFCFA(stats?.totalValuation)}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-semibold text-slate-700">{formatNumber(stats?.totalQuantity)}</span>
            <span>articles physiques en rayon</span>
          </div>
        </div>

        {/* Card 2: Références Produits */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider">Références Actives</span>
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Package className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-900 tracking-tight">
            {formatNumber(stats?.totalReferences)}
          </div>
          <div className="mt-2 text-xs text-slate-500 flex items-center gap-1.5">
            <span className="font-semibold text-emerald-600">
              {stats ? Math.max(0, stats.totalReferences - (stats.outOfStockCount || 0)) : 0}
            </span>
            <span>références disponibles à la vente</span>
          </div>
        </div>

        {/* Card 3: Alertes Stock Faible */}
        <div
          onClick={() => onNavigate('products')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-amber-700">Stock Faible</span>
            <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-amber-600 tracking-tight">
            {stats?.lowStockCount || 0}
          </div>
          <div className="mt-2 text-xs text-amber-700/80 flex items-center justify-between">
            <span>Seuil critique atteint</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>

        {/* Card 4: Ruptures de Stock */}
        <div
          onClick={() => onNavigate('products')}
          className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-red-700">En Rupture</span>
            <div className="w-9 h-9 rounded-xl bg-red-100 text-red-700 flex items-center justify-center font-bold group-hover:scale-110 transition-transform">
              <AlertOctagon className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-black text-red-600 tracking-tight">
            {stats?.outOfStockCount || 0}
          </div>
          <div className="mt-2 text-xs text-red-700/80 flex items-center justify-between">
            <span>Quantité égale à 0</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
          </div>
        </div>
      </div>

      {/* Today's Activity Highlights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Entrées du jour */}
        <div className="bg-emerald-50/60 border border-emerald-200/80 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
              <ArrowDownToLine className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                Entrées de Stock (Aujourd'hui)
              </div>
              <div className="text-xl font-black text-emerald-950 mt-0.5">
                +{formatNumber(stats?.todayEntriesQty)} <span className="text-xs font-medium text-emerald-800">articles reçus</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-200/80 text-emerald-900">
              {stats?.todayEntriesCount || 0} réception(s)
            </span>
          </div>
        </div>

        {/* Sorties du jour */}
        <div className="bg-amber-50/60 border border-amber-200/80 rounded-2xl p-4 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-xl bg-amber-600 text-white flex items-center justify-center shadow-xs">
              <ArrowUpFromLine className="w-6 h-6" />
            </div>
            <div>
              <div className="text-xs font-bold uppercase tracking-wider text-amber-800">
                Sorties de Stock (Aujourd'hui)
              </div>
              <div className="text-xl font-black text-amber-950 mt-0.5">
                -{formatNumber(stats?.todayExitsQty)} <span className="text-xs font-medium text-amber-800">articles livrés</span>
              </div>
            </div>
          </div>
          <div className="text-right">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-amber-200/80 text-amber-900">
              {stats?.todayExitsCount || 0} livraison(s)
            </span>
          </div>
        </div>
      </div>

      {/* Middle Section: Movement Volume Chart & Category Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Activity Chart (Last 7 days) */}
        <div className="lg:col-span-2 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-amber-500" />
                Mouvements des 7 Derniers Jours
              </h2>
              <p className="text-xs text-slate-500">Volume quotidien des entrées vs sorties en unités</p>
            </div>
            <div className="flex items-center gap-3 text-xs font-semibold">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-emerald-500" />
                <span className="text-slate-600">Entrées</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm bg-amber-500" />
                <span className="text-slate-600">Sorties</span>
              </div>
            </div>
          </div>

          {/* Interactive Responsive SVG Bar Chart */}
          <div className="h-56 w-full flex items-end gap-2 sm:gap-4 pt-6 pb-2 px-2 border-b border-slate-100">
            {chartData.map((d, i) => {
              const entryHeight = maxQty > 0 ? (d.entries_qty / maxQty) * 160 : 0;
              const exitHeight = maxQty > 0 ? (d.exits_qty / maxQty) * 160 : 0;
              const dateLabel = new Date(d.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });

              return (
                <div key={i} className="flex-1 flex flex-col items-center h-full justify-end group">
                  <div className="w-full flex items-end justify-center gap-1 h-44">
                    {/* Bar Entries */}
                    <div
                      style={{ height: `${Math.max(entryHeight, 4)}px` }}
                      className="w-1/2 max-w-[20px] bg-emerald-500 rounded-t-sm transition-all group-hover:bg-emerald-400 relative"
                    >
                      {d.entries_qty > 0 && (
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-0.5 px-1.5 rounded whitespace-nowrap pointer-events-none transition-opacity z-10 font-bold">
                          +{d.entries_qty}
                        </div>
                      )}
                    </div>
                    {/* Bar Exits */}
                    <div
                      style={{ height: `${Math.max(exitHeight, 4)}px` }}
                      className="w-1/2 max-w-[20px] bg-amber-500 rounded-t-sm transition-all group-hover:bg-amber-400 relative"
                    >
                      {d.exits_qty > 0 && (
                        <div className="opacity-0 group-hover:opacity-100 absolute -top-7 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] py-0.5 px-1.5 rounded whitespace-nowrap pointer-events-none transition-opacity z-10 font-bold">
                          -{d.exits_qty}
                        </div>
                      )}
                    </div>
                  </div>
                  <span className="text-[10px] font-semibold text-slate-500 mt-2 truncate max-w-full capitalize">
                    {dateLabel}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Categories by Valuation */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Layers className="w-4 h-4 text-amber-500" />
                Top Catégories (Valeur)
              </h2>
              <button
                onClick={() => onNavigate('categories')}
                className="text-xs text-amber-600 hover:text-amber-700 font-bold cursor-pointer"
              >
                Voir tout
              </button>
            </div>

            <div className="space-y-3.5">
              {stats?.categoryStats.map((cat, idx) => {
                const totalStockVal = stats.totalValuation || 1;
                const percentage = Math.round((cat.total_value / totalStockVal) * 100);

                return (
                  <div key={idx} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-slate-800 truncate max-w-[150px]">
                        {cat.category_name}
                      </span>
                      <span className="font-bold text-slate-900">{formatFCFA(cat.total_value)}</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                      <div
                        style={{ width: `${Math.min(percentage, 100)}%` }}
                        className="bg-amber-500 rounded-full"
                      />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-slate-400">
                      <span>{cat.product_count} réf. ({cat.total_stock} pcs)</span>
                      <span>{percentage}% du stock</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span>Devise utilisée :</span>
            <span className="font-bold text-slate-800">FCFA (Francs CFA)</span>
          </div>
        </div>
      </div>

      {/* Bottom Section: Urgent Restock Table & Recent Movements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Urgent Restock */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Articles à Réapprovisionner Urgent
              </h2>
              <p className="text-xs text-slate-500">Quantité inférieure ou égale au seuil de sécurité</p>
            </div>
            <button
              onClick={() => onNavigate('products')}
              className="text-xs text-amber-600 hover:text-amber-700 font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Catalogue</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            {stats?.restockNeeded && stats.restockNeeded.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                    <th className="py-2.5 px-4">Produit & Réf</th>
                    <th className="py-2.5 px-3">Catégorie</th>
                    <th className="py-2.5 px-3 text-center">Stock</th>
                    <th className="py-2.5 px-3 text-center">Seuil</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.restockNeeded.map((prod) => {
                    const status = getStockStatus(prod.current_stock, prod.min_stock_alert);
                    return (
                      <tr key={prod.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900 truncate max-w-[200px]">{prod.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">{prod.sku}</div>
                        </td>
                        <td className="py-3 px-3 text-slate-600 truncate max-w-[120px]">{prod.category_name}</td>
                        <td className="py-3 px-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${status.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass}`} />
                            {prod.current_stock} {prod.unit}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-semibold text-slate-500">{prod.min_stock_alert}</td>
                        <td className="py-3 px-4 text-right">
                          <button
                            onClick={() => onNavigate('stock-in')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold text-[11px] border border-emerald-200 transition-colors cursor-pointer"
                          >
                            + Entrée
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                <ShieldCheck className="w-8 h-8 text-emerald-500 mx-auto mb-2 opacity-80" />
                Aucune alerte critique. Tous vos articles sont au-dessus de leur seuil minimal.
              </div>
            )}
          </div>
        </div>

        {/* Recent Movements Log */}
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
          <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                Derniers Mouvements Enregistrés
              </h2>
              <p className="text-xs text-slate-500">Traçabilité complète des réceptions et livraisons</p>
            </div>
            <button
              onClick={() => onNavigate('movements')}
              className="text-xs text-amber-600 hover:text-amber-700 font-bold inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Historique</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            {stats?.recentMovements && stats.recentMovements.length > 0 ? (
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-semibold border-b border-slate-100">
                    <th className="py-2.5 px-4">N° Mouvement</th>
                    <th className="py-2.5 px-3">Produit</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Qté</th>
                    <th className="py-2.5 px-4 text-right">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stats.recentMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-3 px-4">
                        <div className="font-mono text-[11px] font-bold text-slate-800">{m.movement_number}</div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]">{m.user_name}</div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="font-semibold text-slate-900 truncate max-w-[160px]">{m.product_name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">{m.product_sku}</div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                            m.type === 'ENTREE'
                              ? 'bg-emerald-100 text-emerald-800'
                              : m.type === 'SORTIE'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-purple-100 text-purple-800'
                          }`}
                        >
                          {m.type === 'ENTREE' ? 'ENTRÉE' : m.type === 'SORTIE' ? 'SORTIE' : 'AJUSTEMENT'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-black">
                        <span
                          className={
                            m.type === 'ENTREE'
                              ? 'text-emerald-600'
                              : m.type === 'SORTIE'
                              ? 'text-amber-600'
                              : 'text-purple-600'
                          }
                        >
                          {m.type === 'SORTIE' ? `-${m.quantity}` : `+${m.quantity}`} {m.product_unit}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right text-[11px] text-slate-400 whitespace-nowrap">
                        {formatDate(m.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-slate-400 text-xs">
                Aucun mouvement de stock enregistré.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
