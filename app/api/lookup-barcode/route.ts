import { NextResponse } from 'next/server'
import { lookupBarcode, BarcodeNotFoundError } from '@/lib/food-recognition'

export const runtime = 'nodejs'
export const maxDuration = 15

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}))
    const barcode = typeof body?.barcode === 'string' ? body.barcode.trim() : ''
    if (!barcode || !/^\d{6,14}$/.test(barcode)) {
      return NextResponse.json({ error: 'Invalid barcode' }, { status: 400 })
    }
    const result = await lookupBarcode(barcode)
    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof BarcodeNotFoundError) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 })
    }
    const message = err instanceof Error ? err.message : 'Barcode lookup failed'
    console.error('[lookup-barcode] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
