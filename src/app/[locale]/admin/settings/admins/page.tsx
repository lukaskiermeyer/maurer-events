import { requireAdmin } from "@/lib/auth";
import AdminsSettings from "./AdminsSettings";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin-Konten | MAURER EVENTS",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsAdminsPage() {
  await requireAdmin(true);
  return (
    <div className="py-10 px-4 sm:px-8 max-w-[1100px] mx-auto space-y-6">
      <h1 className="font-display font-black text-3xl sm:text-4xl text-base-dark">Admin-Konten &amp; Zugang</h1>
      <AdminsSettings />
    </div>
  );
}
