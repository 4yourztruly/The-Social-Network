interface CenteredBarProps {
  value: number // -100..100, 0 = neutral center
  className?: string
}

// The whole filled segment is one solid color determined by how far right
// of center the value sits — barely positive reads as yellow, strongly
// positive reads as green, with a smooth interpolation between (not a
// gradient smeared across the fill's own width, which read as "yellow at
// the base, green at the tip" regardless of the actual value). Negative
// values are always solid red.
function colorForValue(clamped: number): string {
  if (clamped <= 0) return 'var(--color-rose-500)'
  const t = Math.min(1, clamped / 100)
  const hue = 45 + t * (155 - 45) // 45deg ~ amber/yellow, 155deg ~ emerald
  return `hsl(${hue}deg 75% 45%)`
}

// A center-anchored gauge, matching the reference's stat/relationship
// bars: the fill starts at the middle and grows outward — rightward for
// positive values, leftward for negative ones. Used for anything framed
// as above/below a neutral midpoint — Humor/Aura (centered on 50) and
// NPC relationships (already -100..100 natively).
export function CenteredBar({ value, className = '' }: CenteredBarProps) {
  const clamped = Math.max(-100, Math.min(100, value))
  const half = (Math.abs(clamped) / 100) * 50

  return (
    <div className={`relative h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700 ${className}`}>
      <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-400 dark:bg-neutral-500" />
      <div
        className="absolute inset-y-0 rounded-full transition-[width]"
        style={{
          backgroundColor: colorForValue(clamped),
          ...(clamped >= 0 ? { left: '50%', width: `${half}%` } : { right: '50%', width: `${half}%` }),
        }}
      />
    </div>
  )
}
