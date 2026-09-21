// Generic @-mention banter lines used when one commenter reacts to another
// commenter (or to the player) instead of reacting to the post itself.
// Deliberately persona-agnostic and free of any specific claim about what
// was said — these are template fill-ins, not real understanding of the
// text being replied to. Shared between seed-time reply generation
// (content/seed.ts) and the live reaction engine (engine/reactions/engine.ts)
// so the two don't drift into two different banter voices.

export const CROSS_MENTION_BANTER_LINES = [
  "{target} nah I don't see it",
  '{target} 😂😂 say it again',
  '{target} facts, no notes',
  "{target} you're actually right about that",
  '{target} not you starting beef 💀',
  '{target} lol true though',
  '{target} exactly what I was thinking',
  '{target} okay but why is this accurate',
]

export const PLAYER_MENTION_BANTER_LINES = [
  '{target} respect, that is actually elite',
  '{target} not gonna lie this is good',
  '{target} okay but do it again this weekend',
  '{target} this you? 👀',
  '{target} say less',
  '{target} the standard just went up',
  '{target} okay I see you',
  '{target} we are not ready for this energy',
]

export function fillBanterTarget(line: string, targetUsername: string): string {
  return line.replace('{target}', `@${targetUsername}`)
}
