import type { AIProviderConfig } from '../types'

// The API key lives here — localStorage, on this device, forever. Never in
// SaveGame (IndexedDB), never in an exported save file, never in the repo
// or bundle. See PROJECT_SPEC.md section 8 "Key handling".
const STORAGE_KEY = 'footy-social-ai-providers-v1'

export function loadProviderConfigs(): AIProviderConfig[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveProviderConfigs(configs: AIProviderConfig[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(configs))
  } catch {
    // localStorage can throw in private-browsing/quota-exceeded cases —
    // AI config just won't persist across reloads, which is a safe failure.
  }
}

export function upsertProviderConfig(config: AIProviderConfig): AIProviderConfig[] {
  const configs = loadProviderConfigs()
  const idx = configs.findIndex((c) => c.id === config.id)
  const next = idx >= 0 ? configs.map((c, i) => (i === idx ? config : c)) : [...configs, config]
  saveProviderConfigs(next)
  return next
}

export function removeProviderConfig(id: string): AIProviderConfig[] {
  const next = loadProviderConfigs().filter((c) => c.id !== id)
  saveProviderConfigs(next)
  return next
}

export function getProviderConfig(id: string | undefined): AIProviderConfig | undefined {
  if (!id) return undefined
  return loadProviderConfigs().find((c) => c.id === id)
}
