import { Product } from '../constants/types';

export type PricingTier = {
  minQty: number;
  unitPrice: number;
  label: string;
};

const round2 = (value: number) => Math.round(value * 100) / 100;

export const getPricingTiers = (product: Product): PricingTier[] => {
  const moq = Math.max(1, product.minOrderQuantity || 1);
  const basePrice = Number(product.price || 0);

  const secondQty = Math.max(moq + 5, moq * 5);
  const thirdQty = Math.max(moq + 10, moq * 10);

  return [
    { minQty: moq, unitPrice: round2(basePrice), label: `${moq}+ units` },
    { minQty: secondQty, unitPrice: round2(basePrice * 0.95), label: `${secondQty}+ units` },
    { minQty: thirdQty, unitPrice: round2(basePrice * 0.9), label: `${thirdQty}+ units` }
  ];
};

export const getTieredUnitPrice = (product: Product, quantity: number): number => {
  const tiers = getPricingTiers(product);
  const qty = Math.max(1, quantity);

  let selected = tiers[0].unitPrice;
  for (const tier of tiers) {
    if (qty >= tier.minQty) {
      selected = tier.unitPrice;
    }
  }

  return selected;
};

export const getLinePricing = (product: Product, quantity: number) => {
  const qty = Math.max(1, quantity);
  const baseUnit = Number(product.price || 0);
  const unitPrice = getTieredUnitPrice(product, qty);
  const subtotal = round2(unitPrice * qty);
  const savings = round2(Math.max(0, (baseUnit - unitPrice) * qty));

  return {
    unitPrice,
    subtotal,
    savings
  };
};
