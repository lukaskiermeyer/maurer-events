import { getMyProfile } from "@/app/actions/staff";
import { decryptField } from "@/lib/secure-fields";
import ProfileForm from "./ProfileForm";

export const dynamic = "force-dynamic";

export default async function ProfilePage() {
  const { member } = await getMyProfile();
  const initial = {
    firstName: member.firstName,
    lastName: member.lastName,
    phone: member.phone || "",
    street: member.street || "",
    zip: member.zip || "",
    city: member.city || "",
    iban: decryptField(member.ibanEnc) || "",
    bic: member.bic || "",
    taxClass: member.taxClass || "",
    healthInsurance: member.healthInsurance || "",
  };
  return <ProfileForm initial={initial} />;
}
