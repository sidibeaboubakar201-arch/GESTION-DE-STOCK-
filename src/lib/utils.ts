/**
 * Utility functions for formatting and stock logic
 */

export function formatFCFA(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) {
    return '0 FCFA';
  }
  const rounded = Math.round(amount);
  return new Intl.NumberFormat('fr-FR', {
    maximumFractionDigits: 0,
  }).format(rounded) + ' FCFA';
}

export function formatNumber(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) return '0';
  return new Intl.NumberFormat('fr-FR').format(val);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatDateShort(dateString: string | null | undefined): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: 'short'
    }).format(d);
  } catch {
    return dateString;
  }
}

export type StockStatusType = 'rupture' | 'faible' | 'disponible' | 'archive';

export function getStockStatus(currentStock: number, minStock: number, isArchived: number = 0): {
  type: StockStatusType;
  label: string;
  badgeClass: string;
  dotClass: string;
} {
  if (isArchived === 1) {
    return {
      type: 'archive',
      label: 'Archivé',
      badgeClass: 'bg-slate-100 text-slate-600 border border-slate-300',
      dotClass: 'bg-slate-400'
    };
  }

  if (currentStock === 0) {
    return {
      type: 'rupture',
      label: 'En rupture',
      badgeClass: 'bg-red-50 text-red-700 border border-red-200',
      dotClass: 'bg-red-500'
    };
  }

  if (currentStock <= minStock) {
    return {
      type: 'faible',
      label: 'Stock faible',
      badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200',
      dotClass: 'bg-amber-500'
    };
  }

  return {
    type: 'disponible',
    label: 'Disponible',
    badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    dotClass: 'bg-emerald-500'
  };
}
