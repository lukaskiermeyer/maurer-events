"use server";

import { calculateFeeFromCents } from "@/lib/pricing";

export async function calculateTotal(input: {
  guestCount: number;
  packageId: string;
  tableId?: string;
  eventId: string;
  packagePrice: number;
}) {
  const { guestCount, packagePrice } = input;
  
  // This is a simplified calculation that mirrors the frontend logic
  // The actual source of truth for the event and table prices would normally be queried from DB here.
  const subtotalEuros = packagePrice * guestCount;
  const subtotalCents = Math.round(subtotalEuros * 100);
  
  const feeCents = calculateFeeFromCents(subtotalCents);
  const totalCents = subtotalCents + feeCents;

  return {
    subtotal: subtotalCents / 100,
    fee: feeCents / 100,
    total: totalCents / 100
  };
}
