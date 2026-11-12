"use server";

import { headers } from "next/headers";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { contracts } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { requireStaffMember, clientIp } from "@/lib/staff-auth";
import { sha256 } from "@/lib/secure-fields";
import { uuid } from "@/lib/reservation-policy";
import { audit } from "@/lib/audit";

export async function signContractText(contractId: string, fullName: string) {
  try {
    const member = await requireStaffMember();
    uuid(contractId);
    const [contract] = await db.select().from(contracts).where(and(eq(contracts.id, contractId), eq(contracts.staffId, member.id)));
    if (!contract) throw new Error("Vertrag nicht gefunden.");
    if (contract.status !== "pending") throw new Error("Dieser Vertrag ist nicht mehr offen.");
    if (contract.signatureMode !== "text") throw new Error("Dieser Vertrag muss handschriftlich unterschrieben werden.");
    const expected = `${member.firstName} ${member.lastName}`.trim().toLowerCase();
    if (typeof fullName !== "string" || fullName.trim().toLowerCase() !== expected) throw new Error("Bitte deinen vollständigen Namen exakt eingeben.");
    const requestHeaders = await headers();
    const signedAt = new Date();
    const [updated] = await db.update(contracts).set({
      status: "signed",
      signedAt,
      signedFileSha256: sha256(`${contract.bodyHtml}\n${fullName}\n${signedAt.toISOString()}`),
      consentVersion: "2026-11",
      signedIp: clientIp(new Request("http://localhost", { headers: requestHeaders })),
      signedUserAgent: (requestHeaders.get("user-agent") || "").slice(0, 500),
      updatedAt: signedAt,
    }).where(eq(contracts.id, contractId)).returning();
    await audit("staff", member.id, "contract.sign_text", "contract", contractId);
    revalidatePath("/[locale]/team", "layout");
    return { success: true, contract: updated };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Vertrag konnte nicht unterschrieben werden." };
  }
}

export async function attachSignedContract(contractId: string, fileUrl: string, fileSha256: string) {
  try {
    const member = await requireStaffMember();
    uuid(contractId);
    if (typeof fileUrl !== "string" || !fileUrl.startsWith("https://")) throw new Error("Ungültige Datei.");
    if (typeof fileSha256 !== "string" || !/^[a-f0-9]{64}$/i.test(fileSha256)) throw new Error("Ungültige Dateiprüfsumme.");
    const [contract] = await db.select().from(contracts).where(and(eq(contracts.id, contractId), eq(contracts.staffId, member.id)));
    if (!contract) throw new Error("Vertrag nicht gefunden.");
    if (contract.status !== "pending") throw new Error("Dieser Vertrag ist nicht mehr offen.");
    if (contract.signatureMode !== "handwritten") throw new Error("Dieser Vertrag wird digital unterschrieben.");
    const [updated] = await db.update(contracts).set({
      status: "signed",
      signedAt: new Date(),
      signedFileUrl: fileUrl,
      signedFileSha256: fileSha256,
      consentVersion: "2026-11",
      updatedAt: new Date(),
    }).where(eq(contracts.id, contractId)).returning();
    await audit("staff", member.id, "contract.upload_signed", "contract", contractId);
    revalidatePath("/[locale]/team", "layout");
    return { success: true, contract: updated };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unterschriebener Vertrag konnte nicht gespeichert werden." };
  }
}

export async function verifyContract(contractId: string) {
  const actor = await requireAdmin();
  uuid(contractId);
  const [updated] = await db.update(contracts).set({ status: "verified", updatedAt: new Date() }).where(and(eq(contracts.id, contractId), eq(contracts.status, "signed"))).returning();
  if (!updated) throw new Error("Vertrag nicht gefunden oder noch nicht unterschrieben.");
  await audit("admin", actor.email, "contract.verify", "contract", contractId);
  revalidatePath("/[locale]/admin/mitarbeiter", "page");
  return { success: true };
}