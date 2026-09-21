import { useEffect } from 'react'
import type { Effect } from '../types'
import type { PostOutcome } from '../store/gameStore'

const compactFormatter = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

function labelFor(effect: Effect): string {
  switch (effect.type) {
    case 'followers':
      return 'Followers'
    case 'stat':
      return effect.target ? effect.target[0].toUpperCase() + effect.target.slice(1) : 'Stat'
    default:
      return effect.type
  }
}

function formatDelta(effect: Effect): string {
  const sign = effect.delta >= 0 ? '+' : ''
  if (effect.type === 'followers' && Math.abs(effect.delta) >= 1000) {
    return `${sign}${compactFormatter.format(effect.delta)}`
  }
  return `${sign}${effect.delta}`
}

interface OutcomeBannerProps {
  outcome: PostOutcome
  onDismiss: () => void
}

export function OutcomeBanner({ outcome, onDismiss }: OutcomeBannerProps) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  // Skip zero-delta effects — nothing to show, no point cluttering the banner.
  const visibleDeltas = outcome.statDeltas.filter((d) => d.delta !== 0)

  return (
    <button
      onClick={onDismiss}
      className="mx-3 mt-3 flex w-[calc(100%-1.5rem)] flex-col gap-1.5 rounded-2xl border border-neutral-200 bg-white p-3 text-left shadow-lg dark:border-neutral-700 dark:bg-neutral-900"
    >
      <p className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
        Posted — {outcome.commentCount} {outcome.commentCount === 1 ? 'reply' : 'replies'} coming in
      </p>
      {visibleDeltas.length > 0 && (
        <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
          {visibleDeltas.map((effect, i) => {
            const isGood = effect.delta >= 0
            return (
              <span key={i} className={isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                {formatDelta(effect)} {labelFor(effect)}
              </span>
            )
          })}
        </div>
      )}
    </button>
  )
}
