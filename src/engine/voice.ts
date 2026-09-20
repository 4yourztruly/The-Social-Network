import type { NPC } from '../types'
import type { RNG } from './rng'

// Flavors a template line using an NPC's own traits and posting style —
// both already authored per-NPC but previously unused. This is deliberately
// not an LLM call: deterministic, offline, free, and consistent with every
// other reaction in the game. See PROJECT_SPEC.md section 8 for why a real
// AI provider is a separate, opt-in, later milestone.

const TRAIT_EMOJI: Record<string, string[]> = {
  loyal: ['❤️', '🤝'],
  jokester: ['😂', '💀'],
  passionate: ['🔥', '⚡'],
  optimistic: ['🙌'],
  dramatic: ['👀', '😱'],
  gleeful: ['👀', '😏'],
  nosy: ['👀'],
  sarcastic: ['🙄'],
  confident: ['💪'],
  quick: ['⚡'],
  irreverent: ['💀'],
  mentor: ['🤝'],
  discreet: ['🤐'],
}

const SOFTENER_PATTERN = /\s*(tbh|honestly|ngl)\b/gi

export function applyPersonalityVoice(line: string, npc: NPC, rng: RNG): string {
  let text = line

  // Blunt/contrarian personalities keep it terse — strip trailing softeners.
  if (npc.personality.includes('blunt') || npc.personality.includes('contrarian')) {
    text = text.replace(SOFTENER_PATTERN, '').trim()
  }

  // Occasionally add a trait-appropriate emoji if the NPC's posting style
  // leans that way and the line doesn't already end on one.
  const endsWithEmoji = /\p{Emoji_Presentation}/u.test(text.slice(-2))
  if (!endsWithEmoji && rng() < npc.postingStyle.emoji * 0.6) {
    const traitEmojis = npc.personality.flatMap((t) => TRAIT_EMOJI[t] ?? [])
    if (traitEmojis.length > 0) {
      text = `${text} ${traitEmojis[Math.floor(rng() * traitEmojis.length)]}`
    }
  }

  // High-caps posting style occasionally shouts a short line for emphasis —
  // discreet/measured personalities are exempt, that would contradict them.
  const measured = npc.personality.includes('discreet') || npc.personality.includes('measured')
  if (!measured && npc.postingStyle.caps > 0.4 && text.length <= 24 && rng() < npc.postingStyle.caps * 0.5) {
    text = text.toUpperCase()
  }

  return text
}
