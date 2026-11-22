import { PgSchema, text, timestamp, boolean, uuid, integer, json, jsonb, index, check, unique, uniqueIndex, real, customType, bigint, bigserial } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Qualify every table and enum, even when a pooled session has an empty search_path.
// PgSchema's constructor supports explicit public qualification; pgSchema() rejects it.
const publicSchema = new PgSchema('public');
const pgTable = publicSchema.table;

export const bytea = customType<{ data: Uint8Array; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
  toDriver(value: Uint8Array): Buffer {
    return Buffer.from(value);
  },
  fromDriver(value: unknown): Uint8Array {
    if (value instanceof Buffer) return new Uint8Array(value);
    if (value instanceof Uint8Array) return value;
    if (ArrayBuffer.isView(value)) return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    return new Uint8Array(value as ArrayBuffer);
  },
});
export const reservationStatusEnum = publicSchema.enum('reservation_status', ['pending', 'paid', 'confirmed', 'checked_in', 'cancelled', 'expired', 'refunded', 'disputed', 'payment_review', 'payment_pending', 'requested', 'declined']);

export const events = pgTable('events', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title').notNull(),
  date: timestamp('date').notNull(), // Start date
  endDate: timestamp('end_date'), // Optional end date for multi-day
  location: text('location').notNull(),
  zip: text('zip'),
  description: text('description').notNull(),
  titleEn: text('title_en'),
  locationEn: text('location_en'),
  descriptionEn: text('description_en'),
  titleBar: text('title_bar'),
  locationBar: text('location_bar'),
  descriptionBar: text('description_bar'),
  imageUrl: text('image_url'),
  mapUrl: text('map_url'),
  link: text('link'),
  reservable: boolean('reservable').default(false).notNull(),
  allowTableSelection: boolean('allow_table_selection').default(true).notNull(),
  reservationMode: text('reservation_mode').default('none').notNull(), // 'none' | 'email' | 'online'
  reservationEmail: text('reservation_email').default('servus@maurer-events.com').notNull(),
  reservationNote: text('reservation_note'),
  reservationDeadline: timestamp('reservation_deadline'),
  expectedGuests: integer('expected_guests'),
  maxCapacity: integer('max_capacity').default(0).notNull(),
  reservableDates: json('reservable_dates').$type<string[]>(), // Array of ISO date strings
  minimumConsumption: integer('minimum_consumption').default(5000), // Deprecated: unused for pricing, the package price is authoritative. Drop in a later migration.
  walkInReserve: integer('walk_in_reserve').default(0).notNull(), // Seats reserved for walk-ins
  publishTablesAt: timestamp('publish_tables_at'), // When tables become visible
  type: text('type').default('event').notNull(), // Deprecated: nur noch 'event'; Galerie ist eigenständig (gallery_albums). Spalte später entfernen.
  isFeaturedGallery: boolean('is_featured_gallery').default(false).notNull(), // Deprecated: ungenutzt, Startseite kuratiert über galleries.is_favorite. Spalte später entfernen.
  isPublished: boolean('is_published').default(true).notNull(), // Whether the event is visible on the public site
  deletedAt: timestamp('deleted_at'), // Soft delete timestamp
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    maxCapacityCheck: check('events_max_capacity_check', sql`${table.maxCapacity} >= 0`),
    minimumConsumptionCheck: check('events_minimum_consumption_check', sql`${table.minimumConsumption} >= 0`),
    walkInReserveCheck: check('events_walk_in_reserve_check', sql`${table.walkInReserve} >= 0`),
    reservationModeCheck: check('events_reservation_mode_check', sql`${table.reservationMode} in ('none', 'email', 'online')`),
    expectedGuestsCheck: check('events_expected_guests_check', sql`${table.expectedGuests} is null or ${table.expectedGuests} >= 0`),
  };
});

export const tables = pgTable('tables', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(), // e.g., "Tisch 1"
  capacity: integer('capacity').default(8).notNull(),
  positionX: integer('position_x').default(0).notNull(),
  positionY: integer('position_y').default(0).notNull(),
  section: text('section'),
  rowLabel: text('row_label'),
  displayNumber: text('display_number'),
  shape: text('shape').default('rect').notNull(), // 'rect' | 'round'
  widthM: real('width_m'),
  heightM: real('height_m'),
  rotation: integer('rotation').default(0).notNull(),
  isBlocked: boolean('is_blocked').default(false).notNull(),
  isVip: boolean('is_vip').default(false).notNull(),
  vipPrice: integer('vip_price').default(0),
}, (table) => {
  return {
    nameUnique: unique('table_name_unique').on(table.name),
    capacityCheck: check('tables_capacity_check', sql`${table.capacity} > 0`),
    vipPriceCheck: check('tables_vip_price_check', sql`${table.vipPrice} >= 0`),
    shapeCheck: check('tables_shape_check', sql`${table.shape} in ('rect', 'round')`),
    rotationCheck: check('tables_rotation_check', sql`${table.rotation} >= 0 and ${table.rotation} < 360`),
    widthCheck: check('tables_width_check', sql`${table.widthM} is null or ${table.widthM} > 0`),
    heightCheck: check('tables_height_check', sql`${table.heightM} is null or ${table.heightM} > 0`),
  };
});

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  displayName: text('display_name').notNull(),
  company: text('company'),
  email: text('email'),
  phone: text('phone'),
  street: text('street'),
  zip: text('zip'),
  city: text('city'),
  notes: text('notes'),
  tags: text('tags').array().default([]).notNull(),
  source: text('source').default('manual').notNull(), // 'manual' | 'request' | 'snapticket'
  externalRef: text('external_ref'),
  externalSource: text('external_source'),
  marketingConsent: boolean('marketing_consent').default(false).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'),
}, (table) => {
  return {
    emailUnique: uniqueIndex('customer_email_unique').on(sql`lower(trim(${table.email}))`),
    phoneIdx: index('customer_phone_idx').on(table.phone),
    externalRefIdx: index('customer_external_ref_idx').on(table.externalSource, table.externalRef),
    nameCheck: check('customers_name_check', sql`length(trim(${table.displayName})) > 0`),
  };
});

