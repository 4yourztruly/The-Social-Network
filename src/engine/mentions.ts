// Pulls @username tokens out of post text and resolves them against a
// username -> profile id index. Unknown mentions (no matching user) are
// silently dropped rather than left dangling.
export function extractMentionedIds(text: string, usernameToId: Record<string, string>): string[] {
  const matches = text.match(/@(\w+)/g) ?? []
  const ids = new Set<string>()
  for (const m of matches) {
    const id = usernameToId[m.slice(1).toLowerCase()]
    if (id) ids.add(id)
  }
  return [...ids]
}

export function buildUsernameIndex(
  profiles: Record<string, { id: string; username: string }>,
): Record<string, string> {
  const index: Record<string, string> = {}
  for (const p of Object.values(profiles)) index[p.username.toLowerCase()] = p.id
  return index
}
