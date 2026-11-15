import { requestPasswordReset } from "@/app/actions/staffAuth";
import { Link } from "@/i18n/routing";

export const dynamic = "force-dynamic";

export default function PasswordForgotPage() {
  return (
    <div className="max-w-md mx-auto mt-10 bg-white border border-border-light rounded-3xl p-6 sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent-wood mb-2">Maurer Events</p>
      <h1 className="text-3xl font-display font-black text-base-dark mb-2">Passwort vergessen</h1>
      <p className="text-sm text-base-dark/60 mb-6">Gib deine E-Mail-Adresse ein – wir senden dir einen Link zum Zurücksetzen.</p>
      <form action={async (formData: FormData) => { "use server"; await requestPasswordReset(String(formData.get("email") || "")); }} className="space-y-4">
        <div><label className="block text-xs font-bold uppercase mb-1">E-Mail</label><input type="email" name="email" required className="w-full bg-base-light border border-border-light rounded-xl p-3" /></div>
        <button type="submit" className="w-full bg-accent-green text-white py-3 rounded-xl font-bold">Link senden</button>
      </form>
      <p className="text-xs text-base-dark/50 mt-5">Hinweis: Wenn die E-Mail nicht ankommt, prüfe den Spam-Ordner oder wende dich an den Festwirt.</p>
      <p className="text-xs mt-3"><Link href="/team/login" className="text-accent-green underline">Zurück zum Login</Link></p>
    </div>
  );
}
