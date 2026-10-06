// Shared sender configuration also allows a verified staging domain.
export function emailFrom() {
  return process.env.EMAIL_FROM || 'Maurer Events <servus@maurer-events.com>';
}
