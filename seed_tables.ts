import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { tables } from './src/db/schema';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql);

async function seedTables() {
  console.log("Seeding tables...");
  const tableData = [];

  // Festzelt Layout: Linke Seite, Mitte, Rechte Seite
  // Wir erstellen 20 Tische
  
  // Linke Reihe
  for (let i = 0; i < 6; i++) {
    tableData.push({
      name: `L${i + 1}`,
      capacity: 8,
      positionX: 10,
      positionY: 10 + (i * 15),
    });
  }

  // Rechte Reihe
  for (let i = 0; i < 6; i++) {
    tableData.push({
      name: `R${i + 1}`,
      capacity: 8,
      positionX: 80,
      positionY: 10 + (i * 15),
    });
  }

  // Mittelschiff / VIP
  for (let i = 0; i < 8; i++) {
    tableData.push({
      name: `M${i + 1}`,
      capacity: 10,
      positionX: 45,
      positionY: 20 + (i * 10),
    });
  }

  try {
    await db.insert(tables).values(tableData);
    console.log("Seeding complete!");
  } catch (err) {
    console.error("Error seeding tables:", err);
  }
}

seedTables();