export const customerImports = pgTable('customer_imports', {
  id: uuid('id').defaultRandom().primaryKey(),
  fileName: text('file_name'),
  importedBy: text('imported_by').notNull(),
  rowCount: integer('row_count').notNull(),
  createdCount: integer('created_count').notNull(),
  updatedCount: integer('updated_count').notNull(),
  skippedCount: integer('skipped_count').notNull(),
  report: jsonb('report').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const staffRoles = pgTable('staff_roles', {
  id: uuid('id').defaultRandom().primaryKey(),
  key: text('key').notNull(),
  name: text('name').notNull(),
  description: text('description'),
  hourlyRateCents: integer('hourly_rate_cents').default(0).notNull(),
  profitSharePercent: real('profit_share_percent'),
  requiredDocuments: jsonb('required_documents').$type<string[]>().default([]).notNull(),
  requiresHandwrittenSignature: boolean('requires_handwritten_signature').default(false).notNull(),
  active: boolean('active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  keyUnique: unique('staff_role_key_unique').on(table.key),
  rateCheck: check('staff_roles_rate_check', sql`${table.hourlyRateCents} >= 0`),
}));

export const staff = pgTable('staff', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  passwordHash: text('password_hash'),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone'),
  birthDate: timestamp('birth_date'),
  street: text('street'),
  houseNumber: text('house_number'),
  zip: text('zip'),
  city: text('city'),
  roleId: uuid('role_id').references(() => staffRoles.id, { onDelete: 'set null' }),
  status: text('status').default('invited').notNull(), // invited | onboarding | ready | active | inactive
  employmentType: text('employment_type').default('minijob').notNull(), // minijob | short_term | student | employed
  hourlyRateCents: integer('hourly_rate_cents').default(0).notNull(),
  profitSharePercent: real('profit_share_percent'),
  monthlySalaryCents: integer('monthly_salary_cents').default(0).notNull(),
  taxIdEnc: text('tax_id_enc'),
  taxClass: text('tax_class'),
  childAllowances: integer('child_allowances').default(0).notNull(),
  socialSecurityEnc: text('social_security_enc'),
  healthInsurance: text('health_insurance'),
  ibanEnc: text('iban_enc'),
  bic: text('bic'),
  entryDate: timestamp('entry_date'),
  exitDate: timestamp('exit_date'),
  lastLoginAt: timestamp('last_login_at'),
  privacyVersion: text('privacy_version'),
  privacyAcceptedAt: timestamp('privacy_accepted_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  emailUnique: uniqueIndex('staff_email_unique').on(sql`lower(trim(${table.email}))`),
  statusCheck: check('staff_status_check', sql`${table.status} in ('invited', 'onboarding', 'ready', 'active', 'inactive')`),
  employmentCheck: check('staff_employment_check', sql`${table.employmentType} in ('minijob', 'short_term', 'student', 'employed')`),
  rateCheck: check('staff_rate_check', sql`${table.hourlyRateCents} >= 0 and ${table.monthlySalaryCents} >= 0`),
}));

export const staffInvites = pgTable('staff_invites', {
  id: uuid('id').defaultRandom().primaryKey(),
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tokenUnique: unique('staff_invite_token_unique').on(table.tokenHash),
  staffIdx: index('staff_invite_staff_idx').on(table.staffId),
}));

export const staffSessions = pgTable('staff_sessions', {
  id: uuid('id').defaultRandom().primaryKey(),
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'cascade' }).notNull(),
  validUntil: timestamp('valid_until').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  staffIdx: index('staff_session_staff_idx').on(table.staffId),
  validIdx: index('staff_session_valid_idx').on(table.validUntil),
}));

export const staffDocuments = pgTable('staff_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'cascade' }).notNull(),
  kind: text('kind').notNull(), // id_card | health_certificate | tax_card | minijob_form | other
  fileUrl: text('file_url').notNull(),
  publicId: text('public_id'),
  mimeType: text('mime_type').notNull(),
  status: text('status').default('pending').notNull(), // pending | verified | rejected
  expiresAt: timestamp('expires_at'),
  verifiedBy: text('verified_by'),
  verifiedAt: timestamp('verified_at'),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  staffIdx: index('staff_document_staff_idx').on(table.staffId),
  statusCheck: check('staff_documents_status_check', sql`${table.status} in ('pending', 'verified', 'rejected')`),
  kindCheck: check('staff_documents_kind_check', sql`${table.kind} in ('id_card', 'health_certificate', 'tax_card', 'minijob_form', 'driver_license', 'work_certificate', 'other')`),
}));

