'use client'

import { useState } from 'react'

interface MuscleMapProps {
  target?: string
  secondaryMuscles?: string[]
  interactive?: boolean
  onMuscleClick?: (muscle: string) => void
  selectedMuscle?: string
  size?: 'sm' | 'md' | 'lg'
  theme?: 'light' | 'dark'
}

// Anatomically accurate SVG muscle regions with gradients
const MUSCLE_REGIONS: Record<string, {
  front?: Array<{ d: string; label?: string }>
  back?: Array<{ d: string; label?: string }>
  displayName: string
}> = {
  pectorals: {
    displayName: 'Chest',
    front: [
      { d: 'M 128 124 Q 135 116 148 112 Q 156 110 162 112 L 166 114 Q 170 118 170 126 Q 168 138 160 144 Q 152 150 142 148 Q 134 146 130 140 Z' },
      { d: 'M 212 124 Q 205 116 192 112 Q 184 110 178 112 L 174 114 Q 170 118 170 126 Q 172 138 180 144 Q 188 150 198 148 Q 206 146 210 140 Z' },
    ],
  },
  delts: {
    displayName: 'Shoulders',
    front: [
      { d: 'M 122 108 Q 116 102 114 112 Q 112 122 114 132 Q 118 138 124 134 Q 130 128 132 120 Q 132 112 128 108 Z' },
      { d: 'M 218 108 Q 224 102 226 112 Q 228 122 226 132 Q 222 138 216 134 Q 210 128 208 120 Q 208 112 212 108 Z' },
    ],
    back: [
      { d: 'M 122 108 Q 116 102 114 112 Q 112 122 114 132 Q 118 138 124 134 Q 130 128 132 120 Q 132 112 128 108 Z' },
      { d: 'M 218 108 Q 224 102 226 112 Q 228 122 226 132 Q 222 138 216 134 Q 210 128 208 120 Q 208 112 212 108 Z' },
    ],
  },
  biceps: {
    displayName: 'Biceps',
    front: [
      { d: 'M 114 136 Q 110 140 108 152 Q 106 164 108 174 Q 112 180 116 176 Q 120 168 120 156 Q 120 144 118 138 Z' },
      { d: 'M 226 136 Q 230 140 232 152 Q 234 164 232 174 Q 228 180 224 176 Q 220 168 220 156 Q 220 144 222 138 Z' },
    ],
  },
  triceps: {
    displayName: 'Triceps',
    back: [
      { d: 'M 114 136 Q 110 140 108 152 Q 106 164 108 174 Q 112 180 116 176 Q 120 168 120 156 Q 120 144 118 138 Z' },
      { d: 'M 226 136 Q 230 140 232 152 Q 234 164 232 174 Q 228 180 224 176 Q 220 168 220 156 Q 220 144 222 138 Z' },
    ],
  },
  forearms: {
    displayName: 'Forearms',
    front: [
      { d: 'M 106 178 Q 102 184 100 196 Q 98 208 96 218 Q 98 222 102 220 Q 106 214 108 202 Q 110 190 110 182 Z' },
      { d: 'M 234 178 Q 238 184 240 196 Q 242 208 244 218 Q 242 222 238 220 Q 234 214 232 202 Q 230 190 230 182 Z' },
    ],
  },
  abs: {
    displayName: 'Abs',
    front: [
      { d: 'M 158 148 L 170 148 L 170 162 L 158 162 Z' },
      { d: 'M 170 148 L 182 148 L 182 162 L 170 162 Z' },
      { d: 'M 158 164 L 170 164 L 170 178 L 158 178 Z' },
      { d: 'M 170 164 L 182 164 L 182 178 L 170 178 Z' },
      { d: 'M 158 180 L 170 180 L 170 194 L 160 196 Z' },
      { d: 'M 170 180 L 182 180 L 180 196 L 170 194 Z' },
    ],
  },
  quads: {
    displayName: 'Quads',
    front: [
      { d: 'M 148 210 Q 144 218 142 240 Q 140 260 142 280 Q 146 290 152 288 Q 158 282 160 264 Q 162 244 162 228 Q 160 216 156 210 Z' },
      { d: 'M 192 210 Q 196 218 198 240 Q 200 260 198 280 Q 194 290 188 288 Q 182 282 180 264 Q 178 244 178 228 Q 180 216 184 210 Z' },
    ],
  },
  hamstrings: {
    displayName: 'Hamstrings',
    back: [
      { d: 'M 148 210 Q 144 218 142 240 Q 140 260 142 280 Q 146 290 152 288 Q 158 282 160 264 Q 162 244 162 228 Q 160 216 156 210 Z' },
      { d: 'M 192 210 Q 196 218 198 240 Q 200 260 198 280 Q 194 290 188 288 Q 182 282 180 264 Q 178 244 178 228 Q 180 216 184 210 Z' },
    ],
  },
  glutes: {
    displayName: 'Glutes',
    back: [
      { d: 'M 146 192 Q 152 186 170 184 Q 188 186 194 192 L 196 208 Q 190 216 170 218 Q 150 216 146 208 Z' },
    ],
  },
  calves: {
    displayName: 'Calves',
    front: [
      { d: 'M 144 294 Q 142 302 140 318 Q 140 334 142 344 Q 146 350 150 346 Q 152 336 152 322 Q 152 308 150 298 Z' },
      { d: 'M 196 294 Q 198 302 200 318 Q 200 334 198 344 Q 194 350 190 346 Q 188 336 188 322 Q 188 308 190 298 Z' },
    ],
    back: [
      { d: 'M 144 294 Q 140 304 138 320 Q 138 338 142 348 Q 148 354 154 348 Q 156 336 156 318 Q 154 302 150 294 Z' },
      { d: 'M 196 294 Q 200 304 202 320 Q 202 338 198 348 Q 192 354 186 348 Q 184 336 184 318 Q 186 302 190 294 Z' },
    ],
  },
  lats: {
    displayName: 'Lats',
    back: [
      { d: 'M 132 120 Q 128 126 126 140 Q 126 158 130 172 Q 136 180 142 176 Q 148 168 150 154 Q 150 138 146 126 Q 142 118 136 118 Z' },
      { d: 'M 208 120 Q 212 126 214 140 Q 214 158 210 172 Q 204 180 198 176 Q 192 168 190 154 Q 190 138 194 126 Q 198 118 204 118 Z' },
    ],
  },
  traps: {
    displayName: 'Traps',
    back: [
      { d: 'M 148 88 Q 156 82 170 80 Q 184 82 192 88 L 190 108 Q 182 102 170 100 Q 158 102 150 108 Z' },
    ],
    front: [
      { d: 'M 148 92 Q 156 86 170 84 Q 184 86 192 92 L 188 104 Q 182 98 170 96 Q 158 98 152 104 Z' },
    ],
  },
  'upper back': {
    displayName: 'Upper Back',
    back: [
      { d: 'M 148 108 L 192 108 L 192 160 Q 180 168 170 168 Q 160 168 148 160 Z' },
    ],
  },
  'serratus anterior': {
    displayName: 'Serratus',
    front: [
      { d: 'M 128 140 Q 132 136 138 138 L 140 158 Q 136 162 128 158 Z' },
      { d: 'M 212 140 Q 208 136 202 138 L 200 158 Q 204 162 212 158 Z' },
    ],
  },
  adductors: {
    displayName: 'Inner Thigh',
    front: [
      { d: 'M 160 210 Q 164 206 170 208 L 168 240 Q 164 244 160 240 Z' },
      { d: 'M 180 210 Q 176 206 170 208 L 172 240 Q 176 244 180 240 Z' },
    ],
  },
  abductors: {
    displayName: 'Outer Thigh',
    front: [
      { d: 'M 140 208 Q 144 202 150 204 L 146 236 Q 142 240 138 236 Z' },
      { d: 'M 200 208 Q 196 202 190 204 L 194 236 Q 198 240 202 236 Z' },
    ],
  },
  'levator scapulae': {
    displayName: 'Neck',
    back: [
      { d: 'M 156 78 Q 162 74 170 74 Q 178 74 184 78 L 182 90 Q 178 86 170 86 Q 162 86 158 90 Z' },
    ],
  },
  spine: {
    displayName: 'Lower Back',
    back: [
      { d: 'M 164 160 L 176 160 L 178 198 Q 174 204 170 204 Q 166 204 162 198 Z' },
    ],
  },
  'cardiovascular system': {
    displayName: 'Cardio',
    front: [
      { d: 'M 164 120 Q 168 116 176 116 Q 180 116 176 124 Q 172 130 168 124 Q 164 130 160 124 Q 158 118 164 120 Z' },
    ],
  },
}

