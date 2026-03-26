// Regular prices by currency from App Store pricing (March 2026)
export const REGULAR_PRICES: Record<string, string> = {
  USD: '4.99',
  EUR: '5.99',
  GBP: '4.99',
  CAD: '6.99',
  AUD: '7.99',
  JPY: '800',
  CNY: '38.0',
  HKD: '38.0',
  TWD: '150',
  SGD: '6.98',
  KRW: '6600',
  BRL: '29.9',
  MXN: '99.0',
  INR: '499.0',
  RUB: '449.0',
  TRY: '249.99',
  CHF: '4.0',
  NOK: '59.0',
  SEK: '69.0',
  DKK: '39.0',
  PLN: '24.99',
  CZK: '129.0',
  HUF: '1990',
  RON: '29.99',
  ILS: '17.9',
  ZAR: '99.99',
  AED: '19.99',
  SAR: '19.99',
  QAR: '19.99',
  MYR: '22.9',
  THB: '199.0',
  IDR: '89000',
  VND: '149000',
  PHP: '299.0',
  NGN: '7900.0',
  EGP: '249.99',
  CLP: '5990',
  COP: '24900.0',
  PEN: '22.9',
  PKR: '1300.0',
  KZT: '2990.0',
  TZS: '14900.0',
  NZD: '9.99',
};

// Helper function to extract numeric price from formatted price string
export const extractNumericPrice = (priceString: string): number => {
  const match = priceString.match(/[\d,]+\.?\d*/g);
  if (match) {
    return parseFloat(match[0].replace(/,/g, ''));
  }
  return 0;
};

// Helper function to extract currency code from price string
export const extractCurrencyFromPrice = (priceString: string): string => {
  // Common currency symbols
  const currencySymbols: Record<string, string> = {
    '$': 'USD',
    '€': 'EUR',
    '£': 'GBP',
    '¥': 'JPY',
    '₹': 'INR',
    '₽': 'RUB',
    '₪': 'ILS',
    'R$': 'BRL',
  };
  
  for (const [symbol, code] of Object.entries(currencySymbols)) {
    if (priceString.includes(symbol)) {
      return code;
    }
  }
  
  // Check for currency codes in the string (e.g., "USD 4.99" or "4.99 USD")
  const codeMatch = priceString.match(/[A-Z]{3}/);
  if (codeMatch) {
    return codeMatch[0];
  }
  
  return 'USD'; // Default fallback
};

// Helper function to format price with currency
export const formatPrice = (amount: string, currencyCode: string, originalFormat: string): string => {
  // Try to match the original format (symbol before or after)
  const symbolBefore = /^[^\d]/.test(originalFormat);
  
  const currencySymbols: Record<string, string> = {
    USD: '$',
    EUR: '€',
    GBP: '£',
    JPY: '¥',
    INR: '₹',
    RUB: '₽',
    ILS: '₪',
  };
  
  const symbol = currencySymbols[currencyCode] || currencyCode + ' ';
  return symbolBefore ? `${symbol}${amount}` : `${amount} ${symbol}`;
};

/**
 * Checks if the current price is a promotional price and returns the original price if so.
 * @param currentPrice The current price string from the store (e.g., "$3.99")
 * @param priceCurrencyCode Optional currency code from the product (if available)
 * @returns The original price string if there's a promotion, otherwise null
 */
export const getOriginalPrice = (
  currentPrice: string,
  priceCurrencyCode?: string
): string | null => {
  // Try to get currency code from product or extract from price string
  const currencyCode = priceCurrencyCode || extractCurrencyFromPrice(currentPrice);
  
  if (currencyCode && REGULAR_PRICES[currencyCode]) {
    const regularPrice = formatPrice(REGULAR_PRICES[currencyCode], currencyCode, currentPrice);
    const currentNumericPrice = extractNumericPrice(currentPrice);
    const regularNumericPrice = parseFloat(REGULAR_PRICES[currencyCode]);
    
    // If current price is lower than regular price, return the original price
    if (currentNumericPrice < regularNumericPrice) {
      return regularPrice;
    }
  }
  
  return null;
};
