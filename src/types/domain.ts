import type { events, tables, galleries, waitlists, eventSettings } from '@/db/schema';
import type { getAdminStats } from '@/app/actions/events';
import type { getReservationsByEvent } from '@/app/actions/reservations';
import type { getPublicEventSettings } from '@/app/actions/eventSettings';
import type { getAllGalleryImages, getGalleryAlbums } from '@/app/actions/gallery';

export type EventRecord = typeof events.$inferSelect;
export type TableRecord = typeof tables.$inferSelect;
export type GalleryImage = typeof galleries.$inferSelect;
export type WaitlistEntry = typeof waitlists.$inferSelect;
export type EventSettings = typeof eventSettings.$inferSelect;
export type FoodPackage = EventSettings['packages'][number];
export type AdminStats = Awaited<ReturnType<typeof getAdminStats>>;
export type ReservationRow = Awaited<ReturnType<typeof getReservationsByEvent>>[number];
export type PublicEventSettings = NonNullable<Awaited<ReturnType<typeof getPublicEventSettings>>>;
export type GalleryAlbum = Awaited<ReturnType<typeof getGalleryAlbums>>[number];
export type GalleryWithEvent = Awaited<ReturnType<typeof getAllGalleryImages>>[number];
export type ReservationEvent = Omit<EventRecord, 'date' | 'publishTablesAt'> & {
  date: Date | string;
  publishTablesAt: Date | string | null;
};
export interface TentDimensions { width: number; height: number }
