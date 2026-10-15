import React, { useState, useEffect } from 'react';
import { InventorySession, InventoryItem } from '../types/index.ts';
import { api } from '../lib/api.ts';
import { formatFCFA, formatNumber, formatDate } from '../lib/utils.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  ClipboardCheck,
  Play,
  CheckCircle2,
  AlertTriangle,
  X,
  History,
  RotateCcw,
  Save,
  ShieldCheck,
  Search,
  AlertCircle
} from 'lucide-react';

export const InventoryView: React.FC<{ onRefreshAll: () => void }> = ({ onRefreshAll }) => {
  const { user } = useAuth();

  const [activeSession, setActiveSession] = useState<InventorySession | null>(null);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [catalogProducts, setCatalogProducts] = useState<any[]>([]);
  const [history, setHistory] = useState<InventorySession[]>([]);
  const [loading, setLoading] = useState(true);

  // Counting inputs: { [productId]: countedQty }
  const [counts, setCounts] = useState<Record<number, number>>({});
  const [searchFilter, setSearchFilter] = useState('');
  const [showValidateModal, setShowValidateModal] = useState(false);
  const [validationNotes, setValidationNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    loadInventoryData();
  }, []);

  const loadInventoryData = async () => {
    try {
      setLoading(true);
      const res = await api.getActiveInventory();
      setActiveSession(res.activeSession);
      setItems(res.items);
      setCatalogProducts(res.catalogProducts);

      // Pre-fill counts from active items if any
      const initialCounts: Record<number, number> = {};
      res.items.forEach((item) => {
        initialCounts[item.product_id] = item.counted_stock;
      });
      setCounts(initialCounts);

      // Also fetch past history
      const hist = await api.getInventoryHistory();
      setHistory(hist);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  const handleStartSession = async () => {
    try {
      setSubmitting(true);
      const res = await api.startInventory('Inventaire périodique de contrôle');
      showNotification(`Session d'inventaire ${res.session.session_number} ouverte.`);
      loadInventoryData();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'ouverture de la session.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCountChange = (productId: number, val: string) => {
    const num = Math.max(0, parseInt(val, 10) || 0);
    setCounts((prev) => ({ ...prev, [productId]: num }));
  };

  const handleSaveProgress = async () => {
    if (!activeSession) return;
    try {
      setSubmitting(true);
      await api.saveInventoryCounts(activeSession.id, counts);
      showNotification('Comptages temporaires enregistrés.');
      loadInventoryData();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'enregistrement.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleValidateSession = async () => {
    if (!activeSession) return;
    try {
      setSubmitting(true);
      // First save latest counts
      await api.saveInventoryCounts(activeSession.id, counts);

      const res = await api.validateInventory(activeSession.id, validationNotes);
      setShowValidateModal(false);
      showNotification(res.message);
      loadInventoryData();
      onRefreshAll();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de la validation.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelSession = async () => {
    if (!activeSession) return;
    if (!window.confirm('Voulez-vous vraiment annuler cette session d\'inventaire ? Aucun stock ne sera modifié.')) {
      return;
    }

    try {
      setSubmitting(true);
      await api.cancelInventory(activeSession.id);
      showNotification('Session d\'inventaire annulée.');
      loadInventoryData();
    } catch (err: any) {
      alert(err.message || 'Erreur lors de l\'annulation.');
    } finally {
      setSubmitting(false);
    }
  };

  // Discrepancy calculations
  const discrepanciesList = items.map((item) => {
    const counted = counts[item.product_id] !== undefined ? counts[item.product_id] : item.theoretical_stock;
    const diff = counted - item.theoretical_stock;
    return {
      ...item,
      currentCounted: counted,
      diff
    };
  });

  const totalDifferences = discrepanciesList.filter((d) => d.diff !== 0);
  const totalSurplus = discrepanciesList.filter((d) => d.diff > 0);
  const totalShortage = discrepanciesList.filter((d) => d.diff < 0);

  const filteredItems = discrepanciesList.filter(
    (item) =>
      item.name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.sku?.toLowerCase().includes(searchFilter.toLowerCase()) ||
      item.category_name?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 border border-amber-500/30 text-xs font-semibold animate-in fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toast}</span>
        </div>
      )}

      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ClipboardCheck className="w-5 h-5 text-indigo-600" />
            Inventaire Physique & Régularisation
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Comptage physique des articles • Calcul des écarts • Régularisation traçable par mouvement
          </p>
        </div>

        {activeSession ? (
          <div className="flex items-center gap-2">
            <button
              onClick={handleSaveProgress}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Sauvegarder Brouillon</span>
            </button>

            <button
              onClick={handleCancelSession}
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Annuler Session</span>
            </button>

            <button
              onClick={() => setShowValidateModal(true)}
              disabled={submitting}
              className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs shadow-md shadow-emerald-700/20 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Valider & Corriger le Stock</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleStartSession}
            disabled={submitting}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>Ouvrir une Session d'Inventaire</span>
          </button>
        )}
      </div>

      {/* Main Content Area */}
      {activeSession ? (
        <div className="space-y-4">
          {/* Active Session Status Card */}
          <div className="bg-slate-900 text-white p-5 rounded-2xl border border-slate-800 shadow-md">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-xs font-bold uppercase tracking-wider text-amber-400">
                    Session d'Inventaire en Cours : {activeSession.session_number}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-1">
                  Ouverte le {formatDate(activeSession.created_at)} par {activeSession.user_name}
                </div>
              </div>

              {/* Discrepancies Counter */}
              <div className="flex items-center gap-4 text-xs">
                <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  <span className="text-[10px] text-slate-400 block uppercase font-bold">Articles vérifiés</span>
                  <span className="text-base font-black text-white">{items.length}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  <span className="text-[10px] text-emerald-400 block uppercase font-bold">Surplus (+ stock)</span>
                  <span className="text-base font-black text-emerald-400">{totalSurplus.length}</span>
                </div>
                <div className="p-2.5 rounded-xl bg-slate-800 border border-slate-700">
                  <span className="text-[10px] text-red-400 block uppercase font-bold">Manquants (- stock)</span>
                  <span className="text-base font-black text-red-400">{totalShortage.length}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Search filter for inventory sheet */}
          <div className="bg-white p-3.5 rounded-2xl border border-slate-200/80 shadow-xs flex items-center justify-between">
            <div className="relative w-full max-w-sm">
              <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchFilter}
                onChange={(e) => setSearchFilter(e.target.value)}
                placeholder="Filtrer un article par référence ou nom..."
                className="w-full pl-9 pr-4 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-amber-500"
              />
            </div>
            <div className="text-xs text-slate-500 font-medium">
              Saisissez la quantité comptée dans la colonne "Quantité Réelle"
            </div>
          </div>

          {/* Inventory Worksheet Table */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200">
                    <th className="py-3 px-4">Référence SKU</th>
                    <th className="py-3 px-3">Produit Sécurité</th>
                    <th className="py-3 px-3">Catégorie</th>
                    <th className="py-3 px-3 text-center">Stock Théorique</th>
                    <th className="py-3 px-4 text-center">Quantité Réelle Comptée</th>
                    <th className="py-3 px-3 text-center">Écart Constaté</th>
                    <th className="py-3 px-4 text-right">Valeur Écart</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredItems.map((item) => {
                    const counted = counts[item.product_id] !== undefined ? counts[item.product_id] : item.theoretical_stock;
                    const diff = counted - item.theoretical_stock;
                    const diffValue = diff * item.unit_price;

                    return (
                      <tr
                        key={item.id}
                        className={`hover:bg-slate-50/70 transition-colors ${
                          diff !== 0 ? (diff > 0 ? 'bg-emerald-50/30' : 'bg-red-50/30') : ''
                        }`}
                      >
                        <td className="py-3 px-4 font-mono font-bold text-slate-900">{item.sku}</td>
                        <td className="py-3 px-3">
                          <div className="font-bold text-slate-900">{item.name}</div>
                          {item.location && <div className="text-[10px] text-slate-400">Rayon : {item.location}</div>}
                        </td>
                        <td className="py-3 px-3 text-slate-600">{item.category_name}</td>
                        <td className="py-3 px-3 text-center font-bold text-slate-800">
                          {item.theoretical_stock} {item.unit}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={counted}
                            onChange={(e) => handleCountChange(item.product_id, e.target.value)}
                            className="w-24 text-center py-1.5 px-2 border-2 border-slate-300 rounded-lg text-sm font-black text-slate-900 focus:border-amber-500 focus:outline-none"
                          />
                        </td>
                        <td className="py-3 px-3 text-center font-black">
                          {diff === 0 ? (
                            <span className="text-slate-400 font-medium">Conforme (0)</span>
                          ) : diff > 0 ? (
                            <span className="inline-block px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                              Surplus (+{diff})
                            </span>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded bg-red-100 text-red-800">
                              Manquant ({diff})
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right font-bold">
                          {diff === 0 ? (
                            <span className="text-slate-400">-</span>
                          ) : (
                            <span className={diff > 0 ? 'text-emerald-700' : 'text-red-700'}>
                              {formatFCFA(diffValue)}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        /* No active inventory state */
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto">
            <ClipboardCheck className="w-8 h-8" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Aucune session d'inventaire en cours</h2>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Ouvrez une nouvelle session pour figer l'état théorique du stock, compter les matériels dans les rayons et ajuster les quantités avec traçabilité intégrale.
            </p>
          </div>
          <button
            onClick={handleStartSession}
            disabled={submitting}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 cursor-pointer"
          >
            <Play className="w-4 h-4" />
            <span>Démarrer un nouvel inventaire</span>
          </button>
        </div>
      )}

      {/* Past Inventory History */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <History className="w-4 h-4 text-slate-500" />
            <h2 className="text-sm font-bold text-slate-900">Historique des Sessions d'Inventaire</h2>
          </div>
        </div>

        <div className="overflow-x-auto">
          {history.length > 0 ? (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-4">N° Session</th>
                  <th className="py-2.5 px-3">Date & Heure</th>
                  <th className="py-2.5 px-3">Statut</th>
                  <th className="py-2.5 px-3">Articles</th>
                  <th className="py-2.5 px-3 text-center">Écarts Régularisés</th>
                  <th className="py-2.5 px-4">Responsable</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {history.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50/60">
                    <td className="py-3 px-4 font-mono font-bold text-slate-900">{s.session_number}</td>
                    <td className="py-3 px-3 text-slate-500">{formatDate(s.created_at)}</td>
                    <td className="py-3 px-3">
                      <span
                        className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                          s.status === 'VALIDE'
                            ? 'bg-emerald-100 text-emerald-800'
                            : s.status === 'EN_COURS'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-600'
                        }`}
                      >
                        {s.status === 'VALIDE' ? 'VALIDÉ' : s.status === 'EN_COURS' ? 'EN COURS' : 'ANNULÉ'}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700">{s.total_items} articles</td>
                    <td className="py-3 px-3 text-center font-bold text-slate-900">
                      {s.total_discrepancies > 0 ? (
                        <span className="text-amber-600 font-bold">{s.total_discrepancies} régularisation(s)</span>
                      ) : (
                        <span className="text-emerald-600">0 écart</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-slate-600">{s.user_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="p-8 text-center text-slate-400 text-xs">
              Aucune session d'inventaire archivée.
            </div>
          )}
        </div>
      </div>

      {/* VALIDATION CONFIRMATION MODAL */}
      {showValidateModal && activeSession && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 p-6 text-xs space-y-4">
            <div className="flex items-center gap-3 text-indigo-600">
              <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Validation Finale de l'Inventaire</h3>
                <p className="text-slate-500">Génération automatique des mouvements de régularisation</p>
              </div>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex justify-between font-semibold">
                <span className="text-slate-600">Total articles contrôlés :</span>
                <span className="text-slate-900">{items.length}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-slate-600">Articles avec écart (à régulariser) :</span>
                <span className="font-bold text-amber-600">{totalDifferences.length}</span>
              </div>
              <div className="flex justify-between text-emerald-700">
                <span>• Surplus constatés :</span>
                <span className="font-bold">+{totalSurplus.length} produit(s)</span>
              </div>
              <div className="flex justify-between text-red-700">
                <span>• Manquants constatés :</span>
                <span className="font-bold">-{totalShortage.length} produit(s)</span>
              </div>
            </div>

            <p className="text-slate-600">
              Chaque écart entraînera la création d'un mouvement officiel de type <span className="font-bold font-mono">AJUSTEMENT_INVENTAIRE</span> avec l'horodatage et l'auteur. Le stock en rayon sera mis à jour avec les valeurs réelles comptées.
            </p>

            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Note de clôture / Visa de l'inventaire
              </label>
              <textarea
                rows={2}
                value={validationNotes}
                onChange={(e) => setValidationNotes(e.target.value)}
                placeholder="Inventaire annuel clôturé sans anomalie majeure..."
                className="w-full p-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowValidateModal(false)}
                className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Retour aux comptages
              </button>
              <button
                type="button"
                onClick={handleValidateSession}
                disabled={submitting}
                className="px-5 py-2 font-bold bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl shadow-md cursor-pointer"
              >
                {submitting ? 'Ajustement en cours...' : 'Confirmer et Ajuster le Stock'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
