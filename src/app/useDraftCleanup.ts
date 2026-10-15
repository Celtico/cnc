import { useEffect, useRef } from "react"
import { dropDrafts, dropIfDraft } from "../db/db"
import { readStoredId, STORAGE_KEY } from "./storedId"

/**
 * Esborranys (plantilles obertes sense tocar, `Project.draft`): en obrir l'app, fora els que han quedat; en deixar un
 * moble, si encara ho és, s'esborra. Una mica més tard: abans, el desat pendent de l'editor (en desmuntar-se) el salva.
 */
export function useDraftCleanup(projectId: number | null) {
  useEffect(() => {
    void dropDrafts(readStoredId(STORAGE_KEY))
  }, [])
  const openId = useRef(projectId)
  useEffect(() => {
    openId.current = projectId
    if (projectId === null) return
    const id = projectId
    // Si es torna a obrir (o és el doble muntatge de StrictMode), no es toca.
    return () => void setTimeout(() => openId.current !== id && void dropIfDraft(id), 1500)
  }, [projectId])
}
