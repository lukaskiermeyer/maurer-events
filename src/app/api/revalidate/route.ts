import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Secrets gehören nicht in URLs, da sie sonst in Proxy-/Browser-Logs landen.
  const secret = request.headers.get("x-revalidate-secret") || "";
  const expected = process.env.CRON_SECRET || "";
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tags = (searchParams.get("tags") || searchParams.get("tag") || "events")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  for (const tag of tags) {
    revalidateTag(tag, "max");
  }

  return NextResponse.json({ revalidated: tags, now: Date.now() });
}
