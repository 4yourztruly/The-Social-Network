const compactFormatter = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 })

// "500k", "50m", "1.2b" for anything 1000 or over (Intl's compact notation
// defaults to uppercase K/M/B — lowercased to match); the plain number
// as-is below that, so small counts/deltas don't get needlessly abbreviated.
export function formatCompactNumber(n: number): string {
  if (Math.abs(n) < 1000) return String(n)
  return compactFormatter.format(n).toLowerCase()
}
