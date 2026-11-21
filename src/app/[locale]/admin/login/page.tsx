import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin-Login | MAURER EVENTS",
  robots: { index: false, follow: false },
};

export default function AdminLoginPage() {
  return <LoginClient />;
}