function BodyOutline({ view, dark }: { view: 'front' | 'back'; dark: boolean }) {
  const bodyFill = dark ? `url(#bodyGrad-${view}-dark)` : `url(#bodyGrad-${view})`
  const strokeColor = dark ? 'rgba(255,255,255,0.10)' : '#1B2D50'
  const strokeOp = dark ? 1 : 0.15

  return (
    <g>
      <defs>
        {/* Light theme gradients */}
        <linearGradient id={`bodyGrad-${view}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a3a5c" stopOpacity="0.12" />
          <stop offset="100%" stopColor="#1B2D50" stopOpacity="0.06" />
        </linearGradient>
        {/* Dark theme gradients */}
        <linearGradient id={`bodyGrad-${view}-dark`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="rgba(255,255,255,0.08)" stopOpacity="1" />
          <stop offset="100%" stopColor="rgba(255,255,255,0.03)" stopOpacity="1" />
        </linearGradient>
        {/* Light primary/secondary */}
        <linearGradient id="primaryGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F76B16" />
          <stop offset="100%" stopColor="#D8590C" />
        </linearGradient>
        <linearGradient id="secondaryGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1A7BFF" />
          <stop offset="100%" stopColor="#0F5FE0" />
        </linearGradient>
        {/* Dark primary (green like Stndrd) */}
        <linearGradient id="primaryGradDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22C55E" />
          <stop offset="100%" stopColor="#16A34A" />
        </linearGradient>
        {/* Dark secondary (yellow like Stndrd) */}
        <linearGradient id="secondaryGradDark" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#EAB308" />
          <stop offset="100%" stopColor="#CA8A04" />
        </linearGradient>
      </defs>

      {/* Head */}
      <ellipse cx="170" cy="52" rx="22" ry="26" fill={bodyFill} stroke={strokeColor} strokeWidth="0.8" strokeOpacity={strokeOp} />
      {/* Neck */}
      <rect x="162" y="76" width="16" height="14" rx="4" fill={bodyFill} stroke={strokeColor} strokeWidth="0.8" strokeOpacity={strokeOp} />
      {/* Torso */}
      <path d="M 130 92 Q 136 86 152 84 L 188 84 Q 204 86 210 92 L 216 130 L 214 180 Q 210 208 200 212 L 140 212 Q 130 208 126 180 L 124 130 Z" fill={bodyFill} stroke={strokeColor} strokeWidth="0.8" strokeOpacity={strokeOp} />
      {/* Left arm */}
      <path d="M 128 96 Q 118 92 112 100 Q 106 112 104 130 L 100 170 Q 96 190 92 210 Q 88 226 86 236 Q 84 242 88 244 Q 94 244 98 236 Q 102 222 106 202 L 112 170 Q 116 150 118 136" fill={bodyFill} stroke={strokeColor} strokeWidth="0.8" strokeOpacity={strokeOp} />
      {/* Right arm */}
      <path d="M 212 96 Q 222 92 228 100 Q 234 112 236 130 L 240 170 Q 244 190 248 210 Q 252 226 254 236 Q 256 242 252 244 Q 246 244 242 236 Q 238 222 234 202 L 228 170 Q 224 150 222 136" fill={bodyFill} stroke={strokeColor} strokeWidth="0.8" strokeOpacity={strokeOp} />
      {/* Left leg */}
      <path d="M 142 212 Q 138 224 136 250 L 134 290 Q 132 320 130 346 Q 128 360 130 370 Q 134 378 140 374 Q 146 366 148 350 L 152 310 Q 156 270 158 240 Q 162 218 166 212" fill={bodyFill} stroke={strokeColor} strokeWidth="0.8" strokeOpacity={strokeOp} />
      {/* Right leg */}
      <path d="M 198 212 Q 202 224 204 250 L 206 290 Q 208 320 210 346 Q 212 360 210 370 Q 206 378 200 374 Q 194 366 192 350 L 188 310 Q 184 270 182 240 Q 178 218 174 212" fill={bodyFill} stroke={strokeColor} strokeWidth="0.8" strokeOpacity={strokeOp} />
    </g>
  )
}

export default function MuscleMap({
  target,
  secondaryMuscles = [],
  interactive = false,
  onMuscleClick,
  selectedMuscle,
  size = 'md',
  theme = 'light',
}: MuscleMapProps) {
  const [view, setView] = useState<'front' | 'back'>('front')
  const [hoveredMuscle, setHoveredMuscle] = useState<string | null>(null)
  const dark = theme === 'dark'

  const sizeClasses = {
    sm: 'max-h-[200px]',
    md: 'max-h-[340px]',
    lg: 'max-h-[440px]',
  }

  const primaryMuscles = target ? [target] : []

  const getMuscleStyle = (muscle: string) => {
    const isPrimary = primaryMuscles.includes(muscle)
    const isSecondary = secondaryMuscles.includes(muscle)
    const isSelected = selectedMuscle === muscle
    const isHovered = hoveredMuscle === muscle

    if (dark) {
      if (isSelected) {
        return { fill: 'url(#primaryGradDark)', opacity: 0.9, stroke: '#22C55E', strokeWidth: 1.5 }
      }
      if (isPrimary) {
        return { fill: 'url(#primaryGradDark)', opacity: isHovered ? 0.85 : 0.7, stroke: '#16A34A', strokeWidth: 0.8 }
      }
      if (isSecondary) {
        return { fill: 'url(#secondaryGradDark)', opacity: isHovered ? 0.55 : 0.4, stroke: '#CA8A04', strokeWidth: 0.5 }
      }
      if (interactive && isHovered) {
        return { fill: 'white', opacity: 0.08, stroke: 'rgba(255,255,255,0.2)', strokeWidth: 0.8 }
      }
      return { fill: 'transparent', opacity: 0, stroke: 'transparent', strokeWidth: 0 }
    }

    // Light theme (original)
    if (isSelected) {
      return { fill: 'url(#primaryGrad)', opacity: 0.9, stroke: '#F76B16', strokeWidth: 1.5 }
    }
    if (isPrimary) {
      return { fill: 'url(#primaryGrad)', opacity: isHovered ? 0.85 : 0.7, stroke: '#D8590C', strokeWidth: 0.8 }
    }
    if (isSecondary) {
      return { fill: 'url(#secondaryGrad)', opacity: isHovered ? 0.5 : 0.35, stroke: '#1A7BFF', strokeWidth: 0.5 }
    }
    if (interactive && isHovered) {
      return { fill: '#1B2D50', opacity: 0.15, stroke: '#1B2D50', strokeWidth: 0.8 }
    }
    return { fill: 'transparent', opacity: 0, stroke: 'transparent', strokeWidth: 0 }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Front/Back toggle */}
      <div className={`flex items-center rounded-lg p-0.5 gap-0.5 ${dark ? 'bg-white/[0.04]' : 'bg-brand-navy/[0.04]'}`}>
        <button
          onClick={() => setView('front')}
          className={`px-3 py-1 rounded-md font-display font-semibold text-[10px] uppercase tracking-[0.12em] transition-opacity duration-200 ${
            view === 'front'
              ? dark ? 'bg-white/[0.10] text-white' : 'bg-white text-brand-navy shadow-sm'
              : dark ? 'text-white/40 hover:text-white/60' : 'text-brand-navy/40 hover:text-brand-navy/60'
          }`}
        >
          Front
        </button>
        <button
          onClick={() => setView('back')}
          className={`px-3 py-1 rounded-md font-display font-semibold text-[10px] uppercase tracking-[0.12em] transition-opacity duration-200 ${
            view === 'back'
              ? dark ? 'bg-white/[0.10] text-white' : 'bg-white text-brand-navy shadow-sm'
              : dark ? 'text-white/40 hover:text-white/60' : 'text-brand-navy/40 hover:text-brand-navy/60'
          }`}
        >
          Back
        </button>
      </div>

      {/* Body SVG */}
      <svg
        viewBox="70 20 200 370"
        className={`w-full ${sizeClasses[size]}`}
        style={{ filter: dark ? 'none' : 'drop-shadow(0 2px 8px rgba(27,45,80,0.06))' }}
      >
        <BodyOutline view={view} dark={dark} />

        {/* Muscle regions */}
        {Object.entries(MUSCLE_REGIONS).map(([muscle, data]) => {
          const paths = view === 'front' ? data.front : data.back
          if (!paths) return null
          const style = getMuscleStyle(muscle)

          return paths.map((pathData, i) => (
            <path
              key={`${muscle}-${view}-${i}`}
              d={pathData.d}
              fill={style.fill}
              opacity={style.opacity}
              stroke={style.stroke}
              strokeWidth={style.strokeWidth}
              className={interactive ? 'cursor-pointer transition-opacity duration-150' : 'transition-opacity duration-300'}
              onMouseEnter={() => interactive && setHoveredMuscle(muscle)}
              onMouseLeave={() => interactive && setHoveredMuscle(null)}
              onClick={() => interactive && onMuscleClick?.(muscle)}
            />
          ))
        })}

        {/* Hover tooltip */}
        {interactive && hoveredMuscle && MUSCLE_REGIONS[hoveredMuscle] && (
          <g>
            <rect x="120" y="386" width="100" height="20" rx="4" fill={dark ? '#222' : '#1B2D50'} opacity="0.9" />
            <text x="170" y="400" textAnchor="middle" fontSize="10" fill="white" fontFamily="sans-serif" fontWeight="600">
              {MUSCLE_REGIONS[hoveredMuscle].displayName}
            </text>
          </g>
        )}
      </svg>

      {/* Legend */}
      {(target || secondaryMuscles.length > 0) && (
        <div className="flex items-center justify-center gap-4 text-[10px] font-body">
          {target && (
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm ${dark ? 'bg-gradient-to-b from-[#22C55E] to-[#16A34A]' : 'bg-gradient-to-b from-[#F76B16] to-[#D8590C]'}`} />
              <span className={dark ? 'text-white/60 capitalize' : 'text-brand-navy/60 capitalize'}>{MUSCLE_REGIONS[target]?.displayName || target}</span>
            </div>
          )}
          {secondaryMuscles.length > 0 && (
            <div className="flex items-center gap-1.5">
              <span className={`w-2.5 h-2.5 rounded-sm opacity-50 ${dark ? 'bg-gradient-to-b from-[#EAB308] to-[#CA8A04]' : 'bg-gradient-to-b from-[#1A7BFF] to-[#0F5FE0]'}`} />
              <span className={dark ? 'text-white/60' : 'text-brand-navy/60'}>Secondary</span>
            </div>
          )}
        </div>
      )}

      {interactive && (
        <p className={`text-[10px] font-body text-center ${dark ? 'text-white/25' : 'text-brand-navy/30'}`}>
          Tap a muscle to filter exercises
        </p>
      )}
    </div>
  )
}
