import { useMemo, useRef, useState } from 'react'
import { useGameStore } from '../../store/gameStore'
import { downloadSaveFile, parseSaveJSON, persistNow } from '../../db/persistence'
import { ArrowLeftIcon, TrashIcon } from '../../components/icons'
import { Avatar } from '../../components/Avatar'
import { PROVIDER_PRESETS, presetById, isModelIdAllowed } from '../../ai/presets'
import { getProviderConfig, upsertProviderConfig, removeProviderConfig } from '../../ai/keyStorage'
import { usageToday } from '../../ai/budget'
import { createOpenAICompatibleProvider, AIRequestError } from '../../ai/openaiCompatible'
import { isNPC, type AIProviderConfig, type Persona, type RelationshipVibe } from '../../types'

const PERSONA_OPTIONS: { value: Persona; label: string }[] = [
  { value: 'loyal_fan', label: 'Loyal fan' },
  { value: 'hater', label: 'Hater' },
  { value: 'rival', label: 'Rival' },
  { value: 'teammate', label: 'Teammate' },
  { value: 'coach', label: 'Coach' },
  { value: 'agent', label: 'Agent' },
  { value: 'meme_account', label: 'Meme account' },
  { value: 'match_reporter', label: 'Reporter' },
  { value: 'insider', label: 'Insider' },
  { value: 'tabloid', label: 'Tabloid' },
]

const VIBE_OPTIONS: { value: RelationshipVibe; label: string }[] = [
  { value: 'friend', label: 'Friend' },
  { value: 'romantic', label: 'Romantic partner' },
  { value: 'rival', label: 'Rival' },
  { value: 'mentor', label: 'Mentor' },
  { value: 'teammate_bond', label: 'Teammate' },
  { value: 'fan', label: 'Fan' },
  { value: 'frenemy', label: 'Frenemy' },
]

interface SettingsProps {
  onBack: () => void
}

