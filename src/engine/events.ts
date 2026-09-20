import type { GameEvent, GameEventType, Tone } from '../types'
import { makeId } from './id'

export function createGameEvent(args: {
  type: GameEventType
  tags: string[]
  data?: Record<string, unknown>
  tone?: Tone
  sourceId?: string
  timestamp?: number
}): GameEvent {
  return {
    id: makeId('event'),
    type: args.type,
    tags: args.tags,
    data: args.data ?? {},
    tone: args.tone,
    sourceId: args.sourceId,
    timestamp: args.timestamp ?? Date.now(),
  }
}
