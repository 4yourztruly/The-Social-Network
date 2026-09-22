export function makeId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`
}

// Guarantees uniqueness within a single roster generation batch — used for
// usernames (and, since most avatar URLs are seeded by username, this also
// prevents two different accounts from ending up with the same picture).
// Mutates `used`.
export function dedupe(value: string, used: Set<string>): string {
  if (!used.has(value)) {
    used.add(value)
    return value
  }
  let n = 2
  let candidate = `${value}${n}`
  while (used.has(candidate)) {
    n++
    candidate = `${value}${n}`
  }
  used.add(candidate)
  return candidate
}
