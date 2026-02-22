'use client'

const items = [
  'Maximize Output',
  'Proper Form',
  'Real Accountability',
  'Home Workouts',
  'ISSA Certified',
  'No Excuses',
  'Brains & Gains',
  'Luke 12:48',
]

export default function Marquee() {
  const content = items.map((item, i) => (
    <span key={i} className="flex items-center gap-6 whitespace-nowrap">
      <span className="font-display font-bold text-sm uppercase tracking-[0.2em]">
        {item}
      </span>
      <span className="text-white/60 text-lg">◆</span>
    </span>
  ))

  return (
    <div className="bg-brand-orange overflow-hidden py-4 relative text-white">
      <div className="flex animate-marquee gap-6">
        <div className="flex gap-6 shrink-0">{content}</div>
        <div className="flex gap-6 shrink-0" aria-hidden>{content}</div>
      </div>
    </div>
  )
}
