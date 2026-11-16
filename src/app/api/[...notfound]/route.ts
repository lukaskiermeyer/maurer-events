import { NextResponse } from "next/server";

function notFound(request: Request) {
  const url = new URL(request.url);
  return NextResponse.json(
    { ok: false, error: "not_found", path: url.pathname },
    { status: 404, headers: { "content-type": "application/json" } },
  );
}

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return notFound(request);
}
export async function POST(request: Request) {
  return notFound(request);
}
export async function PUT(request: Request) {
  return notFound(request);
}
export async function PATCH(request: Request) {
  return notFound(request);
}
export async function DELETE(request: Request) {
  return notFound(request);
}
export async function HEAD(request: Request) {
  return notFound(request);
}
export async function OPTIONS(request: Request) {
  return notFound(request);
}