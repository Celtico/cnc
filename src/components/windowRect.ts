/** Mida i posició d'una finestra flotant (`FloatingWindow`), en px de la finestra del navegador. */
export interface WindowRect {
  x: number
  y: number
  width: number
  height: number
}

/**
 * Tipus de finestra, per a la mida i el lloc on s'obre el primer cop:
 * - `picker`: una tria (materials, ferratges, la fitxa d'una peça): estreta i alta, enganxada a la dreta (com el calaix d'abans).
 * - `editor`: un editor o un visor (Render, materials, textura, perfil, Vista CAM…): gran i al mig de la zona de treball
 *   (el menú lateral queda lliure).
 */
export type WindowKind = "picker" | "editor"

/** Amplada del menú lateral de l'ordinador (220 px) i una mica de marge: els editors no el tapen. */
const NAV = 236
/** Marge amb les vores de la finestra del navegador. */
const EDGE = 16
/** La mida més petita a què es pot encongir (i amb què es comprova que hi càpiga). */
export const MIN_SIZE = { width: 320, height: 240 }

/**
 * On s'obre una finestra el primer cop (sense mida recordada). `width` i `height`: la mida que vol (`picker`: 380 × tota
 * l'alçada; `editor`: fins a 1200 × 820); sempre dins de la zona visible.
 */
export function defaultWindowRect(kind: WindowKind, view: { width: number; height: number }, want: { width?: number; height?: number } = {}): WindowRect {
  const W = view.width
  const H = view.height
  if (kind === "picker") {
    const width = Math.max(MIN_SIZE.width, Math.min(want.width ?? 380, W - 2 * EDGE))
    const height = Math.max(MIN_SIZE.height, Math.min(want.height ?? H, H - 2 * EDGE))
    return { x: Math.max(0, W - width - EDGE), y: EDGE, width, height }
  }
  const width = Math.max(MIN_SIZE.width, Math.min(want.width ?? 1200, W - NAV - 48))
  const height = Math.max(MIN_SIZE.height, Math.min(want.height ?? 820, H - 96))
  return { x: Math.max(0, NAV + Math.round((W - NAV - width) / 2)), y: Math.max(0, Math.round((H - height) / 2)), width, height }
}

/** Una mida recordada, dins de la finestra d'ara (s'ha pogut fer més petita): s'encongeix i es mou fins que hi cap. */
export function fitWindowRect(r: WindowRect, view: { width: number; height: number }): WindowRect {
  const width = Math.min(Math.max(r.width, MIN_SIZE.width), view.width)
  const height = Math.min(Math.max(r.height, MIN_SIZE.height), view.height)
  const x = Math.min(Math.max(0, r.x), Math.max(0, view.width - width))
  const y = Math.min(Math.max(0, r.y), Math.max(0, view.height - height))
  return { x, y, width, height }
}

const key = (id: string) => `mobles:window:${id}`

/** L'última mida i posició d'una finestra (al navegador; `null` si no n'hi ha o no es pot llegir). */
export function readWindowRect(id: string): WindowRect | null {
  try {
    const raw = localStorage.getItem(key(id))
    if (!raw) return null
    const r = JSON.parse(raw) as Partial<WindowRect>
    return [r.x, r.y, r.width, r.height].every((v) => typeof v === "number" && Number.isFinite(v)) ? (r as WindowRect) : null
  } catch {
    return null
  }
}

export function writeWindowRect(id: string, r: WindowRect) {
  try {
    localStorage.setItem(key(id), JSON.stringify({ x: Math.round(r.x), y: Math.round(r.y), width: Math.round(r.width), height: Math.round(r.height) }))
  } catch {
    /* sense localStorage: es torna a obrir on toca */
  }
}

/** Les finestres flotants obertes (el `Positioner` de cada una). */
const WINDOW_SELECTOR = '[data-floating-window][data-part="positioner"]'

/**
 * Per als diàlegs modals que obren una finestra de tria (el substitut d'«Eliminar material»): la finestra no compta com a
 * «fora» (no tanca el diàleg ni queda sense punter). Va amb `trapFocus={false}` al diàleg, perquè el focus hi pugui entrar.
 */
export const WINDOWS_PERSIST = [() => document.querySelector(`${WINDOW_SELECTOR}[data-over-modal]`)]

/** Esc dins d'una finestra oberta des d'un diàleg modal tanca la finestra, no el diàleg (`onEscapeKeyDown` del diàleg). */
export function keepDialogOnWindowEscape(e: KeyboardEvent) {
  if ((e.target as Element | null)?.closest?.(WINDOW_SELECTOR)) e.preventDefault()
}
