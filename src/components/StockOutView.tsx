import React, { useState } from 'react';
import { Product, StockMovement } from '../types/index.ts';
import { api } from '../lib/api.ts';
import { formatFCFA, formatDate, getStockStatus } from '../lib/utils.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  ArrowUpFromLine,
  Package,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  AlertCircle,
  History,
  ShieldCheck,
  UserCheck,
  X
} from 'lucide-react';
import { NavTab } from './Sidebar.tsx';

interface StockOutViewProps {
  products: Product[];
  initialProductId?: number;
  onRefreshAll: () => void;
  onNavigate: (tab: NavTab) => void;
}

export const StockOutView: React.FC<StockOutViewProps> = ({
  products,
  initialProductId,
  onRefreshAll,
  onNavigate
}) => {
  const { user } = useAuth();

  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProductId ? String(initialProductId) : ''
  );
  const [quantity, setQuantity] = useState<string>('1');
  const [reason, setReason] = useState<string>('Vente');
  const [recipient, setRecipient] = useState<string>('');
  const [docRef, setDocRef] = useState<string>('');
  const [comment, setComment] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [lastMovement, setLastMovement] = useState<StockMovement | null>(null);

  const selectedProduct = products.find((p) => String(p.id) === selectedProductId);
  const parsedQty = Math.round(Number(quantity)) || 0;
  const isOutOfStock = selectedProduct ? selectedProduct.current_stock === 0 : false;
  const isExcess = selectedProduct ? parsedQty > selectedProduct.current_stock : false;

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProductId || !selectedProduct) {
      setError('Veuillez sélectionner un produit.');
      return;
    }

    if (parsedQty <= 0) {
      setError('La quantité sortie doit être strictement supérieure à zéro (> 0).');
      return;
    }

    if (parsedQty > selectedProduct.current_stock) {
      setError(
        `Opération impossible : quantité demandée (${parsedQty} ${selectedProduct.unit}) supérieure au stock disponible (${selectedProduct.current_stock} ${selectedProduct.unit}).`
      );
      return;
    }

    // Open confirmation dialog
    setShowConfirmModal(true);
  };

  const handleConfirmSubmit = async () => {
    if (!selectedProduct) return;

    try {
      setLoading(true);
      setError(null);

      const res = await api.createStockOut({
        product_id: selectedProduct.id,
        quantity: parsedQty,
        reason,
        recipient_name: recipient.trim() || undefined,
        document_reference: docRef.trim() || undefined,
        comment: comment.trim() || undefined
      });

      setShowConfirmModal(false);
      setLastMovement(res.movement);
      setQuantity('1');
      setRecipient('');
      setDocRef('');
      setComment('');
      onRefreshAll();
    } catch (err: any) {
      setShowConfirmModal(false);
      setError(err.message || 'Erreur lors de l\'enregistrement de la sortie.');
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
            <ArrowUpFromLine className="w-5 h-5 text-amber-600" />
            Enregistrement d'une Sortie de Stock (Déstockage)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Vente, installation client, utilisation interne • Contrôle strict des quantités disponibles
          </p>
        </div>

        <button
          onClick={() => onNavigate('movements')}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer self-start sm:self-auto"
        >
          <History className="w-4 h-4" />
          <span>Consulter l'Historique</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Container */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 sm:p-6">
          <form onSubmit={handlePreSubmit} className="space-y-4 text-xs">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Product selection */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Sélectionner le matériel à sortir *
              </label>
              <select
                required
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500"
              >
                <option value="">-- Choisissez un produit du catalogue --</option>
                {products
                  .filter((p) => !p.is_archived)
                  .map((p) => (
                    <option key={p.id} value={p.id} disabled={p.current_stock === 0}>
                      [{p.sku}] {p.name} — {p.current_stock === 0 ? '(RUPTURE)' : `(Dispo : ${p.current_stock} ${p.unit})`}
                    </option>
                  ))}
              </select>
            </div>

            {/* Quantity */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Quantité sortie *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="1"
                  max={selectedProduct ? selectedProduct.current_stock : 99999}
                  step="1"
                  required
                  disabled={isOutOfStock}
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className={`w-full px-3.5 py-2.5 border rounded-xl text-sm font-black text-slate-900 focus:outline-none ${
                    isExcess ? 'border-red-500 bg-red-50/30' : 'border-slate-300 focus:border-amber-500'
                  }`}
                />
                <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                  {selectedProduct?.unit || 'Unité'}
                </span>
              </div>
              {isExcess && (
                <p className="text-[11px] text-red-600 font-bold mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  La quantité saisie ({parsedQty}) dépasse le stock disponible ({selectedProduct?.current_stock}).
                </p>
              )}
            </div>

            {/* Reason */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Motif de sortie *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-amber-500"
              >
                <option value="Vente">Vente comptoir / Client</option>
                <option value="Installation chez un client">Installation chez un client (Projet)</option>
                <option value="Utilisation interne">Utilisation interne (Magasin/Bureaux)</option>
                <option value="Transfert exceptionnel">Transfert exceptionnel</option>
                <option value="Produit endommagé">Produit endommagé / Défectueux</option>
                <option value="Perte">Perte constatée</option>
                <option value="Retour fournisseur">Retour fournisseur (SAV/Remplacement)</option>
                <option value="Autre motif">Autre motif</option>
              </select>
            </div>

            {/* Client / Recipient & Document Ref */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Client / Destinataire (facultatif)
                </label>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="Ex: Banque Atlantique, Société BOA, M. KONE..."
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Référence document associé (BL / Devis / Facture)
                </label>
                <input
                  type="text"
                  value={docRef}
                  onChange={(e) => setDocRef(e.target.value)}
                  placeholder="Ex: DEV-2026-90, BLS-0045"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-mono"
                />
              </div>
            </div>

            {/* Comment */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Commentaire ou observations (facultatif)
              </label>
              <textarea
                rows={2}
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Détails du chantier, technicien responsable, bon d'intervention..."
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
              />
            </div>

            {/* User identification */}
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-[11px] text-slate-500">
              <span>Opération supervisée par :</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                {user?.full_name} ({user?.role})
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || !selectedProductId || isOutOfStock || isExcess}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-sm rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ArrowUpFromLine className="w-4 h-4" />
              <span>{isOutOfStock ? 'Article en rupture de stock' : 'Vérifier et Valider la sortie'}</span>
            </button>
          </form>
        </div>

        {/* Live Simulation Card & Last Movement Receipt */}
        <div className="space-y-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-amber-600" />
              Impact sur le Stock
            </h2>

            {selectedProduct ? (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{selectedProduct.name}</div>
                  <div className="font-mono text-slate-500 mt-0.5">{selectedProduct.sku}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Stock actuellement disponible :</span>
                    <span className="font-bold text-slate-800">
                      {selectedProduct.current_stock} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="flex justify-between text-amber-600 font-bold">
                    <span>Quantité demandée :</span>
                    <span>-{parsedQty} {selectedProduct.unit}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 font-black text-slate-900 text-sm">
                    <span>Stock résiduel après sortie :</span>
                    <span className={selectedProduct.current_stock - parsedQty <= selectedProduct.min_stock_alert ? 'text-red-600 font-black' : 'text-slate-900'}>
                      {Math.max(0, selectedProduct.current_stock - parsedQty)} {selectedProduct.unit}
                    </span>
                  </div>
                </div>

                {selectedProduct.current_stock - parsedQty <= selectedProduct.min_stock_alert && (
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-[11px] flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>Attention : cette sortie fera passer l'article sous le seuil d'alerte ({selectedProduct.min_stock_alert} {selectedProduct.unit}).</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                Sélectionnez un matériel pour calculer le stock résiduel.
              </div>
            )}
          </div>

          {/* Last Movement Confirmation Ticket */}
          {lastMovement && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 animate-in fade-in zoom-in-95 text-xs">
              <div className="flex items-center gap-2 text-amber-800 font-bold mb-2">
                <CheckCircle2 className="w-4 h-4 text-amber-600" />
                <span>Sortie Enregistrée avec Succès !</span>
              </div>
              <div className="space-y-1.5 text-slate-700">
                <div className="flex justify-between">
                  <span className="text-slate-500">N° Mouvement :</span>
                  <span className="font-mono font-bold text-slate-900">{lastMovement.movement_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Article :</span>
                  <span className="font-semibold text-slate-900 truncate max-w-[160px]">{lastMovement.product_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Quantité sortie :</span>
                  <span className="font-bold text-amber-700">-{lastMovement.quantity}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Stock après opération :</span>
                  <span className="font-black text-slate-900">{lastMovement.stock_after}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* CONFIRMATION POPUP MODAL (Mandatory Safety Gate) */}
      {showConfirmModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/75 backdrop-blur-xs animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in zoom-in-95 p-6 text-xs space-y-4">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-xl bg-amber-100 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-slate-900">Confirmation de Sortie</h3>
                <p className="text-slate-500">Vérifiez les informations avant validation définitive</p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-500">Article :</span>
                <span className="font-bold text-slate-900">{selectedProduct.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Référence :</span>
                <span className="font-mono font-semibold text-slate-700">{selectedProduct.sku}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Quantité à déduire :</span>
                <span className="font-black text-amber-600 text-sm">-{parsedQty} {selectedProduct.unit}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Motif :</span>
                <span className="font-semibold text-slate-800">{reason}</span>
              </div>
              {recipient && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Bénéficiaire :</span>
                  <span className="font-semibold text-slate-800">{recipient}</span>
                </div>
              )}
              <div className="pt-2 border-t border-slate-200 flex justify-between font-bold text-slate-900">
                <span>Stock restant en rayon :</span>
                <span>{selectedProduct.current_stock - parsedQty} {selectedProduct.unit}</span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 font-bold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                disabled={loading}
                className="px-5 py-2 font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl shadow-md shadow-amber-500/20 cursor-pointer"
              >
                {loading ? 'Validation...' : 'Confirmer la sortie'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
