import React, { useState, useEffect } from 'react';
import { Product, Category, StockMovement } from '../types/index.ts';
import { api } from '../lib/api.ts';
import { formatFCFA, formatNumber, formatDate, getStockStatus } from '../lib/utils.ts';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Package,
  Plus,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Upload,
  Eye,
  Edit2,
  Archive,
  ArchiveRestore,
  X,
  AlertCircle,
  CheckCircle2,
  Barcode,
  MapPin,
  Tag,
  Building,
  Coins,
  History,
  Layers
} from 'lucide-react';

interface ProductsViewProps {
  categories: Category[];
  initialSearch?: string;
  onRefreshStats?: () => void;
  onNavigateToStockIn?: (productId: number) => void;
  onNavigateToStockOut?: (productId: number) => void;
}

export const ProductsView: React.FC<ProductsViewProps> = ({
  categories,
  initialSearch = '',
  onRefreshStats,
  onNavigateToStockIn,
  onNavigateToStockOut
}) => {
  const { isAdmin } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(initialSearch);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [detailProduct, setDetailProduct] = useState<(Product & { movements: StockMovement[] }) | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    sku: '',
    barcode: '',
    name: '',
    category_id: '',
    brand: '',
    description: '',
    purchase_price: '',
    selling_price: '',
    current_stock: '0',
    min_stock_alert: '5',
    unit: 'Pièce',
    location: ''
  });

  const [formError, setFormError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);

  // CSV Import state
  const [importText, setImportText] = useState('');
  const [importResult, setImportResult] = useState<{ createdCount: number; updatedCount: number; errors: string[] } | null>(null);

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory, statusFilter, sortBy, sortDir]);

  // Handle search debounce
  useEffect(() => {
    const handler = setTimeout(() => {
      fetchProducts();
    }, 250);
    return () => clearTimeout(handler);
  }, [search]);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const data = await api.getProducts({
        search: search.trim() || undefined,
        category_id: selectedCategory || undefined,
        status: statusFilter,
        sort_by: sortBy,
        sort_dir: sortDir
      });
      setProducts(data);
    } catch (err) {
      console.error('Failed to load products:', err);
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (msg: string) => {
    setSuccessToast(msg);
    setTimeout(() => setSuccessToast(null), 4000);
  };

  const handleOpenAdd = () => {
    setFormData({
      sku: '',
      barcode: '',
      name: '',
      category_id: categories[0]?.id ? String(categories[0].id) : '',
      brand: '',
      description: '',
      purchase_price: '',
      selling_price: '',
      current_stock: '0',
      min_stock_alert: '5',
      unit: 'Pièce',
      location: ''
    });
    setFormError(null);
    setShowAddModal(true);
  };

  const handleOpenEdit = (p: Product) => {
    setSelectedProduct(p);
    setFormData({
      sku: p.sku,
      barcode: p.barcode || '',
      name: p.name,
      category_id: String(p.category_id),
      brand: p.brand,
      description: p.description || '',
      purchase_price: String(p.purchase_price),
      selling_price: p.selling_price ? String(p.selling_price) : '',
      current_stock: String(p.current_stock),
      min_stock_alert: String(p.min_stock_alert),
      unit: p.unit,
      location: p.location || ''
    });
    setFormError(null);
    setShowEditModal(true);
  };

  const handleOpenDetail = async (p: Product) => {
    try {
      setSelectedProduct(p);
      setShowDetailModal(true);
      const detailed = await api.getProduct(p.id);
      setDetailProduct(detailed);
    } catch (err: any) {
      console.error(err);
    }
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!formData.sku || !formData.name || !formData.category_id || !formData.brand || !formData.purchase_price) {
      setFormError('Veuillez renseigner tous les champs obligatoires (*).');
      return;
    }

    try {
      setFormSubmitting(true);
      await api.createProduct({
        sku: formData.sku,
        barcode: formData.barcode || undefined,
        name: formData.name,
        category_id: Number(formData.category_id),
        brand: formData.brand,
        description: formData.description || undefined,
        purchase_price: Number(formData.purchase_price),
        selling_price: formData.selling_price ? Number(formData.selling_price) : undefined,
        current_stock: Number(formData.current_stock) || 0,
        min_stock_alert: Number(formData.min_stock_alert) || 5,
        unit: formData.unit,
        location: formData.location || undefined
      });

      setShowAddModal(false);
      showNotification(`Produit "${formData.name}" créé avec succès.`);
      fetchProducts();
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      setFormError(err.message || 'Erreur lors de la création du produit.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setFormError(null);

    try {
      setFormSubmitting(true);
      await api.updateProduct(selectedProduct.id, {
        sku: formData.sku,
        barcode: formData.barcode || undefined,
        name: formData.name,
        category_id: Number(formData.category_id),
        brand: formData.brand,
        description: formData.description || undefined,
        purchase_price: Number(formData.purchase_price),
        selling_price: formData.selling_price ? Number(formData.selling_price) : undefined,
        min_stock_alert: Number(formData.min_stock_alert),
        unit: formData.unit,
        location: formData.location || undefined
      });

      setShowEditModal(false);
      showNotification(`Produit "${formData.name}" mis à jour.`);
      fetchProducts();
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      setFormError(err.message || 'Erreur lors de la mise à jour.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleArchive = async (p: Product) => {
    const action = p.is_archived === 1 ? 'restaurer' : 'archiver';
    if (!window.confirm(`Êtes-vous sûr de vouloir ${action} le produit "${p.name}" (${p.sku}) ?`)) {
      return;
    }

    try {
      const res = await api.toggleArchiveProduct(p.id);
      showNotification(res.message);
      fetchProducts();
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      alert(err.message || 'Erreur lors du changement de statut.');
    }
  };

  const handleSort = (col: string) => {
    if (sortBy === col) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(col);
      setSortDir('asc');
    }
  };

  const handleCsvImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importText.trim()) return;

    try {
      setFormSubmitting(true);
      setImportResult(null);

      // Parse CSV text (supports comma or semicolon)
      const lines = importText.trim().split(/\r?\n/);
      if (lines.length < 2) {
        throw new Error('Le fichier CSV doit comporter une ligne d\'en-tête et au moins une ligne de données.');
      }

      const delimiter = lines[0].includes(';') ? ';' : ',';
      const headers = lines[0].split(delimiter).map(h => h.trim().toLowerCase().replace(/"/g, ''));

      const items = [];
      for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const vals = lines[i].split(delimiter).map(v => v.trim().replace(/^"|"$/g, ''));
        const obj: any = {};
        headers.forEach((h, idx) => {
          obj[h] = vals[idx] !== undefined ? vals[idx] : '';
        });
        items.push(obj);
      }

      const res = await api.importProductsCsv(items);
      setImportResult(res);
      fetchProducts();
      if (onRefreshStats) onRefreshStats();
    } catch (err: any) {
      alert(err.message || 'Erreur lors du traitement du fichier CSV.');
    } finally {
      setFormSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {successToast && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-xl shadow-xl flex items-center gap-2.5 border border-amber-500/30 animate-in fade-in slide-in-from-bottom-2 text-xs font-semibold">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{successToast}</span>
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h1 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Package className="w-5 h-5 text-amber-500" />
            Gestion des Produits & Matériels
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Catalogue complet • Prix en FCFA • Alertes de réapprovisionnement automatiques
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* CSV Export */}
          <a
            href={api.exportProductsCsvUrl()}
            download
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
            title="Exporter tout le catalogue au format Excel CSV"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>

          {/* CSV Import */}
          {isAdmin && (
            <button
              onClick={() => {
                setImportText('');
                setImportResult(null);
                setShowImportModal(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
              title="Importer des produits en masse"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Import CSV</span>
            </button>
          )}

          {/* Add Product Button */}
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-amber-500/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau Produit</span>
          </button>
        </div>
      </div>

      {/* Filters and Search Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher par nom, SKU, marque, code-barres..."
            className="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:bg-white focus:outline-none focus:border-amber-500"
          />
        </div>

        {/* Filters Group */}
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          {/* Category Filter */}
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-700 font-medium focus:bg-white focus:outline-none focus:border-amber-500"
          >
            <option value="">Toutes les catégories</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Stock Condition Filter */}
          <div className="inline-flex rounded-xl bg-slate-100 p-1 text-xs font-semibold">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'all' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Tous
            </button>
            <button
              onClick={() => setStatusFilter('in_stock')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'in_stock' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              En stock
            </button>
            <button
              onClick={() => setStatusFilter('low_stock')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'low_stock' ? 'bg-white text-amber-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Faible
            </button>
            <button
              onClick={() => setStatusFilter('out_of_stock')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'out_of_stock' ? 'bg-white text-red-700 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Rupture
            </button>
            <button
              onClick={() => setStatusFilter('archived')}
              className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                statusFilter === 'archived' ? 'bg-white text-slate-800 shadow-xs font-bold' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Archivés
            </button>
          </div>
        </div>
      </div>

      {/* Products Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200">
                <th
                  onClick={() => handleSort('sku')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Référence SKU</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Nom du Produit & Marque</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('category')}
                  className="py-3 px-3 cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Catégorie</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('purchase_price')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Prix Achat (FCFA)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('selling_price')}
                  className="py-3 px-3 text-right cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Prix Vente (FCFA)</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th
                  onClick={() => handleSort('current_stock')}
                  className="py-3 px-3 text-center cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center justify-center gap-1.5">
                    <span>Stock Disponible</span>
                    <ArrowUpDown className="w-3 h-3 text-slate-400" />
                  </div>
                </th>
                <th className="py-3 px-3 text-center">Statut</th>
                <th className="py-3 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                    Chargement des articles...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-400">
                    <Package className="w-10 h-10 mx-auto text-slate-300 mb-2" />
                    Aucun produit ne correspond aux critères de recherche.
                  </td>
                </tr>
              ) : (
                products.map((p) => {
                  const status = getStockStatus(p.current_stock, p.min_stock_alert, p.is_archived);

                  return (
                    <tr
                      key={p.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        p.is_archived ? 'opacity-60 bg-slate-50/40' : ''
                      }`}
                    >
                      {/* SKU */}
                      <td className="py-3 px-4">
                        <div className="font-mono font-bold text-slate-900 flex items-center gap-1.5">
                          <span>{p.sku}</span>
                        </div>
                        {p.barcode && (
                          <div className="text-[10px] text-slate-400 flex items-center gap-1 mt-0.5">
                            <Barcode className="w-3 h-3" />
                            <span>{p.barcode}</span>
                          </div>
                        )}
                      </td>

                      {/* Name & Brand */}
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 hover:text-amber-600 cursor-pointer" onClick={() => handleOpenDetail(p)}>
                          {p.name}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-0.5">
                          <span className="font-medium text-slate-600 bg-slate-100 px-1.5 py-0.2 rounded text-[10px]">
                            {p.brand}
                          </span>
                          {p.location && (
                            <span className="flex items-center gap-0.5 text-slate-400 text-[10px]">
                              <MapPin className="w-2.5 h-2.5" />
                              {p.location}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Category */}
                      <td className="py-3 px-3">
                        <span className="text-slate-700 font-medium truncate block max-w-[140px]">
                          {p.category_name}
                        </span>
                      </td>

                      {/* Purchase Price */}
                      <td className="py-3 px-3 text-right font-bold text-slate-900">
                        {formatFCFA(p.purchase_price)}
                      </td>

                      {/* Selling Price */}
                      <td className="py-3 px-3 text-right text-slate-600 font-medium">
                        {p.selling_price ? formatFCFA(p.selling_price) : '-'}
                      </td>

                      {/* Available Stock */}
                      <td className="py-3 px-3 text-center">
                        <div className="font-black text-slate-900 text-sm">
                          {p.current_stock}{' '}
                          <span className="text-[11px] font-normal text-slate-500">{p.unit}</span>
                        </div>
                        <div className="text-[10px] text-slate-400">Min : {p.min_stock_alert}</div>
                      </td>

                      {/* Status */}
                      <td className="py-3 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold ${status.badgeClass}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dotClass}`} />
                          {status.label}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {/* View Detail */}
                          <button
                            onClick={() => handleOpenDetail(p)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                            title="Fiche détaillée"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          {/* Edit */}
                          <button
                            onClick={() => handleOpenEdit(p)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-amber-600 hover:bg-amber-50 transition-colors cursor-pointer"
                            title="Modifier"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>

                          {/* Archive/Restore */}
                          <button
                            onClick={() => handleToggleArchive(p)}
                            className={`p-1.5 rounded-lg transition-colors cursor-pointer ${
                              p.is_archived
                                ? 'text-emerald-600 hover:bg-emerald-50'
                                : 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                            }`}
                            title={p.is_archived ? 'Désarchiver' : 'Archiver'}
                          >
                            {p.is_archived ? (
                              <ArchiveRestore className="w-4 h-4" />
                            ) : (
                              <Archive className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ======================================================== */}
      {/* ADD PRODUCT MODAL */}
      {/* ======================================================== */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Plus className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Nouveau Produit de Sécurité</h2>
                  <p className="text-xs text-slate-400">Renseignez les caractéristiques et les prix en FCFA</p>
                </div>
              </div>
              <button
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-5 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Référence SKU unique *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    placeholder="Ex: CAM-IP-4MP-EXT"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Code-barres EAN/UPC (facultatif)
                  </label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    placeholder="Ex: 6941264082214"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nom du produit complet *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Caméra Tube IP ColorVu 4MP Hikvision"
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Catégorie *
                  </label>
                  <select
                    required
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                  >
                    <option value="">Sélectionner une catégorie</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Marque ou Fabricant *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    placeholder="Ex: Hikvision, Dahua, Ajax, ZKTeco..."
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Prix d'achat unitaire (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    placeholder="Ex: 45000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Prix de vente conseillé (FCFA, optionnel)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                    placeholder="Ex: 75000"
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Stock initial en rayon
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.current_stock}
                    onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Seuil d'alerte minimal *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formData.min_stock_alert}
                    onChange={(e) => setFormData({ ...formData, min_stock_alert: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Unité de mesure
                  </label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                  >
                    <option value="Pièce">Pièce</option>
                    <option value="Kit">Kit</option>
                    <option value="Rouleau">Rouleau</option>
                    <option value="Mètre">Mètre</option>
                    <option value="Carton">Carton</option>
                    <option value="Lot">Lot</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Emplacement physique dans le magasin
                </label>
                <input
                  type="text"
                  value={formData.location}
                  onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                  placeholder="Ex: Rayon A-02, Hangar Sécurité, Étagère 4..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Description technique
                </label>
                <textarea
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Spécifications, résolution, optique, portée, protocole..."
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? 'Enregistrement...' : 'Créer le produit'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* EDIT PRODUCT MODAL */}
      {/* ======================================================== */}
      {showEditModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Edit2 className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Modifier le Produit</h2>
                  <p className="text-xs text-slate-400">{selectedProduct.sku} • {selectedProduct.name}</p>
                </div>
              </div>
              <button
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpdateProduct} className="p-5 overflow-y-auto space-y-4 text-xs">
              {formError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Référence SKU
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Code-barres
                  </label>
                  <input
                    type="text"
                    value={formData.barcode}
                    onChange={(e) => setFormData({ ...formData, barcode: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Nom du produit *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Catégorie *
                  </label>
                  <select
                    required
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Marque *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.brand}
                    onChange={(e) => setFormData({ ...formData, brand: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Prix d'achat unitaire (FCFA) *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formData.purchase_price}
                    onChange={(e) => setFormData({ ...formData, purchase_price: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Prix de vente (FCFA)
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    value={formData.selling_price}
                    onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500 font-bold"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Seuil d'alerte minimal *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    required
                    value={formData.min_stock_alert}
                    onChange={(e) => setFormData({ ...formData, min_stock_alert: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Emplacement magasin
                  </label>
                  <input
                    type="text"
                    value={formData.location}
                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                    className="w-full px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                  />
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
                <span className="font-semibold text-slate-900">Note de sécurité :</span> La quantité physique disponible ({selectedProduct.current_stock} {selectedProduct.unit}) est modifiée exclusivement par les opérations vérifiables (Entrées, Sorties ou Inventaire physique).
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? 'Mise à jour...' : 'Enregistrer modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* DETAILED PRODUCT SHEET MODAL */}
      {/* ======================================================== */}
      {showDetailModal && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Package className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">{selectedProduct.name}</h2>
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="font-mono text-amber-400 font-bold">{selectedProduct.sku}</span>
                    <span>•</span>
                    <span>{selectedProduct.brand}</span>
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  setDetailProduct(null);
                }}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5 text-xs">
              {/* KPI Ribbon */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-slate-400 uppercase font-semibold text-[10px]">Stock Actuel</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {selectedProduct.current_stock} <span className="text-xs font-normal text-slate-500">{selectedProduct.unit}</span>
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-slate-400 uppercase font-semibold text-[10px]">Valeur Stock (Achat)</div>
                  <div className="text-lg font-black text-amber-600 mt-0.5">
                    {formatFCFA(selectedProduct.current_stock * selectedProduct.purchase_price)}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                  <div className="text-slate-400 uppercase font-semibold text-[10px]">Seuil Alerte</div>
                  <div className="text-lg font-black text-slate-900 mt-0.5">
                    {selectedProduct.min_stock_alert} <span className="text-xs font-normal text-slate-500">{selectedProduct.unit}</span>
                  </div>
                </div>
              </div>

              {/* Specs & Metadata */}
              <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-2">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Catégorie</span>
                    <span className="font-bold text-slate-800">{selectedProduct.category_name}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Code-barres</span>
                    <span className="font-mono text-slate-800">{selectedProduct.barcode || 'Non renseigné'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Prix d'Achat</span>
                    <span className="font-bold text-slate-900">{formatFCFA(selectedProduct.purchase_price)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Prix de Vente</span>
                    <span className="font-bold text-emerald-700">{selectedProduct.selling_price ? formatFCFA(selectedProduct.selling_price) : 'Non renseigné'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Emplacement Rayon</span>
                    <span className="font-semibold text-slate-800">{selectedProduct.location || 'Magasin général'}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold">Statut</span>
                    <span className="font-semibold text-slate-800">{selectedProduct.is_archived ? 'Archivé' : 'Actif'}</span>
                  </div>
                </div>

                {selectedProduct.description && (
                  <div className="pt-2 border-t border-slate-200/60 mt-2">
                    <span className="text-slate-400 block text-[10px] uppercase font-semibold mb-0.5">Description technique</span>
                    <p className="text-slate-700 leading-relaxed">{selectedProduct.description}</p>
                  </div>
                )}
              </div>

              {/* Movement History on this product */}
              <div>
                <h3 className="font-bold text-slate-900 mb-2 flex items-center gap-1.5">
                  <History className="w-4 h-4 text-blue-500" />
                  Derniers Mouvements de Stock
                </h3>

                {detailProduct?.movements && detailProduct.movements.length > 0 ? (
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-2">Type</th>
                          <th className="py-2 px-2 text-right">Qté</th>
                          <th className="py-2 px-2 text-center">Avant / Après</th>
                          <th className="py-2 px-3">Motif / Tiers</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detailProduct.movements.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/50">
                            <td className="py-2 px-3 text-slate-500 whitespace-nowrap">{formatDate(m.created_at)}</td>
                            <td className="py-2 px-2 font-bold">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[9px] uppercase font-bold ${
                                  m.type === 'ENTREE' ? 'bg-emerald-100 text-emerald-800' : m.type === 'SORTIE' ? 'bg-amber-100 text-amber-800' : 'bg-purple-100 text-purple-800'
                                }`}
                              >
                                {m.type}
                              </span>
                            </td>
                            <td className="py-2 px-2 text-right font-black">
                              {m.type === 'SORTIE' ? `-${m.quantity}` : `+${m.quantity}`}
                            </td>
                            <td className="py-2 px-2 text-center text-slate-500">
                              {m.stock_before} → <span className="font-bold text-slate-900">{m.stock_after}</span>
                            </td>
                            <td className="py-2 px-3 text-slate-600 truncate max-w-[150px]">
                              {m.reason} {m.partner_name ? `(${m.partner_name})` : ''}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-slate-400 text-xs italic">Aucun mouvement récent enregistré sur cet article.</p>
                )}
              </div>

              {/* Quick Action buttons */}
              <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => {
                    setShowDetailModal(false);
                    handleOpenEdit(selectedProduct);
                  }}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
                >
                  Modifier la fiche
                </button>

                <div className="flex items-center gap-2">
                  {onNavigateToStockIn && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDetailModal(false);
                        onNavigateToStockIn(selectedProduct.id);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition-colors cursor-pointer"
                    >
                      + Entrée de stock
                    </button>
                  )}
                  {onNavigateToStockOut && selectedProduct.current_stock > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowDetailModal(false);
                        onNavigateToStockOut(selectedProduct.id);
                      }}
                      className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold transition-colors cursor-pointer"
                    >
                      - Sortie de stock
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* CSV IMPORT MODAL */}
      {/* ======================================================== */}
      {showImportModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full flex flex-col overflow-hidden animate-in fade-in zoom-in-95">
            <div className="p-4 sm:p-5 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold">
                  <Upload className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Importer des Produits en Masse (CSV)</h2>
                  <p className="text-xs text-slate-400">Collez votre fichier texte au format CSV</p>
                </div>
              </div>
              <button
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCsvImportSubmit} className="p-5 space-y-4 text-xs">
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
                <div className="font-bold mb-1">Format des colonnes attendu :</div>
                <code className="font-mono text-[11px] block bg-white/70 p-2 rounded border border-amber-200 text-slate-800">
                  sku;name;category;brand;purchase_price;selling_price;stock;min_stock;unit;location
                </code>
              </div>

              {importResult && (
                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                  <div className="font-bold">Importation terminée :</div>
                  <div>• {importResult.createdCount} produit(s) créé(s)</div>
                  <div>• {importResult.updatedCount} produit(s) mis à jour</div>
                  {importResult.errors.length > 0 && (
                    <div className="text-red-600 mt-1">
                      {importResult.errors.join(', ')}
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Contenu CSV (séparateur point-virgule ou virgule) :
                </label>
                <textarea
                  required
                  rows={8}
                  value={importText}
                  onChange={(e) => setImportText(e.target.value)}
                  placeholder={`sku;name;category;brand;purchase_price;selling_price;stock;min_stock;unit;location\nCAM-01;Caméra Dôme IP;Caméras de surveillance;Dahua;25000;45000;10;3;Pièce;Rayon A-01`}
                  className="w-full font-mono text-[11px] p-3 border border-slate-300 rounded-xl focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold transition-colors cursor-pointer"
                >
                  Fermer
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || !importText.trim()}
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20 transition-all cursor-pointer disabled:opacity-50"
                >
                  {formSubmitting ? 'Traitement en cours...' : 'Lancer l\'importation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
