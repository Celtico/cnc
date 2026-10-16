import { useEffect, useRef, useSyncExternalStore } from "react"
import type { SceneGetter } from "./RenderDialog"

/**
 * **El Render és de tota l'app** (per decisió de l'usuari, 2026-10-14: «si canvio d'apartat, que no s'aturi»): un sol
 * panell flotant (`RenderDialog`) muntat a `App` (`RenderHost`, `RenderHost.tsx`), que es queda muntat. L'editor del moble i
 * el dels ambients l'obren amb `openRender` (el seu `getScene`, el nom i la clau del document); tancar-lo, minimitzar-lo o
 * canviar d'apartat no atura un render començat i, en tornar-lo a obrir des del mateix document (la mateixa `saveKey`), hi
 * és. Des d'un altre document: si el d'ara calcula o té una imatge sense desar, es pregunta què se'n fa (`pending`,
 * `RenderConflictDialog`); si no, se'n fa un de nou. Com va (`RenderStatus`) ho mostra el menú de l'app (`RenderStatusNav`).
 * Sense three: el bloc d'entrada no carrega el render fins que s'obre.
 */
interface RenderRequest {
  getScene: SceneGetter
  name: string
  saveKey: string
}

interface HostState {
  req: RenderRequest | null
  open: boolean
  /** El Render demanat des d'un altre document mentre el d'ara calcula o no s'ha desat (es pregunta). */
  pending: RenderRequest | null
  /** Puja cada cop que es demana veure'l (si era minimitzat, el panell es restaura). */
  shown: number
}

/** Com va el render d'ara: el publica el panell i el llegeix l'indicador del menú. */
interface RenderStatus {
  saveKey: string
  name: string
  begun: boolean
  running: boolean
  passes: number
  limit: number
  elapsed: number
  /** Hi ha una imatge amb passades que no s'ha desat en PNG. */
  unsaved: boolean
  /** El panell és minimitzat (només la barra de títol). */
  minimized: boolean
}

function createStore<T>(initial: T) {
  let value = initial
  const listeners = new Set<() => void>()
  const subscribe = (l: () => void) => {
    listeners.add(l)
    return () => {
      listeners.delete(l)
    }
  }
  return {
    get: () => value,
    set(next: T) {
      value = next
      for (const l of listeners) l()
    },
    subscribe,
    snapshot: () => value,
  }
}

const host = createStore<HostState>({ req: null, open: false, pending: null, shown: 0 })
// A part: canvia cada segon mentre calcula i només ho han de saber l'indicador i el diàleg de pregunta, no tota l'app.
const status = createStore<RenderStatus | null>(null)

/** Calcula o té una imatge sense desar: fer-ne un d'un altre document el perdria. */
const busy = (s: RenderStatus | null) => !!s && s.begun && (s.running || s.unsaved)

export function openRender(req: RenderRequest): void {
  const cur = host.get()
  if (cur.req && cur.req.saveKey !== req.saveKey && busy(status.get())) {
    host.set({ ...cur, pending: req })
    return
  }
  host.set({ req, open: true, pending: null, shown: cur.shown + 1 })
}

/**
 * Qui pot començar un render ara (el moble o l'ambient oberts): el botó «Render» del menú de l'app, sempre a sobre de
 * Preferències (per decisió de l'usuari, 2026-10-16: «que surti sempre al menú principal i treure'l d'Opcions de vista»).
 */
const launcher = createStore<{ saveKey: string; start: () => void } | null>(null)

/** L'editor obert diu com es comença el seu render (mentre és muntat; `null`: no se'n pot fer). */
export function useRenderLauncher(saveKey: string, start: (() => void) | null): void {
  const latest = useRef(start)
  useEffect(() => {
    latest.current = start
  })
  const on = start !== null
  useEffect(() => {
    if (!on) return
    const mine = { saveKey, start: () => latest.current?.() }
    launcher.set(mine)
    return () => {
      if (launcher.get() === mine) launcher.set(null)
    }
  }, [on, saveKey])
}

export function useCurrentRenderLauncher(): { saveKey: string; start: () => void } | null {
  return useSyncExternalStore(launcher.subscribe, launcher.snapshot)
}

/** Torna a mostrar el render d'ara (l'indicador del menú). */
export function showRender(): void {
  const cur = host.get()
  if (cur.req) host.set({ ...cur, open: true, shown: cur.shown + 1 })
}

export function closeRender(): void {
  host.set({ ...host.get(), open: false })
}

/** La resposta a «Ja hi ha un render»: veure el d'ara, aturar-lo i començar el nou, o no fer res. */
export function resolvePendingRender(choice: "keep" | "replace" | "cancel"): void {
  const cur = host.get()
  if (!cur.pending) return
  if (choice === "cancel") host.set({ ...cur, pending: null })
  else if (choice === "keep") host.set({ ...cur, pending: null, open: true, shown: cur.shown + 1 })
  // Una altra `key` a `RenderHost`: el panell d'abans es desmunta i el seu motor s'allibera.
  else host.set({ req: cur.pending, pending: null, open: true, shown: cur.shown + 1 })
}

export function useRenderHost(): HostState {
  return useSyncExternalStore(host.subscribe, host.snapshot)
}

export function useRenderStatus(): RenderStatus | null {
  return useSyncExternalStore(status.subscribe, status.snapshot)
}

/** Com va el render del document `saveKey` (`null`: ja no hi és; només treu el seu, no el d'un altre). */
export function publishRenderStatus(saveKey: string, next: RenderStatus | null): void {
  if (next) status.set(next)
  else if (status.get()?.saveKey === saveKey) status.set(null)
}

/** El panell publica com va el seu render; en desmuntar-se (un altre document), es treu. */
export function usePublishRenderStatus(next: RenderStatus): void {
  const { saveKey, name, begun, running, passes, limit, elapsed, unsaved, minimized } = next
  useEffect(() => {
    publishRenderStatus(saveKey, { saveKey, name, begun, running, passes, limit, elapsed, unsaved, minimized })
  }, [saveKey, name, begun, running, passes, limit, elapsed, unsaved, minimized])
  useEffect(() => () => publishRenderStatus(saveKey, null), [saveKey])
}

/** Per als tests: l'estat del panell, i tornar a començar sense res. */
export const renderHostState = (): HostState => host.get()
export function resetRenderStore(): void {
  host.set({ req: null, open: false, pending: null, shown: 0 })
  status.set(null)
  launcher.set(null)
}

/** «12 / 256 passades · 34 s» (l'indicador del menú i la barra del panell). */
export function renderProgressText({ passes, limit, elapsed }: Pick<RenderStatus, "passes" | "limit" | "elapsed">): string {
  return `${passes}${limit ? ` / ${limit}` : ""} ${passes === 1 ? "passada" : "passades"} · ${elapsed} s`
}

/** Calculant · Aturat · Acabat (ha arribat al límit de passades). */
export function renderStateText({ begun, running, passes, limit }: Pick<RenderStatus, "begun" | "running" | "passes" | "limit">): string {
  if (!begun) return "Sense començar"
  if (running) return "Calculant"
  return limit && passes >= limit ? "Acabat" : "Aturat"
}
