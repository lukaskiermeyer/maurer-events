import { pgTable, text, timestamp, boolean, uuid, integer, json, jsonb, index, check, unique, uniqueIndex, pgEnum, real } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const reservationStatusEnum = pgEnum('reservation_status', ['pending', 'paid', 'confirmed', 'checked_in', 'cancelled', 'expired', 'refunded', 'disputed', 'payment_review', 'payment_pending']);

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  date: timestamp('date').notNull(), // Start date
  endDate: timestamp('end_date'), // Optional end date for multi-day
  location: text('location').notNull(),
  description: text('description').notNull(),
  titleEn: text('title_en'),
  locationEn: text('location_en'),
  descriptionEn: text('description_en'),
  imageUrl: text('image_url'),
  link: text('link'),
  reservable: boolean('reservable').default(false).notNull(),
  allowTableSelection: boolean('allow_table_selection').default(true).notNull(),
  maxCapacity: integer('max_capacity').default(0).notNull(),
  reservableDates: json('reservable_dates'), // Array of ISO date strings
  minimumConsumption: integer('minimum_consumption').default(5000), // Default 50â‚¬ (in cents)
  walkInReserve: integer('walk_in_reserve').default(0).notNull(), // Seats reserved for walk-ins
  publishTablesAt: timestamp('publish_tables_at'), // When tables become visible
  type: text('type').default('event').notNull(), // 'event' or 'gallery'
  isFeaturedGallery: boolean('is_featured_gallery').default(false).notNull(), // To feature on homepage
  deletedAt: timestamp('deleted_at'), // Soft delete timestamp
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    maxCapacityCheck: check('events_max_capacity_check', sql`${table.maxCapacity} >= 0`),
    minimumConsumptionCheck: check('events_minimum_consumption_check', sql`${table.minimumConsumption} >= 0`),
    walkInReserveCheck: check('events_walk_in_reserve_check', sql`${table.walkInReserve} >= 0`),
  };
});

export const tables = pgTable('tables', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(), // e.g., "Tisch 1"
  capacity: integer('capacity').default(8).notNull(),
  positionX: integer('position_x').default(0).notNull(),
  positionY: integer('position_y').default(0).notNull(),
  isVip: boolean('is_vip').default(false).notNull(),
  vipPrice: integer('vip_price').default(0),
}, (table) => {
  return {
    nameUnique: unique('table_name_unique').on(table.name),
    capacityCheck: check('tables_capacity_check', sql`${table.capacity} > 0`),
    vipPriceCheck: check('tables_vip_price_check', sql`${table.vipPrice} >= 0`),
  };
});

export const reservations = pgTable('reservations', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'restrict' }).notNull(),
  tableId: uuid('table_id').references(() => tables.id, { onDelete: 'set null' }), // Nullable until assigned by admin
  reservationDate: timestamp('reservation_date').defaultNow().notNull(), // The specific day they booked for
  guestName: text('guest_name').notNull(),
  email: text('email').notNull(),
  guestCount: integer('guest_count').notNull(),
  selectedTime: text('selected_time'),
  amountTotal: integer('amount_total').notNull(), // in cents
  stripeSessionId: text('stripe_session_id').unique(),
  idempotencyKey: text('idempotency_key').unique(),
  requestHash: text('request_hash'),
  checkoutParams: jsonb('checkout_params').$type<Record<string, unknown>>(),
  status: reservationStatusEnum('status').default('pending').notNull(),
  expiresAt: timestamp('expires_at'),
  pdfUrl: text('pdf_url'),
  qrCodeText: text('qr_code_text').unique(),
  ticketEmailPayload: jsonb('ticket_email_payload').$type<Record<string, unknown>>(),
  ticketSentAt: timestamp('ticket_sent_at'),
  scannedAt: timestamp('scanned_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    eventIdIdx: index('res_event_id_idx').on(table.eventId),
    tableIdIdx: index('res_table_id_idx').on(table.tableId),
    sessionIdIdx: index('res_session_id_idx').on(table.stripeSessionId).where(sql`${table.stripeSessionId} IS NOT NULL`),
    expiresPendingIdx: index('res_expires_pending_idx').on(table.expiresAt).where(sql`${table.status} = 'pending'`),
    dateIdx: index('res_date_idx').on(table.reservationDate),
    eventDateStatusIdx: index('res_event_date_status_idx').on(table.eventId, table.reservationDate, table.status),
    guestCountCheck: check('res_guest_count_check', sql`${table.guestCount} > 0`),
    amountTotalCheck: check('res_amount_total_check', sql`${table.amountTotal} >= 0`),
  };
});

