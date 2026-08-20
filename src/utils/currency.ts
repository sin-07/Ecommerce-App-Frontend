/**
 * Centralized Indian Rupee (INR / ₹) Currency Formatter for AP Enterprises
 */

export const formatINR = (
  amount: number | string | null | undefined,
  includeDecimals = true
): string => {
  const num = Number(amount);
  if (isNaN(num)) return includeDecimals ? '₹0.00' : '₹0';

  const isNegative = num < 0;
  const absNum = Math.abs(num);

  const fixed = absNum.toFixed(includeDecimals ? 2 : 0);
  const [intPart, decPart] = fixed.split('.');

  // Indian Numbering System: last 3 digits, then groups of 2 digits
  let lastThree = intPart.substring(intPart.length - 3);
  const otherNumbers = intPart.substring(0, intPart.length - 3);
  if (otherNumbers !== '') {
    lastThree = ',' + lastThree;
  }
  const formattedInt =
    otherNumbers.replace(/\B(?=(\d{2})+(?!\d))/g, ',') + lastThree;

  const result = includeDecimals && decPart !== undefined
    ? `₹${formattedInt}.${decPart}`
    : `₹${formattedInt}`;

  return isNegative ? `-${result}` : result;
};

export const formatCurrency = formatINR;
