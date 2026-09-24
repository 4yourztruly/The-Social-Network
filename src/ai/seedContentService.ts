import type { AIProviderConfig, NPC } from '../types'
import { createOpenAICompatibleProvider, AIRequestError } from './openaiCompatible'
import { sanitizeAiText } from './shared'

const REQUEST_TIMEOUT_MS = 12_000
const MAX_POST_CHARS = 220

// Onboarding's seeded world starts with ~45 template posts drawn from the
// career pack's generic per-persona line pool — fine as crowd noise, but a
// celeb's very first post landing in the player's feed should sound like
// THEM, not a generic "teammate" line. This personalizes a handful of those
// opening posts (the celeb tier's) using the same bio-first character card
// the rest of the AI integration uses. See gameStore.completeOnboarding.
export function buildSeedPostSystemPrompt(npc: NPC, orgName: string): string {
  const traits = npc.personality.length > 0 ? npc.personality.join(', ') : 'even-tempered'
  // A celebrity the player added is just themselves — never part of the
  // player's career world, so the world/org isn't even mentioned to them.
  const independent = npc.persona === 'celebrity' || npc.offTopic
  return [
    independent
      ? `You are roleplaying as the account @${npc.username}, display name "${npc.displayName}", in a social-media life sim game.`
      : `You are roleplaying as the account @${npc.username}, display name "${npc.displayName}", in a social-media life sim game about the world of ${orgName}.`,
    npc.bio
      ? `Who they actually are, in their own words (source of truth for voice, vocation and interests): "${npc.bio}"`
      : '',
    `Personality traits: ${traits}.`,
    independent
      ? `They have nothing to do with ${orgName} or the player's career — post only about their OWN life, work, interests and mood, never about sport, a club, or anyone's career unless their own bio says that's their thing.`
      : '',
    'Write ONE short, standalone public post in their own authentic voice — about their own life, work, mood, or something on their mind right now. Not a reply to anyone, and not about any specific other person.',
    '1 short sentence, casual social-media tone, no more than 200 characters. An emoji or hashtag is fine if it fits their style, not required.',
    'Stay fully in character. Never mention being an AI, a model, or a game character.',
    'No slurs, no explicit content, no real private information about anyone.',
  ]
    .filter(Boolean)
    .join('\n')
}

// Returns the post text, or null on any failure — callers keep the
// deterministic template line already seeded in that case (spec: gameplay
// never blocks on, or depends on, AI succeeding).
export async function generateAiSeedPost(npc: NPC, orgName: string, config: AIProviderConfig): Promise<string | null> {
  const provider = createOpenAICompatibleProvider(config)
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    const text = await provider.complete({
      system: buildSeedPostSystemPrompt(npc, orgName),
      user: 'Write the post now.',
      maxTokens: 300,
      signal: controller.signal,
    })
    const cleaned = sanitizeAiText(text, MAX_POST_CHARS)
    return cleaned.length > 0 ? cleaned : null
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('AI seed post failed, keeping template line:', err instanceof AIRequestError ? err.message : err)
    }
    return null
  } finally {
    clearTimeout(timeout)
  }
}
