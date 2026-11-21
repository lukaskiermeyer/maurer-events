import { getMyProfile } from "@/app/actions/staff";
import { getMyMinijobPreview } from "@/app/actions/document-templates";
import { decryptField } from "@/lib/secure-fields";
import OnboardingForm from "./OnboardingForm";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const { member, role, documents, contracts } = await getMyProfile();
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
    taxId: decryptField(member.taxIdEnc) || "",
    taxClass: member.taxClass || "",
    childAllowances: member.childAllowances,
    socialSecurity: decryptField(member.socialSecurityEnc) || "",
    healthInsurance: member.healthInsurance || "",
    iban: decryptField(member.ibanEnc) || "",
    bic: member.bic || "",
    entryDate: member.entryDate ? new Date(member.entryDate).toISOString().slice(0, 10) : "",
  };
  return <OnboardingForm initial={initial} roleName={role?.name || "Mitarbeiter"} documents={documents} requiredDocuments={role?.requiredDocuments ?? []} hasContract={contracts.length > 0} minijob={minijob} />;
}