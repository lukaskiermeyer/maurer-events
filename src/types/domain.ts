import type { events, tables, galleries, waitlists, eventSettings, vouchers, eventDocuments, customers, customerImports, staff, staffRoles, staffDocuments, contractTemplates, contracts, staffingRules, staffAvailability, eventStaffRequirements, staffAssignments } from '@/db/schema';
import type { getAdminStats } from '@/app/actions/events';
import type { getReservationsByEvent } from '@/app/actions/reservations';
import type { getPublicEventSettings } from '@/app/actions/eventSettings';
import type { getAllGalleryImages, getGalleryAlbums } from '@/app/actions/gallery';

export type EventRecord = typeof events.$inferSelect;
export type TableRecord = typeof tables.$inferSelect;
export type VoucherRecord = typeof vouchers.$inferSelect;
export type EventDocument = typeof eventDocuments.$inferSelect;
export type CustomerRecord = typeof customers.$inferSelect;
export type CustomerImport = typeof customerImports.$inferSelect;
export type StaffRecord = typeof staff.$inferSelect;
export type StaffRole = typeof staffRoles.$inferSelect;
export type StaffDocumentRecord = typeof staffDocuments.$inferSelect;
export type ContractTemplate = typeof contractTemplates.$inferSelect;
export type ContractRecord = typeof contracts.$inferSelect;
export type StaffingRuleRecord = typeof staffingRules.$inferSelect;
export type StaffAvailabilityRecord = typeof staffAvailability.$inferSelect;
export type EventStaffRequirementRecord = typeof eventStaffRequirements.$inferSelect;
export type StaffAssignmentRecord = typeof staffAssignments.$inferSelect;
export type GalleryImage = typeof galleries.$inferSelect;
export type WaitlistEntry = typeof waitlists.$inferSelect;
export type EventSettings = typeof eventSettings.$inferSelect;
export type FoodPackage = EventSettings['packages'][number];
export interface PackagePreset { name: string; packages: FoodPackage[] }
export interface CareerPosition {
  id: string;
  title: string;
  titleEn?: string;
  titleBar?: string;
  badge: string;
  badgeEn?: string;
  badgeBar?: string;
  employment: string;
  employmentEn?: string;
  employmentBar?: string;
  description: string;
  descriptionEn?: string;
  descriptionBar?: string;
  benefits: string[];
  benefitsEn?: string[];
  benefitsBar?: string[];
}
export interface CareerContent {
  headline: string;
  headlineEn?: string;
  headlineBar?: string;
  intro: string;
  introEn?: string;
  introBar?: string;
  positions: CareerPosition[];
  closingTitle: string;
  closingTitleEn?: string;
  closingTitleBar?: string;
  closingText: string;
  closingTextEn?: string;
  closingTextBar?: string;
}
export type AdminStats = Awaited<ReturnType<typeof getAdminStats>>;
export type ReservationRow = Awaited<ReturnType<typeof getReservationsByEvent>>[number];
export type PublicEventSettings = NonNullable<Awaited<ReturnType<typeof getPublicEventSettings>>>;
export type GalleryAlbum = Awaited<ReturnType<typeof getGalleryAlbums>>[number];
export type GalleryWithEvent = Awaited<ReturnType<typeof getAllGalleryImages>>[number];
export type ReservationEvent = Omit<EventRecord, 'date' | 'publishTablesAt'> & {
  date: Date | string;
  publishTablesAt: Date | string | null;
};
export interface TentFeature { kind: 'stage' | 'bar' | 'entrance' | 'blocked'; x: number; y: number; w: number; h: number; label?: string }
export interface TentDimensions { width: number; height: number; cellSizeM?: number; features?: TentFeature[] }
