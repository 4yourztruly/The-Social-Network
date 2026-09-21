// Presets for providers with a genuine standing free tier that needs no
// credit card, per PROJECT_SPEC.md section 8 "Free-only policy". Re-verify
// against each provider's own docs before trusting this list — free tiers
// change often. No paid provider or model may ever appear here.

export interface ProviderPreset {
  id: string
  name: string
  baseUrl: string
  defaultModel: string
  notes: string
  requiresFreeModelSuffix?: boolean // OpenRouter guard — model id must end in ":free"
  // Conservative defaults — roughly 50-70% of each provider's published free
  // limits, so normal play never bumps into the provider's own rate limit.
  defaultRpmBudget: number
  defaultRpdBudget: number
}

export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: 'groq',
    name: 'Groq (free tier)',
    baseUrl: 'https://api.groq.com/openai/v1',
    defaultModel: 'openai/gpt-oss-20b',
    notes: 'Create a free key at console.groq.com. No billing details needed for the free tier.',
    defaultRpmBudget: 20,
    // Every comment on every post is now AI-eligible (not just the social
    // circle), so a single popular post can use 15-25+ calls on its own.
    // Still well under Groq's real free-tier daily limit (14,400/day).
    defaultRpdBudget: 3000,
  },
  {
    id: 'openrouter',
    name: 'OpenRouter (free models only)',
    baseUrl: 'https://openrouter.ai/api/v1',
    defaultModel: 'meta-llama/llama-3.1-8b-instruct:free',
    notes: 'Only model ids ending in ":free" are allowed here — anything else may not be free.',
    requiresFreeModelSuffix: true,
    defaultRpmBudget: 10,
    defaultRpdBudget: 50,
  },
  {
    id: 'gemini',
    name: 'Google Gemini (OpenAI-compatible endpoint)',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    defaultModel: 'gemini-1.5-flash',
    notes: 'Create a free key at aistudio.google.com. Use a Flash model for the free tier.',
    defaultRpmBudget: 10,
    defaultRpdBudget: 100,
  },
  {
    id: 'ollama',
    name: 'Ollama (local, desktop only)',
    baseUrl: 'http://localhost:11434/v1',
    defaultModel: 'llama3.1',
    notes: 'Unlimited and fully free, but only works while Ollama is running on this device.',
    defaultRpmBudget: 60,
    defaultRpdBudget: 1000,
  },
  {
    id: 'custom',
    name: 'Custom endpoint',
    baseUrl: '',
    defaultModel: '',
    notes: 'Make sure this endpoint is free. This app cannot verify billing.',
    defaultRpmBudget: 10,
    defaultRpdBudget: 50,
  },
]

export function presetById(id: string): ProviderPreset | undefined {
  return PROVIDER_PRESETS.find((p) => p.id === id)
}

// OpenRouter's free-model guard — a model id must end in ":free" or we
// refuse to use it, since anything else on OpenRouter may bill.
export function isModelIdAllowed(presetId: string, modelId: string): boolean {
  const preset = presetById(presetId)
  if (!preset?.requiresFreeModelSuffix) return true
  return modelId.trim().endsWith(':free')
}
