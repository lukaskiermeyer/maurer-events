import { escapeHtml } from "@/lib/escape";

export const INVITE_PLACEHOLDERS = ["{{name}}", "{{event}}", "{{datum}}", "{{ort}}", "{{link}}"];

export const DEFAULT_INVITE_SUBJECT = "Einladung: {{event}}";

export const DEFAULT_INVITE_BODY = `Hallo {{name}},

wir laden dich herzlich zu {{event}} ein.
Wann: {{datum}}
Wo: {{ort}}

Alle Infos und die Tischreservierung findest du hier:
{{link}}

Wir freuen uns auf dich!
Herzliche Grüße
Dein Maurer-Events-Team`;

export interface InviteContext {
  name: string;
  event: string;
  datum: string;
  ort: string;
  link: string;
}

export function fillTemplate(tpl: string, ctx: InviteContext): string {
  return tpl
    .replaceAll("{{name}}", ctx.name)
    .replaceAll("{{event}}", ctx.event)
    .replaceAll("{{datum}}", ctx.datum)
    .replaceAll("{{ort}}", ctx.ort)
    .replaceAll("{{link}}", ctx.link);
}

// Gmail-freundlich: Klartext-Alternative + minimales HTML (Absätze + ein Link),
// kein Banner, kein Button, kein Footer-Marketing, kein Tracking.
export function renderInviteMail(subjectTpl: string, bodyTpl: string, ctx: InviteContext) {
  const subject = fillTemplate(subjectTpl, ctx).replace(/\s+/g, " ").trim().slice(0, 200);
  const text = fillTemplate(bodyTpl, ctx);
  const html = text
    .split(/\n{2,}/)
    .map(p => `<p style="margin:0 0 14px;font:15px/1.6 -apple-system,Segoe UI,Roboto,Arial,sans-serif;color:#222222;">${escapeHtml(p).replace(/\n/g, "<br/>").replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" style="color:#1F5732;">$1</a>')}</p>`)
    .join("");
  return { subject, text, html };
}