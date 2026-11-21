// Admin-Seed-Idempotenz / Status-Report (P0.2)
// Ausführen: npx tsx scripts/admin-seed-report.ts
import postgres from 'postgres';
const url = process.env.DATABASE_URL || 'postgres://reservation_test@127.0.0.1:55439/maurer_events';
const sql = postgres(url, { max: 1 });
(async () => {
  try {
    const rows = await sql`SELECT id, email, status, webauthn_user_id, enrolled_at, created_at FROM admin_users ORDER BY created_at`;
    console.log('admin_users rows:', rows.length);
    for (const r of rows) console.log(JSON.stringify(r));
  } catch (e) {
    console.error('DB error:', e);
  } finally {
    await sql.end();
  }
})();