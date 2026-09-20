// Small pieces shared by every AI-backed feature (DMs, comments): the
// relationship-to-English mapping used in character cards, and reply
// sanitization. Kept tiny and dependency-free.

export function relationshipDescriptor(relationship: number): string {
  if (relationship >= 60) return 'very close — a real bond'
  if (relationship >= 20) return 'warm and friendly'
  if (relationship >= -20) return 'neutral, still getting to know them'
  if (relationship >= -60) return 'cold, some tension'
  return 'openly hostile'
}

export function sanitizeAiText(text: string, maxChars: number): string {
  return text
    .replace(/^["']|["']$/g, '') // strip wrapping quotes the model sometimes adds
    .slice(0, maxChars)
    .trim()
}
