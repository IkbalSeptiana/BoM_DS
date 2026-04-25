import { NextRequest, NextResponse } from 'next/server';
import { SHEET_ID } from '@/lib/sheets.config';

export const runtime = 'edge';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('name') ?? '';
  if (!name) return NextResponse.json({ error: 'missing name' }, { status: 400 });

  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(name)}`;

  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ error: 'upstream error' }, { status: 502 });

    const csv = await res.text();
    return new NextResponse(csv, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return NextResponse.json({ error: 'fetch failed' }, { status: 500 });
  }
}
