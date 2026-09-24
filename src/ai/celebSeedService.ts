import type { AIProviderConfig } from '../types'
import type { NPCSeed } from '../content/careers/types'
import { buildCelebSeed, type CelebDetails, type CelebInput } from '../content/universe'
import { generatePersonDetails } from './personService'
import { canSpend, recordSpend } from './budget'
import { fetchWikipediaThumbnail } from '../engine/avatarSource'
import type { RNG } from '../engine/rng'

const MAX_CELEBS = 20

// Builds roster seeds for the celebs the player added at onboarding. With an
// AI provider each one is researched (real bio, personality, follower
// estimate, photo); without one — or if a lookup fails — it falls back to
// exactly what the player typed plus a Wikipedia photo when one exists.
// Never throws: a celeb that can't be enriched still gets added.
export async function buildCelebSeeds(
  celebs: readonly CelebInput[],
  config: AIProviderConfig | undefined,
  rng: RNG,
  usedUsernames: Set<string>,
): Promise<NPCSeed[]> {
  const cleaned = celebs.filter((c) => c.name.trim().length > 0).slice(0, MAX_CELEBS)
  const details = await Promise.all(
    cleaned.map(async (celeb): Promise<CelebDetails | null> => {
      if (config && canSpend(config.id, config.rpdBudget)) {
        const generated = await generatePersonDetails({ name: celeb.name, description: celeb.description ?? '', config })
        if (generated) {
          recordSpend(config.id)
          return generated
        }
      }
      const avatarUrl = await fetchWikipediaThumbnail(celeb.name).catch(() => null)
      return avatarUrl ? { avatarUrl } : null
    }),
  )
  return cleaned.map((celeb, i) => buildCelebSeed(celeb, details[i], rng, usedUsernames))
}
