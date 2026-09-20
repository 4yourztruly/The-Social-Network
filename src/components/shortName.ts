const LEADING_ARTICLES = new Set(['the', 'a', 'an'])

// "Theo Lin" -> "Theo", but "The Green Room" -> "The Green Room" — brand-style
// NPC names (media outlets, meme accounts) shouldn't get butchered down to
// just their leading article.
export function shortNameFor(displayName: string): string {
  const words = displayName.split(' ')
  if (words.length <= 1) return displayName
  const first = words[0]
  if (LEADING_ARTICLES.has(first.toLowerCase())) return displayName
  return first
}
