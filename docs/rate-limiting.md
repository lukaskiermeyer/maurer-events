# Cloudflare Rate Limiting Empfehlungen

Um die Anwendung vor Spam, Mailbombing und Ressourcen-Überlastung zu schützen, sollten in Cloudflare (WAF -> Rate Limiting Rules) folgende Regeln konfiguriert werden:

| Endpunkt / Funktion | Limit | Kriterium | Aktion |
| :--- | :--- | :--- | :--- |
| `/api/checkout` | 10 Requests pro Minute | pro IP | Blockieren |
| `/api/webhooks/stripe` | KEIN Rate Limit | - | Zulassen (Stripe muss retryen können) |
| `/api/cron/cleanup` | 5 Requests pro Minute | - | Blockieren (wird nur vom Vercel Cron aufgerufen) |
| OTP-Anforderung (Login) | 3 Requests pro Minute | pro IP + E-Mail | Blockieren |
| Kontaktformular | 5 Requests pro Minute | pro IP | Blockieren |
| Upload (Bilder etc.) | 10 Requests pro Minute | pro Session / IP | Blockieren |

Diese Regeln verhindern Bots, die versuchen mehrfach hintereinander OTP-Codes anzufordern (und so den Resend-Quota aufzubrauchen), oder durch automatisierte Requests Doppel-Reservierungen im Checkout auszulösen.
