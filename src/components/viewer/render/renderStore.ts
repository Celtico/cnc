import { useSyncExternalStore } from "react"
import type { SceneGetter } from "./RenderDialog"

/**
 * **El Render és de tota l'app** (per decisió de l'usuari, 2026-10-14: «si canvio d'apartat, que no s'aturi»): un sol
 * `RenderDialog` muntat a `App` (`RenderHost`, `RenderHost.tsx`), que es queda muntat. L'editor del moble i el dels ambients l'obren amb
 * `openRender` (el seu `getScene`, el nom i la clau del document); tancar-lo o canviar d'apartat no atura un render començat
 * i, en tornar-lo a obrir des del mateix document (la mateixa `saveKey`), hi és. Des d'un altre document, se'n fa un de nou.
 * Sense React ni three: el bloc d'entrada no carrega el render fins que s'obre.
 */
interface RenderRequest {
  getScene: SceneGetter
  name: string
  saveKey: string
}

let state: { req: RenderRequest | null; open: boolean } = { req: null, open: false }
const listeners = new Set<() => void>()
const emit = (next: typeof state) => {
  state = next
  for (const l of listeners) l()
}

export function openRender(req: RenderRequest): void {
  emit({ req, open: true })
}

export function closeRender(): void {
  emit({ ...state, open: false })
}

export function useRenderHost(): typeof state {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    () => state,
  )
}
