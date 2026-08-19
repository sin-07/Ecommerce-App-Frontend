import { Product } from '../constants/types';

export const LOW_STOCK_THRESHOLD = 10;

export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export const getStockStatus = (stock: number): StockStatus => {
  if (stock <= 0) return 'out_of_stock';
  if (stock < LOW_STOCK_THRESHOLD) return 'low_stock';
  return 'in_stock';
};

export const getStockLabel = (stock: number) => {
  const status = getStockStatus(stock);

  if (status === 'out_of_stock') return 'Out of stock';
  if (status === 'low_stock') return `Low stock (${stock})`;
  return `In stock (${stock})`;
};

export const getStockTone = (stock: number) => {
  const status = getStockStatus(stock);

  if (status === 'out_of_stock') {
    return {
      backgroundColor: '#fef2f2',
      borderColor: '#fecaca',
      textColor: '#b42318',
      iconColor: '#ef4444'
    };
  }

  if (status === 'low_stock') {
    return {
      backgroundColor: '#fffbeb',
      borderColor: '#fde68a',
      textColor: '#b45309',
      iconColor: '#f59e0b'
    };
  }

  return {
    backgroundColor: '#ecfdf3',
    borderColor: '#bbf7d0',
    textColor: '#166534',
    iconColor: '#22c55e'
  };
};

export const getInventoryAnalytics = (products: Product[]) => {
  const totals = products.reduce(
    (acc, product) => {
      acc.totalProducts += 1;
      acc.totalUnits += Math.max(0, product.stock || 0);

      const status = getStockStatus(product.stock || 0);
      if (status === 'in_stock') acc.inStock += 1;
      if (status === 'low_stock') acc.lowStock += 1;
      if (status === 'out_of_stock') acc.outOfStock += 1;

      return acc;
    },
    {
      totalProducts: 0,
      totalUnits: 0,
      inStock: 0,
      lowStock: 0,
      outOfStock: 0
    }
  );

  return {
    ...totals,
    lowStockRate: totals.totalProducts ? Math.round((totals.lowStock / totals.totalProducts) * 100) : 0
  };
};
