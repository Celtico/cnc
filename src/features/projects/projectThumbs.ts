import { cameraSignature, isEmptyComposition, thumbIsStale, type Composition, type MaterialPref } from "../../core/model"
import { THUMB_VERSION } from "../../components/viewer/thumbVersion"
import { presentationScenePrint, readPresentationScene } from "../../components/viewer/presentationScene"
import { compositionOf } from "../../db/compositionStore"
import { db, type Project } from "../../db/db"
import { templatePrint, usedMaterialsPrint, readLatestThumb, readThumb, writeThumb } from "./thumbStore"

/** El renderitzador (three.js) es carrega en fer la primera miniatura, no en obrir la galeria. */
const jobs = () => import("./thumbJobs")

/**
 * Cua de miniatures 3D dels mobles i objectes: es fan d'una en una quan el navegador està lliure i es desen
 * al projecte (`thumb`, amb `thumbAt` = l'`updatedAt` que retraten). Si el moble canvia, es torna a fer.
 */
const queue: { id: number | string; run: () => Promise<void> }[] = []
const pending = new Set<number | string>()
/** Targetes que esperen cada feina: si ja no n'hi ha cap (s'han desmuntat), la feina se salta. */
const wanted = new Map<number | string, number>()
let running = false
/** El renderitzador s'allibera quan la cua fa 3 s que és buida (desplaçar una graella en demana més de seguida). */
const RELEASE_MS = 3000
let releaseTimer: ReturnType<typeof setTimeout> | undefined

/** Una targeta més vol la miniatura `key`; la funció que torna diu que ja no (en desmuntar-se). */
function want(key: number | string): () => void {
  wanted.set(key, (wanted.get(key) ?? 0) + 1)
  let done = false
  return () => {
    if (done) return
    done = true
    const n = (wanted.get(key) ?? 1) - 1
    if (n > 0) wanted.set(key, n)
    else wanted.delete(key)
  }
}

/**
 * També quan canvia l'escena de Preferències › Visor 3D (per decisió de l'usuari, 2026-10-22: «només els mobles que he
 * retocat surten amb el fons de formigó»).
 */
export function needsThumb(p: Project): boolean {
  return thumbIsStale(p, p.updatedAt, THUMB_VERSION, p.composition?.camera, presentationScenePrint())
}

/** Demana la miniatura del moble; la funció que torna la cancel·la (si cap altra targeta la vol). */
export function requestProjectThumb(p: Project, materials: MaterialPref[]): () => void {
  if (!needsThumb(p)) return () => {}
  const release = want(p.id)
  if (pending.has(p.id)) return release
  pending.add(p.id)
  queue.push({
    id: p.id,
    run: async () => {
      const fresh = await db.projects.get(p.id)
      if (!fresh || !needsThumb(fresh)) return
      const comp = compositionOf(fresh)
      const studio = presentationScenePrint()
      const url = await (await jobs()).renderProjectThumb(comp, materials)
      // Sense tocar `updatedAt` ni `edited`. `thumbCam` és la de la fila (la que mira `needsThumb`).
      const cam = cameraSignature(fresh.composition?.camera)
      if (url) await db.projects.update(p.id, { thumb: url, thumbAt: fresh.updatedAt, thumbV: THUMB_VERSION, thumbCam: cam, thumbStudio: studio })
      // Buit (s'han tret tots els mòduls): fora la miniatura d'abans, que ensenyaria el que ja no hi és.
      else if (fresh.thumb && isEmptyComposition(comp)) await db.projects.update(p.id, { thumb: undefined })
    },
  })
  void drain()
  return release
}

/**
 * Miniatures que no són de l'usuari (plantilles del catàleg, objectes, escenes del catàleg d'ambients, ferratges de
 * Preferències): es guarden en memòria i a la Cache Storage (`thumbStore`) amb `sig`, una empremta de tot el que les
 * pinta (versió, contingut, materials). La mateixa (dues targetes iguals) es fa un sol cop i totes la reben.
 */
const storedThumbs = new Map<string, string>()
const storedListeners = new Map<string, Set<(url: string) => void>>()
const storedKey = (kind: string, id: string, sig: string) => `${kind}|${id}|${sig}`

/** La miniatura ja feta en aquesta sessió (o `undefined`). */
export function storedThumb(kind: string, id: string, sig: string): string | undefined {
  return storedThumbs.get(storedKey(kind, id, sig))
}

