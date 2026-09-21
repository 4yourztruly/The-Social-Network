import { useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { msUntilNextEvent } from '../../engine/eventCooldown'
import { SparkleIcon } from '../../components/icons'

// Floating action button — a quick, spontaneous decision (unlike the
// Activity tab's player-authored scenes). Positioned inside the app shell's
// own relative container (not viewport-fixed), so it stays aligned with the
// centered card on desktop instead of drifting to the raw screen edge.
export function EventButton() {
  const triggerRandomEncounter = useGameStore((s) => s.triggerRandomEncounter)
  const activeEncounter = useGameStore((s) => s.activeEncounter)
  const [cooldownMessage, setCooldownMessage] = useState<string | null>(null)

  const handleClick = () => {
    const started = triggerRandomEncounter()
    if (!started) {
      const minutes = Math.ceil(msUntilNextEvent() / 60_000)
      setCooldownMessage(`Next event in ~${minutes}m`)
      setTimeout(() => setCooldownMessage(null), 2000)
    }
  }

  if (activeEncounter) return null

  return (
    <div className="absolute right-4 z-40 bottom-[calc(5rem_+_env(safe-area-inset-bottom))] md:bottom-6">
      {cooldownMessage && (
        <p className="mb-2 whitespace-nowrap rounded-full bg-neutral-900 px-3 py-1 text-xs text-white shadow-lg dark:bg-neutral-100 dark:text-neutral-900">
          {cooldownMessage}
        </p>
      )}
      <button
        onClick={handleClick}
        className="flex cursor-pointer items-center gap-1.5 rounded-full bg-gradient-to-r from-sky-500 to-blue-500 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105"
      >
        <SparkleIcon className="h-4 w-4" />
        Event
      </button>
    </div>
  )
}
