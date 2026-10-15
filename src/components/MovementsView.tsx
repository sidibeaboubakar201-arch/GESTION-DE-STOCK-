import React, { useState, useEffect } from 'react';
import { StockMovement, Product, Category } from '../types/index.ts';
import { api } from '../lib/api.ts';
import { formatFCFA, formatDate } from '../lib/utils.ts';
import {
  History,
  Search,
  Filter,
  Download,
  ArrowDownToLine,
  ArrowUpFromLine,
  RefreshCw,
  FileSpreadsheet,
  Calendar,
  Layers,
  Package
} from 'lucide-react';

interface MovementsViewProps {
  products: Product[];
  categories: Category[];
}

export const MovementsView: React.FC<MovementsViewProps> = ({ products, categories }) => {
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // Filters
  const [typeFilter, setTypeFilter] = useState<string>('');
  const [productIdFilter, setProductIdFilter] = useState<string>('');
  const [categoryIdFilter, setCategoryIdFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  useEffect(() => {
    fetchMovements();
  }, [typeFilter, productIdFilter, categoryIdFilter, dateRange]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchMovements();
    }, 250);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchMovements = async () => {
    try {
      setLoading(true);

      let startDate: string | undefined = undefined;
      const now = new Date();
      if (dateRange === 'today') {
        startDate = now.toISOString().slice(0, 10);
      } else if (dateRange === 'week') {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        startDate = d.toISOString().slice(0, 10);
      } else if (dateRange === 'month') {
        const d = new Date();
        d.setDate(d.getDate() - 30);
        startDate = d.toISOString().slice(0, 10);
      }

      const res = await api.getMovements({
        type: typeFilter || undefined,
        product_id: productIdFilter ? Number(productIdFilter) : undefined,
        category_id: categoryIdFilter ? Number(categoryIdFilter) : undefined,
        start_date: startDate,
        search: search.trim() || undefined,
        limit: 100
      });

      setMovements(res.movements);
      setTotalCount(res.totalCount);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <History className="w-5 h-5 text-blue-600" />
            Historique & Traçabilité des Mouvements
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Journal immuable • Entrées, sorties, ajustements inventaires • {totalCount} mouvements répertoriés
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={fetchMovements}
            className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors cursor-pointer"
            title="Rafraîchir"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <a
            href={api.exportMovementsCsvUrl()}
            download
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Exporter l'Historique (CSV)</span>
          </a>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="N° mouvement, référence, tiers..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Movement Type */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-amber-500"
          >
            <option value="">Tous les types</option>
            <option value="ENTREE">Entrées uniquement</option>
            <option value="SORTIE">Sorties uniquement</option>
            <option value="AJUSTEMENT_INVENTAIRE">Ajustements d'inventaire</option>
          </select>

          {/* Date range */}
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 focus:bg-white focus:outline-none focus:border-amber-500"
          >
            <option value="all">Toutes dates</option>
            <option value="today">Aujourd'hui</option>
            <option value="week">7 derniers jours</option>
            <option value="month">Ce mois</option>
          </select>

          {/* Product */}
          <select
            value={productIdFilter}
            onChange={(e) => setProductIdFilter(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-amber-500 max-w-[180px]"
          >
            <option value="">Tous les produits</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.sku} - {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Movement Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200">
                <th className="py-3 px-4">Date & Heure</th>
                <th className="py-3 px-3">N° Mouvement</th>
                <th className="py-3 px-3">Matériel Sécurité</th>
                <th className="py-3 px-2 text-center">Type</th>
                <th className="py-3 px-3 text-right">Quantité</th>
                <th className="py-3 px-3 text-center">Avant / Après</th>
                <th className="py-3 px-3">Motif & Document</th>
                <th className="py-3 px-3">Tiers (Fournisseur/Client)</th>
                <th className="py-3 px-4">Responsable</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Chargement de l'historique...
                  </td>
                </tr>
              ) : movements.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    <History className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    Aucun mouvement trouvé pour cette sélection.
                  </td>
                </tr>
              ) : (
                movements.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 text-slate-500 whitespace-nowrap">
                      {formatDate(m.created_at)}
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-900">
                      {m.movement_number}
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-bold text-slate-900 truncate max-w-[200px]">{m.product_name}</div>
                      <div className="font-mono text-[10px] text-slate-400">{m.product_sku}</div>
                    </td>
                    <td className="py-3 px-2 text-center">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${
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
                    <td className="py-3 px-3 text-center font-mono text-slate-500 whitespace-nowrap">
                      {m.stock_before} → <span className="font-bold text-slate-900">{m.stock_after}</span>
                    </td>
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 truncate max-w-[160px]">{m.reason}</div>
                      {m.document_reference && (
                        <div className="text-[10px] font-mono text-slate-400">Réf: {m.document_reference}</div>
                      )}
                    </td>
                    <td className="py-3 px-3 text-slate-700 truncate max-w-[140px]">
                      {m.partner_name || '-'}
                    </td>
                    <td className="py-3 px-4 text-slate-500 truncate max-w-[140px]">
                      {m.user_name}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
