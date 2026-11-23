// Shared sender configuration also allows a verified staging domain.
export function emailFrom() {
  return process.env.EMAIL_FROM || 'Maurer Events <servus@maurer-events.com>';
}

// Reply-To auf die echte Absender-Adresse: Antworten landen im Postfach und
// signalisieren Gmail eine echte Konversation statt einer Massen-Mail.
export function emailReplyTo() {
  const from = emailFrom();
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim();
}
