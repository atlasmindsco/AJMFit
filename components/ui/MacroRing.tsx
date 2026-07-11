/**
 * Circular progress ring for macro / calorie targets.
 * Single source of truth, used by the studio dashboard (dark)
 * and the nutrition page (light) via the `bgStroke` prop.
 */

interface MacroRingProps {
  current: number
  goal: number
  color: string
  size?: number
  /** Background ring color. Defaults to dark-theme translucent white. */
  bgStroke?: string
}

export default function MacroRing({
  current,
  goal,
  color,
  size = 72,
  bgStroke = 'rgba(255,255,255,0.06)',
}: MacroRingProps) {
  const radius = (size - 8) / 2
  const circumference = 2 * Math.PI * radius
  const pct = goal > 0 ? Math.min(current / goal, 1) : 0
  const offset = circumference * (1 - pct)

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={bgStroke} strokeWidth={6} />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={6}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        className="transition-[stroke-dashoffset] duration-700"
      />
    </svg>
  )
}
