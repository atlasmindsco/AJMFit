import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { recordTargetChange } from '@/lib/nutrition-history'

/**
 * Coach-only: Set or clear custom nutrition target overrides.
 * POST: set custom targets for a user
 * DELETE: clear custom overrides (revert to calculated values)
 */

async function checkIsTrainer(): Promise<boolean> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const role = (user?.app_metadata as { role?: string } | undefined)?.role
  return role === 'trainer'
}

export async function POST(request: Request) {
  try {
    if (!(await checkIsTrainer())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await request.json()) as {
      userId: string
      targets: { calories: number; protein: number; carbs: number; fats: number }
      /** Optional note from Anthony, shown to the client in their history. */
      reason?: string
    }

    if (!body.userId || !body.targets) {
      return NextResponse.json({ error: 'Missing userId or targets' }, { status: 400 })
    }

    const admin = createAdminClient() as any

    const { error } = await admin
      .from('users')
      .update({
        custom_cal_target: body.targets.calories,
        custom_protein_target: body.targets.protein,
        custom_carb_target: body.targets.carbs,
        custom_fat_target: body.targets.fats,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.userId)

    if (error) {
      console.error('[nutrition/override] POST error:', error)
      return NextResponse.json({ error: 'Failed to save overrides' }, { status: 500 })
    }

    await recordTargetChange(admin, {
      userId: body.userId,
      calories: body.targets.calories,
      protein: body.targets.protein,
      carbs: body.targets.carbs,
      fats: body.targets.fats,
      source: 'coach',
      reason: body.reason?.trim() || 'Anthony set these targets for you.',
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[nutrition/override] POST error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    if (!(await checkIsTrainer())) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = (await request.json()) as { userId: string }

    if (!body.userId) {
      return NextResponse.json({ error: 'Missing userId' }, { status: 400 })
    }

    const admin = createAdminClient() as any

    const { data: cleared, error } = await admin
      .from('users')
      .update({
        custom_cal_target: null,
        custom_protein_target: null,
        custom_carb_target: null,
        custom_fat_target: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.userId)
      .select('daily_cal_target, protein_target, carb_target, fat_target')

    if (error) {
      console.error('[nutrition/override] DELETE error:', error)
      return NextResponse.json({ error: 'Failed to clear overrides' }, { status: 500 })
    }

    // Lifting an override is itself a change to what the client should eat,
    // so it belongs in the history with the numbers they revert to.
    const back = cleared?.[0]
    if (back) {
      await recordTargetChange(admin, {
        userId: body.userId,
        calories: back.daily_cal_target,
        protein: back.protein_target,
        carbs: back.carb_target,
        fats: back.fat_target,
        source: 'coach',
        reason: 'Anthony lifted his custom targets, so you are back on the calculated ones.',
      })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[nutrition/override] DELETE error:', err)
    return NextResponse.json({ error: 'Something went wrong' }, { status: 500 })
  }
}
