export const PRICING = {
  stripeFeePercent: 0.015,
  stripeFeeFixedCents: 25,
};

export function calculateFee(subtotalEuros: number, customPercent?: number, customFixedCents?: number): number {
  const percent = customPercent !== undefined ? customPercent / 100 : PRICING.stripeFeePercent;
  const fixed = customFixedCents !== undefined ? customFixedCents : PRICING.stripeFeeFixedCents;
  const feeInCents = Math.ceil(subtotalEuros * 100 * percent + fixed);
  return feeInCents / 100;
}

export function calculateFeeFromCents(subtotalCents: number, customPercent?: number, customFixedCents?: number): number {
  const percent = customPercent !== undefined ? customPercent / 100 : PRICING.stripeFeePercent;
  const fixed = customFixedCents !== undefined ? customFixedCents : PRICING.stripeFeeFixedCents;
  return Math.ceil(subtotalCents * percent + fixed);
}

export type TaxStatus = 'standard' | 'small_business';

export interface PackageTaxInput {
  price: number; // Euro, as stored in eventSettings.packages
  priceIncludesVat?: boolean;
  vatRate?: 0 | 7 | 19;
}

export interface PackageTaxBreakdown {
  grossCents: number;
  netCents: number;
  vatCents: number;
  vatRate: 0 | 7 | 19;
  priceIncludesVat: boolean;
}

export function packageTax(pkg: PackageTaxInput, taxStatus: TaxStatus = 'standard'): PackageTaxBreakdown | null {
  const priceCents = Math.round(pkg.price * 100);
  if (!Number.isFinite(pkg.price) || pkg.price < 0 || !Number.isSafeInteger(priceCents)) return null;
  if (taxStatus === 'small_business') {
    return { grossCents: priceCents, netCents: priceCents, vatCents: 0, vatRate: 0, priceIncludesVat: pkg.priceIncludesVat !== false };
  }
  const rate = pkg.vatRate;
  if (rate !== 0 && rate !== 7 && rate !== 19) return null;
  const includesVat = pkg.priceIncludesVat !== false;
  if (includesVat) {
    const netCents = Math.round(priceCents * 100 / (100 + rate));
    return { grossCents: priceCents, netCents, vatCents: priceCents - netCents, vatRate: rate, priceIncludesVat: true };
  }
  const vatCents = Math.round(priceCents * rate / 100);
  return { grossCents: priceCents + vatCents, netCents: priceCents, vatCents, vatRate: rate, priceIncludesVat: false };
}

export function formatEuroCents(cents: number): string {
  return `${(cents / 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
}
