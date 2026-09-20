import type { AIProviderConfig } from '../types'

// Plain fetch, no provider SDK — see PROJECT_SPEC.md section 3 "AI
// transport". One adapter covers every OpenAI-compatible free-tier
// endpoint (Groq, OpenRouter free models, Gemini's OpenAI-compat endpoint,
// Ollama).

export interface AIProvider {
  complete(args: { system: string; user: string; maxTokens?: number; signal?: AbortSignal }): Promise<string>
}

export class AIRequestError extends Error {
  readonly status?: number

  constructor(message: string, status?: number) {
    super(message)
    this.name = 'AIRequestError'
    this.status = status
  }
}

export function createOpenAICompatibleProvider(config: AIProviderConfig): AIProvider {
  return {
    async complete({ system, user, maxTokens = 200, signal }) {
      const url = `${config.baseUrl.replace(/\/$/, '')}/chat/completions`
      let res: Response
      try {
        res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${config.apiKey}`,
          },
          body: JSON.stringify({
            model: config.model,
            messages: [
              { role: 'system', content: system },
              { role: 'user', content: user },
            ],
            max_tokens: maxTokens,
            temperature: 0.9,
            // Reasoning models (e.g. Groq's gpt-oss) bill hidden chain-of-thought
            // against max_tokens — left at the default effort, replies can come
            // back empty because reasoning alone exhausts the budget. Providers
            // that don't recognize this field ignore it.
            reasoning_effort: 'low',
          }),
          signal,
        })
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') throw err
        throw new AIRequestError(`Network error contacting AI provider: ${(err as Error).message}`)
      }

      if (!res.ok) {
        throw new AIRequestError(`AI provider returned ${res.status}`, res.status)
      }

      const data = (await res.json()) as {
        choices?: { message?: { content?: string } }[]
      }
      const text = data.choices?.[0]?.message?.content?.trim()
      if (!text) throw new AIRequestError('AI provider returned an empty response')
      return text
    },
  }
}
