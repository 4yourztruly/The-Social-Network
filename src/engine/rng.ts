// Deterministic seeded RNG (mulberry32). Used everywhere content selection needs
// to be reproducible for tests instead of relying on Math.random().

export type RNG = () => number

export function mulberry32(seed: number): RNG {
  let a = seed >>> 0
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashStringToSeed(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

export function pick<T>(rng: RNG, items: readonly T[]): T {
  if (items.length === 0) throw new Error('pick: empty array')
  return items[Math.floor(rng() * items.length)]
}

export function pickWeighted<T>(rng: RNG, items: readonly T[], weight: (item: T) => number): T {
  const weights = items.map(weight)
  const total = weights.reduce((a, b) => a + b, 0)
  if (total <= 0) return pick(rng, items)
  let roll = rng() * total
  for (let i = 0; i < items.length; i++) {
    roll -= weights[i]
    if (roll <= 0) return items[i]
  }
  return items[items.length - 1]
}

export function randomInt(rng: RNG, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min
}
