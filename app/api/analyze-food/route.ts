import { NextResponse } from 'next/server'
import { analyzeFood } from '@/lib/food-recognition'

export const runtime = 'nodejs'
export const maxDuration = 30

export async function POST(req: Request) {
  try {
    const formData = await req.formData()
    const file = formData.get('image')
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'No image uploaded' }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image too large (max 10MB)' }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const base64 = buffer.toString('base64')
    const mimeType = file.type || 'image/jpeg'

    const result = await analyzeFood(base64, mimeType)
    return NextResponse.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed'
    console.error('[analyze-food] Error:', err)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
