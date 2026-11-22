import SetupClient from "./SetupClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin-Einrichtung | MAURER EVENTS",
  robots: { index: false, follow: false },
};

export default function AdminSetupPage() {
  return <SetupClient />;
}
