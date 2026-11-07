import { moduleOrigins3 } from "./composition"
import type { Composition } from "./compositionSchema"
import type { FreePart, PartOrient } from "./freePart"
import { partBox } from "./freePart"
import type { Panel, PanelRole, Vec3 } from "./panel"

/**
 * **Bloc condicionat** (el del Taulell, cel 2026-11-07): una peça que omple el buit on s'ha clicat i el segueix. Es busquen,
 * des d'un punt de dins del buit, les peces més properes a cada costat dins del pla de la peça; la peça va d'una a l'altra
 * (menys la folgança) i té el gruix triat, centrada al punt en la direcció del gruix. Si el moble canvia, es torna a ajustar.
 * Port fidel de `fitBlock` del Taulell (mateixos eixos: X amplada, Y alçada, Z fondària).
 */

type Box = { min: Vec3; max: Vec3 }
/** Eix del gruix (`n`) i els dos del pla (`u`, `v`) de cada orientació. */
const FIT_AX: Record<PartOrient, { n: number; u: number; v: number }> = {
  flat: { n: 1, u: 0, v: 2 },
  side: { n: 0, u: 2, v: 1 },
  front: { n: 2, u: 1, v: 0 },
}
/** El nom de la peça nova, com al Taulell. */
export const FIT_NOUN: Record<PartOrient, string> = { flat: "Prestatge", side: "Divisió", front: "Travesser" }

/** Els fronts no fan de paret del buit (al Taulell, «Porta» i «Frontal»). */
const FRONT_ROLES = new Set<PanelRole>(["door", "drawerFront", "flap", "grille", "hatch", "panel"])

/** La caixa (alineada amb els eixos) d'una peça construïda, en mm de la composició. */
export function panelAabb(p: Panel): Box {
  const { origin: o, xAxis: x, yAxis: y, zAxis: z } = p.placement
  const min: Vec3 = [Infinity, Infinity, Infinity]
  const max: Vec3 = [-Infinity, -Infinity, -Infinity]
  for (const a of [0, p.length])
    for (const b of [0, p.width])
      for (const c of [0, p.thickness])
        for (let k = 0; k < 3; k++) {
          const v = o[k]! + x[k]! * a + y[k]! * b + z[k]! * c
          if (v < min[k]!) min[k] = v
          if (v > max[k]!) max[k] = v
        }
  return { min, max }
}

/** Les parets que compten per als blocs: totes les peces menys els fronts. */
export function fitWalls(panels: Panel[]): Box[] {
  return panels.filter((p) => !FRONT_ROLES.has(p.role)).map(panelAabb)
}

const r1 = (v: number) => Math.round(v * 10) / 10

/** El bloc que omple el buit des de `seed`, o null si allà no hi ha cap buit tancat. */
export function fitBlock(boxes: Box[], seed: Vec3, orient: PartOrient, T: number, gap: number): Box | null {
  const ax = FIT_AX[orient]
  const EPS = 0.5
  const plane = [ax.u, ax.v]
  const inside = (b: Box, a: number) => b.min[a]! < seed[a]! - EPS && b.max[a]! > seed[a]! + EPS
  if (boxes.some((b) => [0, 1, 2].every((a) => inside(b, a)))) return null
  const lo: (number | undefined)[] = []
  const hi: (number | undefined)[] = []
  const loB: (Box | undefined)[] = []
  const hiB: (Box | undefined)[] = []
  for (const a of plane) {
    const others = [0, 1, 2].filter((o) => o !== a)
    for (const b of boxes) {
      if (!others.every((o) => inside(b, o))) continue
      if (b.max[a]! <= seed[a]! + EPS && (lo[a] === undefined || b.max[a]! > lo[a]!)) {
        lo[a] = b.max[a]
        loB[a] = b
      }
      if (b.min[a]! >= seed[a]! - EPS && (hi[a] === undefined || b.min[a]! < hi[a]!)) {
        hi[a] = b.min[a]
        hiB[a] = b
      }
    }
  }
  const min: Vec3 = [0, 0, 0]
  const max: Vec3 = [0, 0, 0]
  for (const a of plane) {
    const o = a === ax.u ? ax.v : ax.u
    const walls = [loB[o], hiB[o]].filter((b): b is Box => !!b)
    let l = lo[a] !== undefined ? lo[a]! + gap : undefined
    let h = hi[a] !== undefined ? hi[a]! - gap : undefined
    if (l === undefined && walls.length) l = Math.max(...walls.map((b) => b.min[a]!))
    if (h === undefined && walls.length) h = Math.min(...walls.map((b) => b.max[a]!))
    if (l === undefined || h === undefined || h - l < 5) return null
    min[a] = r1(l)
    max[a] = r1(h)
  }
  min[ax.n] = r1(seed[ax.n]! - T / 2)
  max[ax.n] = r1(min[ax.n]! + T)
  return { min, max }
}