export function Settings({ onBack }: SettingsProps) {
  const settings = useGameStore((s) => s.settings)
  const setTheme = useGameStore((s) => s.setTheme)
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
  const [personPersona, setPersonPersona] = useState<Persona>('loyal_fan')
  const [personVibe, setPersonVibe] = useState<RelationshipVibe>('friend')
  const [personMessage, setPersonMessage] = useState<string | null>(null)

  const handleAddPerson = () => {
    if (!personName.trim()) {
      setPersonMessage('Give them a name first.')
      return
    }
    addCustomPerson({
      displayName: personName.trim(),
      username: personUsername.trim() || personName.trim().toLowerCase().replace(/\s+/g, ''),
      bio: personBio.trim(),
      persona: personPersona,
      vibe: personVibe,
    })
    setPersonName('')
    setPersonUsername('')
    setPersonBio('')
    setPersonPersona('loyal_fan')
    setPersonVibe('friend')
    setPersonMessage(`Added ${personName.trim()} to your network.`)
  }

  const DEFAULT_PRESET_ID = 'groq'
  // Fall back to the default preset id when looking up a saved key: the
  // localStorage key config is written the instant Save is clicked, but
  // settings.activeProviderId only reaches localStorage/IndexedDB via the
  // debounced game-save autosave, so a refresh shortly after saving can see
  // this field still unset even though the actual key is sitting right there.
  const existingConfig = getProviderConfig(settings.activeProviderId ?? DEFAULT_PRESET_ID)
  const [presetId, setPresetId] = useState(existingConfig?.id ?? DEFAULT_PRESET_ID)
  const preset = presetById(presetId) ?? PROVIDER_PRESETS[0]
  const [baseUrl, setBaseUrl] = useState(existingConfig?.baseUrl ?? preset.baseUrl)
  const [model, setModel] = useState(existingConfig?.model ?? preset.defaultModel)
  const [apiKey, setApiKey] = useState(existingConfig?.apiKey ?? '')
  const [aiMessage, setAiMessage] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(existingConfig ? existingConfig.id !== DEFAULT_PRESET_ID : false)

  const handlePresetChange = (id: string) => {
    setPresetId(id)
    const p = presetById(id) ?? PROVIDER_PRESETS[0]
    const stored = getProviderConfig(id)
    setBaseUrl(stored?.baseUrl ?? p.baseUrl)
    setModel(stored?.model ?? p.defaultModel)
    setApiKey(stored?.apiKey ?? '')
    setAiMessage(null)
  }

  const buildConfig = (): AIProviderConfig => ({
    id: presetId,
    name: preset.name,
    baseUrl: baseUrl.trim(),
    apiKey: apiKey.trim(),
    model: model.trim(),
    rpmBudget: preset.defaultRpmBudget,
    rpdBudget: preset.defaultRpdBudget,
  })

  const handleSaveProvider = () => {
    if (!apiKey.trim() && presetId !== 'ollama') {
      setAiMessage('Enter an API key first.')
      return
    }
    if (!isModelIdAllowed(presetId, model)) {
      setAiMessage('OpenRouter model ids must end in ":free" — only free models are allowed here.')
      return
    }
    const config = buildConfig()
    upsertProviderConfig(config)
    setActiveProviderId(config.id)
    setAiEnabled(true)
    setAiMessage('AI provider saved and enabled.')
  }

  const handleRemoveProvider = () => {
    removeProviderConfig(presetId)
    if (settings.activeProviderId === presetId) {
      setActiveProviderId(undefined)
      setAiEnabled(false)
    }
    setApiKey('')
    setAiMessage('Provider removed.')
  }

  const handleTestConnection = async () => {
    if (!apiKey.trim() && presetId !== 'ollama') {
      setAiMessage('Enter an API key first.')
      return
    }
    if (!isModelIdAllowed(presetId, model)) {
      setAiMessage('OpenRouter model ids must end in ":free" — only free models are allowed here.')
      return
    }
    setTesting(true)
    setAiMessage(null)
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 12_000)
    try {
      const provider = createOpenAICompatibleProvider(buildConfig())
      await provider.complete({
        system: 'You are a connection test. Reply with the single word OK.',
        user: 'Say OK.',
        maxTokens: 300,
        signal: controller.signal,
      })
      setAiMessage('Connection works!')
    } catch (err) {
      const reason =
        err instanceof AIRequestError
          ? err.message
          : err instanceof DOMException && err.name === 'AbortError'
            ? 'Timed out after 12s.'
            : 'Could not reach the endpoint.'
      setAiMessage(`Test failed: ${reason}`)
    } finally {
      clearTimeout(timeout)
      setTesting(false)
    }
  }

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
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-neutral-200 bg-white/90 px-4 py-2 backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/90">
        <button onClick={onBack} className="rounded-full p-2.5 hover:bg-neutral-100 dark:hover:bg-neutral-800">
          <ArrowLeftIcon className="h-5 w-5" />
        </button>
        <h1 className="text-lg font-bold">Settings</h1>
      </div>

      <div className="px-4 py-4">

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-500">Theme</h2>
        <div className="mt-2 flex gap-2">
          {(['system', 'light', 'dark'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              className={`rounded-full px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                settings.theme === t
                  ? 'bg-neutral-900 text-white dark:bg-white dark:text-neutral-900'
                  : 'border border-neutral-300 text-neutral-700 dark:border-neutral-700 dark:text-neutral-300'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </section>

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

        <div className="mt-4 grid gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-neutral-600 dark:text-neutral-400">
              Groq API key
            </span>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="sk-..."
              autoComplete="off"
              className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 font-mono text-xs dark:border-neutral-700"
            />
            <span className="text-xs text-neutral-500">
              Get a free key at console.groq.com. Stored only on this device, never in your save
              file.
            </span>
          </label>

          <button
            onClick={() => setShowAdvanced((v) => !v)}
            className="justify-self-start text-xs font-medium text-neutral-500 underline underline-offset-2"
          >
            {showAdvanced ? 'Hide advanced options' : 'Use a different provider'}
          </button>

          {showAdvanced && (
            <>
              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-neutral-600 dark:text-neutral-400">Provider</span>
                <select
                  value={presetId}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 dark:border-neutral-700"
                >
                  {PROVIDER_PRESETS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
                <span className="text-xs text-neutral-500">{preset.notes}</span>
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-neutral-600 dark:text-neutral-400">Base URL</span>
                <input
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                  placeholder="https://api.example.com/v1"
                  className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 font-mono text-xs dark:border-neutral-700"
                />
              </label>

              <label className="flex flex-col gap-1 text-sm">
                <span className="font-medium text-neutral-600 dark:text-neutral-400">Model</span>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  placeholder={preset.defaultModel}
                  className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 font-mono text-xs dark:border-neutral-700"
                />
                {presetId === 'openrouter' && (
                  <span className="text-xs text-amber-600 dark:text-amber-400">
                    Must end in ":free" — other OpenRouter models may bill.
                  </span>
                )}
              </label>
            </>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleSaveProvider}
              className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
            >
              Save & enable
            </button>
            <button
              onClick={handleTestConnection}
              disabled={testing}
              className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
            >
              {testing ? 'Testing…' : 'Test connection'}
            </button>
            <button
              onClick={handleRemoveProvider}
              className="rounded-full border border-rose-400 px-4 py-1.5 text-sm font-medium text-rose-600 dark:text-rose-400"
            >
              Remove key
            </button>
          </div>

          {aiMessage && <p className="text-sm text-neutral-600 dark:text-neutral-400">{aiMessage}</p>}

          {activeConfig && (
            <p className="text-xs text-neutral-500">
              Usage today: {usedToday} / {activeConfig.rpdBudget} calls to {activeConfig.name}
            </p>
          )}
        </div>
      </section>

      <section className="mt-6">
        <h2 className="text-sm font-semibold text-neutral-500">People</h2>
        <p className="mt-2 text-sm text-neutral-500">
          Add a person to your network — a partner, a rival, a friend — and they'll show up in your feed,
          comment, DM, and be available for Activities. Only people you add here can be removed.
        </p>

        <div className="mt-3 grid gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
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
              <span className="font-medium text-neutral-600 dark:text-neutral-400">Username</span>
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
              placeholder="Who are they?"
              className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700"
            />
          </label>

          <div className="grid grid-cols-2 gap-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-600 dark:text-neutral-400">Public role</span>
              <select
                value={personPersona}
                onChange={(e) => setPersonPersona(e.target.value as Persona)}
                className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700"
              >
                {PERSONA_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="font-medium text-neutral-600 dark:text-neutral-400">Relationship</span>
              <select
                value={personVibe}
                onChange={(e) => setPersonVibe(e.target.value as RelationshipVibe)}
                className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 text-sm dark:border-neutral-700"
              >
                {VIBE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

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
