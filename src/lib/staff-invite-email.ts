// Design für die Mitarbeiter-Einladungsmail (Maurer Events Branding).
// Inline-CSS, email-sicher (keine externen Stylesheets).

const GREEN = "#20603C";
const GOLD = "#CB7913";
const INK = "#1A1A1A";
const MUTED = "#5B5B57";
const CANVAS = "#F9F7F3";
const BORDER = "#E6E0D5";

export function staffInviteSubject(roleName: string) {
  return roleName ? `Deine Einladung zum Maurer-Events Team (${roleName})` : "Deine Einladung zum Maurer-Events Team-Portal";
}

export function staffInviteHtml({ firstName, inviteUrl, expiresAt, roleName, loginUrl }: { firstName: string; inviteUrl: string; expiresAt: string; roleName?: string; loginUrl?: string }) {
  return `<!doctype html>
<html lang="de">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Deine Einladung zum Maurer-Events Team</title>
</head>
<body style="margin:0;padding:0;background:${CANVAS};font-family:Helvetica,Arial,sans-serif;color:${INK};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${CANVAS};padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#FFFFFF;border:1px solid ${BORDER};border-radius:20px;overflow:hidden;">
        <!-- Header -->
        <tr><td style="background:${GREEN};padding:28px 32px 24px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="font-size:28px;color:#FFFFFF;"><b>MAURER</b> <span style="color:#F1D9AE;">EVENTS</span></div>
          </div>
          <div style="color:#CDE3D3;font-size:13px;margin-top:6px;letter-spacing:1px;text-transform:uppercase;">Willkommen im Team</div>
        </td></tr>
        <!-- Hero -->
        <tr><td style="padding:28px 32px 0;">
          <h1 style="margin:0;font-size:26px;line-height:1.25;color:${GREEN};">Servus ${firstName},</h1>
          <p style="margin:12px 0 0;font-size:16px;line-height:1.6;color:${MUTED};">
            great news – du wirst Teil des Maurer-Events Teams${roleName ? ` als <b style="color:${INK};">${roleName}</b>` : ""}.
            Damit wir alles rechtzeitig vorbereiten können, fülle bitte kurz dein Mitarbeiterprofil aus.
          </p>
        </td></tr>
        <!-- CTA -->
        <tr><td align="center" style="padding:28px 32px 8px;">
          <a href="${inviteUrl}" style="display:inline-block;background:${GREEN};color:#FFFFFF;text-decoration:none;font-weight:700;font-size:16px;padding:14px 28px;border-radius:12px;">
            Jetzt Einladung annehmen
          </a>
          <div style="font-size:13px;color:${MUTED};margin-top:12px;">Der Link ist gültig bis ${expiresAt} (7 Tage).</div>
        </td></tr>
        <!-- Login hint -->
        <tr><td style="padding:8px 32px 0;">
          <div style="background:${CANVAS};border:1px solid ${BORDER};border-radius:14px;padding:14px 18px;">
            <div style="font-weight:700;font-size:13px;color:${INK};">Später einloggen</div>
            <div style="font-size:13px;line-height:1.6;color:${MUTED};margin-top:4px;">Nach dem Setzen deines Passworts meldest du dich jederzeit unter <a href="${loginUrl || inviteUrl}" style="color:${GREEN};text-decoration:none;font-weight:700;">${loginUrl || inviteUrl}</a> mit deiner E-Mail-Adresse und dem Passwort an.</div>
          </div>
        </td></tr>
        <!-- Steps -->
        <tr><td style="padding:8px 32px 4px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 4px;" align="center" width="33%">
                <div style="font-size:20px;">🪪</div>
                <div style="font-weight:700;font-size:13px;margin-top:6px;">1. Daten + Dokumente</div>
                <div style="font-size:12px;color:${MUTED};margin-top:2px;">Profil, Steuer, IBAN &amp; Nachweise hochladen</div>
              </td>
              <td style="padding:8px 4px;" align="center" width="33%">
                <div style="font-size:20px;">📝</div>
                <div style="font-weight:700;font-size:13px;margin-top:6px;">2. Vertrag</div>
                <div style="font-size:12px;color:${MUTED};margin-top:2px;">Deinen Arbeitsvertrag digital unterschreiben</div>
              </td>
              <td style="padding:8px 4px;" align="center" width="33%">
                <div style="font-size:20px;">🎪</div>
                <div style="font-weight:700;font-size:13px;margin-top:6px;">3. Einsatz</div>
                <div style="font-size:12px;color:${MUTED};margin-top:2px;">Schichten einsehen &amp; Verfügbarkeit eintragen</div>
              </td>
            </tr>
          </table>
        </td></tr>
        <!-- Mini card -->
        <tr><td style="padding:16px 32px 0;">
          <div style="background:${CANVAS};border:1px solid ${BORDER};border-radius:14px;padding:16px 18px;">
            <div style="font-weight:700;font-size:14px;color:${GOLD};">Wichtig für den Festwirt</div>
            <div style="font-size:13px;line-height:1.6;color:${MUTED};margin-top:4px;">Bitte gib deine Daten sorgfältig ein und lade alle geforderten Dokumente gleich mit hoch – so können wir dich schnellstmöglich einteilen.</div>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="padding:22px 32px 28px;">
          <div style="border-top:1px solid ${BORDER};padding-top:16px;font-size:12px;line-height:1.6;color:${MUTED};">
            Maurer Events · Schwaiger Str. 6 · 85126 Müchsmünster<br/>
            Servus: <a href="mailto:servus@maurer-events.com" style="color:${GREEN};text-decoration:none;">servus@maurer-events.com</a>
          </div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function staffInviteText({ firstName, inviteUrl, expiresAt, roleName, loginUrl }: { firstName: string; inviteUrl: string; expiresAt: string; roleName?: string; loginUrl?: string }) {
  return [
    `Servus ${firstName},`,
    "",
    `willkommen im Maurer-Events Team${roleName ? ` als ${roleName}` : ""}!`,
    "Fülle bitte kurz dein Mitarbeiterprofil aus (Daten, Dokumente, Vertrag).",
    "",
    `Einladung annehmen: ${inviteUrl}`,
    `Der Link ist gültig bis ${expiresAt} (7 Tage).`,
    "",
    `Später einloggen: ${loginUrl || inviteUrl} (E-Mail + Passwort)`,
    "",
    "Schritte: 1) Daten + Dokumente ausfüllen, 2) Vertrag unterschreiben, 3) Schichten einsehen.",
    "",
    "Servus! Ihr Maurer-Events Team",
  ].join("\n");
}