export const contractTemplates = pgTable('contract_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  roleId: uuid('role_id').references(() => staffRoles.id, { onDelete: 'set null' }),
  name: text('name').notNull(),
  version: integer('version').default(1).notNull(),
  bodyHtml: text('body_html').notNull(),
  signatureMode: text('signature_mode').default('text').notNull(), // text | handwritten
  status: text('status').default('draft').notNull(), // draft | reviewed | active
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  roleIdx: index('contract_template_role_idx').on(table.roleId),
  statusCheck: check('contract_templates_status_check', sql`${table.status} in ('draft', 'reviewed', 'active')`),
  signatureCheck: check('contract_templates_signature_check', sql`${table.signatureMode} in ('text', 'handwritten')`),
}));

export const contracts = pgTable('contracts', {
  id: uuid('id').defaultRandom().primaryKey(),
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'cascade' }).notNull(),
  templateId: uuid('template_id').references(() => contractTemplates.id, { onDelete: 'set null' }),
  templateVersion: integer('template_version').notNull(),
  roleId: uuid('role_id').references(() => staffRoles.id, { onDelete: 'set null' }),
  bodyHtml: text('body_html').notNull(),
  signatureMode: text('signature_mode').notNull(),
  status: text('status').default('pending').notNull(), // pending | signed | verified | declined
  signedAt: timestamp('signed_at'),
  signedFileUrl: text('signed_file_url'),
  signedFileSha256: text('signed_file_sha256'),
  consentVersion: text('consent_version'),
  signedIp: text('signed_ip'),
  signedUserAgent: text('signed_user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  staffIdx: index('contract_staff_idx').on(table.staffId),
  statusCheck: check('contracts_status_check', sql`${table.status} in ('pending', 'signed', 'verified', 'declined')`),
}));

export const auditLog = pgTable('audit_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  actorType: text('actor_type').notNull(),
  actorId: text('actor_id').notNull(),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  meta: jsonb('meta').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  actorIdx: index('audit_actor_idx').on(table.actorType, table.actorId),
  entityIdx: index('audit_entity_idx').on(table.entityType, table.entityId),
}));

export const documentFormTemplates = pgTable('document_form_templates', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').default('Minijob-Formular').notNull(),
  kind: text('kind').default('minijob').notNull(),
  bodyHtml: text('body_html').default('').notNull(),
  status: text('status').default('draft').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  statusCheck: check('document_form_templates_status_check', sql`${table.status} in ('draft', 'active')`),
  kindCheck: check('document_form_templates_kind_check', sql`${table.kind} in ('minijob', 'other')`),
}));

export const payrollExports = pgTable('payroll_exports', {  id: uuid('id').defaultRandom().primaryKey(),
  createdBy: text('created_by').notNull(),
  format: text('format').default('datev_csv').notNull(),
  periodFrom: timestamp('period_from'),
  periodTo: timestamp('period_to'),
  rowCount: integer('row_count').notNull(),
  selectedStaffIds: jsonb('selected_staff_ids').$type<string[]>(),
  fileHash: text('file_hash').notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tokenUnique: unique('payroll_export_token_unique').on(table.tokenHash),
  createdIdx: index('payroll_export_created_idx').on(table.createdAt),
}));

export const staffingRules = pgTable('staffing_rules', {
  id: uuid('id').defaultRandom().primaryKey(),
  roleId: uuid('role_id').references(() => staffRoles.id, { onDelete: 'cascade' }).unique().notNull(),
  guestsPerStaff: integer('guests_per_staff').default(40).notNull(),
  minStaff: integer('min_staff').default(1).notNull(),
  fixedStaff: integer('fixed_staff').default(0).notNull(),
  maxHoursPerDay: integer('max_hours_per_day').default(10).notNull(),
  minRestHours: integer('min_rest_hours').default(11).notNull(),
  minAge: integer('min_age').default(18).notNull(),
  active: boolean('active').default(true).notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  guestsCheck: check('staffing_rules_guests_check', sql`${table.guestsPerStaff} > 0`),
  countsCheck: check('staffing_rules_counts_check', sql`${table.minStaff} >= 0 and ${table.fixedStaff} >= 0`),
  hoursCheck: check('staffing_rules_hours_check', sql`${table.maxHoursPerDay} between 1 and 24 and ${table.minRestHours} between 0 and 24`),
  ageCheck: check('staffing_rules_age_check', sql`${table.minAge} between 0 and 100`),
}));

export const staffAvailability = pgTable('staff_availability', {
  id: uuid('id').defaultRandom().primaryKey(),
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'cascade' }).notNull(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  date: timestamp('date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  kind: text('kind').default('available').notNull(), // available | unavailable | preferred
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  staffEventIdx: index('staff_availability_staff_event_idx').on(table.staffId, table.eventId),
  eventIdx: index('staff_availability_event_idx').on(table.eventId),
  kindCheck: check('staff_availability_kind_check', sql`${table.kind} in ('available', 'unavailable', 'preferred')`),
}));

export const eventStaffRequirements = pgTable('event_staff_requirements', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  roleId: uuid('role_id').references(() => staffRoles.id, { onDelete: 'restrict' }).notNull(),
  date: timestamp('date').notNull(),
  startTime: text('start_time'),
  endTime: text('end_time'),
  requiredCount: integer('required_count').notNull(),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  eventIdx: index('staff_requirement_event_idx').on(table.eventId),
  countCheck: check('staff_requirement_count_check', sql`${table.requiredCount} > 0`),
}));

