import { useMemo, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { CAREER_PACKS } from '../../content/careers'
import { extractOrgFromBio, extractRoleFromBio, inferCareerFromBio } from '../../engine/careerInference'
import { AIProviderSetup } from '../../components/AIProviderSetup'
import { loadProviderConfigs } from '../../ai/keyStorage'

type Step = 'ai-choice' | 'ai-setup' | 'profile'

export function Onboarding() {
  const completeOnboarding = useGameStore((s) => s.completeOnboarding)
  // Always starts here, every time a profile is created — even for a
  // returning player who configured AI before, so the choice (and a chance
  // to update/verify the key) is never silently skipped.
  const [step, setStep] = useState<Step>('ai-choice')
  const hasExistingProvider = loadProviderConfigs().length > 0
  const [displayName, setDisplayName] = useState('')
  const [username, setUsername] = useState('')
  const [bio, setBio] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const career = useMemo(() => inferCareerFromBio(bio), [bio])
  const pack = CAREER_PACKS[career]
  // Only what's actually in the bio — never a stand-in. '' means "player
  // didn't say", and it stays that way all the way into PlayerState.
  const role = useMemo(() => extractRoleFromBio(bio, career), [bio, career])
  const org = useMemo(() => extractOrgFromBio(bio), [bio])
  const hasSignal = bio.trim().length >= 6

  const canSubmit = displayName.trim().length > 0 && username.trim().length > 0 && bio.trim().length > 0 && !submitting

  const handleSubmit = async () => {
    if (!canSubmit) return
    setSubmitting(true)
    try {
      await completeOnboarding({
        career,
        displayName: displayName.trim(),
        username: username.trim().replace(/^@/, '').replace(/\s+/g, ''),
        bio: bio.trim(),
        role: role ?? '',
        org: org ?? '',
      })
    } finally {
      // Only matters if completeOnboarding throws — on success this screen
      // unmounts before the reset would ever be seen.
      setSubmitting(false)
    }
  }

  if (step === 'ai-choice') {
    return (
      <div className="flex h-full flex-col overflow-y-auto bg-white dark:bg-neutral-900">
        <div className="mx-auto w-full max-w-md flex-1 px-6 py-10">
          <h1 className="text-2xl font-bold">Bring your own AI?</h1>
          <p className="mt-1 text-sm text-neutral-500">
            With a free AI key connected, the people who follow, comment on, and DM you are generated to fit what
            you write in your bio — including real public figures where relevant — and every reply reacts to what
            you actually said. Without one, you still get a full cast of realistic (invented) accounts and
            personality-flavored template replies.
          </p>
          {hasExistingProvider && (
            <p className="mt-2 text-sm text-emerald-600 dark:text-emerald-400">
              You already have a provider saved on this device — pick "Connect" to reuse or update it.
            </p>
          )}

          <div className="mt-8 flex flex-col gap-3">
            <button
              onClick={() => setStep('ai-setup')}
              className="rounded-xl border border-neutral-300 px-4 py-3 text-left text-sm font-semibold hover:border-blue-500 dark:border-neutral-700"
            >
              {hasExistingProvider ? 'Connect (use saved key)' : 'Connect an AI provider'}
              <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                Free key, takes a minute — you can test the connection before continuing.
              </span>
            </button>
            <button
              onClick={() => setStep('profile')}
              className="rounded-xl border border-neutral-300 px-4 py-3 text-left text-sm font-semibold hover:border-blue-500 dark:border-neutral-700"
            >
              Continue without AI
              <span className="mt-0.5 block text-xs font-normal text-neutral-500">
                You can still connect one later from Settings.
              </span>
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'ai-setup') {
    return (
      <div className="flex h-full flex-col overflow-y-auto bg-white dark:bg-neutral-900">
        <div className="mx-auto w-full max-w-md flex-1 px-6 py-10">
          <button
            onClick={() => setStep('ai-choice')}
            className="text-xs font-medium text-neutral-500 underline underline-offset-2"
          >
            Back
          </button>
          <h1 className="mt-3 text-2xl font-bold">Connect your AI provider</h1>
          <p className="mt-1 text-sm text-neutral-500">
            Enter your key and press "Save & continue" — that's the only step that moves you forward from here, so
            your key is never lost by clicking away.
          </p>

          <div className="mt-6">
            <AIProviderSetup saveLabel="Save & continue" showRemove={false} onSaved={() => setStep('profile')} />
          </div>

          <button
            onClick={() => setStep('profile')}
            className="mt-4 w-full text-center text-xs font-medium text-neutral-500 underline underline-offset-2"
          >
            Skip for now, continue without AI
          </button>
        </div>
      </div>
    )
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
            {submitting ? 'Building your world…' : 'Enter the feed'}
          </button>
        </div>
      </div>
    </div>
  )
}
