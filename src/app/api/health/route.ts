import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
const headers = { 'Cache-Control': 'no-store' };

// App-Liveness ohne DB-Check, damit Monitoring-Pings die Datenbank nicht wecken.
// DB-/Migrations-Readiness: /api/health/db (Deploy-Preflight, manuell).
export async function GET() {
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() }, { headers });
}
