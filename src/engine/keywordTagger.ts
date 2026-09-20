import type { KeywordRule } from '../content/careers/types'

// Scans a caption against a career pack's keyword rules and returns the
// canonical tags that matched. Career-agnostic — the rules (and the words
// that trigger them) come from the player's chosen CareerPack.
export function scanKeywordTags(text: string, rules: readonly KeywordRule[]): string[] {
  const tags = new Set<string>()
  for (const rule of rules) {
    if (rule.patterns.some((p) => p.test(text))) tags.add(rule.tag)
  }
  return [...tags]
}
