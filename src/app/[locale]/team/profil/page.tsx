import { getMyProfile } from "@/app/actions/staff";
import { decryptField } from "@/lib/secure-fields";
import { requireStaffMember } from "@/lib/staff-auth";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const [{ member }, privateMember] = await Promise.all([getMyProfile(), requireStaffMember(true)]);
  const initial = {
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone || "",
    street: member.street || "",
    houseNumber: member.houseNumber || "",
    zip: member.zip || "",
    city: member.city || "",
    iban: decryptField(privateMember.ibanEnc) || "",
    bic: member.bic || "",
    taxClass: member.taxClass || "",
    healthInsurance: member.healthInsurance || "",
  };
  return <ProfileForm initial={initial} />;
}
