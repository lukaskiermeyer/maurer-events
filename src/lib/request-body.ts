import { BookingError } from './reservation-policy';

export async function boundedBody(request: Request, maxBytes: number): Promise<string> {
  const length = request.headers.get('content-length');
  if (length && Number(length) > maxBytes) throw new BookingError('Anfrage zu groß.', 413);
  if (!request.body) throw new BookingError('Leere Anfrage.');
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new BookingError('Anfrage zu groß.', 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return Buffer.concat(chunks).toString('utf8');
}