/**
 * Demana la miniatura `kind`/`id` amb l'empremta `sig`: la de memòria, la desada d'una altra sessió o, si no n'hi ha, a
 * la cua comuna (`render`, `null` si no surt: no es desa). `onDone` rep la imatge; la funció que torna la cancel·la.
 */
export function requestStoredThumb(kind: string, id: string, sig: string, render: () => Promise<string | null>, onDone: (url: string) => void): () => void {
  const key = storedKey(kind, id, sig)
  const hit = storedThumbs.get(key)
  if (hit) {
    onDone(hit)
    return () => {}
  }
  const listeners = storedListeners.get(key) ?? new Set<(url: string) => void>()
  storedListeners.set(key, listeners)
  listeners.add(onDone)
  const finish = (url: string) => {
    storedThumbs.set(key, url)
    for (const f of storedListeners.get(key) ?? []) f(url)
    storedListeners.delete(key)
  }
  let release: (() => void) | undefined
  let cancelled = false
  // Primer, la desada d'una altra sessió; si no n'hi ha, a la cua.
  void readThumb(kind, id, sig).then((saved) => {
    if (cancelled) return
    if (saved) return finish(saved)
    release = enqueueThumb(key, async () => {
      const url = await render()
      if (url) {
        finish(url)
        void writeThumb(kind, id, sig, url)
      } else storedListeners.delete(key)
    })
  })
  return () => {
    cancelled = true
    listeners.delete(onDone)
    release?.()
  }
}

/** Plantilles (catàleg de botiga, objectes): la miniatura es fa igual que la d'un moble, amb l'empremta de la plantilla. */
// L'escena (terra i paret de Preferències) també hi és: canviar-la torna a fer les miniatures.
const templateSig = (comp: Composition, materials: readonly MaterialPref[]) => {
  const studio = readPresentationScene()
  return `${THUMB_VERSION}-${templatePrint(comp)}-${templatePrint(studio)}-${usedMaterialsPrint([comp, studio], materials)}`
}
/**
 * L'última miniatura que s'ha vist d'una plantilla (en aquesta sessió o desada), sense fer-la: la targeta l'ensenya de
 * seguida mentre es fa la plantilla per mirar si ha canviat (per decisió de l'usuari, 2026-10-22: «ara sempre torna a
 * fer el render de tot, on es nota més és als Llistons»).
 */
const latestThumbs = new Map<string, string>()
export function lastTemplateThumb(id: string, onFound: (url: string) => void): void {
  const hit = latestThumbs.get(id)
  if (hit) return onFound(hit)
  void readLatestThumb("moble", id).then((url) => {
    if (url) {
      latestThumbs.set(id, url)
      onFound(url)
    }
  })
}
export function templateThumb(id: string, comp: Composition, materials: readonly MaterialPref[]): string | undefined {
  return storedThumb("moble", id, templateSig(comp, materials))
}
export function requestTemplateThumb(id: string, make: () => Composition, materials: MaterialPref[], onDone: (url: string) => void): () => void {
  return requestStoredThumb("moble", id, templateSig(make(), materials), async () => (await jobs()).renderTemplateThumb(make(), materials), (url) => {
    latestThumbs.set(id, url)
    onDone(url)
  })
}

/** Afegeix una feina a la cua comuna de miniatures (una cada cop; `key` evita repetir-la). */
export function enqueueThumb(key: string, run: () => Promise<void>): () => void {
  const release = want(key)
  if (pending.has(key)) return release
  pending.add(key)
  queue.push({ id: key, run })
  void drain()
  return release
}

const idle = () =>
  new Promise<void>((resolve) => {
    const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }
    if (w.requestIdleCallback) w.requestIdleCallback(() => resolve(), { timeout: 500 })
    else setTimeout(resolve, 60)
  })

async function drain() {
  if (running) return
  running = true
  clearTimeout(releaseTimer)
  try {
    while (queue.length) {
      const job = queue.shift()!
      // La targeta que la volia ja no hi és (s'ha tancat l'acordió, s'ha canviat de pàgina): se salta.
      if (!wanted.has(job.id)) {
        pending.delete(job.id)
        storedListeners.delete(String(job.id))
        continue
      }
      await idle()
      try {
        await job.run()
      } catch {
        /* una miniatura que no surt no ha d'aturar les altres */
      }
      pending.delete(job.id)
    }
  } finally {
    running = false
    clearTimeout(releaseTimer)
    releaseTimer = setTimeout(() => {
      if (!running) void jobs().then((j) => j.releaseThumbRenderer())
    }, RELEASE_MS)
  }
}
