import { NextResponse } from 'next/server';
import { HISTORY_SHEETS } from '@/lib/sheets.config';

export const revalidate = 0;

export async function GET() {
  return NextResponse.json({ sheets: HISTORY_SHEETS });
}