export const galleries = pgTable('galleries', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'restrict' }).notNull(),
  imageUrl: text('image_url').notNull(),
  publicId: text('public_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    eventIdIdx: index('gal_event_id_idx').on(table.eventId),
  };
});

export const settings = pgTable('settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(), // JSON string for flexibility
});

export const waitlists = pgTable('waitlists', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'restrict' }).notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  guestCount: integer('guest_count').notNull(),
  notifiedAt: timestamp('notified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    eventIdIdx: index('wait_event_id_idx').on(table.eventId),
    guestCountCheck: check('waitlists_guest_count_check', sql`${table.guestCount} > 0`),
    emailUnique: uniqueIndex('wait_event_email_unique').on(table.eventId, sql`lower(trim(${table.email}))`),
  };
});

export const adminAuth = pgTable('admin_auth', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  otpCode: text('otp_code').notNull(),
  attempts: integer('attempts').default(0).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    emailUnique: unique('auth_email_unique').on(table.email),
  };
});

export const securityRateLimits = pgTable('security_rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  resetAt: timestamp('reset_at').notNull(),
});

export const adminSessions = pgTable('admin_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  validUntil: timestamp('valid_until').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    sessionEmailIdx: index('sess_email_idx').on(table.email),
  };
});

export const stripeEvents = pgTable('stripe_events', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});


export const eventSettings = pgTable('event_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).unique().notNull(),

  // Tisch-Belegung
  requireFullTable: boolean('require_full_table').default(true).notNull(),

  // Mindestabnahme (in Cents)
  minConsumptionCents: integer('min_consumption_cents').default(5000).notNull(),

  // Zeitslots (JSON Array)
  timeSlots: jsonb('time_slots').$type<string[]>().default(['17:00', '18:00', '19:00']).notNull(),

  // Pakete (JSON Array)
  packages: jsonb('packages').$type<{
    id: string;
    name: string;
    price: number; // in Euro
    description: string;
    popular?: boolean;
  }[]>().default([
    { id: 'brotzeit', name: 'Brotzeit-Paket', price: 25, description: '1 Maß & 1 halbes Hendl', popular: false },
    { id: 'vollgas', name: 'Vollgas-Paket', price: 50, description: '2 Maß, 1 Hauptgericht & 1 Schnaps', popular: true }
  ]).notNull(),

  // Storno-Bedingungen
  cancellationDays: integer('cancellation_days').default(7).notNull(),

  // Limitierungen
  maxBookingsPerEmail: integer('max_bookings_per_email').default(2).notNull(),

  // Service-Fee (optional, sonst globale Fee)
  customServiceFee: boolean('custom_service_fee').default(false).notNull(),
  serviceFeePercent: real('service_fee_percent').default(1.5).notNull(),
  serviceFeeFixedCents: integer('service_fee_fixed_cents').default(25).notNull(),

  // Buchungszeitraum
  bookingWindowStartDays: integer('booking_window_start_days').default(90).notNull(),
  bookingWindowEndHours: integer('booking_window_end_hours').default(2).notNull(),

  // Ticket-Versand
  autoSendTicket: boolean('auto_send_ticket').default(true).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
