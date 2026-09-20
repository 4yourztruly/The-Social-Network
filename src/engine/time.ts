const UNITS: [number, string][] = [
  [60 * 1000, 's'],
  [60 * 60 * 1000, 'm'],
  [24 * 60 * 60 * 1000, 'h'],
  [7 * 24 * 60 * 60 * 1000, 'd'],
  [30 * 24 * 60 * 60 * 1000, 'w'],
]

export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const diff = Math.max(0, now - timestamp)
  if (diff < UNITS[0][0]) return 'now'
  let value = diff
  let suffix = 's'
  for (let i = 0; i < UNITS.length; i++) {
    const [ms, unit] = UNITS[i]
    const next = UNITS[i + 1]
    if (!next || diff < next[0]) {
      value = Math.floor(diff / ms)
      suffix = unit
      break
    }
  }
  return `${value}${suffix}`
}
