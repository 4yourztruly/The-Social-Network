import { useMemo, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { CAREER_PACKS } from '../../content/careers'
import { extractOrgFromBio, extractRoleFromBio, inferCareerFromBio } from '../../engine/careerInference'

export function Onboarding() {
  const completeOnboarding = useGameStore((s) => s.completeOnboarding)
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')

  const career = useMemo(() => inferCareerFromBio(bio), [bio])
  const pack = CAREER_PACKS[career]
  // Only what's actually in the bio — never a stand-in. '' means "player
  // didn't say", and it stays that way all the way into PlayerState.
  const role = useMemo(() => extractRoleFromBio(bio, career), [bio, career])
  const org = useMemo(() => extractOrgFromBio(bio), [bio])
  const hasSignal = bio.trim().length >= 6

  const canSubmit = displayName.trim().length > 0 && username.trim().length > 0 && bio.trim().length > 0

  const handleSubmit = () => {
    if (!canSubmit) return
    completeOnboarding({
      career,
      displayName: displayName.trim(),
      username: username.trim().replace(/^@/, '').replace(/\s+/g, ''),
      bio: bio.trim(),
      role: role ?? '',
      org: org ?? '',
    })
  }

  return (
    <div className="flex h-full flex-col overflow-y-auto bg-white dark:bg-neutral-900">
      <div className="mx-auto w-full max-w-md flex-1 px-6 py-10">
        <h1 className="text-2xl font-bold">Create your profile</h1>
        <p className="mt-1 text-sm text-neutral-500">
          Write your bio. What you write places you in your world — your role, your club, your
          feed and the media that covers you all follow from exactly what you say. Nothing is
          assumed.
        </p>

        <div className="mt-8 flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-neutral-500">Display name</span>
            <input
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value.slice(0, 40))}
              placeholder="Your name"
              className="rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-[15px] outline-none focus:border-blue-500 dark:border-neutral-700"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-neutral-500">Username</span>
            <div className="flex items-center gap-1 rounded-lg border border-neutral-300 px-3 py-2 focus-within:border-blue-500 dark:border-neutral-700">
              <span className="text-neutral-500">@</span>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value.slice(0, 24))}
                placeholder="yourhandle"
                className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
              />
            </div>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-neutral-500">Bio</span>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value.slice(0, 160))}
              placeholder="e.g. Right winger for Real Madrid and Sweden's national team. Or: independent rapper, just dropped my first mixtape."
              className="min-h-24 resize-none rounded-lg border border-neutral-300 bg-transparent px-3 py-2 text-[15px] outline-none focus:border-blue-500 dark:border-neutral-700"
            />
          </label>

          <div className="rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 text-sm dark:border-neutral-800 dark:bg-neutral-900">
            {hasSignal ? (
              <span>
                <span className="text-lg">{pack.emoji}</span> You'll land among the{' '}
                <span className="font-semibold">{pack.label.toLowerCase()}</span> crowd
                {role && (
                  <>
                    {' '}
                    as a <span className="font-semibold">{role}</span>
                  </>
                )}
                {org && (
                  <>
                    {' '}
                    at <span className="font-semibold">{org}</span>
                  </>
                )}
                .{!role && !org && " Mention a role or a club and we'll pick it up."}
              </span>
            ) : (
              <span className="text-neutral-500">Keep writing — your world will show up here.</span>
            )}
          </div>

          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="mt-2 rounded-full bg-neutral-900 py-2.5 text-sm font-semibold text-white transition-opacity disabled:opacity-40 dark:bg-white dark:text-neutral-900"
          >
            Enter the feed
          </button>
        </div>
      </div>
    </div>
  )
}
