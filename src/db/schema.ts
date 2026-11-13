import { PgSchema, text, timestamp, boolean, uuid, integer, json, jsonb, index, check, unique, uniqueIndex, real } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// Qualify every table and enum, even when a pooled session has an empty search_path.
// PgSchema's constructor supports explicit public qualification; pgSchema() rejects it.
const publicSchema = new PgSchema('public');
const pgTable = publicSchema.table;
export const reservationStatusEnum = publicSchema.enum('reservation_status', ['pending', 'paid', 'confirmed', 'checked_in', 'cancelled', 'expired', 'refunded', 'disputed', 'payment_review', 'payment_pending', 'requested', 'declined']);

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
  zip: text('zip'),
  city: text('city'),
  roleId: uuid('role_id').references(() => staffRoles.id, { onDelete: 'set null' }),
  status: text('status').default('invited').notNull(), // invited | onboarding | ready | active | inactive
  employmentType: text('employment_type').default('minijob').notNull(), // minijob | short_term | student | employed
  hourlyRateCents: integer('hourly_rate_cents').default(0).notNull(),
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
  kindCheck: check('staff_documents_kind_check', sql`${table.kind} in ('id_card', 'health_certificate', 'tax_card', 'minijob_form', 'other')`),
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
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
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
  source: text('source').default('auto').notNull(), // auto | manual
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  eventIdx: index('staff_assignment_event_idx').on(table.eventId),
  staffIdx: index('staff_assignment_staff_idx').on(table.staffId),
  uniqueShift: unique('staff_assignment_unique_shift').on(table.eventId, table.staffId, table.date, table.startTime),
  statusCheck: check('staff_assignment_status_check', sql`${table.status} in ('proposed', 'accepted', 'declined', 'confirmed')`),
  sourceCheck: check('staff_assignment_source_check', sql`${table.source} in ('auto', 'manual')`),
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

export const eventDocuments = pgTable('event_documents', {
  id: uuid('id').defaultRandom().primaryKey(),
  eventId: uuid('event_id').references(() => events.id, { onDelete: 'cascade' }).notNull(),
  kind: text('kind').notNull(), // 'menu' | 'program'
  title: text('title').notNull(),
  titleEn: text('title_en'),
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
