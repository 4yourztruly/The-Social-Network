// Keeps the Event button from being spammed — device-local, like the AI
// budget tracker (src/ai/budget.ts), not part of SaveGame.

const STORAGE_KEY = 'footy-social-last-event-at'
export const EVENT_COOLDOWN_MS = 5 * 60 * 1000

export function msUntilNextEvent(): number {
  try {
    const last = Number(localStorage.getItem(STORAGE_KEY) ?? 0)
    return Math.max(0, EVENT_COOLDOWN_MS - (Date.now() - last))
  } catch {
    return 0
  }
}

export function recordEventTriggered(): void {
  try {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
  } catch {
    // Non-fatal — worst case the cooldown just doesn't persist across reloads.
  }
}
