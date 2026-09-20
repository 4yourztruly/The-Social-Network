// Deterministic per-user color palette, shared by Avatar and anything that
// wants a matching background (e.g. the story viewer).
function hashSeed(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return hash
}

export function paletteFor(seed: string) {
  const hash = hashSeed(seed)
  const base = hash % 360
  const spread = 35 + (Math.floor(hash / 360) % 25) // 35-59deg between tones
  const angle = Math.floor(hash / 100_000) % 360
  return {
    h1: base,
    h2: (base + spread) % 360,
    h3: (base + spread * 2) % 360,
    angle,
  }
}

export function gradientCssFor(seed: string): string {
  const { h1, h2, h3, angle } = paletteFor(seed)
  return `linear-gradient(${angle}deg, hsl(${h1} 75% 38%), hsl(${h2} 65% 42%) 55%, hsl(${h3} 68% 34%))`
}
