# Log-Redaction-Regeln (Patch)

Geltungsbereich: App-Logs (Next.js stdout/stderr), Traefik-/Coolify-Logs, Docker-Logs,
Error-Tracking (Sentry o. ä.), CI-Artefakte, Audit-Logs.

## Regeln (verbindlich)

| # | Datenkategorie | Regel | Beispiel vorher | Beispiel nachher |
|---|----------------|-------|-----------------|------------------|
| 1 | E-Mail | Lokaler Teil maskieren, Domain behalten | `max.mustermann@example.com` | `m***@example.com` |
| 2 | Telefon | Nur letzte 4 Ziffern | `+49 170 1234567` | `XXX-XXX-4567` |
| 3 | Name | Nur Initialen | `Max Mustermann` | `M. M.` |
| 4 | Token/Secret/Signatur | Vollständig maskieren | `sk_live_abc…` | `[REDACTED]` |
| 5 | Signed URL | Vollständig maskieren (s--, token, sig, signature, access_token) | `…/upload/s--abc--/file.pdf?token=x` | `[signed-url-redacted]` |
| 6 | URL allgemein | Query-String + Fragment entfernen | `https://app/p?email=x` | `https://app/p` |
| 7 | Request-Body | Niemals loggen; nur Länge + Content-Type | `{email, phone}` | `bodyLen=1234 contentType=application/json` |
| 8 | Fehlerobjekt | Nur name + gekürzte message (≤500 Zeichen), kein Stack mit Daten | Stack mit PII | `{name, message}` |
| 9 | Objekt-Keys | Keys mit PII/Sekret-Wörtern maskieren | `{email, iban}` | `{email:[REDACTED], iban:[REDACTED]}` |
| 10 | Cloudinary-URLs in Logs | Nur public_id (ohne Domain/Signatur) oder vollständig maskieren | `https://res.cloudinary.com/…/file.pdf` | `[cloudinary-asset]` |

## Implementierung

- Zentrale Utility: `src/lib/redact.ts` (`redact`, `redactEmail`, `redactPhone`, `redactToken`,
  `redactUrl`, `redactName`, `redactError`, `safeLog`, `safeError`, `safeWarn`).
- Alle `console.*`-Aufrufe in `src/` durch `safe*` ersetzen oder Argumente durch `redact()` laufen.
  Kritische Stellen: `src/app/actions/staffAuth.ts` (Passwort-Reset-Link),
  `src/lib/cloudinary.ts` (URLs bei Fehlern), `src/app/api/cron/cleanup/route.ts` (URLs),
  `src/app/api/webhooks/stripe/route.ts` (nur IDs, keine Gastdaten).
- Error-Tracking (falls Sentry o. ä.): `beforeSend`-Hook nutzt `redact()`; Request-Bodies
  deaktivieren (`sendDefaultPii: false`), Cookies/Headers filtern.
- Traefik: Access-Log-Format ohne Query-String (`%U` statt `%r`), keine Request-Body-Logs.
- Docker: Logging-Driver mit max-size/max-file begrenzen (Rotation).

## Header-Config (Patch in next.config.mjs)

Geändert:
- `Strict-Transport-Security: max-age=63072000; includeSubDomains; preload` (neu)
- `Referrer-Policy: strict-origin` (vorher `strict-origin-when-cross-origin`) → verhindert Leak
  von signed-URL-Query-Parametern im Referer.
- Bereits vorhanden: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`,
  `Permissions-Policy`, CSP mit `object-src 'none'`, `frame-ancestors 'none'`.

## Traefik-Header (zu setzen, falls Coolify/Traefik genutzt)

```
# In Traefik-Middleware oder Coolify-Proxy-Config
headers:
  customResponseHeaders:
    Strict-Transport-Security: "max-age=63072000; includeSubDomains; preload"
    X-Frame-Options: "DENY"
    X-Content-Type-Options: "nosniff"
    Referrer-Policy: "strict-origin"
    Permissions-Policy: "camera=(self), microphone=(), geolocation=()"
    Content-Security-Policy: "default-src 'self'; ... (wie next.config)"
  # HSTS auch auf HTTP→HTTPS-Redirect
  forceSTSHeader: true
  stsIncludeSubdomains: true
  stsPreload: true
  # Keine Server-Version
  customRequestHeaders:
    X-Forwarded-Proto: "https"
```

## Docker-Logging (docker-compose.yml Ergänzung)

```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
    tag: "{{.Name}}/{{.ID}}"
```

## CI-Artefakte

- Playwright-Screenshots/Traces können PII enthalten (E-Mail, Namen). Artefakte nur
  in CI-Storage mit begrenzter Retention (≤30 Tage) und Zugriffsbeschränkung.
- `debug.log` im Repo-Root (enthält ggf. Daten) aus Git entfernen + in `.gitignore`.
- Test-Reports (`test-results/`) nicht committen.
