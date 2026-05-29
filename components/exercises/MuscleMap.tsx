'use client'

import { useMemo } from 'react'
import Body, { type Slug, type ExtendedBodyPart } from 'react-muscle-highlighter'

interface MuscleMapProps {
  target?: string
  secondaryMuscles?: string[]
  interactive?: boolean
  onMuscleClick?: (muscle: string) => void
  selectedMuscle?: string
  size?: 'sm' | 'md' | 'lg'
  theme?: 'light' | 'dark'
}

const PRIMARY = '#F76B16'
const SECONDARY = '#1A7BFF'

const NAME_TO_SLUG: Record<string, Slug> = {
  // Free Exercise DB names
  chest: 'chest',
  pectorals: 'chest',
  shoulders: 'deltoids',
  delts: 'deltoids',
  deltoids: 'deltoids',
  biceps: 'biceps',
  triceps: 'triceps',
  forearms: 'forearm',
  forearm: 'forearm',
  abdominals: 'abs',
  abs: 'abs',
  obliques: 'obliques',
  quadriceps: 'quadriceps',
  quads: 'quadriceps',
  hamstrings: 'hamstring',
  hamstring: 'hamstring',
  calves: 'calves',
  glutes: 'gluteal',
  gluteal: 'gluteal',
  traps: 'trapezius',
  trapezius: 'trapezius',
  lats: 'upper-back',
  'middle back': 'upper-back',
  'upper back': 'upper-back',
  'upper-back': 'upper-back',
  'lower back': 'lower-back',
  'lower-back': 'lower-back',
  spine: 'lower-back',
  adductors: 'adductors',
  abductors: 'gluteal',
  neck: 'neck',
}

function toSlug(name?: string): Slug | null {
  if (!name) return null
  const key = name.toLowerCase().trim()
  return NAME_TO_SLUG[key] ?? null
}

export default function MuscleMap({
  target,
  secondaryMuscles = [],
  size = 'md',
  theme = 'light',
}: MuscleMapProps) {
  const dark = theme === 'dark'

  const scale = size === 'sm' ? 0.45 : size === 'lg' ? 0.85 : 0.6

  const data = useMemo<ExtendedBodyPart[]>(() => {
    const list: ExtendedBodyPart[] = []
    const primarySlug = toSlug(target)
    if (primarySlug) {
      list.push({ slug: primarySlug, color: PRIMARY, intensity: 2 })
    }
    for (const m of secondaryMuscles) {
      const s = toSlug(m)
      if (!s || s === primarySlug) continue
      list.push({ slug: s, color: SECONDARY, intensity: 1 })
    }
    return list
  }, [target, secondaryMuscles])

  const defaultFill = dark ? 'rgba(255,255,255,0.08)' : 'rgba(27,45,80,0.10)'
  const defaultStroke = dark ? 'rgba(255,255,255,0.15)' : 'rgba(27,45,80,0.22)'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="flex justify-center gap-3">
        <div className="flex flex-col items-center">
          <Body
            data={data}
            side="front"
            gender="male"
            scale={scale}
            border="none"
            defaultFill={defaultFill}
            defaultStroke={defaultStroke}
            defaultStrokeWidth={0.8}
          />
          <span className={`text-[9px] font-display font-bold uppercase tracking-[0.15em] mt-1 ${dark ? 'text-white/30' : 'text-[#1B2D50]/40'}`}>
            Front
          </span>
        </div>
        <div className="flex flex-col items-center">
          <Body
            data={data}
            side="back"
            gender="male"
            scale={scale}
            border="none"
            defaultFill={defaultFill}
            defaultStroke={defaultStroke}
            defaultStrokeWidth={0.8}
          />
          <span className={`text-[9px] font-display font-bold uppercase tracking-[0.15em] mt-1 ${dark ? 'text-white/30' : 'text-[#1B2D50]/40'}`}>
            Back
          </span>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-1">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: PRIMARY }} />
          <span className={`text-[9px] font-display font-bold uppercase tracking-[0.12em] ${dark ? 'text-white/40' : 'text-[#1B2D50]/50'}`}>
            Primary
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: SECONDARY }} />
          <span className={`text-[9px] font-display font-bold uppercase tracking-[0.12em] ${dark ? 'text-white/40' : 'text-[#1B2D50]/50'}`}>
            Secondary
          </span>
        </div>
      </div>
    </div>
  )
}
