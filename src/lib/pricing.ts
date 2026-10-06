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
