import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { contracts, staff as staffTable } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { staffSession as memberSession } from "@/lib/staff-auth";
import { UUID_PATTERN } from "@/lib/reservation-policy";
import { generateFormPdf } from "@/lib/document-forms";

export const runtime = "nodejs";

async function authorizedStaffId() {
  const store = await cookies();
  const isAdmin = await requireAdmin().then(() => true).catch(() => false);
  if (isAdmin) return { isAdmin: true, staffId: null as string | null };
  const staffToken = store.get("staff_token")?.value;
  const member = await memberSession(staffToken).catch(() => null);
  if (member) return { isAdmin: false, staffId: member.member.id as string };
  return null;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const contractId = searchParams.get("contractId");
  if (!contractId || !UUID_PATTERN.test(contractId)) return NextResponse.json({ error: "Ungültige ID." }, { status: 400 });
  const auth = await authorizedStaffId();
  if (!auth) return NextResponse.json({ error: "Nicht eingeloggt." }, { status: 401 });

  const [contract] = await db.select().from(contracts).where(eq(contracts.id, contractId));
  if (!contract) return NextResponse.json({ error: "Nicht gefunden." }, { status: 404 });
  if (!auth.isAdmin && contract.staffId !== auth.staffId) return NextResponse.json({ error: "Kein Zugriff." }, { status: 403 });

  const [member] = await db.select().from(staffTable).where(eq(staffTable.id, contract.staffId));
  const memberName = member ? `${member.firstName} ${member.lastName}` : "Mitarbeiter";

  const pdf = await generateFormPdf(contract.bodyHtml, "Arbeitsvertrag", memberName);
  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Vertrag-${memberName.replace(/\s+/g, "_")}.pdf"`,
      "Cache-Control": "private, no-store",
      "X-Frame-Options": "SAMEORIGIN",
      "Content-Security-Policy": "frame-ancestors 'self'",
    },
  });
}