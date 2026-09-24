import { useEffect, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import type { OutcomeReport } from '../store/gameStore'
import { isNPC } from '../types'
import { formatCompactNumber } from './formatCompactNumber'
import { Avatar } from './Avatar'
import { relationshipLabel, statLabel, tagPhrase } from '../engine/reportDetails'

const STAT_META: Record<string, { emoji: string; label: string }> = {
  humor: { emoji: '😂', label: 'Humor' },
  aura: { emoji: '🌟', label: 'Aura' },
}

interface OutcomeBannerProps {
  report: OutcomeReport
  onDismiss: () => void
  onOpenProfile: (profileId: string) => void
}

// The "report card" shown after posting, ending an activity, or resolving
// an event — XP, the biggest stat swing (as a % bar with a one-line reason,
// since humor/aura are already a 0-100 scale), everything else that moved,
// and who noticed. See OutcomeReport (store/gameStore.ts).
export function OutcomeBanner({ report, onDismiss, onOpenProfile }: OutcomeBannerProps) {
  const player = useGameStore((s) => s.player)
  const profiles = useGameStore((s) => s.profiles)

  // Tap the card to open the full report; while it's open it stays put
  // (no auto-dismiss) so there's time to actually read it.
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (expanded) return
    const timer = setTimeout(onDismiss, 7000)
    return () => clearTimeout(timer)
  }, [onDismiss, expanded])

  // One entry per stat with every effect on it summed, so the headline
  // number always matches the full report's.
  const totals = new Map<string, number>()
  for (const d of report.statDeltas) {
    if (d.type === 'stat' && (d.target === 'humor' || d.target === 'aura')) {
      totals.set(d.target, (totals.get(d.target) ?? 0) + d.delta)
    }
  }
  const statChanges = [...totals.entries()]
    .filter(([, delta]) => delta !== 0)
    .map(([target, delta]) => ({ type: 'stat' as const, target, delta }))
  // Whichever stat swung hardest gets the big bar; the rest fold into the
  // small chip row below along with followers.
  const primary = [...statChanges].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0]
  const secondaryStats = statChanges.filter((d) => d !== primary)
  const primaryValue = primary?.target === 'humor' ? player.humor : primary?.target === 'aura' ? player.aura : undefined

  return (
    <div
      onClick={report.details ? () => setExpanded((v) => !v) : undefined}
      className={`mx-3 mt-3 flex max-h-[80dvh] w-[calc(100%-1.5rem)] flex-col gap-2 overflow-y-auto rounded-2xl border border-neutral-200 bg-white p-3 text-left shadow-lg dark:border-neutral-700 dark:bg-neutral-900 ${report.details ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-sm font-semibold text-amber-500">
          ✨ +{report.xpGained} XP
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDismiss()
          }}
          aria-label="Dismiss"
          className="cursor-pointer rounded-full p-1 text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
        >
          ×
        </button>
      </div>

      {primary && primaryValue !== undefined && (
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1 font-medium text-neutral-900 dark:text-neutral-100">
              {STAT_META[primary.target ?? '']?.emoji} {STAT_META[primary.target ?? '']?.label}
            </span>
            <span className={`font-semibold ${primary.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
              {primary.delta >= 0 ? '+' : ''}
              {primary.delta}%
            </span>
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <div className="h-2 flex-1 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
              <div
                className={`h-full rounded-full ${primary.delta >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                style={{ width: `${Math.max(0, Math.min(100, primaryValue))}%` }}
              />
            </div>
            <span className="shrink-0 text-xs font-semibold text-neutral-500">{primaryValue}%</span>
          </div>
          {report.reason && <p className="mt-1 text-xs text-neutral-500">{report.reason}</p>}
        </div>
      )}

      {(secondaryStats.length > 0 || report.followerDelta !== 0) && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
          {report.followerDelta !== 0 && (
            <span
              className={`flex items-center gap-1 font-medium ${report.followerDelta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
            >
              👥 Followers {report.followerDelta >= 0 ? '↑' : '↓'} {formatCompactNumber(Math.abs(report.followerDelta))}
            </span>
          )}
          {secondaryStats.map((effect, i) => (
            <span
              key={i}
              className={`flex items-center gap-1 font-medium ${effect.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
            >
              {STAT_META[effect.target ?? '']?.emoji} {STAT_META[effect.target ?? '']?.label}{' '}
              {effect.delta >= 0 ? '↑' : '↓'}
            </span>
          ))}
        </div>
      )}

      {report.relationshipChanges.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {report.relationshipChanges.map(({ npcId, delta }) => {
            const npc = profiles[npcId]
            if (!npc || !isNPC(npc)) return null
            return (
              <button
                key={npcId}
                onClick={(e) => {
                  e.stopPropagation()
                  onOpenProfile(npcId)
                }}
                className="flex cursor-pointer items-center gap-1 rounded-full bg-neutral-100 py-0.5 pl-0.5 pr-2 text-xs font-medium hover:bg-neutral-200 dark:bg-neutral-800 dark:hover:bg-neutral-700"
              >
                <Avatar avatar={npc.avatar} seed={npc.id} size={20} />
                <span className="max-w-20 truncate">{npc.displayName}</span>
                <span className={delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
                  {delta >= 0 ? '↑' : '↓'}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {report.commentCount !== undefined && (
        <p className="text-xs text-neutral-500">
          {report.commentCount} {report.commentCount === 1 ? 'reply' : 'replies'} coming in
        </p>
      )}

      {report.details && !expanded && (
        <p className="text-center text-[11px] font-medium text-sky-500">Tap for the full report ▾</p>
      )}
      {report.details && expanded && <ExpandedReport report={report} onOpenProfile={onOpenProfile} />}
    </div>
  )
}

function ExpandedReport({ report, onOpenProfile }: { report: OutcomeReport; onOpenProfile: (profileId: string) => void }) {
  const profiles = useGameStore((s) => s.profiles)
  const details = report.details
  if (!details) return null

  return (
    <div className="mt-1 flex flex-col gap-3 border-t border-neutral-200 pt-3 text-sm dark:border-neutral-800">
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">What happened</h3>
        <p className="mt-1 text-neutral-800 dark:text-neutral-200">{details.summary}</p>
      </section>

      {details.statReasons.length === 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Your stats</h3>
          <p className="mt-1 text-xs text-neutral-500">Nothing about this stood out enough to move your Humor, Aura or followers.</p>
        </section>
      )}

      {details.statReasons.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Why your stats moved</h3>
          <ul className="mt-1 flex flex-col gap-2">
            {details.statReasons.map((r) => (
              <li key={r.stat}>
                <span
                  className={`font-semibold ${r.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                >
                  {statLabel(r.stat)} {r.delta >= 0 ? '+' : ''}
                  {r.stat === 'followers' ? formatCompactNumber(r.delta) : `${r.delta}%`}
                </span>
                {r.reason && <span className="block text-xs text-neutral-500">{r.reason}</span>}
              </li>
            ))}
          </ul>
        </section>
      )}

      {details.relationships.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Relationships</h3>
          <ul className="mt-1 flex flex-col gap-3">
            {details.relationships.map((rel) => {
              const npc = profiles[rel.npcId]
              if (!npc || !isNPC(npc)) return null
              return (
                <li key={rel.npcId}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenProfile(rel.npcId)
                    }}
                    className="flex w-full cursor-pointer items-center gap-2 text-left"
                  >
                    <Avatar avatar={npc.avatar} seed={npc.id} size={28} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{npc.displayName}</span>
                      <span className="block text-xs text-neutral-500">
                        {rel.before}% → {rel.after}% · {relationshipLabel(rel.after)}
                        {relationshipLabel(rel.before) !== relationshipLabel(rel.after) &&
                          ` (was ${relationshipLabel(rel.before)})`}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 text-xs font-semibold ${rel.delta >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}
                    >
                      {rel.delta >= 0 ? '+' : ''}
                      {rel.delta}
                    </span>
                  </button>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
                    <div
                      className={`h-full rounded-full ${rel.after >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                      style={{ width: `${Math.max(2, Math.min(100, Math.abs(rel.after)))}%` }}
                    />
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">{rel.reason}</p>
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {details.signals.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">What people picked up on</h3>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {details.signals.map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300"
              >
                {tagPhrase(tag)}
              </span>
            ))}
          </div>
        </section>
      )}

      {details.buzz && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Buzz</h3>
          <p className="mt-1 text-neutral-800 dark:text-neutral-200">{details.buzz}</p>
        </section>
      )}

      <p className="text-center text-[11px] font-medium text-sky-500">Tap to collapse ▴</p>
    </div>
  )
}
