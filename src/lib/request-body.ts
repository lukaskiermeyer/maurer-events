import { NextResponse } from "next/server";
import { BookingError } from "./reservation-policy";

export async function boundedBody(request: Request, maxBytes: number): Promise<string> {
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > maxBytes) throw new BookingError("Anfrage zu groß.", 413);
  if (!request.body) throw new BookingError("Leere Anfrage.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) {
        await reader.cancel();
        throw new BookingError("Anfrage zu groß.", 413);
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks).toString("utf8");
}

export async function boundedJson<T = unknown>(request: Request, maxBytes = 16 * 1024): Promise<T> {
  const raw = await boundedBody(request, maxBytes);
  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new BookingError("Ungültiges JSON.", 400);
  }
}

export function bodyError(error: unknown) {
  const status = error instanceof BookingError ? error.status : 400;
  const message = error instanceof BookingError ? error.message : "Ungültige Anfrage.";
  return NextResponse.json({ error: message }, { status });
}
