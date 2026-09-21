import { useMemo, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { downloadSaveFile, parseSaveJSON, persistNow } from '../../db/persistence'
import { ArrowLeftIcon, TrashIcon } from '../../components/icons'
import { Avatar } from '../../components/Avatar'
import { fileToAvatarDataUrl } from '../../components/imageUpload'
import { AIProviderSetup } from '../../components/AIProviderSetup'
import { getProviderConfig } from '../../ai/keyStorage'
import { usageToday } from '../../ai/budget'
import { isNPC, type Avatar as AvatarType } from '../../types'

interface SettingsProps {
  onBack: () => void
}

export function Settings({ onBack }: SettingsProps) {
  const settings = useGameStore((s) => s.settings)
  const setAiEnabled = useGameStore((s) => s.setAiEnabled)
  const setActiveProviderId = useGameStore((s) => s.setActiveProviderId)
  const resetWorld = useGameStore((s) => s.resetWorld)
  const hydrateFromSave = useGameStore((s) => s.hydrateFromSave)
  const toSaveGame = useGameStore((s) => s.toSaveGame)
  const profiles = useGameStore((s) => s.profiles)
  const addCustomPerson = useGameStore((s) => s.addCustomPerson)
  const removeCustomPerson = useGameStore((s) => s.removeCustomPerson)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [confirmingReset, setConfirmingReset] = useState(false)

  const customPeople = useMemo(
    () => Object.values(profiles).filter(isNPC).filter((n) => n.custom),
    [profiles],
  )
  const [personName, setPersonName] = useState('')
  const [personUsername, setPersonUsername] = useState('')
  const [personBio, setPersonBio] = useState('')
  const [personFollowers, setPersonFollowers] = useState('')
  const [personAvatar, setPersonAvatar] = useState<AvatarType | undefined>(undefined)
  const [personMessage, setPersonMessage] = useState<string | null>(null)
  const personAvatarInputRef = useRef<HTMLInputElement>(null)

  const handlePersonAvatarFile = async (file: File | undefined) => {
    if (!file) return
    try {
      const dataUrl = await fileToAvatarDataUrl(file)
      setPersonAvatar({ kind: 'webp', value: dataUrl })
    } catch {
      setPersonMessage("Couldn't use that picture — try a different one.")
    }
  }

  const handleAddPerson = () => {
    if (!personName.trim()) {
      setPersonMessage('Give them a name first.')
      return
    }
    addCustomPerson({
      displayName: personName.trim(),
      username: personUsername.trim() || personName.trim().toLowerCase().replace(/\s+/g, ''),
      bio: personBio.trim(),
      followers: Number(personFollowers.replace(/[^0-9]/g, '')) || undefined,
      avatar: personAvatar,
    })
    setPersonName('')
    setPersonUsername('')
    setPersonBio('')
    setPersonFollowers('')
    setPersonAvatar(undefined)
    if (personAvatarInputRef.current) personAvatarInputRef.current.value = ''
    setPersonMessage(`Added ${personName.trim()} to your network.`)
  }

  // Fall back to the default preset id when looking up a saved key: the
  // localStorage key config is written the instant Save is clicked, but
  // settings.activeProviderId only reaches localStorage/IndexedDB via the
  // debounced game-save autosave, so a refresh shortly after saving can see
  // this field still unset even though the actual key is sitting right there.
  const DEFAULT_PRESET_ID = 'groq'

  const activeConfig = getProviderConfig(settings.activeProviderId)
  const usedToday = activeConfig ? usageToday(activeConfig.id) : 0
  const aiStatus = !settings.aiEnabled ? 'off' : !activeConfig ? 'not configured' : 'on'

  const handleExport = () => {
    downloadSaveFile(toSaveGame())
    setMessage('Save exported.')
  }

  const handleImportClick = () => fileInputRef.current?.click()

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const text = await file.text()
    const result = parseSaveJSON(text)
    if (!result.ok || !result.save) {
      setMessage(result.error ?? 'Import failed.')
      return
    }
    hydrateFromSave(result.save)
    await persistNow(result.save)
    setMessage('Save imported.')
  }

  const handleReset = async () => {
    resetWorld()
    await persistNow(useGameStore.getState().toSaveGame())
    setConfirmingReset(false)
    setMessage('World reset.')
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/90">
        <button onClick={onBack} className="rounded-full p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Settings</h1>
      </div>

      <div className="px-4 py-4">

      <section className="mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-neutral-500">AI-powered DMs & comments</h2>
          <span
            className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
              aiStatus === 'on'
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                : aiStatus === 'not configured'
                  ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300'
                  : 'bg-neutral-100 text-neutral-500 dark:bg-neutral-800'
            }`}
          >
            {aiStatus}
          </span>
        </div>
        <p className="mt-2 text-sm text-neutral-500">
          Bring your own free API key and NPCs will reply to your DMs with real AI, in character — and every
          comment on your posts reacts to what you actually said, sometimes bringing up recent gossip too.
          Without a key, DMs and comments still work using built-in personality-flavored templates.
        </p>

        <div className="mt-3 flex items-center gap-2">
          <span className="text-sm font-medium">Enable AI replies</span>
          <button
            onClick={() => setAiEnabled(!settings.aiEnabled)}
            className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
              settings.aiEnabled
                ? 'bg-emerald-600 text-white'
                : 'border border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400'
            }`}
          >
            {settings.aiEnabled ? 'On' : 'Off'}
          </button>
        </div>

        <div className="mt-4">
          <AIProviderSetup
            initialPresetId={settings.activeProviderId ?? DEFAULT_PRESET_ID}
            onSaved={(config) => {
              setActiveProviderId(config.id)
              setAiEnabled(true)
            }}
            onRemoved={() => {
              setActiveProviderId(undefined)
              setAiEnabled(false)
            }}
          />

          {activeConfig && (
            <p className="mt-2 text-xs text-neutral-500">
              Usage today: {usedToday} / {activeConfig.rpdBudget} calls to {activeConfig.name}
            </p>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-500">People</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Add a person to your network — a partner, a rival, a tabloid account, anyone — and they'll show up in
          your feed, comment, DM, and be available for Activities. What they post and how they relate to you is
          inferred from their name and bio (e.g. a bio like "tabloid celeb news" posts gossip). Only people you
          add here can be removed.
        </p>

        <div className="mt-3 grid gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => personAvatarInputRef.current?.click()}
              aria-label="Add a picture"
              className="shrink-0 cursor-pointer rounded-full"
            >
              {personAvatar ? (
                <Avatar avatar={personAvatar} seed="new-person" size={48} />
              ) : (
                <div className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-neutral-300 text-xs text-neutral-500 dark:border-neutral-700">
                  Photo
                </div>
              )}
            </button>
            <input
              ref={personAvatarInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handlePersonAvatarFile(e.target.files?.[0])}
            />
            {personAvatar && (
              <button
                type="button"
                onClick={() => {
                  setPersonAvatar(undefined)
                  if (personAvatarInputRef.current) personAvatarInputRef.current.value = ''
                }}
                className="cursor-pointer text-xs font-medium text-neutral-500 underline underline-offset-2"
              >
                Remove picture
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-600 dark:text-neutral-400">Name</span>
              <input
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Their name"
                className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-600 dark:text-neutral-400">Handle</span>
              <input
                value={personUsername}
                onChange={(e) => setPersonUsername(e.target.value)}
                placeholder="optional"
                className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-600 dark:text-neutral-400">Bio</span>
            <input
              value={personBio}
              onChange={(e) => setPersonBio(e.target.value)}
              placeholder="Who are they? e.g. Tabloid celeb news"
              className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-600 dark:text-neutral-400">Followers</span>
            <input
              inputMode="numeric"
              value={personFollowers}
              onChange={(e) => setPersonFollowers(e.target.value)}
              placeholder="optional, e.g. 30000000"
              className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700"
            />
          </label>

          <button
            onClick={handleAddPerson}
            className="cursor-pointer justify-self-start rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
          >
            Add person
          </button>

          {personMessage && <p className="text-sm text-neutral-600 dark:text-neutral-400">{personMessage}</p>}
        </div>

        {customPeople.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {customPeople.map((npc) => (
              <div
                key={npc.id}
                className="flex items-center gap-3 rounded-xl border border-neutral-200 p-2 dark:border-neutral-800"
              >
                <Avatar avatar={npc.avatar} seed={npc.id} size={36} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{npc.displayName}</p>
                  <p className="truncate text-xs text-neutral-500">@{npc.username}</p>
                </div>
                <button
                  onClick={() => removeCustomPerson(npc.id)}
                  aria-label={`Remove ${npc.displayName}`}
                  className="shrink-0 cursor-pointer rounded-full p-2 text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/40"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-500">Save data</h2>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            onClick={handleExport}
            className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium dark:border-neutral-700"
          >
            Export save
          </button>
          <button
            onClick={handleImportClick}
            className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium dark:border-neutral-700"
          >
            Import save
          </button>
          <input ref={fileInputRef} type="file" accept="application/json" className="hidden" onChange={handleImportFile} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-500">Danger zone</h2>
        {!confirmingReset ? (
          <button
            onClick={() => setConfirmingReset(true)}
            className="mt-2 rounded-full border border-rose-400 px-4 py-1.5 text-sm font-medium text-rose-600 dark:text-rose-400"
          >
            Start a new profile
          </button>
        ) : (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-sm text-neutral-600 dark:text-neutral-400">
              This deletes your save and sends you back to career selection. Are you sure?
            </span>
            <button
              onClick={handleReset}
              className="rounded-full bg-rose-600 px-4 py-1.5 text-sm font-medium text-white"
            >
              Yes, reset
            </button>
            <button
              onClick={() => setConfirmingReset(false)}
              className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium dark:border-neutral-700"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      {message && <p className="mt-6 text-sm text-neutral-500">{message}</p>}
      </div>
    </div>
  )
}
