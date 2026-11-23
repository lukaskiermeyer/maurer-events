import { getMyProfile } from "@/app/actions/staff";
import { getMyMinijobPreview } from "@/app/actions/document-templates";
import { decryptField } from "@/lib/secure-fields";
import { requireStaffMember } from "@/lib/staff-auth";
import OnboardingForm from "./OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const [{ member, role, documents, contracts }, privateMember] = await Promise.all([getMyProfile(), requireStaffMember(true)]);
  const minijob = await getMyMinijobPreview().catch(() => null);
  const initial = {
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone || "",
    birthDate: member.birthDate ? new Date(member.birthDate).toISOString().slice(0, 10) : "",
    street: member.street || "",
    houseNumber: member.houseNumber || "",
    zip: member.zip || "",
    city: member.city || "",
    employmentType: member.employmentType,
    taxId: decryptField(privateMember.taxIdEnc) || "",
    taxClass: member.taxClass || "",
    childAllowances: member.childAllowances,
    socialSecurity: decryptField(privateMember.socialSecurityEnc) || "",
    healthInsurance: member.healthInsurance || "",
    iban: decryptField(privateMember.ibanEnc) || "",
    bic: member.bic || "",
    entryDate: member.entryDate ? new Date(member.entryDate).toISOString().slice(0, 10) : "",
  };
  return <OnboardingForm initial={initial} roleName={role?.name || "Mitarbeiter"} documents={documents} requiredDocuments={role?.requiredDocuments ?? []} hasContract={contracts.length > 0} minijob={minijob} />;
}