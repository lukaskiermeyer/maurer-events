import type { staff } from "@/db/schema";

type StaffRow = typeof staff.$inferSelect;
export type SafeStaffMember = Omit<StaffRow, "passwordHash" | "taxIdEnc" | "socialSecurityEnc" | "ibanEnc"> & {
  hasTaxId: boolean;
  hasSocialSecurity: boolean;
  hasIban: boolean;
};

/** Never serialize credential hashes or encrypted payroll identifiers to clients. */
export function safeStaffMember(member: StaffRow): SafeStaffMember {
  const safe: Partial<StaffRow> = { ...member };
  delete safe.passwordHash;
  delete safe.taxIdEnc;
  delete safe.socialSecurityEnc;
  delete safe.ibanEnc;
  return {
    ...safe,
    hasTaxId: member.taxIdEnc !== null,
    hasSocialSecurity: member.socialSecurityEnc !== null,
    hasIban: member.ibanEnc !== null,
  } as SafeStaffMember;
}
