import { freeX, moduleFootprint, moduleFrontFace, modulePlacements, moduleRot, rightWallX, rowOf, sideWallOf, type Composition, type Module, type ModuleRot } from "./composition"

/** La paret que un mòdul de la fila té al darrere: la del fons o la d'un costat. */
export type BackWall = "back" | "left" | "right"

const E = 1

/**
 * **Primer la posició** (per decisió de l'usuari, 2026-10-22: «primer ha de mirar la posició del moble, després s'apliquen
 * les mateixes [regles] a tots igual»): la paret que cada mòdul de la fila té al darrere. Sense girar, la del fons. Girat de
 * costat (90° o 270°) al primer o l'últim lloc de la composició, la paret d'aquell costat; enmig (o sol), el costat que
 * diu el seu gir. Els lliures (X pròpia) no en tenen (null).
 */
export function wallSides(comp: Pick<Composition, "modules">): (BackWall | null)[] {
  const places = modulePlacements(comp as Composition)
  const boxes = comp.modules.map((m, i) => moduleFootprint(m, places[i]!, moduleFrontFace(m)))
  const x0 = Math.min(...boxes.map((b) => b.x0)), x1 = Math.max(...boxes.map((b) => b.x1))
  return comp.modules.map((m, i) => {
    if (freeX(m)) return null
    const own = sideWallOf(m)
    if (own) return own
    const rot = moduleRot(m)
    if (rot !== 90 && rot !== 270) return "back"
    const b = boxes[i]!
    const left = b.x0 - x0 < E, right = x1 - b.x1 < E
    if (left && !right) return "left"
    if (right && !left) return "right"
    return rot === 90 ? "left" : "right"
  })
}

/** El gir d'un mòdul d'esquena a la paret d'un costat: els fronts miren cap a dins (90 = a la dreta). */
const SIDE_ROT: Record<"left" | "right", ModuleRot> = { left: 90, right: 270 }

/**
 * Cada mòdul de la fila girat cap a la paret que té al darrere (`wallSides`): d'esquena a la paret esquerra, els fronts a
 * la dreta; a la dreta, a l'esquerra. Tota la resta (caixa, penjadors i regleta, cantells, fronts, moviment) es fa com amb
 * la paret del fons i gira amb el mòdul. No es guarda: es recalcula sempre.
 */
export function withWallBacks<T extends Pick<Composition, "modules">>(comp: T): T {
  if (!comp.modules.some((m) => m.rot === 90 || m.rot === 270)) return comp
  const sides = wallSides(comp)
  let changed = false
  const modules = comp.modules.map((m, i) => {
    const s = sides[i]
    if (s !== "left" && s !== "right" || moduleRot(m) === SIDE_ROT[s]) return m
    changed = true
    return { ...m, rot: SIDE_ROT[s] }
  })
  return changed ? { ...comp, modules } : comp
}

/**
 * Treu el mòdul `i` de la fila del fons sense moure els altres: el següent de la seva fila guanya la separació i el lloc que
 * ocupava (per quan passa a la paret d'un costat o surt de la fila).
 */
export function detachFromRow(comp: Pick<Composition, "modules">, i: number): Module[] {
  const modules = comp.modules.map((x) => ({ ...x }))
  const m = comp.modules[i]!
  if (freeX(m) || sideWallOf(m)) return modules
  const places = modulePlacements(comp as Composition)
  const foot = (k: number) => moduleFootprint(comp.modules[k]!, places[k]!, moduleFrontFace(comp.modules[k]!))
  const mates = comp.modules.map((x, k) => (k !== i && rowOf(x) === rowOf(m) && !freeX(x) && !sideWallOf(x) ? k : -1)).filter((k) => k >= 0)
  const after = mates.find((k) => k > i)
  const prev = mates.filter((k) => k < i).at(-1)
  if (after !== undefined) modules[after]!.gapBefore = Math.max(0, Math.round(foot(after).x0 - (prev !== undefined ? foot(prev).x1 : 0)))
  return modules
}

/**
 * La paret dreta queda on és (per decisió de l'usuari, 2026-10-22: «m'ha mogut la paret… si hi ha un moble a la paret, mirar
 * primer si ja hi ha un moble a la paret»): en cada canvi, si hi ha mòduls d'esquena a la paret dreta, se'n desa la posició
 * (`scene.rightWallX`). La primera vegada és la d'abans del canvi: on hi havia la paret, o on acabava el moble (el mòdul
 * que s'hi posa era l'últim de la fila). Només s'allunya si un mòdul de la fila la passaria.
 */
export function withRightWall(prev: Composition, next: Composition): Composition {
  const now = rightWallX(next)
  if (now === undefined) return next
  const before = prev.scene?.rightWallX ?? rightWallX(prev) ?? rightmost(prev)
  const x = Math.round(Math.max(now, next.scene?.rightWallX ?? before))
  return x === next.scene?.rightWallX && now <= x ? next : { ...next, scene: { ...next.scene, rightWallX: x } }
}

const rightmost = (comp: Composition): number => {
  const at = modulePlacements(comp)
  return Math.max(0, ...comp.modules.map((m, i) => moduleFootprint(m, at[i]!, moduleFrontFace(m)).x1))
}
