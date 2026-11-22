// Wiederverwendbares E-Mail-Template im Maurer-Events-Stil.
// Tabellenbasiert + inline-CSS fuer maximale Kompatibilitaet (Outlook, Gmail, Apple Mail).

const BRAND = {
  green: "#20603C",
  wood: "#cb7913",
  dark: "#0A0A0A",
  light: "#FAF8F4",
  canvas: "#F4F0E8",
  border: "#F0EDE5",
  muted: "#6b6b6b",
};

const LOGO_URL = "https://www.maurer-events.com/LogoFinalGrün_MaurerEvents.svg";
const SITE_URL = "https://www.maurer-events.com";

export type EmailBlock =
  | { type: "heading"; text: string }
  | { type: "paragraph"; text: string; muted?: boolean }
  | { type: "button"; label: string; href: string }
  | { type: "list"; items: string[] }
  | { type: "divider" }
  | { type: "note"; text: string };

export function renderEmail(opts: {
  preheader?: string;
  title: string;
  blocks: EmailBlock[];
  footerNote?: string;
}): string {
  const { preheader = "", title, blocks, footerNote } = opts;

  const bodyHtml = blocks
    .map((b) => {
      switch (b.type) {
        case "heading":
          return `<h2 style="margin:0 0 12px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:20px;font-weight:700;color:${BRAND.dark};line-height:1.3;">${b.text}</h2>`;
        case "paragraph":
          return `<p style="margin:0 0 14px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:${b.muted ? BRAND.muted : BRAND.dark};">${b.text}</p>`;
        case "button":
          return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:18px 0;"><tr><td style="border-radius:10px;background:${BRAND.green};"><a href="${b.href}" style="display:inline-block;padding:12px 24px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:10px;">${b.label}</a></td></tr></table>`;
        case "list":
          return `<ul style="margin:0 0 14px;padding-left:20px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:15px;line-height:1.7;color:${BRAND.dark};">${b.items.map((i) => `<li style="margin-bottom:4px;">${i}</li>`).join("")}</ul>`;
        case "divider":
          return `<hr style="border:none;border-top:1px solid ${BRAND.border};margin:20px 0;" />`;
        case "note":
          return `<p style="margin:14px 0 0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:13px;line-height:1.5;color:${BRAND.muted};font-style:italic;">${b.text}</p>`;
        default:
          return "";
      }
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<title>${title}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.canvas};-webkit-text-size-adjust:100%;">
  ${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:${BRAND.canvas};">${preheader}</div>` : ""}
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${BRAND.canvas};padding:24px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:${BRAND.light};border-radius:16px;overflow:hidden;border:1px solid ${BRAND.border};">
          <!-- Header -->
          <tr>
            <td style="background:${BRAND.green};padding:24px 32px;text-align:center;">
              <img src="${LOGO_URL}" alt="Maurer Events" width="64" height="64" style="display:block;margin:0 auto 10px;border:0;" />
              <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:18px;font-weight:800;color:#ffffff;letter-spacing:0.02em;">Maurer Events</div>
              <div style="font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:rgba(255,255,255,0.75);margin-top:2px;">Festwirt &amp; Eventservice</div>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 18px;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:24px;font-weight:800;color:${BRAND.dark};line-height:1.2;">${title}</h1>
              ${bodyHtml}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;background:${BRAND.canvas};border-top:1px solid ${BRAND.border};text-align:center;">
              <p style="margin:0;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;font-size:12px;color:${BRAND.muted};line-height:1.5;">
                ${footerNote || "Maurer Events · Festwirt &amp; Eventservice"}
                <br />
                <a href="${SITE_URL}" style="color:${BRAND.green};text-decoration:none;">maurer-events.com</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}
