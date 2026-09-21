import { useState } from 'react'
import { PROVIDER_PRESETS, presetById, isModelIdAllowed } from '../ai/presets'
import { getProviderConfig, upsertProviderConfig, removeProviderConfig } from '../ai/keyStorage'
import { createOpenAICompatibleProvider, AIRequestError } from '../ai/openaiCompatible'
import type { AIProviderConfig } from '../types'

interface AIProviderSetupProps {
  initialPresetId?: string
  onSaved?: (config: AIProviderConfig) => void
  onRemoved?: () => void
  showRemove?: boolean
  saveLabel?: string
}

const DEFAULT_PRESET_ID = 'groq'

// Shared between Settings (toggle AI mid-game) and Onboarding (opt in before
// the world is generated, so roster generation can actually use it) — same
// form, same validation, same "test connection" call, just different
// callers deciding what happens after a successful save.
export function AIProviderSetup({
  initialPresetId = DEFAULT_PRESET_ID,
  onSaved,
  onRemoved,
  showRemove = true,
  saveLabel = 'Save & enable',
}: AIProviderSetupProps) {
  const existingConfig = getProviderConfig(initialPresetId)
  const [presetId, setPresetId] = useState(existingConfig?.id ?? initialPresetId)
  const preset = presetById(presetId) ?? PROVIDER_PRESETS[0]
  const [baseUrl, setBaseUrl] = useState(existingConfig?.baseUrl ?? preset.baseUrl)
  const [model, setModel] = useState(existingConfig?.model ?? preset.defaultModel)
  const [apiKey, setApiKey] = useState(existingConfig?.apiKey ?? '')
  const [message, setMessage] = useState<string | null>(null)
  const [testing, setTesting] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(existingConfig ? existingConfig.id !== initialPresetId : false)

  const handlePresetChange = (id: string) => {
    setPresetId(id)
    const p = presetById(id) ?? PROVIDER_PRESETS[0]
    const stored = getProviderConfig(id)
    setBaseUrl(stored?.baseUrl ?? p.baseUrl)
    setModel(stored?.model ?? p.defaultModel)
    setApiKey(stored?.apiKey ?? '')
    setMessage(null)
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

  const handleSave = () => {
    if (!apiKey.trim() && presetId !== 'ollama') {
      setMessage('Enter an API key first.')
      return
    }
    if (!isModelIdAllowed(presetId, model)) {
      setMessage('OpenRouter model ids must end in ":free" — only free models are allowed here.')
      return
    }
    const config = buildConfig()
    upsertProviderConfig(config)
    setMessage('AI provider saved and enabled.')
    onSaved?.(config)
  }

  const handleRemove = () => {
    removeProviderConfig(presetId)
    setApiKey('')
    setMessage('Provider removed.')
    onRemoved?.()
  }

  const handleTestConnection = async () => {
    if (!apiKey.trim() && presetId !== 'ollama') {
      setMessage('Enter an API key first.')
      return
    }
    if (!isModelIdAllowed(presetId, model)) {
      setMessage('OpenRouter model ids must end in ":free" — only free models are allowed here.')
      return
    }
    setTesting(true)
    setMessage(null)
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
      setMessage('Connection works!')
    } catch (err) {
      const reason =
        err instanceof AIRequestError
          ? err.message
          : err instanceof DOMException && err.name === 'AbortError'
            ? 'Timed out after 12s.'
            : 'Could not reach the endpoint.'
      setMessage(`Test failed: ${reason}`)
    } finally {
      clearTimeout(timeout)
      setTesting(false)
    }
  }

  return (
    <div className="grid gap-3 rounded-xl border border-neutral-200 p-3 dark:border-neutral-800">
      <label className="flex flex-col gap-1 text-sm">
        <span className="font-medium text-neutral-600 dark:text-neutral-400">Groq API key</span>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="sk-..."
          autoComplete="off"
          className="rounded-lg border border-neutral-300 bg-transparent px-2 py-1.5 font-mono text-xs dark:border-neutral-700"
        />
        <span className="text-xs text-neutral-500">
          Get a free key at console.groq.com. Stored only on this device, never in your save file.
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
          onClick={handleSave}
          className="rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-neutral-900"
        >
          {saveLabel}
        </button>
        <button
          onClick={handleTestConnection}
          disabled={testing}
          className="rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium disabled:opacity-50 dark:border-neutral-700"
        >
          {testing ? 'Testing…' : 'Test connection'}
        </button>
        {showRemove && (
          <button
            onClick={handleRemove}
            className="rounded-full border border-rose-400 px-4 py-1.5 text-sm font-medium text-rose-600 dark:text-rose-400"
          >
            Remove key
          </button>
        )}
      </div>

      {message && <p className="text-sm text-neutral-600 dark:text-neutral-400">{message}</p>}
    </div>
  )
}
