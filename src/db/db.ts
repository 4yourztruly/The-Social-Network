import Dexie, { type Table } from 'dexie'
import type { SaveGame } from '../types'

export interface SaveRow {
  id: string // fixed 'current' — single-save-slot for v1
  data: SaveGame
  savedAt: number
}

export class GameDB extends Dexie {
  saves!: Table<SaveRow, string>

  constructor() {
    super('football-social-life-sim')
    this.version(1).stores({
      saves: 'id',
    })
  }
}

export const db = new GameDB()

export const CURRENT_SAVE_ID = 'current'