export const staffAssignments = pgTable('staff_assignments', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'cascade' }).notNull(),
  roleId: uuid('role_id').references(() => staffRoles.id, { onDelete: 'restrict' }).notNull(),
  date: timestamp('date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  status: text('status').default('proposed').notNull(), // proposed | requested | accepted | declined | confirmed
  source: text('source').default('auto').notNull(), // auto | manual | self
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  eventIdx: index('staff_assignment_event_idx').on(table.eventId),
  staffIdx: index('staff_assignment_staff_idx').on(table.staffId),
  uniqueShift: unique('staff_assignment_unique_shift').on(table.eventId, table.staffId, table.date, table.startTime),
  statusCheck: check('staff_assignment_status_check', sql`${table.status} in ('proposed', 'requested', 'accepted', 'declined', 'confirmed')`),
  sourceCheck: check('staff_assignment_source_check', sql`${table.source} in ('auto', 'manual', 'self')`),
}));

export const reservations = pgTable('reservations', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'restrict' }).notNull(),
  customerId: uuid('customer_id').references(() => customers.id, { onDelete: 'set null' }),
  tableId: uuid('table_id').references(() => tables.id, { onDelete: 'set null' }), // Nullable until assigned by admin
  reservationDate: timestamp('reservation_date').defaultNow().notNull(), // The specific day they booked for
  guestName: text('guest_name').notNull(),
  email: text('email').notNull(),
  phone: text('phone'),
  guestCount: integer('guest_count').notNull(),
  selectedTime: text('selected_time'),
  amountTotal: integer('amount_total').notNull(), // in cents
  stripeSessionId: text('stripe_session_id').unique(),
  idempotencyKey: text('idempotency_key').unique(),
  requestHash: text('request_hash'),
  checkoutParams: jsonb('checkout_params').$type<Record<string, unknown>>(),
  status: reservationStatusEnum('status').default('pending').notNull(),
  source: text('source'), // 'online' | 'email' | 'manual' | 'import' | 'legacy'
  bookingGroupId: uuid('booking_group_id'),
  groupLabel: text('group_label'),
  groupIndex: integer('group_index'),
  groupSize: integer('group_size'),
  notes: text('notes'),
  internalNotes: text('internal_notes'),
  packageId: text('package_id'),
  packageName: text('package_name'),
  priceGrossCents: integer('price_gross_cents'),
  priceNetCents: integer('price_net_cents'),
  vatCents: integer('vat_cents'),
  vatRate: integer('vat_rate'),
  agreedPriceCents: integer('agreed_price_cents'),
  privacyVersion: text('privacy_version'),
  privacyAcceptedAt: timestamp('privacy_accepted_at'),
  confirmedAt: timestamp('confirmed_at'),
  confirmedBy: text('confirmed_by'),
  slipPrintedAt: timestamp('slip_printed_at'),
  paymentStatus: text('payment_status'), // 'open' | 'deposit_paid' | 'paid' | 'refunded'
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
    customerIdIdx: index('res_customer_id_idx').on(table.customerId),
    tableIdIdx: index('res_table_id_idx').on(table.tableId),
    sessionIdIdx: index('res_session_id_idx').on(table.stripeSessionId).where(sql`${table.stripeSessionId} IS NOT NULL`),
    expiresPendingIdx: index('res_expires_pending_idx').on(table.expiresAt).where(sql`${table.status} = 'pending'`),
    dateIdx: index('res_date_idx').on(table.reservationDate),
    eventDateStatusIdx: index('res_event_date_status_idx').on(table.eventId, table.reservationDate, table.status),
    bookingGroupIdx: index('res_booking_group_idx').on(table.bookingGroupId).where(sql`${table.bookingGroupId} IS NOT NULL`),
    guestCountCheck: check('res_guest_count_check', sql`${table.guestCount} > 0`),
    amountTotalCheck: check('res_amount_total_check', sql`${table.amountTotal} >= 0`),
    sourceCheck: check('res_source_check', sql`${table.source} is null or ${table.source} in ('online', 'email', 'manual', 'import', 'legacy')`),
    groupIndexCheck: check('res_group_index_check', sql`${table.groupIndex} is null or ${table.groupIndex} > 0`),
    groupSizeCheck: check('res_group_size_check', sql`${table.groupSize} is null or ${table.groupSize} > 0`),
    priceGrossCheck: check('res_price_gross_check', sql`${table.priceGrossCents} is null or ${table.priceGrossCents} >= 0`),
    priceNetCheck: check('res_price_net_check', sql`${table.priceNetCents} is null or ${table.priceNetCents} >= 0`),
    vatCentsCheck: check('res_vat_cents_check', sql`${table.vatCents} is null or ${table.vatCents} >= 0`),
    vatRateCheck: check('res_vat_rate_check', sql`${table.vatRate} is null or ${table.vatRate} in (0, 7, 19)`),
    agreedPriceCheck: check('res_agreed_price_check', sql`${table.agreedPriceCents} is null or ${table.agreedPriceCents} >= 0`),
    paymentStatusCheck: check('res_payment_status_check', sql`${table.paymentStatus} is null or ${table.paymentStatus} in ('open', 'deposit_paid', 'paid', 'refunded')`),
  };
});

