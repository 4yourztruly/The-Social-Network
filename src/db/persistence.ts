import type { SaveGame } from '../types'
import { db, CURRENT_SAVE_ID } from './db'
import { saveGameSchema } from './saveSchema'
import { migrateSaveData } from './migrations'

const AUTOSAVE_DEBOUNCE_MS = 800

let debounceHandle: ReturnType<typeof setTimeout> | null = null

export function scheduleAutosave(getSave: () => SaveGame): void {
  if (debounceHandle) clearTimeout(debounceHandle)
  debounceHandle = setTimeout(() => {
    debounceHandle = null
    void persistNow(getSave())
  }, AUTOSAVE_DEBOUNCE_MS)
}

export async function persistNow(save: SaveGame): Promise<void> {
  await db.saves.put({ id: CURRENT_SAVE_ID, data: save, savedAt: Date.now() })
}

export async function loadSave(): Promise<SaveGame | null> {
  const row = await db.saves.get(CURRENT_SAVE_ID)
  if (!row) return null
  const migrated = migrateSaveData(row.data)
  const result = saveGameSchema.safeParse(migrated)
  if (!result.success) {
    console.error('Stored save failed validation after migration; ignoring it.', result.error)
    return null
  }
  return result.data as SaveGame
}

export async function deleteSave(): Promise<void> {
  await db.saves.delete(CURRENT_SAVE_ID)
}

// AI provider configs (including any API key) never enter SaveGame at all —
// they live only in localStorage (src/ai/keyStorage.ts) — so there's
// nothing to strip here. The type system enforces this: Settings has no
// field that could carry a key.
export function exportSaveToJSON(save: SaveGame): string {
  return JSON.stringify(save, null, 2)
}

export function downloadSaveFile(save: SaveGame, filename = 'football-sim-save.json'): void {
  const json = exportSaveToJSON(save)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export interface ImportResult {
  ok: boolean
  save?: SaveGame
  error?: string
}

export function parseSaveJSON(json: string): ImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(json)
  } catch {
    return { ok: false, error: 'That file is not valid JSON.' }
  }
  const migrated = migrateSaveData(parsed)
  const result = saveGameSchema.safeParse(migrated)
  if (!result.success) {
    return { ok: false, error: 'That save file does not match the expected format.' }
  }
  return { ok: true, save: result.data as SaveGame }
}
