import { NextResponse } from 'next/server';
import { db } from '@/db';

export const revalidate = 60;

export async function GET() {
    try {
        // Einfacher DB-Check
        await db.execute('SELECT 1');
        return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
    } catch (error) {
        return NextResponse.json(
            { status: 'error', error: 'Database connection failed' },
            { status: 500 }
        );
    }
}