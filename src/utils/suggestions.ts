import { Product } from '../constants/types';
import { getPricingTiers } from './pricing';

export const getSmartDiscountSuggestion = (product: Product, quantity: number) => {
  const tiers = getPricingTiers(product);
  const currentQty = Math.max(1, quantity);
  const nextTier = tiers.find((tier) => currentQty < tier.minQty);

  if (!nextTier) {
    return {
      title: 'Best discount unlocked',
      message: 'You are already using the highest available bulk tier.'
    };
  }

  const addMore = Math.max(1, nextTier.minQty - currentQty);
  return {
    title: 'Bulk savings tip',
    message: `Add ${addMore} more item${addMore === 1 ? '' : 's'} to get ${nextTier.label} pricing.`
  };
};
