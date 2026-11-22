import 'dotenv/config';
import { config } from 'dotenv';
config({ path: '.env.local' });
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import { eq } from 'drizzle-orm';
import { contractTemplates, contracts, staff as staffTable, staffRoles } from '../src/db/schema';
import { renderContract } from '../src/lib/contracts';
import { DEFAULT_CONTRACT_HTML } from '../src/lib/contract-paper';

const client = postgres(process.env.DATABASE_URL!, { max: 1 });
const db = drizzle(client);

async function main() {
  const templates = await db.select().from(contractTemplates);
  for (const tpl of templates) {
    if (tpl.bodyHtml === DEFAULT_CONTRACT_HTML) {
      console.log(`Template unveraendert: ${tpl.name} v${tpl.version} (${tpl.status})`);
      continue;
    }
    await db.update(contractTemplates).set({ bodyHtml: DEFAULT_CONTRACT_HTML }).where(eq(contractTemplates.id, tpl.id));
    tpl.bodyHtml = DEFAULT_CONTRACT_HTML;
    console.log(`Template auf neuen Standardtext gesetzt: ${tpl.name} v${tpl.version} (${tpl.status}, Rolle ${tpl.roleId})`);
  }

  const rows = await db.select().from(contracts);
  for (const contract of rows) {
    const [member] = await db.select().from(staffTable).where(eq(staffTable.id, contract.staffId));
    if (!member) {
      console.log(`Vertrag ${contract.id}: kein Mitarbeiter gefunden – uebersprungen`);
      continue;
    }
    const roleId = contract.roleId || member.roleId;
    const [role] = roleId ? await db.select().from(staffRoles).where(eq(staffRoles.id, roleId)) : [];
    const template = contract.templateId ? templates.find(t => t.id === contract.templateId) : undefined;
    const body = renderContract(template?.bodyHtml ?? DEFAULT_CONTRACT_HTML, member, role || null);
    if (body === contract.bodyHtml) {
      console.log(`Vertrag unveraendert: ${contract.id} (${contract.status})`);
      continue;
    }
    await db.update(contracts).set({ bodyHtml: body, updatedAt: new Date() }).where(eq(contracts.id, contract.id));
    console.log(`Vertrag neu gerendert: ${contract.id} (${contract.status}) – ${member.firstName} ${member.lastName}`);
  }
  await client.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
