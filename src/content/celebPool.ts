import type { CelebInput } from './universe'
import { pick, type RNG } from '../engine/rng'

// A universe always has at least this many celebrities. If the player adds
// fewer, the rest come from this pool — an even mix of genders and
// professions so the world doesn't feel like one industry.
export const MIN_CELEBS = 10

type Gender = 'f' | 'm'
type Profession = 'actor' | 'musician' | 'athlete' | 'creator' | 'comedian' | 'host'

interface PoolEntry {
  name: string
  gender: Gender
  profession: Profession
}

const PROFESSION_LABEL: Record<Profession, string> = {
  actor: 'Actor',
  musician: 'Musician',
  athlete: 'Professional athlete',
  creator: 'Model / online creator',
  comedian: 'Comedian',
  host: 'TV / media personality',
}

const PROFESSIONS: Profession[] = ['actor', 'musician', 'athlete', 'creator', 'comedian', 'host']

const POOL: PoolEntry[] = [
  ...(['Zendaya', 'Emma Stone', 'Margot Robbie', 'Florence Pugh', 'Anya Taylor-Joy', 'Jenna Ortega'] as const).map((name) => ({ name, gender: 'f' as const, profession: 'actor' as const })),
  ...(['Ryan Gosling', 'Timothée Chalamet', 'Pedro Pascal', 'Tom Holland', 'Idris Elba', 'Michael B. Jordan'] as const).map((name) => ({ name, gender: 'm' as const, profession: 'actor' as const })),
  ...(['Taylor Swift', 'Billie Eilish', 'Dua Lipa', 'Olivia Rodrigo', 'Beyoncé', 'Rihanna'] as const).map((name) => ({ name, gender: 'f' as const, profession: 'musician' as const })),
  ...(['Drake', 'Harry Styles', 'The Weeknd', 'Bad Bunny', 'Ed Sheeran', 'Post Malone'] as const).map((name) => ({ name, gender: 'm' as const, profession: 'musician' as const })),
  ...(['Serena Williams', 'Simone Biles', 'Alex Morgan', 'Naomi Osaka', 'Aitana Bonmatí', 'Megan Rapinoe'] as const).map((name) => ({ name, gender: 'f' as const, profession: 'athlete' as const })),
  ...(['Lionel Messi', 'Cristiano Ronaldo', 'LeBron James', 'Kylian Mbappé', 'Lamine Yamal', 'Erling Haaland'] as const).map((name) => ({ name, gender: 'm' as const, profession: 'athlete' as const })),
  ...(['Kendall Jenner', 'Bella Hadid', 'Hailey Bieber', 'Gigi Hadid', 'Emily Ratajkowski', 'Charli D\'Amelio'] as const).map((name) => ({ name, gender: 'f' as const, profession: 'creator' as const })),
  ...(['MrBeast', 'Khaby Lame', 'Logan Paul', 'Noah Beck', 'Zach King', 'KSI'] as const).map((name) => ({ name, gender: 'm' as const, profession: 'creator' as const })),
  ...(['Amy Schumer', 'Ali Wong', 'Tiffany Haddish', 'Sarah Silverman', 'Whitney Cummings', 'Iliza Shlesinger'] as const).map((name) => ({ name, gender: 'f' as const, profession: 'comedian' as const })),
  ...(['Kevin Hart', 'Dave Chappelle', 'John Mulaney', 'Pete Davidson', 'Trevor Noah', 'Bo Burnham'] as const).map((name) => ({ name, gender: 'm' as const, profession: 'comedian' as const })),
  ...(['Oprah Winfrey', 'Ellen DeGeneres', 'Kim Kardashian', 'Emma Chamberlain', 'Drew Barrymore', 'Tyra Banks'] as const).map((name) => ({ name, gender: 'f' as const, profession: 'host' as const })),
  ...(['Jimmy Fallon', 'Jimmy Kimmel', 'Joe Rogan', 'Ryan Seacrest', 'Stephen Colbert', 'Graham Norton'] as const).map((name) => ({ name, gender: 'm' as const, profession: 'host' as const })),
]

function norm(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '')
}

// Tops the player's list up to `target` celebrities, alternating gender and
// cycling through professions, never repeating anyone they already added.
export function padCelebs(input: readonly CelebInput[], rng: RNG, target = MIN_CELEBS): CelebInput[] {
  const result = [...input]
  const taken = new Set(result.map((c) => norm(c.name)))
  let gender: Gender = rng() < 0.5 ? 'f' : 'm'
  let professionIdx = Math.floor(rng() * PROFESSIONS.length)

  while (result.length < target) {
    let choice: PoolEntry | undefined
    // Prefer the wanted gender+profession; relax profession, then gender, if it's used up.
    for (let attempt = 0; attempt < PROFESSIONS.length && !choice; attempt++) {
      const profession = PROFESSIONS[(professionIdx + attempt) % PROFESSIONS.length]
      const options = POOL.filter((p) => p.gender === gender && p.profession === profession && !taken.has(norm(p.name)))
      if (options.length > 0) choice = pick(rng, options)
    }
    if (!choice) {
      const anyLeft = POOL.filter((p) => !taken.has(norm(p.name)))
      if (anyLeft.length === 0) break
      choice = pick(rng, anyLeft)
    }
    taken.add(norm(choice.name))
    result.push({ name: choice.name, description: PROFESSION_LABEL[choice.profession] })
    gender = gender === 'f' ? 'm' : 'f'
    professionIdx = (PROFESSIONS.indexOf(choice.profession) + 1) % PROFESSIONS.length
  }
  return result
}
