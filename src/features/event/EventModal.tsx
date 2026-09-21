import { useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { isNPC } from '../../types'
import { Avatar } from '../../components/Avatar'
import { SparkleIcon } from '../../components/icons'

interface EventModalProps {
  onOpenProfile: (profileId: string) => void
}

const STAT_LABELS: Record<string, string> = {
  humor: 'Humor',
  aura: 'Aura',
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 py-2">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.3s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.15s]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" />
    </div>
  )
}

export function EventModal({ onOpenProfile }: EventModalProps) {
  const encounter = useGameStore((s) => s.activeEncounter)
  const celeb = useGameStore((s) => (encounter?.celebId ? s.profiles[encounter.celebId] : undefined))
  const resolveEncounterChoice = useGameStore((s) => s.resolveEncounterChoice)
  const resolveEncounterCustom = useGameStore((s) => s.resolveEncounterCustom)
  const dismissEncounter = useGameStore((s) => s.dismissEncounter)
  const [customText, setCustomText] = useState('')

  if (!encounter) return null

  const npc = celeb && isNPC(celeb) ? celeb : undefined
  // Four phases: generating the situation -> choices shown, awaiting a pick
  // -> resolving the outcome -> resolved. `loading` is reused for both the
  // situation and outcome AI calls; `choices.length` disambiguates which.
  const isGeneratingSituation = encounter.loading && encounter.choices.length === 0 && !encounter.resolution
  const isResolving = encounter.loading && encounter.choices.length > 0 && !encounter.resolution
  const showChoices = !encounter.loading && !encounter.resolution

  const handleCustom = () => {
    if (!customText.trim()) return
    resolveEncounterCustom(customText)
    setCustomText('')
  }

  return (
    <div className="absolute inset-0 z-[100] flex items-end justify-center bg-black/60 sm:items-center">
      <div className="w-full rounded-t-3xl bg-white p-5 dark:bg-neutral-900 sm:max-w-md sm:rounded-3xl">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-r from-sky-500 to-fuchsia-500">
            <SparkleIcon className="h-4 w-4 text-white" />
          </span>
          <h2 className="text-xs font-bold uppercase tracking-wide text-neutral-500">Event</h2>
        </div>

        {npc && (
          <button
            onClick={() => onOpenProfile(npc.id)}
            className="mt-3 flex cursor-pointer items-center gap-2 rounded-full bg-neutral-100 py-1 pl-1 pr-3 text-xs font-medium dark:bg-neutral-800"
          >
            <Avatar avatar={npc.avatar} seed={npc.id} size={22} />
            {npc.displayName}
          </button>
        )}

        {isGeneratingSituation ? (
          <div className="mt-4">
            <TypingDots />
          </div>
        ) : (
          <p className="mt-3 text-lg font-semibold leading-snug">{encounter.text}</p>
        )}

        {showChoices && (
          <div className="mt-4 flex flex-col gap-2">
            {encounter.choices.map((choice) => (
              <button
                key={choice.id}
                onClick={() => resolveEncounterChoice(choice.id)}
                className="cursor-pointer rounded-xl border border-neutral-200 px-4 py-3 text-left text-sm font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-800"
              >
                {choice.label}
              </button>
            ))}

            <div className="mt-1 flex items-center gap-2">
              <input
                value={customText}
                onChange={(e) => setCustomText(e.target.value.slice(0, 200))}
                onKeyDown={(e) => e.key === 'Enter' && handleCustom()}
                placeholder="Or write your own move..."
                className="min-w-0 flex-1 rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm placeholder-neutral-500 outline-none dark:border-neutral-700"
              />
              <button
                onClick={handleCustom}
                disabled={!customText.trim()}
                className="shrink-0 cursor-pointer rounded-full bg-neutral-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40 dark:bg-white dark:text-neutral-900"
              >
                Go
              </button>
            </div>
          </div>
        )}

        {isResolving && (
          <div className="mt-4">
            {encounter.pendingChoiceLabel && (
              <p className="text-sm font-medium text-neutral-500">You: {encounter.pendingChoiceLabel}</p>
            )}
            <TypingDots />
          </div>
        )}

        {encounter.resolution && (
          <div className="mt-4">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{encounter.resolution.text}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              {encounter.resolution.followerDelta !== 0 && (
                <span
                  className={`rounded-full px-2.5 py-1 font-semibold ${
                    encounter.resolution.followerDelta > 0
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                      : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                  }`}
                >
                  {encounter.resolution.followerDelta > 0 ? '+' : ''}
                  {encounter.resolution.followerDelta} followers
                </span>
              )}
              {encounter.resolution.statDeltas.map((d, i) => {
                const label = d.type === 'stat' ? (STAT_LABELS[d.target ?? ''] ?? d.target) : d.type
                const isGood = d.delta > 0
                return (
                  <span
                    key={i}
                    className={`rounded-full px-2.5 py-1 font-semibold ${
                      isGood
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300'
                    }`}
                  >
                    {d.delta > 0 ? '+' : ''}
                    {d.delta} {label}
                  </span>
                )
              })}
            </div>
            <button
              onClick={dismissEncounter}
              className="mt-4 w-full cursor-pointer rounded-full bg-neutral-900 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-neutral-900"
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
