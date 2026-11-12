import { db } from "@/db";
import { auditLog } from "@/db/schema";

export async function audit(actorType: string, actorId: string, action: string, entityType: string, entityId: string | null, meta?: Record<string, unknown>) {
  await db.insert(auditLog).values({ actorType, actorId, action, entityType, entityId, meta });
}