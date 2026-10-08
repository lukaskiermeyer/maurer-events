import { config } from 'dotenv';
config({ path: '.env.local' });

import postgres from 'postgres';

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL nicht in .env.local gefunden');
  process.exit(1);
}

const sql = postgres(process.env.DATABASE_URL, {
  ssl: 'require',
  max: 1,
  idle_timeout: 5,
  connect_timeout: 10,
});

async function main() {
  console.log('🚀 Starte DB-Migration...');

  try {
    // 1. Normiere alte Reservierungsdaten auf 00:00 UTC
    console.log('\n📅 Normiere Reservierungsdaten auf 00:00 UTC...');
    const dateResult = await sql`
      UPDATE reservations 
      SET reservation_date = DATE_TRUNC('day', reservation_date)
      WHERE reservation_date != DATE_TRUNC('day', reservation_date)
    `;
    console.log(`  ✅ ${dateResult.count} Datensätze normiert`);

    // 2. Fülle fehlende expiresAt für alte Pending-Holds
    console.log('\n⏰ Fülle fehlende expiresAt für alte Pending-Holds...');
    const expiresResult = await sql`
      UPDATE reservations 
      SET expires_at = created_at + INTERVAL '35 minutes'
      WHERE status = 'pending' 
        AND expires_at IS NULL
    `;
    console.log(`  ✅ ${expiresResult.count} expiresAt-Felder gesetzt`);

    // 3. Verifizierung
    console.log('\n🔍 Verifizierung:');
    const stats = await sql`
      SELECT 
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE status = 'pending' AND expires_at IS NULL)::int AS pending_without_expires,
        COUNT(*) FILTER (WHERE reservation_date != DATE_TRUNC('day', reservation_date))::int AS not_normalized
      FROM reservations
    `;
    console.log(`  Gesamt: ${stats[0].total} Reservierungen`);
    console.log(`  Pending ohne expiresAt: ${stats[0].pending_without_expires}`);
    console.log(`  Nicht normierte Daten: ${stats[0].not_normalized}`);

    if (stats[0].pending_without_expires === 0 && stats[0].not_normalized === 0) {
      console.log('\n✅ Migration erfolgreich! Datenbank ist sauber.');
    } else {
      console.warn('\n⚠️  Einige Datensätze konnten nicht migriert werden.');
    }

  } catch (err) {
    console.error('❌ Migration fehlgeschlagen:', err instanceof Error ? err.message : 'Unbekannter Fehler');
    process.exit(1);
  } finally {
    await sql.end();
  }
}

main();
