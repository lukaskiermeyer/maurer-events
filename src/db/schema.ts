import { pgTable, text, timestamp, boolean, uuid, integer, json, index } from 'drizzle-orm/pg-core';

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
  minimumConsumption: integer('minimum_consumption').default(5000), // Default 50€ (in cents)
  walkInReserve: integer('walk_in_reserve').default(0).notNull(), // Seats reserved for walk-ins
  publishTablesAt: timestamp('publish_tables_at'), // When tables become visible
  type: text('type').default('event').notNull(), // 'event' or 'gallery'
  isFeaturedGallery: boolean('is_featured_gallery').default(false).notNull(), // To feature on homepage
  deletedAt: timestamp('deleted_at'), // Soft delete timestamp
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tables = pgTable('tables', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(), // e.g., "Tisch 1"
  capacity: integer('capacity').default(8).notNull(),
  positionX: integer('position_x').default(0).notNull(),
  positionY: integer('position_y').default(0).notNull(),
  isVip: boolean('is_vip').default(false).notNull(),
  vipPrice: integer('vip_price').default(0),
});

export const reservations = pgTable('reservations', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  tableId: uuid('table_id').references(() => tables.id), // Nullable until assigned by admin
  reservationDate: timestamp('reservation_date').defaultNow().notNull(), // The specific day they booked for
  guestName: text('guest_name').notNull(),
  email: text('email').notNull(),
  guestCount: integer('guest_count').notNull(),
  amountTotal: integer('amount_total').notNull(), // in cents
  stripeSessionId: text('stripe_session_id'),
  status: text('status').default('pending').notNull(), // 'pending', 'paid', 'cancelled', 'confirmed'
  pdfUrl: text('pdf_url'),
  qrCodeText: text('qr_code_text'),
  scannedAt: timestamp('scanned_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    eventIdIdx: index('res_event_id_idx').on(table.eventId),
    tableIdIdx: index('res_table_id_idx').on(table.tableId),
    sessionIdIdx: index('res_session_id_idx').on(table.stripeSessionId),
    dateIdx: index('res_date_idx').on(table.reservationDate),
  };
});

export const galleries = pgTable('galleries', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
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
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  name: text('name').notNull(),
  email: text('email').notNull(),
  guestCount: integer('guest_count').notNull(),
  notifiedAt: timestamp('notified_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    eventIdIdx: index('wait_event_id_idx').on(table.eventId),
  };
});

export const adminAuth = pgTable('admin_auth', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  otpCode: text('otp_code').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    emailIdx: index('auth_email_idx').on(table.email),
  };
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