/** La peça lliure (coordenades pròpies: relatives al mòdul si n'és) amb la caixa `b` (de la composició). */
export function partWithBox(p: FreePart, b: Box, offset: Vec3): FreePart {
  const s: Vec3 = [b.max[0] - b.min[0], b.max[1] - b.min[1], b.max[2] - b.min[2]]
  const wh: [number, number] = p.orient === "front" ? [s[0], s[1]] : p.orient === "side" ? [s[2], s[1]] : [s[0], s[2]]
  return { ...p, w: r1(wh[0]), h: r1(wh[1]), x: r1(b.min[0] - offset[0]), y: r1(b.min[1] - offset[1]), z: r1(b.min[2] - offset[2]) }
}

/** Un límit d'un tauler dinàmic (`FreePart.dyn.limits`). */
export type DynLimit = NonNullable<FreePart["dyn"]>["limits"][number]
/** L'orientació d'una peça pel seu eix del gruix. */
export const ORIENT_OF_AXIS: PartOrient[] = ["side", "flat", "front"]
/** Els noms dels costats de cada eix, com al Taulell (límit de baix `s: 0`, de dalt `s: 1`). */
export const SIDE_NAMES: [string, string][] = [
  ["Esquerra", "Dreta"],
  ["Baix", "Dalt"],
  ["Darrere", "Davant"],
]

/** Les caixes de les peces que fan de paret, amb el seu id (per als límits d'un tauler dinàmic). */
export function wallBoxes(panels: Panel[]): { id: string; box: Box }[] {
  return panels.filter((p) => !FRONT_ROLES.has(p.role) && p.role !== "hardware").map((p) => ({ id: p.id, box: panelAabb(p) }))
}

/** Les cares més properes que envolten `seed` en els dos eixos que no són `t` (les del Taulell, `autoLimits`). */
export function autoLimits(walls: { id: string; box: Box }[], seed: Vec3, t: number, skip: (id: string) => boolean): DynLimit[] {
  const out: DynLimit[] = []
  for (const a of [0, 1, 2]) {
    if (a === t) continue
    const others = [0, 1, 2].filter((k) => k !== a)
    let lo: { l: number; id: string } | undefined
    let hi: { l: number; id: string } | undefined
    for (const w of walls) {
      if (skip(w.id)) continue
      const b = w.box
      if (!others.every((k) => b.min[k]! < seed[k]! - 0.5 && b.max[k]! > seed[k]! + 0.5)) continue
      if (b.max[a]! <= seed[a]! + 0.5 && (!lo || b.max[a]! > lo.l)) lo = { l: b.max[a]!, id: w.id }
      if (b.min[a]! >= seed[a]! - 0.5 && (!hi || b.min[a]! < hi.l)) hi = { l: b.min[a]!, id: w.id }
    }
    if (lo) out.push({ panel: lo.id, a, s: 0, off: 0 })
    if (hi) out.push({ panel: hi.id, a, s: 1, off: 0 })
  }
  return out
}

/**
 * La caixa d'un tauler dinàmic (port de `dynBox` del Taulell): cada límit posa un costat a la cara de la seva peça (més el
 * desplaçament, cap a dins); un costat sense límit va fins on arriben les peces de referència; en el gruix, el tauler
 * surt de la cara on es recolza. Null si les peces ja no hi són o el tauler queda sense mida.
 */
