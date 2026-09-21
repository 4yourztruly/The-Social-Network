interface CenteredBarProps {
  value: number // -100..100, 0 = neutral center
  className?: string
}

// A center-anchored gauge, matching the reference's stat/relationship
// bars: the fill starts at the middle and grows outward — rightward
// (amber fading to emerald, i.e. "yellow to green") for positive values,
// leftward (solid rose) for negative ones. Used for anything framed as
// above/below a neutral midpoint — Humor/Aura (centered on 50) and NPC
// relationships (already -100..100 natively).
export function CenteredBar({ value, className = '' }: CenteredBarProps) {
  const clamped = Math.max(-100, Math.min(100, value))
  const half = (Math.abs(clamped) / 100) * 50

  return (
    <div className={`relative h-2 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-700 ${className}`}>
      <div className="absolute inset-y-0 left-1/2 w-px bg-neutral-400 dark:bg-neutral-500" />
      {clamped >= 0 ? (
        <div
          className="absolute inset-y-0 rounded-full bg-gradient-to-r from-amber-500 to-emerald-500 transition-[width]"
          style={{ left: '50%', width: `${half}%` }}
        />
      ) : (
        <div
          className="absolute inset-y-0 rounded-full bg-rose-500 transition-[width]"
          style={{ right: '50%', width: `${half}%` }}
        />
      )}
    </div>
  )
}