export const vouchers = pgTable('vouchers', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'restrict' }).notNull(),
  reservationId: uuid('reservation_id').references(() => reservations.id, { onDelete: 'set null' }),
  code: text('code').notNull(),
  valueCents: integer('value_cents').notNull(),
  status: text('status').default('issued').notNull(), // 'issued' | 'redeemed' | 'void'
  issuedAt: timestamp('issued_at').defaultNow().notNull(),
  redeemedAt: timestamp('redeemed_at'),
  redeemedBy: text('redeemed_by'),
  note: text('note'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    codeUnique: unique('voucher_code_unique').on(table.code),
    eventIdIdx: index('voucher_event_id_idx').on(table.eventId),
    reservationIdIdx: index('voucher_reservation_id_idx').on(table.reservationId),
    valueCheck: check('vouchers_value_check', sql`${table.valueCents} > 0`),
    statusCheck: check('vouchers_status_check', sql`${table.status} in ('issued', 'redeemed', 'void')`),
    redeemedCheck: check('vouchers_redeemed_check', sql`${table.status} <> 'redeemed' or ${table.redeemedAt} is not null`),
  };
});

// Eigenständige Galerie-Alben (Rückblick vergangener Feste), entkoppelt von events.
// eventId = optionale Herkunft: das Album gehört zu diesem Fest (Uploads im Event-Tab
// landen dort). Gelöschte Events setzen den Link auf null, das Album bleibt erhalten.
export const galleryAlbums = pgTable('gallery_albums', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'set null' }),
  title: text('title').notNull(),
  titleEn: text('title_en'),
  titleBar: text('title_bar'),
  date: timestamp('date').notNull(),
  location: text('location').notNull(),
  locationEn: text('location_en'),
  locationBar: text('location_bar'),
  description: text('description').notNull(),
  descriptionEn: text('description_en'),
  descriptionBar: text('description_bar'),
  coverImageUrl: text('cover_image_url'),
  coverPublicId: text('cover_public_id'),
  // Manuelle Reihenfolge (Admin ↑/↓) = Anzeige auf /galerie; Gleichstand: Datum absteigend.
  sortOrder: integer('sort_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  deletedAt: timestamp('deleted_at'), // Soft delete timestamp
}, (table) => {
  return {
    eventIdx: index('gallery_album_event_idx').on(table.eventId),
  };
});

export const galleries = pgTable('galleries', {
  id: uuid('id').defaultRandom().primaryKey(),
  albumId: uuid('album_id').references(() => galleryAlbums.id, { onDelete: 'cascade' }), // null = Bilder-Pool ohne Album
  imageUrl: text('image_url').notNull(),
  publicId: text('public_id'),
  // Kuratierte "Best of"-Auswahl fuer die Startseite (max 8), mit Reihenfolge.
  isFavorite: boolean('is_favorite').default(false).notNull(),
  favoriteOrder: integer('favorite_order').default(0).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    albumIdIdx: index('gal_album_id_idx').on(table.albumId),
  };
});

