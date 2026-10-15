import React, { useState, useEffect } from 'react';
import { api } from '../lib/api.ts';
import { formatFCFA, formatNumber, formatDate } from '../lib/utils.ts';
import {
  BarChart3,
  Download,
  Coins,
  Package,
  Layers,
  TrendingUp,
  AlertTriangle,
  FileSpreadsheet,
  Calendar,
  CheckCircle2
} from 'lucide-react';

export const ReportsView: React.FC = () => {
  const [valuationData, setValuationData] = useState<any>(null);
  const [periodData, setPeriodData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonths, setSelectedMonths] = useState(6);

  useEffect(() => {
    loadReports();
  }, [selectedMonths]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const [val, per] = await Promise.all([
        api.getValuationReport(),
        api.getPeriodicMovementsReport(selectedMonths)
      ]);
      setValuationData(val);
      setPeriodData(per);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            Rapports Comptables & Audit du Stock
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Valorisation financière en FCFA • Analyse par famille d'équipements • Évolution périodique
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={api.exportProductsCsvUrl()}
            download
            className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-amber-400" />
            <span>Export Stock Complet (Excel)</span>
          </a>
        </div>
      </div>

      {/* Global Stock Financial Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Valorisation Globale au Prix d'Achat
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatFCFA(valuationData?.globalTotal?.total_valuation)}
          </div>
          <p className="text-xs text-slate-500 mt-1">Montant immobilisé dans le magasin</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Volume Total d'Articles Physiques
          </div>
          <div className="text-2xl font-black text-amber-600">
            {formatNumber(valuationData?.globalTotal?.total_quantity)} <span className="text-sm font-normal text-slate-600">pièces</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Tous matériels et accessoires confondus</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
            Catalogue de Sécurité
          </div>
          <div className="text-2xl font-black text-slate-900">
            {formatNumber(valuationData?.globalTotal?.total_products)} <span className="text-sm font-normal text-slate-600">références</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">Nombre d'articles au catalogue actif</p>
        </div>
      </div>

      {/* Section 1: Valuation Breakdown by Category */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="w-4 h-4 text-amber-500" />
              État & Valorisation par Catégorie de Sécurité
            </h2>
            <p className="text-xs text-slate-500">Répartition de la valeur du stock au coût d'acquisition</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <th className="py-3 px-4">Famille de Matériel</th>
                <th className="py-3 px-3 text-center">Références</th>
                <th className="py-3 px-3 text-center">Quantité en Rayon</th>
                <th className="py-3 px-4 text-right">Valeur Stock (Achat FCFA)</th>
                <th className="py-3 px-4 text-right">Valeur Vente Estimée (FCFA)</th>
                <th className="py-3 px-4 text-right">Marge Potentielle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {valuationData?.byCategory?.map((cat: any) => {
                const margin = cat.total_retail_value - cat.total_cost_value;
                const marginPercent = cat.total_cost_value > 0 ? Math.round((margin / cat.total_cost_value) * 100) : 0;

                return (
                  <tr key={cat.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-bold text-slate-900">{cat.category_name}</td>
                    <td className="py-3 px-3 text-center text-slate-700 font-semibold">{cat.product_count}</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-900">{cat.total_units}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">{formatFCFA(cat.total_cost_value)}</td>
                    <td className="py-3 px-4 text-right font-medium text-emerald-700">{formatFCFA(cat.total_retail_value)}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="font-bold text-slate-800">{formatFCFA(margin)}</span>{' '}
                      <span className="text-[10px] text-emerald-600 font-semibold">({marginPercent}%)</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 2: Top 10 Most Valued Products in Stock */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Package className="w-4 h-4 text-blue-500" />
              Top 10 des Produits les Plus Immobilisés (Valeur en Stock)
            </h2>
            <p className="text-xs text-slate-500">Articles représentant la plus forte valeur financière dans le magasin</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                <th className="py-3 px-4">Rang</th>
                <th className="py-3 px-3">Référence SKU</th>
                <th className="py-3 px-4">Nom du Matériel</th>
                <th className="py-3 px-3">Catégorie</th>
                <th className="py-3 px-3 text-right">Prix Unitaire</th>
                <th className="py-3 px-3 text-center">Quantité</th>
                <th className="py-3 px-4 text-right">Valeur Totale FCFA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {valuationData?.topValuedProducts?.map((p: any, idx: number) => (
                <tr key={p.id} className="hover:bg-slate-50/70">
                  <td className="py-3 px-4 font-black text-slate-400">#{idx + 1}</td>
                  <td className="py-3 px-3 font-mono font-bold text-slate-800">{p.sku}</td>
                  <td className="py-3 px-4 font-bold text-slate-900">{p.name}</td>
                  <td className="py-3 px-3 text-slate-600">{p.category_name}</td>
                  <td className="py-3 px-3 text-right text-slate-700 font-medium">{formatFCFA(p.purchase_price)}</td>
                  <td className="py-3 px-3 text-center font-bold text-slate-900">{p.current_stock} {p.unit}</td>
                  <td className="py-3 px-4 text-right font-black text-amber-600">{formatFCFA(p.stock_value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Section 3: Monthly Trends */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              Évolution Mensuelle des Flux de Marchandises
            </h2>
            <p className="text-xs text-slate-500">Volume des entrées vs livraisons par mois</p>
          </div>

          <select
            value={selectedMonths}
            onChange={(e) => setSelectedMonths(Number(e.target.value))}
            className="px-3 py-1.5 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:border-amber-500"
          >
            <option value={3}>3 derniers mois</option>
            <option value={6}>6 derniers mois</option>
            <option value={12}>12 derniers mois</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          {periodData.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <th className="py-3 px-4">Période (Mois)</th>
                  <th className="py-3 px-3 text-center">Articles Reçus (Entrées)</th>
                  <th className="py-3 px-3 text-center">Articles Livrés (Sorties)</th>
                  <th className="py-3 px-3 text-center">Régularisations Inventaire</th>
                  <th className="py-3 px-4 text-right">Valeur Achats Reçus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {periodData.map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-3 px-4 font-bold text-slate-900 font-mono">{row.month}</td>
                    <td className="py-3 px-3 text-center font-black text-emerald-600">+{row.total_entries_qty}</td>
                    <td className="py-3 px-3 text-center font-black text-amber-600">-{row.total_exits_qty}</td>
                    <td className="py-3 px-3 text-center font-bold text-purple-600">{row.total_adjustments_qty}</td>
                    <td className="py-3 px-4 text-right font-black text-slate-900">
                      {formatFCFA(row.entries_financial_value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              Aucune donnée périodique pour cet intervalle.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
