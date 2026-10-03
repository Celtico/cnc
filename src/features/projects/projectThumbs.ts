import { cameraSignature, thumbIsStale, type Composition, type MaterialPref } from "../../core/model"
import { THUMB_VERSION } from "../../components/viewer/thumbVersion"
import { compositionOf } from "../../db/compositionStore"
import { db, type Project } from "../../db/db"
import { materialsPrint, templatePrint, readThumb, writeThumb } from "./thumbStore"

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

export function needsThumb(p: Project): boolean {
  return thumbIsStale(p, p.updatedAt, THUMB_VERSION, p.composition?.camera)
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
      const url = await (await jobs()).renderProjectThumb(compositionOf(fresh), materials)
      // Sense tocar `updatedAt` ni `edited`. `thumbCam` és la de la fila (la que mira `needsThumb`).
      const cam = cameraSignature(fresh.composition?.camera)
      if (url) await db.projects.update(p.id, { thumb: url, thumbAt: fresh.updatedAt, thumbV: THUMB_VERSION, thumbCam: cam })
    },
  })
  void drain()
  return release
}

/**
 * Plantilles (catàleg de botiga, objectes): la miniatura es fa igual però no és de l'usuari: es guarda en memòria
 * i a la Cache Storage (`thumbStore`), amb una empremta de la plantilla i dels materials. `onDone` rep la imatge.
 */
const templateThumbs = new Map<string, string>()
const templateListeners = new Map<string, Set<(url: string) => void>>()
const templateSig = (comp: Composition, materials: readonly MaterialPref[]) => `${THUMB_VERSION}-${templatePrint(comp)}-${materialsPrint(materials)}`
export function templateThumb(id: string, comp: Composition, materials: readonly MaterialPref[]): string | undefined {
  return templateThumbs.get(`${id}|${templateSig(comp, materials)}`)
}
export function requestTemplateThumb(id: string, make: () => Composition, materials: MaterialPref[], onDone: (url: string) => void): () => void {
  const sig = templateSig(make(), materials)
  const mem = `${id}|${sig}`
  const hit = templateThumbs.get(mem)
  if (hit) {
    onDone(hit)
    return () => {}
  }
  const key = `t:${mem}`
  // Una altra targeta de la mateixa plantilla (la mateixa a dues categories): també rep la imatge.
  const listeners = templateListeners.get(key) ?? new Set<(url: string) => void>()
  templateListeners.set(key, listeners)
  listeners.add(onDone)
  const finish = (url: string) => {
    templateThumbs.set(mem, url)
    for (const f of templateListeners.get(key) ?? []) f(url)
    templateListeners.delete(key)
  }
  let release: (() => void) | undefined
  let cancelled = false
  // Primer, la desada d'una altra sessió; si no n'hi ha, a la cua.
  void readThumb("moble", id, sig).then((saved) => {
    if (cancelled) return
    if (saved) return finish(saved)
    release = enqueueThumb(key, async () => {
      const url = await (await jobs()).renderTemplateThumb(make(), materials)
      if (url) {
        finish(url)
        void writeThumb("moble", id, sig, url)
      } else templateListeners.delete(key)
    })
  })
  return () => {
    cancelled = true
    listeners.delete(onDone)
    release?.()
  }
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
        templateListeners.delete(String(job.id))
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