export const eventDocuments = pgTable('event_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  kind: text('kind').notNull(), // 'menu' | 'program'
  title: text('title').notNull(),
  titleEn: text('title_en'),
  titleBar: text('title_bar'),
  fileUrl: text('file_url').notNull(),
  previewUrl: text('preview_url'),
  publicId: text('public_id'),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes'),
  isPublic: boolean('is_public').default(true).notNull(),
  sortOrder: integer('sort_order').default(0).notNull(),
  createdBy: text('created_by'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    eventIdIdx: index('event_doc_event_id_idx').on(table.eventId),
    kindCheck: check('event_documents_kind_check', sql`${table.kind} in ('menu', 'program')`),
    sizeCheck: check('event_documents_size_check', sql`${table.sizeBytes} is null or ${table.sizeBytes} >= 0`),
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

export const scannerAccess = pgTable('scanner_access', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  email: text('email').notNull(),
  validUntil: timestamp('valid_until').notNull(),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, table => ({
  eventEmailUnique: uniqueIndex('scanner_event_email_unique').on(table.eventId, sql`lower(trim(${table.email}))`),
  emailIdx: index('scanner_email_idx').on(table.email),
}));

export const adminUsers = pgTable('admin_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  emailNormalized: text('email_normalized'),
  displayName: text('display_name'),
  role: text('role').default('owner').notNull(),
  status: text('status').default('pending_enrollment').notNull(),
  webauthnUserId: text('webauthn_user_id'),
  enrolledAt: timestamp('enrolled_at'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  lastLoginAt: timestamp('last_login_at'),
  failedAttempts: integer('failed_attempts').default(0).notNull(),
  lockedUntil: timestamp('locked_until'),
  removedAt: timestamp('removed_at'),
  passwordHash: text('password_hash'),
  passwordSetAt: timestamp('password_set_at'),
  totpSecretEnc: bytea('totp_secret_enc'),
  totpEnrolledAt: timestamp('totp_enrolled_at'),
  totpLastUsedStep: bigint('totp_last_used_step', { mode: 'number' }),
  failedPasswordAttempts: integer('failed_password_attempts').default(0).notNull(),
  failedTotpAttempts: integer('failed_totp_attempts').default(0).notNull(),
}, (table) => ({
  emailUnique: uniqueIndex('admin_users_email_unique').on(sql`lower(trim(${table.email}))`),
  emailNormalizedUnique: uniqueIndex('admin_users_email_normalized_unique').on(table.emailNormalized),
  webauthnUserUnique: uniqueIndex('admin_users_webauthn_user_unique').on(table.webauthnUserId),
}));

// TOTP (RFC 6238) MFA for admin accounts. One row per admin email (incl. env admins).
export const adminMfa = pgTable('admin_mfa', {
  email: text('email').primaryKey(),
  totpSecretEnc: text('totp_secret_enc'),
  totpEnabledAt: timestamp('totp_enabled_at'),
  totpLastCounter: integer('totp_last_counter'),
  recoveryCodes: jsonb('recovery_codes').$type<string[]>().default([]).notNull(),
  pendingSecretEnc: text('pending_secret_enc'),
  pendingCreatedAt: timestamp('pending_created_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// "Dieses Gerät merken" (7 Tage) – trusted device tokens for admins.
export const adminTrustedDevices = pgTable('admin_trusted_devices', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull(),
  tokenHash: text('token_hash').notNull(),
  fingerprint: text('fingerprint'),
  sessionHash: text('session_hash'),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),
}, (table) => ({
  tokenUnique: unique('admin_trusted_device_token_unique').on(table.tokenHash),
  emailIdx: index('admin_trusted_device_email_idx').on(table.email),
}));


export const festOpportunities = pgTable('fest_opportunities', {
  id: uuid('id').defaultRandom().primaryKey(),
  title: text('title'),
  organizer: text('organizer'),
  location: text('location'),
  region: text('region'),
  eventDate: timestamp('event_date'),
  jubileeYears: integer('jubilee_years'),
  categories: jsonb('categories').$type<string[]>().default([]),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  sourceUrl: text('source_url').notNull(),
  sourceUrlNormalized: text('source_url_normalized'),
  urlHash: text('url_hash').notNull(),
  notes: text('notes'),
  festwirtStatus: text('festwirt_status').default('unknown').notNull(), // open | unknown | taken | closed
  score: integer('score').default(0).notNull(),
  scoreReason: text('score_reason'),
  monthsAhead: integer('months_ahead'),
  status: text('status').default('new').notNull(), // new | reviewing | applied | contacted | won | lost | ignore
  nextAction: text('next_action'),
  discoveredAt: timestamp('discovered_at'),
  n8nRunId: text('n8n_run_id'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  sourceUrlUnique: unique('fest_opportunities_source_url_unique').on(table.sourceUrl),
  urlHashUnique: unique('fest_opportunities_url_hash_unique').on(table.urlHash),
  statusIdx: index('fest_opp_status_idx').on(table.status),
  regionIdx: index('fest_opp_region_idx').on(table.region),
  scoreIdx: index('fest_opp_score_idx').on(table.score),
  sourceUrlNormIdx: index('fest_opp_source_norm_idx').on(table.sourceUrlNormalized),
}));

export const festRuns = pgTable('fest_runs', {
  id: uuid('id').defaultRandom().primaryKey(),
  runId: text('run_id').notNull(),
  startedAt: timestamp('started_at'),
  foundCount: integer('found_count').default(0).notNull(),
  syncedCount: integer('synced_count').default(0).notNull(),
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  runIdUnique: unique('fest_runs_run_id_unique').on(table.runId),
  createdIdx: index('fest_runs_created_idx').on(table.createdAt),
}));

export const festChances = pgTable('fest_chances', {
  id: uuid('id').defaultRandom().primaryKey(),
  urlHash: text('url_hash').notNull(),
  sourceUrl: text('source_url').notNull(),
  sourceUrlNormalized: text('source_url_normalized').notNull(),
  title: text('title'),
  organizer: text('organizer'),
  location: text('location'),
  region: text('region'),
  eventDate: text('event_date'),
  monthsAhead: integer('months_ahead'),
  jubileeYears: integer('jubilee_years'),
  festwirtStatus: text('festwirt_status').default('unknown').notNull(),
  eventType: text('event_type').default('other').notNull(),
  contactName: text('contact_name'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  emergency: boolean('emergency').default(false).notNull(),
  score: integer('score').default(0).notNull(),
  scoreReason: text('score_reason'),
  nimModel: text('nim_model'),
  runId: text('run_id'),
  status: text('status').default('new').notNull(),
  notes: text('notes'),
  // Lead-Typ + Erweiterungen (Task 1)
  leadType: text('lead_type').default('open').notNull(), // open | watch | signal
  eventKey: text('event_key'),
  eventYear: integer('event_year'),
  dateAssumed: boolean('date_assumed').default(false).notNull(),
  foundingYear: integer('founding_year'),
  incumbentFestwirt: text('incumbent_festwirt'),
  brauereiPartner: text('brauerei_partner'),
  contactRole: text('contact_role'),
  planningSignal: text('planning_signal').default('none').notNull(), // none | festausschuss | termin | presse
  recurring: boolean('recurring').default(false).notNull(),
  recheckAt: timestamp('recheck_at'),
  sourceUrls: jsonb('source_urls').$type<string[]>().default([]),
  // Wirt-CRM (Task 3)
  wirtStatus: text('wirt_status').default('neu').notNull(), // neu | kontaktiert | im_gespraech | angebot | gewonnen | verloren | vertagt
  wirtNotiz: text('wirt_notiz'),
  wiedervorlage: timestamp('wiedervorlage'),
  discoveredAt: timestamp('discovered_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  urlHashUnique: unique('fest_chances_url_hash_unique').on(table.urlHash),
  eventKeyIdx: index('fest_chances_event_key_idx').on(table.eventKey),
  leadTypeIdx: index('fest_chances_lead_type_idx').on(table.leadType),
  statusScoreIdx: index('fest_chances_status_score_idx').on(table.status, table.score),
  regionIdx: index('fest_chances_region_idx').on(table.region),
  runIdIdx: index('fest_chances_run_id_idx').on(table.runId),
  recheckIdx: index('fest_chances_recheck_idx').on(table.recheckAt),
}));

// Backwards-compatible alias (singular) for callers/tests that expect `festChance`.
export const festChance = festChances;

export const vereinsRadar = pgTable('vereins_radar', {
  id: uuid('id').defaultRandom().primaryKey(),
  leadKey: text('lead_key').notNull(),
  vereinName: text('verein_name'),
  ort: text('ort'),
  region: text('region'),
  vereinsTyp: text('vereins_typ'),
  foundingYear: integer('founding_year'),
  mitglieder: integer('mitglieder'),
  eventYear: integer('event_year'),
  jubileeYears: integer('jubilee_years'),
  monthsAhead: integer('months_ahead'),
  dateAssumed: boolean('date_assumed').default(false).notNull(),
  phase: text('phase'),
  status: text('status').default('beobachten').notNull(), // connecten | jetzt_anbieten | beobachten
  score: integer('score').default(0).notNull(),
  scoreReason: text('score_reason'),
  planningSignals: jsonb('planning_signals').$type<string[]>().default([]),
  incumbentFestwirt: text('incumbent_festwirt'),
  brauereiPartner: text('brauerei_partner'),
  contactName: text('contact_name'),
  contactRole: text('contact_role'),
  contactEmail: text('contact_email'),
  contactPhone: text('contact_phone'),
  nextAction: text('next_action'),
  sourceUrl: text('source_url'),
  domain: text('domain'),
  contentHash: text('content_hash'),
  queryType: text('query_type'),
  runId: text('run_id'),
  discoveredAt: timestamp('discovered_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  // Wirt-CRM
  wirtStatus: text('wirt_status').default('neu').notNull(),
  wirtNotiz: text('wirt_notiz'),
  wiedervorlage: timestamp('wiedervorlage'),
}, (table) => ({
  leadKeyUnique: unique('vereins_radar_lead_key_unique').on(table.leadKey),
  statusIdx: index('vereins_radar_status_idx').on(table.status),
  regionIdx: index('vereins_radar_region_idx').on(table.region),
  scoreIdx: index('vereins_radar_score_idx').on(table.score),
  runIdIdx: index('vereins_radar_run_id_idx').on(table.runId),
}));

export const emailLog = pgTable('email_log', {
  id: uuid('id').defaultRandom().primaryKey(),
  toEmail: text('to_email').notNull(),
  subject: text('subject').notNull(),
  category: text('category').default('general').notNull(),
  status: text('status').default('sent').notNull(), // sent | failed
  error: text('error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  createdIdx: index('email_log_created_idx').on(table.createdAt),
  statusIdx: index('email_log_status_idx').on(table.status),
}));

export const shiftOffers = pgTable('shift_offers', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  roleId: uuid('role_id').references(() => staffRoles.id, { onDelete: 'restrict' }).notNull(),
  date: timestamp('date').notNull(),
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  requiredCount: integer('required_count').default(1).notNull(),
  note: text('note'),
  createdBy: text('created_by').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  eventIdx: index('shift_offers_event_idx').on(table.eventId),
  countCheck: check('shift_offers_count_check', sql`${table.requiredCount} > 0`),
}));

export const staffPasswordResets = pgTable('staff_password_resets', {
  id: uuid('id').defaultRandom().primaryKey(),
  staffId: uuid('staff_id').references(() => staff.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  usedAt: timestamp('used_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tokenUnique: unique('staff_password_reset_token_unique').on(table.tokenHash),
  staffIdx: index('staff_password_reset_staff_idx').on(table.staffId),
}));
export const eventSettings = pgTable('event_settings', {
  id: uuid('id').primaryKey().defaultRandom(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).unique().notNull(),

  // Tisch-Belegung
  requireFullTable: boolean('require_full_table').default(true).notNull(),

  // Deprecated: der Paketpreis ist maßgeblich. In einer späteren Migration entfernen.
  minConsumptionCents: integer('min_consumption_cents').default(5000).notNull(),

  // Zeitslots (JSON Array)
  timeSlots: jsonb('time_slots').$type<string[]>().default(['17:00', '18:00', '19:00']).notNull(),

  // Preislogik: nur für Online-Reservierungen relevant
  pricingMode: text('pricing_mode').default('per_person').notNull(), // 'per_person' | 'per_table'

  // Pakete (JSON Array)
  packages: jsonb('packages').$type<{
    id: string;
    name: string;
    price: number; // in Euro
    description: string;
    popular?: boolean;
    unit?: 'per_person' | 'per_table';
    priceIncludesVat?: boolean;
    vatRate?: 0 | 7 | 19;
    vatNote?: string;
    type?: 'food_package' | 'voucher_bundle' | 'other';
    voucherCount?: number;
    voucherValueCents?: number;
    voucherTerms?: string;
    active?: boolean;
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

  // Reservierungszettel
  slipNote: text('slip_note').default('Dieser Tisch muss ab 15 Minuten vor der Reservierung freigehalten werden.').notNull(),
  slipFreeAfterMinutes: integer('slip_free_after_minutes').default(15).notNull(),

  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    pricingModeCheck: check('event_settings_pricing_mode_check', sql`${table.pricingMode} in ('per_person', 'per_table')`),
    slipFreeAfterMinutesCheck: check('event_settings_slip_free_after_minutes_check', sql`${table.slipFreeAfterMinutes} >= 0 and ${table.slipFreeAfterMinutes} <= 720`),
  };
});

// ---------------------------------------------------------------------------
// Passkey-first admin auth (admin_users extended above).
// ---------------------------------------------------------------------------

export const adminCredentials = pgTable('admin_credentials', {
  id: uuid('id').defaultRandom().primaryKey(),
  adminId: uuid('admin_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  credentialId: text('credential_id').notNull(),
  publicKey: bytea('public_key').notNull(),
  counter: bigint('counter', { mode: 'number' }).default(0).notNull(),
  transports: text('transports').array(),
  deviceType: text('device_type'),
  backedUp: boolean('backed_up'),
  aaguid: text('aaguid'),
  friendlyName: text('friendly_name'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastUsedAt: timestamp('last_used_at'),
  revokedAt: timestamp('revoked_at'),
  needsReview: boolean('needs_review').default(false).notNull(),
}, (table) => ({
  credentialIdUnique: unique('admin_credentials_credential_id_unique').on(table.credentialId),
  adminIdx: index('admin_credentials_admin_idx').on(table.adminId),
}));

export const adminPasskeySessions = pgTable('admin_passkey_sessions', {
  tokenHash: text('token_hash').primaryKey(),
  adminId: uuid('admin_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  lastSeenAt: timestamp('last_seen_at').defaultNow().notNull(),
  idleExpiresAt: timestamp('idle_expires_at').notNull(),
  absoluteExpiresAt: timestamp('absolute_expires_at').notNull(),
  stepUpAt: timestamp('step_up_at'),
  userAgent: text('user_agent'),
  ipHash: text('ip_hash'),
  deviceLabel: text('device_label'),
  revokedAt: timestamp('revoked_at'),
  revokeReason: text('revoke_reason'),
}, (table) => ({
  adminIdx: index('admin_passkey_sessions_admin_idx').on(table.adminId),
}));

export const adminEnrollmentTokens = pgTable('admin_enrollment_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  adminId: uuid('admin_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  tokenHash: text('token_hash').notNull(),
  pinHash: text('pin_hash'),
  pinAttempts: integer('pin_attempts').default(0).notNull(),
  purpose: text('purpose').default('initial').notNull(),
  pendingTotpEnc: text('pending_totp_enc'),
  pendingTotpAt: timestamp('pending_totp_at'),
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
  createdBy: uuid('created_by'),
  createdVia: text('created_via').default('ui').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  tokenHashUnique: unique('admin_enrollment_tokens_token_hash_unique').on(table.tokenHash),
  adminIdx: index('admin_enrollment_tokens_admin_idx').on(table.adminId),
}));

// Zweiter Login-Schritt: single-use Token mit 5 Minuten TTL zwischen Passwort und TOTP.
export const adminMfaPending = pgTable('admin_mfa_pending', {
  tokenHash: text('token_hash').primaryKey(),
  adminId: uuid('admin_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
}, (table) => ({
  adminIdx: index('admin_mfa_pending_admin_idx').on(table.adminId),
}));

export const adminRecoveryCodes = pgTable('admin_recovery_codes', {
  id: uuid('id').defaultRandom().primaryKey(),
  adminId: uuid('admin_id').references(() => adminUsers.id, { onDelete: 'cascade' }).notNull(),
  batchId: uuid('batch_id').notNull(),
  codeHash: text('code_hash').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  consumedAt: timestamp('consumed_at'),
}, (table) => ({
  adminIdx: index('admin_recovery_codes_admin_idx').on(table.adminId),
}));

export const adminChallenges = pgTable('admin_challenges', {
  id: uuid('id').defaultRandom().primaryKey(),
  adminId: uuid('admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  challenge: text('challenge').notNull(),
  type: text('type').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  consumedAt: timestamp('consumed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  browserCookie: text('browser_cookie'),
}, (table) => ({
  adminIdx: index('admin_challenges_admin_idx').on(table.adminId),
}));

export const adminAuditLog = pgTable('admin_audit_log', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  occurredAt: timestamp('occurred_at').defaultNow().notNull(),
  actorAdminId: uuid('actor_admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  subjectAdminId: uuid('subject_admin_id').references(() => adminUsers.id, { onDelete: 'set null' }),
  eventType: text('event_type').notNull(),
  ipHash: text('ip_hash'),
  userAgent: text('user_agent'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  prevHash: text('prev_hash'),
  entryHash: text('entry_hash').notNull(),
}, (table) => ({
  occurredIdx: index('admin_audit_log_occurred_idx').on(table.occurredAt),
  actorIdx: index('admin_audit_log_actor_idx').on(table.actorAdminId),
  subjectIdx: index('admin_audit_log_subject_idx').on(table.subjectAdminId),
  eventIdx: index('admin_audit_log_event_idx').on(table.eventType),
}));
