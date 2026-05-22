import { NextResponse } from 'next/server'
import { lookupTypedFood } from '@/lib/food-recognition'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const query = typeof body?.query === 'string' ? body.query.trim() : ''
    if (!query || query.length < 2) {
      return NextResponse.json({ error: 'Query too short' }, { status: 400 })
    }
    if (query.length > 200) {
      return NextResponse.json({ error: 'Query too long' }, { status: 400 })
    }
    const result = await lookupTypedFood(query)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Lookup failed'
    console.error('[lookup-food] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
