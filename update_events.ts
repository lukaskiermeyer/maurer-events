import { config } from "dotenv";
config({ path: ".env.local" });
import { db } from "./src/db";
import { events } from "./src/db/schema";

async function main() {
  console.log("Updating all existing events to type = 'gallery'...");
  await db.update(events).set({ type: 'gallery' });
  console.log("Done.");
}

main().catch(console.error);
