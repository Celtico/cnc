/**
 * Desfer/refer genèric (pur, sense React): el fan servir l'editor de mobles, el d'ambients i l'editor de perfils
 * (`useHistory`). Un sol model per a les dues maneres de treballar que hi havia:
 * - **Per temps** (`coalesceMs`, l'editor de mobles): canvis seguits (escriure «1180») compten com un sol pas.
 * - **Explícita** (`commit: false` en viu, `commit()` en deixar anar: arrossegar al plànol o al 3D és un sol pas).
 * Un canvi amb `group` s'ajunta amb l'anterior si és del mateix grup i arriba de pressa (escriure en un camp, fletxes).
 */
export interface History<T> {
  /** Passos desats (el darrer és l'anterior a `committed`). */
  past: T[]
  /** El que es veu (pot portar canvis en viu, encara sense pas). */
  present: T
  /** L'últim valor amb pas propi: desfer hi torna des d'aquí (els canvis en viu es descarten). */
  committed: T
  future: T[]
  /** Quan es va fer l'últim pas (0 després de desfer/refer: el següent canvi no s'hi ajunta). */
  at: number
  /** Grup de l'últim pas (`group` del canvi). */
  group?: string
}

export interface HistoryOptions {
  /** Passos com a molt (els més vells es perden). */
  limit?: number
  /** Canvis a menys d'aquests ms de l'anterior són el mateix pas (0: només els del mateix `group`). */
  coalesceMs?: number
}

export interface SetOptions {
  /** `false`: canvi en viu (arrossegant), sense pas; el pas es fa amb `commitHistory`. Per defecte `true`. */
  commit?: boolean
  /** Canvis del mateix grup seguits (< `coalesceMs`, o 500 ms) són un sol pas (p. ex. `field:x`). */
  group?: string
}

export const DEFAULT_LIMIT = 100
/** Finestra d'ajuntar per grup quan l'historial no ajunta per temps. */
export const GROUP_MS = 500

export function initHistory<T>(value: T): History<T> {
  return { past: [], present: value, committed: value, future: [], at: 0 }
}

/** Fa un pas de `committed` (si el valor ha canviat). */
function step<T>(h: History<T>, next: T, now: number, opts: HistoryOptions, group?: string): History<T> {
  const limit = Math.max(1, opts.limit ?? DEFAULT_LIMIT)
  return { past: [...h.past, h.committed].slice(-limit), present: next, committed: next, future: [], at: now, group }
}

/** Canvi nou: en viu (`commit: false`) o amb pas (ajuntat amb l'anterior si toca). Un valor idèntic no fa res. */
export function pushHistory<T>(h: History<T>, next: T, now: number, opts: HistoryOptions = {}, set: SetOptions = {}): History<T> {
  if (set.commit === false) return next === h.present ? h : { ...h, present: next }
  if (next === h.present && next === h.committed) return h
  const coalesceMs = opts.coalesceMs ?? 0
  const window = coalesceMs > 0 ? coalesceMs : GROUP_MS
  const sameGroup = set.group !== undefined ? set.group === h.group : coalesceMs > 0
  if (h.past.length > 0 && h.at > 0 && sameGroup && now - h.at < window) return { ...h, present: next, committed: next, future: [], at: now }
  return step(h, next, now, opts, set.group)
}

/** Fa un pas amb els canvis en viu (en deixar anar el que s'arrossegava). Sense canvis, res. */
export function commitHistory<T>(h: History<T>, now: number, opts: HistoryOptions = {}): History<T> {
  if (h.present === h.committed) return h
  return step(h, h.present, now, opts)
}

/** Torna a l'anterior pas (els canvis en viu sense pas es perden). */
export function undoHistory<T>(h: History<T>): History<T> {
  const prev = h.past.at(-1)
  if (h.past.length === 0) return h
  return { past: h.past.slice(0, -1), present: prev as T, committed: prev as T, future: [h.committed, ...h.future], at: 0 }
}

export function redoHistory<T>(h: History<T>): History<T> {
  if (h.future.length === 0) return h
  const next = h.future[0] as T
  return { past: [...h.past, h.committed], present: next, committed: next, future: h.future.slice(1), at: 0 }
}

export const canUndo = (h: History<unknown>) => h.past.length > 0
export const canRedo = (h: History<unknown>) => h.future.length > 0
