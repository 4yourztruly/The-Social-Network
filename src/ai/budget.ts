// Client-side requests-per-day budget so the app can never blow past a free
// tier's own limits — see PROJECT_SPEC.md section 8, implementation rule 4.
// Persisted in localStorage, resets when the calendar date changes. RPM
// isn't separately tracked in v1 — RPD alone, kept conservative, is enough
// to stay well under any of the listed providers' actual limits given how
// sparingly AI is used (one call per DM message, nothing else yet).

const STORAGE_PREFIX = 'footy-social-ai-usage-v1:'

interface UsageRecord {
  date: string // YYYY-MM-DD, local
  count: number
}

function todayKey(): string {
  return new Date().toISOString().slice(0, 10)
}

function readUsage(providerId: string): UsageRecord {
  try {
    const raw = localStorage.getItem(STORAGE_PREFIX + providerId)
    if (!raw) return { date: todayKey(), count: 0 }
    const parsed = JSON.parse(raw) as UsageRecord
    if (parsed.date !== todayKey()) return { date: todayKey(), count: 0 }
    return parsed
  } catch {
    return { date: todayKey(), count: 0 }
  }
}

function writeUsage(providerId: string, usage: UsageRecord): void {
  try {
    localStorage.setItem(STORAGE_PREFIX + providerId, JSON.stringify(usage))
  } catch {
    // Non-fatal — worst case the budget just doesn't persist across reloads.
  }
}

export function usageToday(providerId: string): number {
  return readUsage(providerId).count
}

export function canSpend(providerId: string, dailyBudget: number): boolean {
  return usageToday(providerId) < dailyBudget
}

export function recordSpend(providerId: string): void {
  const usage = readUsage(providerId)
  writeUsage(providerId, { date: usage.date, count: usage.count + 1 })
}