export function dynBox(dyn: NonNullable<FreePart["dyn"]>, boxOf: (id: string) => Box | undefined, T: number): Box | null {
  const lo: (number | null)[] = [null, null, null]
  const hi: (number | null)[] = [null, null, null]
  const refs: Box[] = []
  for (const L of dyn.limits) {
    const b = boxOf(L.panel)
    if (!b) continue
    refs.push(b)
    if (L.s === 0) lo[L.a] = b.max[L.a]! + L.off
    else hi[L.a] = b.min[L.a]! - L.off
  }
  if (!refs.length) return null
  const ext = (a: number): [number, number] => {
    let mn = Math.max(...refs.map((b) => b.min[a]!))
    let mx = Math.min(...refs.map((b) => b.max[a]!))
    if (mx - mn < 1) {
      mn = Math.min(...refs.map((b) => b.min[a]!))
      mx = Math.max(...refs.map((b) => b.max[a]!))
    }
    return [mn, mx]
  }
  const far = (a: number, s: number) => (s ? Math.max(...refs.map((b) => b.max[a]!)) : Math.min(...refs.map((b) => b.min[a]!)))
  const min: Vec3 = [0, 0, 0]
  const max: Vec3 = [0, 0, 0]
  for (let a = 0; a < 3; a++) {
    if (a === dyn.t) continue
    const [mn, mx] = ext(a)
    let l = lo[a]!
    let h = hi[a]!
    if (lo[a] === null) l = hi[a] !== null && hi[a]! <= mn + 0.5 ? far(a, 0) : mn
    if (hi[a] === null) h = lo[a] !== null && lo[a]! >= mx - 0.5 ? far(a, 1) : mx
    min[a] = l
    max[a] = h
  }
  const t = dyn.t
  if (lo[t] !== null) {
    min[t] = lo[t]!
    max[t] = lo[t]! + T
  } else if (hi[t] !== null) {
    max[t] = hi[t]!
    min[t] = hi[t]! - T
  } else return null
  if ([0, 1, 2].some((a) => max[a]! - min[a]! < 1)) return null
  return { min: min.map(r1) as Vec3, max: max.map(r1) as Vec3 }
}

/**
 * Els blocs condicionats (`FreePart.fit`) i els taulers dinàmics (`FreePart.dyn`) tornats a ajustar, en ordre (cada peça fa
 * de paret de les de després, com al Taulell). Sense canvis, la mateixa llista. Una peça que s'ha quedat sense buit o sense
 * les seves cares es queda com estava.
 */
export function refitParts(comp: Composition, panels: Panel[]): FreePart[] {
  const parts = comp.parts ?? []
  if (!parts.some((p) => p.fit || p.dyn)) return parts
  const origins = moduleOrigins3(comp)
  const built = panels.filter((p) => !p.id.startsWith("part:"))
  const walls = fitWalls(built)
  const boxes = new Map(built.map((p) => [p.id, panelAabb(p)] as const))
  const out: FreePart[] = []
  let changed = false
  for (const p of parts) {
    const off: Vec3 = (p.module && origins.get(p.module)) || [0, 0, 0]
    const own = partBox(p)
    const box = { min: own.min.map((v, k) => v + off[k]!) as Vec3, max: own.max.map((v, k) => v + off[k]!) as Vec3 }
    let f: Box | null = null
    if (p.fit) f = fitBlock(walls, box.min.map((v, k) => (v + box.max[k]!) / 2) as Vec3, p.orient, p.thickness, p.fit.gap ?? 0)
    else if (p.dyn) f = dynBox(p.dyn, (id) => boxes.get(id), p.thickness)
    const next = f ? partWithBox(p, f, off) : p
    if (next.w !== p.w || next.h !== p.h || next.x !== p.x || next.y !== p.y || next.z !== p.z) changed = true
    out.push(next)
    walls.push(f ?? box)
    boxes.set(`part:${p.id}`, f ?? box)
  }
  return changed ? out : parts
}
