import React, { useState, useEffect } from 'react';
import { Product, Supplier, StockMovement } from '../types/index.ts';
import { api } from '../lib/api.ts';
import { formatFCFA, formatDate, getStockStatus } from '../lib/utils.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  ArrowDownToLine,
  Package,
  Truck,
  FileText,
  CheckCircle2,
  AlertCircle,
  Coins,
  History,
  ShieldCheck,
  ArrowRight
} from 'lucide-react';
import { NavTab } from './Sidebar.tsx';

interface StockInViewProps {
  products: Product[];
  suppliers: Supplier[];
  initialProductId?: number;
  onRefreshAll: () => void;
  onNavigate: (tab: NavTab) => void;
}

export const StockInView: React.FC<StockInViewProps> = ({
  products,
  suppliers,
  initialProductId,
  onRefreshAll,
  onNavigate
}) => {
  const { user } = useAuth();

  const [selectedProductId, setSelectedProductId] = useState<string>(
    initialProductId ? String(initialProductId) : ''
  );
  const [quantity, setQuantity] = useState<string>('1');
  const [unitPrice, setUnitPrice] = useState<string>('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [docRef, setDocRef] = useState<string>('');
  const [reason, setReason] = useState<string>('Achat fournisseur');
  const [comment, setComment] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastMovement, setLastMovement] = useState<StockMovement | null>(null);

  const selectedProduct = products.find((p) => String(p.id) === selectedProductId);

  // Sync unit price when product is selected
  useEffect(() => {
    if (selectedProduct) {
      setUnitPrice(String(selectedProduct.purchase_price));
    }
  }, [selectedProductId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!selectedProductId) {
      setError('Veuillez sélectionner un article à réceptionner.');
      return;
    }

    const qty = Math.round(Number(quantity));
    if (isNaN(qty) || qty <= 0) {
      setError('La quantité reçue doit être strictement supérieure à zéro.');
      return;
    }

    try {
      setLoading(true);
      const res = await api.createStockIn({
        product_id: Number(selectedProductId),
        quantity: qty,
        unit_price: unitPrice ? Number(unitPrice) : undefined,
        supplier_id: supplierId ? Number(supplierId) : undefined,
        document_reference: docRef.trim() || undefined,
        reason,
        comment: comment.trim() || undefined
      });

      setLastMovement(res.movement);
      setQuantity('1');
      setDocRef('');
      setComment('');
      onRefreshAll();
    } catch (err: any) {
      setError(err.message || 'Erreur lors de l\'enregistrement de la réception.');
    } finally {
      setLoading(false);
    }
  };

  const calculatedTotal = (Number(quantity) || 0) * (Number(unitPrice) || 0);

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <ArrowDownToLine className="w-5 h-5 text-emerald-600" />
            Enregistrement d'une Entrée de Stock (Réception)
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Réception de marchandises • Mise à jour automatique et immédiate des quantités disponibles
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
          <form onSubmit={handleSubmit} className="space-y-4 text-xs">
            {error && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2 font-medium">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Product selection */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Sélectionner le matériel reçu *
              </label>
              <select
                required
                value={selectedProductId}
                onChange={(e) => setSelectedProductId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
              >
                <option value="">-- Choisissez un produit du catalogue --</option>
                {products
                  .filter((p) => !p.is_archived)
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      [{p.sku}] {p.name} — (Stock actuel : {p.current_stock} {p.unit})
                    </option>
                  ))}
              </select>
            </div>

            {/* Quantity and Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Quantité reçue *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    step="1"
                    required
                    value={quantity}
                    onChange={(e) => setQuantity(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    {selectedProduct?.unit || 'Unité'}
                  </span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Prix d'achat unitaire (FCFA) *
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-xs">
                    FCFA
                  </span>
                </div>
              </div>
            </div>

            {/* Supplier & Doc Ref */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Fournisseur (facultatif)
                </label>
                <select
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs text-slate-700 focus:bg-white focus:outline-none focus:border-emerald-500"
                >
                  <option value="">-- Aucun fournisseur spécifié --</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.contact_name})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  N° Facture / Bon de Livraison (BL)
                </label>
                <input
                  type="text"
                  value={docRef}
                  onChange={(e) => setDocRef(e.target.value)}
                  placeholder="Ex: BL-2026-4890, FACT-0012"
                  className="w-full px-3.5 py-2.5 border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-500 font-mono"
                />
              </div>
            </div>

            {/* Reason */}
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Motif de la réception *
              </label>
              <select
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-800 focus:bg-white focus:outline-none focus:border-emerald-500"
              >
                <option value="Achat fournisseur">Achat fournisseur</option>
                <option value="Réapprovisionnement régulier">Réapprovisionnement régulier</option>
                <option value="Retour client">Retour client / Annulation</option>
                <option value="Don / Dotation matériel">Don / Dotation matériel</option>
                <option value="Régularisation exceptionnelle">Régularisation exceptionnelle</option>
                <option value="Autre motif">Autre motif</option>
              </select>
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
                placeholder="État des cartons, transporteur, remarques sur la livraison..."
                className="w-full px-3.5 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-emerald-500"
              />
            </div>

            {/* Responsible User Indicator */}
            <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-[11px] text-slate-500">
              <span>Opération enregistrée par :</span>
              <span className="font-bold text-slate-800 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                {user?.full_name} ({user?.role})
              </span>
            </div>

            <button
              type="submit"
              disabled={loading || !selectedProductId}
              className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-xl shadow-lg shadow-emerald-700/20 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <ArrowDownToLine className="w-4 h-4" />
              <span>{loading ? 'Validation en cours...' : 'Valider la réception et incrémenter le stock'}</span>
            </button>
          </form>
        </div>

        {/* Live Simulation Card & Last Movement Receipt */}
        <div className="space-y-4">
          {/* Live Preview of the selected product */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-3 flex items-center gap-1.5">
              <Package className="w-4 h-4 text-emerald-600" />
              Aperçu en Direct
            </h2>

            {selectedProduct ? (
              <div className="space-y-3 text-xs">
                <div>
                  <div className="font-bold text-slate-900 text-sm">{selectedProduct.name}</div>
                  <div className="font-mono text-slate-500 mt-0.5">{selectedProduct.sku}</div>
                </div>

                <div className="p-3 bg-slate-50 rounded-xl space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Stock actuel :</span>
                    <span className="font-bold text-slate-800">
                      {selectedProduct.current_stock} {selectedProduct.unit}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-600 font-bold">
                    <span>Quantité ajoutée :</span>
                    <span>+{Number(quantity) || 0} {selectedProduct.unit}</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 font-black text-slate-900 text-sm">
                    <span>Nouveau stock prévu :</span>
                    <span className="text-emerald-700">
                      {selectedProduct.current_stock + (Number(quantity) || 0)} {selectedProduct.unit}
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-emerald-50/70 border border-emerald-200/60 rounded-xl space-y-1">
                  <div className="flex justify-between text-emerald-900 font-semibold">
                    <span>Montant total achat :</span>
                    <span className="font-black">{formatFCFA(calculatedTotal)}</span>
                  </div>
                  <div className="text-[10px] text-emerald-700">
                    Calculé sur la base de {quantity || 0} x {formatFCFA(Number(unitPrice) || 0)}
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-xs">
                Sélectionnez un matériel pour visualiser la mise à jour du stock en temps réel.
              </div>
            )}
          </div>

          {/* Last Movement Confirmation Ticket */}
          {lastMovement && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 animate-in fade-in zoom-in-95 text-xs">
              <div className="flex items-center gap-2 text-emerald-800 font-bold mb-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Entrée Enregistrée avec Succès !</span>
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
                  <span className="text-slate-500">Quantité ajoutée :</span>
                  <span className="font-bold text-emerald-700">+{lastMovement.quantity}</span>
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
    </div>
  );
};
