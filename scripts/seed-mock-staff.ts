import { config } from "dotenv";
config({ path: ".env.local" });

import { db } from "../src/db";
import { staff, staffRoles } from "../src/db/schema";

async function main() {
  // Ensure a few roles exist
  const existingRoles = await db.select().from(staffRoles);
  const roleByKey = new Map(existingRoles.map(r => [r.key, r]));
  const rolesToEnsure = [
    { key: "service", name: "Service", hourlyRateCents: 1500 },
    { key: "kueche", name: "Küche", hourlyRateCents: 1600 },
    { key: "bar", name: "Bar", hourlyRateCents: 1400 },
    { key: "security", name: "Security", hourlyRateCents: 1800 },
  ];
  for (const r of rolesToEnsure) {
    if (!roleByKey.has(r.key)) {
      const [created] = await db.insert(staffRoles).values({ key: r.key, name: r.name, hourlyRateCents: r.hourlyRateCents, requiredDocuments: [], active: true }).returning();
      roleByKey.set(r.key, created);
      console.log("Rolle erstellt:", r.key);
    }
  }

  const allRoles = await db.select().from(staffRoles);
  const pickRole = (key: string) => allRoles.find(r => r.key === key)!.id;

  const mocks = [
    { firstName: "Max", lastName: "Mustermann", email: "max.mustermann@example.com", roleId: pickRole("service"), status: "active", employmentType: "minijob" },
    { firstName: "Anna", lastName: "Beispiel", email: "anna.beispiel@example.com", roleId: pickRole("kueche"), status: "ready", employmentType: "student" },
    { firstName: "Tom", lastName: "Tester", email: "tom.tester@example.com", roleId: pickRole("bar"), status: "onboarding", employmentType: "short_term" },
    { firstName: "Lisa", lastName: "Lorem", email: "lisa.lorem@example.com", roleId: pickRole("security"), status: "invited", employmentType: "employed" },
    { firstName: "Paul", lastName: "Platzhalter", email: "paul.platzhalter@example.com", roleId: pickRole("service"), status: "active", employmentType: "minijob" },
    { firstName: "Sarah", lastName: "Sample", email: "sarah.sample@example.com", roleId: pickRole("kueche"), status: "active", employmentType: "student" },
  ];

  let inserted = 0;
  for (const m of mocks) {
    try {
      await db.insert(staff).values({ ...m, hourlyRateCents: 0 });
      inserted++;
      console.log("Mitarbeiter erstellt:", m.firstName, m.lastName, m.status);
    } catch (e: any) {
      console.log("Übersprungen (evtl. Duplikat):", m.email, e?.message?.slice(0, 80));
    }
  }
  console.log(`Fertig. ${inserted} von ${mocks.length} eingefügt.`);
  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
