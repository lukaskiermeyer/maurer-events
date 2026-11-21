import crypto from 'node:crypto';

export function pepper(): string {
  const p = process.env.AUTH_PEPPER || process.env.AUTH_SECRET;
  if (!p || p.length < 32) throw new Error('AUTH_PEPPER is not configured.');
  return p;
}

export function hmacSha256(key: string, data: string | Buffer): string {
  return crypto.createHmac('sha256', key).update(data).digest('hex');
}

export function sha256Hex(data: string | Buffer): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

export function randomBytes(bytes = 32): Uint8Array {
  return new Uint8Array(crypto.randomBytes(bytes));
}

export function timingSafeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a, 'hex'), Buffer.from(b, 'hex'));
  } catch {
    return false;
  }
}

export function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
export function randomCrockford(len: number): string {
  const bytes = crypto.randomBytes(len);
  let out = '';
  for (let i = 0; i < len; i++) out += CROCKFORD[bytes[i] % 32];
  return out;
}

export function formatCrockford(code: string, group = 4): string {
  const chunks: string[] = [];
  for (let i = 0; i < code.length; i += group) chunks.push(code.slice(i, i + group));
  return chunks.join('-');
}

export function normalizeCrockford(input: string): string {
  return input.replace(/[^0-9A-Za-z]/g, '').toUpperCase()
    .replace(/O/g, '0').replace(/I/g, '1').replace(/L/g, '1');
}

export function ipHash(ip: string): string {
  const day = new Date().toISOString().slice(0, 10);
  const salt = hmacSha256(pepper(), `ip-salt:${day}`);
  return hmacSha256(salt, ip);
}

export function hashToken(token: string): string {
  return sha256Hex(token);
}
