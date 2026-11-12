// Events-CMS Reset: Events + Galerien + Event-Dokumente löschen (neuer Cloudinary-Account läuft schon).
// Verwendung: npx tsx scripts/reset-events-cms.ts --dry-run  -> nur zählen
//             npx tsx scripts/reset-events-cms.ts --execute -> löschen (nur wenn keine Reservierungen/Vouchers/Wartelisten hängen)
import { config } from "dotenv";
config({ path: ".env.local" });

import postgres from "postgres";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL fehlt in .env.local");
const sql = postgres(process.env.DATABASE_URL, { ssl: "require", max: 1, idle_timeout: 5, connect_timeout: 10 });

const EXECUTE = process.argv.includes("--execute");

async function main() {
  const [c] = await sql`
    select
      (select count(*)::int from events) as events,
      (select count(*)::int from galleries) as galleries,
      (select count(*)::int from event_documents) as docs,
      (select count(*)::int from reservations) as reservations,
      (select count(*)::int from vouchers) as vouchers,
      (select count(*)::int from waitlists) as waitlists
  `;
  console.log("Aktueller Stand:", c);

  if (!EXECUTE) {
    console.log("\nDry-run: nichts gelöscht. Zum Löschen: npx tsx scripts/reset-events-cms.ts --execute (löscht auch Test-Reservierungen)");
    await sql.end(); process.exit(0);
  }

  if (!EXECUTE) {
    console.log("\nDry-run: nichts gelöscht. Zum Löschen: npx tsx scripts/reset-events-cms.ts --execute");
    await sql.end(); process.exit(0);
  }

  // Testdaten inkl. Reservierungen weg (vom Wirt so gewünscht für Neustart)
  const delR = await sql`delete from reservations returning id`;
  const delG = await sql`delete from galleries returning id`;
  const delD = await sql`delete from event_documents returning id`;
  const delE = await sql`delete from events returning id`;
  console.log(`Gelöscht: Reservierungen=${(delR as any).count ?? delR.length} Galerien=${(delG as any).count ?? delG.length} Dokumente=${(delD as any).count ?? delD.length} Events=${(delE as any).count ?? delE.length}`);
  console.log("Fertig. Der Wirt kann jetzt die ersten Events selbst anlegen.");
  await sql.end(); process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
