# SECURITY — Admin Passkey Auth

## Threat Model
- Passkeys (WebAuthn) als einziger Login-Faktor, userVerification required.
- Recovery über Offline-Codes + Peer-Recovery, nicht Mailbox.
- Break-Glass nur mit Server/DB-Zugriff.

## Restrisiken
- Synced Passkeys erben Cloud-Account-Sicherheit (iCloud/Google).
- Infostealer mit Session-Cookies.
- Mailbox bleibt Benachrichtigungskanal, nicht Login-Faktor.

## Offene TODOs
- DROP COLUMN legacy password columns erst nach Freigabe.
- CSP ohne unsafe-inline (Vite-Polyfill beachten) — aktuell Next.js inline scripts.
- Cloudflare Rate-Limiting Rules auf /api/admin/auth/*.
"