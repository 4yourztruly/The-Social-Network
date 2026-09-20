import { useEffect, useRef } from 'react'
import { useGameStore } from '../store/gameStore'
import { loadSave, scheduleAutosave } from '../db/persistence'

export function usePersistence() {
  const hydrateFromSave = useGameStore((s) => s.hydrateFromSave)
  const hydrated = useRef(false)

  useEffect(() => {
    void navigator.storage?.persist?.()
    void loadSave().then((save) => {
      if (save) hydrateFromSave(save)
      hydrated.current = true
    })
  }, [hydrateFromSave])

  useEffect(() => {
    const unsubscribe = useGameStore.subscribe(() => {
      if (!hydrated.current) return
      scheduleAutosave(() => useGameStore.getState().toSaveGame())
    })
    return unsubscribe
  }, [])
}
