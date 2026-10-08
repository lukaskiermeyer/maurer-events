"use client";

import type { TableRecord, FoodPackage, ReservationEvent } from '@/types/domain';

import { useTranslations } from "next-intl";
import { calculateFee } from "@/lib/pricing";

export default function SummaryPanel({
  selectedEventObj,
  selectedDate,
  selectedTime,
  selectedTableObj,
  guests,
  selectedPackage,
  packages,
  amountTotal,
  minimumConsumption,
  customServiceFee,
  serviceFeePercent,
  serviceFeeFixedCents
}: {
  selectedEventObj: ReservationEvent | undefined;
  selectedDate: string;
  selectedTime: string;
  selectedTableObj: TableRecord | undefined;
  guests: number;
  selectedPackage: string;
  packages: FoodPackage[];
  amountTotal: number;
  minimumConsumption: number;
  customServiceFee?: boolean;
  serviceFeePercent?: number;
  serviceFeeFixedCents?: number;
}) {
  const t = useTranslations("Reservation");

  const subtotal = selectedPackage 
    ? amountTotal + ((packages.find(p => p.id === selectedPackage)?.price || 0) * guests) - (minimumConsumption/100 * guests) 
    : amountTotal;

  // Stripe Fee berechnet über zentrale Funktion
  const feeInEuros = calculateFee(
    subtotal, 
    customServiceFee ? serviceFeePercent : undefined, 
    customServiceFee ? serviceFeeFixedCents : undefined
  );
  
  const total = subtotal + feeInEuros;
  const content = (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <span className="opacity-70">{t('event_time')}</span>
        <span className="font-bold text-right text-base-dark">
          {selectedEventObj ? selectedEventObj.title : "-"} <br/> 
          <span className="opacity-70 font-normal text-sm">
            {selectedDate ? new Date(selectedDate).toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'}) : "-"} | {selectedTime || "-"}
          </span>
        </span>
      </div>
      
      {selectedEventObj?.allowTableSelection !== false && (
        <div className="flex justify-between items-center">
          <span className="opacity-70">Tisch</span>
          <span className="font-bold text-base-dark">{selectedTableObj ? selectedTableObj.name : "-"}</span>
        </div>
      )}
      
      <div className="flex justify-between items-center">
        <span className="opacity-70">{t('guests')}</span>
        <span className="font-bold text-base-dark">{guests} {t('persons')}</span>
      </div>
      
      <div className="flex justify-between items-start mb-6">
        <span className="opacity-70">{t('consumption_package')}</span>
        <div className="text-right text-base-dark">
          <span className="font-bold block">{selectedPackage ? packages.find(p => p.id === selectedPackage)?.name : "-"}</span>
          {selectedPackage && (
            <span className="text-sm opacity-70">{guests} x {packages.find(p => p.id === selectedPackage)?.price}€</span>
          )}
        </div>
      </div>

      {selectedTableObj?.isVip && (
        <div className="flex justify-between items-center text-yellow-600 bg-yellow-50 p-3 rounded-xl text-sm border border-yellow-200">
          <span className="font-bold">VIP Aufpreis</span>
          <span className="font-bold">{(selectedTableObj.vipPrice || 0) / 100}€</span>
        </div>
      )}

      <div className="flex justify-between items-center text-base-dark/70 text-sm">
        <span>Service- & Buchungsgebühr</span>
        <span className="font-bold">{feeInEuros.toFixed(2).replace('.', ',')}€</span>
      </div>

      <div className="pt-6 border-t border-border-light flex justify-between items-end">
        <span className="text-sm font-bold text-base-dark">{t('total_amount')} <br/><span className="text-xs font-normal opacity-50">{t('voucher_hint', { amount: subtotal.toFixed(2).replace('.', ',') + '€' })}</span></span>
        <span className="text-3xl font-black text-accent-green">
          {total.toFixed(2).replace('.', ',')}€
        </span>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop View */}
      <div className="hidden lg:block bg-canvas-light border border-border-light shadow-sm rounded-3xl p-8">
        <h3 className="text-2xl font-bold mb-8 border-b border-border-light pb-6 text-base-dark">{t('summary')}</h3>
        {content}
      </div>

      {/* Mobile Accordion View */}
      <details className="lg:hidden mb-6 bg-canvas-light border border-border-light rounded-2xl overflow-hidden group">
        <summary className="font-bold text-base-dark cursor-pointer p-4 flex justify-between items-center list-none select-none">
          <span>{t('summary')} (Gesamt: {total.toFixed(2).replace('.', ',')}€)</span>
          <svg className="w-5 h-5 text-accent-green transform group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </summary>
        <div className="px-4 pb-6 pt-2 border-t border-border-light">
          {content}
        </div>
      </details>
    </>
  );
}
