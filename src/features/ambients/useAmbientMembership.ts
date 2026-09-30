import { useMemo } from "react"
import { parseAmbient } from "../../core/model"
import { db } from "../../db/db"
import { useLiveQuery } from "../../db/useLiveQuery"

/** Per a cada moble (id), els ambients on és col·locat. */
export function useAmbientMembership(): Map<number, { id: number; name: string }[]> {
  const rows = useLiveQuery(() => db.ambients.toArray(), [])
  return useMemo(() => {
    const out = new Map<number, { id: number; name: string }[]>()
    for (const r of rows ?? [])
      for (const it of parseAmbient(r.data).items) {
        if (it.kind !== "moble") continue
        const list = out.get(it.projectId) ?? []
        if (!list.some((a) => a.id === r.id)) list.push({ id: r.id, name: r.name })
        out.set(it.projectId, list)
      }
    return out
  }, [rows])
}
