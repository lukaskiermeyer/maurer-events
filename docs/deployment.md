# Deployment Checkliste (Cloudflare Workers / Pages)

Bevor du die Anwendung final in Produktion (Production) nimmst, arbeite diese Checkliste ab, um einen sicheren und stabilen Betrieb zu gewährleisten.

## 1. Environment-Variablen (Secrets) setzen
Setze alle in `.env.example` aufgelisteten Variablen in deiner Cloudflare Worker / Pages Umgebung.
Führe für jede sensible Variable (z.B. Keys, Secrets) folgenden Befehl aus:
```bash
npx wrangler secret put <VARIABLE_NAME>
```
*Wichtig:* Die Variable `NEXT_PUBLIC_IS_STAGING` sollte in der Production-Umgebung auf `false` gesetzt oder ganz weggelassen werden. Stelle außerdem sicher, dass `NEXT_PUBLIC_BASE_URL` auf deine finale Production-Domain zeigt.

## 2. Datenbank-Migrationen ausführen
Nach dem Bereitstellen des Codes musst du die Drizzle-Migrationen anwenden, damit die Datenbank-Tabellen auf dem neuesten Stand sind:
```bash
npx drizzle-kit migrate
# ODER bei bestehenden Datenbanken (siehe vorherige Hinweise):
npx drizzle-kit push
```

## 3. Stripe & Turnstile konfigurieren
- **Stripe Webhook:** Füge im Stripe Dashboard einen neuen Webhook-Endpoint hinzu (`https://deine-domain.de/api/webhooks/stripe`). Achte darauf, dass du das dort generierte Secret (`whsec_...`) als `STRIPE_WEBHOOK_SECRET` in Cloudflare hinterlegst.
- **Turnstile:** Generiere Site Key und Secret Key in Cloudflare Turnstile für deine Production-Domain und trage diese ebenfalls ein.

## 4. Cloudflare Rate Limiting (WAF)
Erstelle in den Cloudflare WAF-Regeln die empfohlenen Rate Limiting Rules, insbesondere für `/api/checkout` (10 req/min) und OTP/Contact, wie in `docs/rate-limiting.md` beschrieben. Den Webhook-Endpoint `/api/webhooks/stripe` musst du dabei vom Rate Limiting ausschließen (Allow/Skip-Regel).

## 5. Cron Trigger für Cleanup-Job einrichten
In der Datei `wrangler.jsonc` wurde der Cron-Trigger (`*/5 * * * *`) bereits konfiguriert. 
**Achtung:** Cloudflare Workers rufen bei einem Cron-Trigger nativ *keinen* HTTP-Endpoint auf, sondern lösen den `scheduled` Event-Handler im Worker-Skript aus. Wenn du OpenNext verwendest, musst du prüfen, ob das Framework diesen Handler automatisch an deinen `/api/cron/cleanup` Endpoint weiterleitet. 
Sollte dies nicht der Fall sein, gibt es zwei Alternativen:
1. Erstelle eine einfache GitHub Action oder nutze einen Dienst wie cron-job.org, um `GET https://deine-domain.de/api/cron/cleanup` alle 5 Minuten aufzurufen.
2. Sende dabei den Header `Authorization: Bearer <DEIN_CRON_SECRET>` mit.

## 6. SSL / HTTPS
Stelle sicher, dass in Cloudflare (unter SSL/TLS -> Edge Certificates) **"Always Use HTTPS"** aktiviert ist.

## 7. Tests nach dem Deploy
Führe direkt nach dem Livegang folgende Prüfungen durch:
- [ ] Aufruf von `https://deine-domain.de/api/health` prüfen.
- [ ] Test-Checkout mit einem Test-Event durchführen (Stripe Test-Modus).
- [ ] Admin-Login (/admin) per E-Mail OTP prüfen.
- [ ] Manuelles Triggern des Cron-Jobs testen (z.B. via Postman mit dem Auth-Header), um zu verifizieren, dass Pending-Reservierungen verfallen.

