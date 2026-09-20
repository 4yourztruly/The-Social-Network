// Humor/aura are player stats, but unlike every other tag they aren't
// career-specific vocabulary — a joke reads the same whether you're a
// footballer or a singer. So this scans generically, independent of the
// active CareerPack's keywordRules, and feeds straight into the same
// 'funny'/'aura_moment' tags BASE_DELTAS_BY_TAG already knows about.

const HUMOR_PATTERN = /😂|🤣|💀|\blol+\b|\blmao+\b|\blmfao+\b|\bhaha+\b|\bjoke\b|\bjoking\b/i
const AURA_PATTERN = /\baura\b|\bno cap\b|\bgoated\b|\biconic\b|\blegendary\b|\bbuilt different\b|\bdifferent breed\b/i

export function funMarkerTags(text: string): string[] {
  const tags: string[] = []
  if (HUMOR_PATTERN.test(text)) tags.push('funny')
  if (AURA_PATTERN.test(text)) tags.push('aura_moment')
  return tags
}
