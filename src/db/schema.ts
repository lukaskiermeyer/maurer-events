import { pgTable, text, timestamp, boolean, uuid, integer } from 'drizzle-orm/pg-core';

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  date: timestamp('date').notNull(),
  location: text('location').notNull(),
  description: text('description').notNull(),
  titleEn: text('title_en'),
  locationEn: text('location_en'),
  descriptionEn: text('description_en'),
  imageUrl: text('image_url'),
  link: text('link'),
  reservable: boolean('reservable').default(false).notNull(),
  minimumConsumption: integer('minimum_consumption').default(5000), // Default 50€ (in cents)
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const tables = pgTable('tables', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(), // e.g., "Tisch 1"
  capacity: integer('capacity').default(8).notNull(),
  positionX: integer('position_x').default(0).notNull(),
  positionY: integer('position_y').default(0).notNull(),
});

export const reservations = pgTable('reservations', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id).notNull(),
  tableId: uuid('table_id').references(() => tables.id), // Nullable until assigned by admin
  guestName: text('guest_name').notNull(),
  email: text('email').notNull(),
  guestCount: integer('guest_count').notNull(),
  amountTotal: integer('amount_total').notNull(), // in cents
  stripeSessionId: text('stripe_session_id'),
  status: text('status').default('pending').notNull(), // 'pending', 'paid', 'cancelled'
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
