import { type Composition, type Cutout, type Panel, type RefObject, type Vec3, AXIS_INDEX } from "../model"
import { buildModule } from "./buildModule"
import { toLocal } from "./geometry"
import { modulePlacements, refOnPanel } from "../model"

type Box = { min: Vec3; max: Vec3 }

/** Eix normal d'una peça (0 = x, 1 = y, 2 = z): el del gruix. */
function normalIndex(p: Panel): 0 | 1 | 2 {
  const z = p.placement.zAxis
  const a = [Math.abs(z[0]), Math.abs(z[1]), Math.abs(z[2])]
  return a[0]! >= a[1]! && a[0]! >= a[2]! ? 0 : a[1]! >= a[2]! ? 1 : 2
}

/** L'objecte i la caixa de la peça es toquen (el cilindre, amb la seva secció rodona). */
export function refTouchesBox(o: RefObject, b: Box, tol = 0.5): boolean {
  const min: Vec3 = [o.x, o.y, o.z]
  const max: Vec3 = [o.x + o.w, o.y + o.h, o.z + o.d]
  for (let i = 0; i < 3; i++) if (max[i]! <= b.min[i]! + tol || b.max[i]! <= min[i]! + tol) return false
  if (o.shape !== "cylinder") return true
  // Secció rodona: distància del centre del cercle al rectangle de la caixa, en el pla
  // perpendicular a l'eix.
  const a = AXIS_INDEX[o.axis ?? "z"]
  const [i, j] = ([0, 1, 2] as const).filter((k) => k !== a) as [number, number]
  const r = Math.min(max[i]! - min[i]!, max[j]! - min[j]!) / 2
  const ci = (min[i]! + max[i]!) / 2
  const cj = (min[j]! + max[j]!) / 2
  const di = Math.max(b.min[i]! - ci, 0, ci - b.max[i]!)
  const dj = Math.max(b.min[j]! - cj, 0, cj - b.max[j]!)
  return di * di + dj * dj < (r - tol) * (r - tol)
}

export interface RefCutProblem {
  refId: string
  panel: Panel
  message: string
}

/**
 * Objectes que tallen: a cada peça que travessen en la seva direcció (`axis`, per defecte cap
 * a la paret) hi fan un forat passant amb la seva secció (cercle o rectangle). Si
 * el forat arribaria a la vora de la peça (seria un rebaix del contorn) no es fa i es
 * retorna com a problema. Modifica les peces (afegeix `cutouts`).
 */
export function applyRefCuts(panels: Panel[], refs: RefObject[], boxOf: (p: Panel) => Box): RefCutProblem[] {
  const problems: RefCutProblem[] = []
  for (const o of refs) {
    if (o.effect !== "cut") continue
    const min: Vec3 = [o.x, o.y, o.z]
    const max: Vec3 = [o.x + o.w, o.y + o.h, o.z + o.d]
    for (const p of panels) {
      const b = boxOf(p)
      if (!refTouchesBox(o, b)) continue
      const n = normalIndex(p)
      // Només talla les peces que travessa en la seva direcció (un tub cap a la paret forada
      // el fons, no el cantell dels prestatges; un desguàs vertical, la base i els prestatges).
      if (AXIS_INDEX[o.axis ?? "z"] !== n) continue
      const mid = (b.min[n]! + b.max[n]!) / 2
      const point = (v: Vec3): Vec3 => {
        const q: [number, number, number] = [v[0], v[1], v[2]]
        q[n] = mid
        return q
      }
      let cut: Cutout
      if (o.shape === "cylinder") {
        const [i, j] = ([0, 1, 2] as const).filter((k) => k !== n) as [number, number]
        const c = toLocal(p, point([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]))
        const d = Math.min(max[i]! - min[i]!, max[j]! - min[j]!)
        cut = { kind: "circle", x: c[0], y: c[1], diameter: Math.round(d * 10) / 10, tag: "ref" }
        if (c[0] - d / 2 < 1 || c[1] - d / 2 < 1 || c[0] + d / 2 > p.length - 1 || c[1] + d / 2 > p.width - 1) {
          problems.push({ refId: o.id, panel: p, message: `«${o.name}» toca la vora de ${p.label}: caldria un rebaix del contorn (encara no es fa).` })
          continue
        }
      } else {
        const a = toLocal(p, point(min))
        const c = toLocal(p, point(max))
        const x0 = Math.min(a[0], c[0]), x1 = Math.max(a[0], c[0])
        const y0 = Math.min(a[1], c[1]), y1 = Math.max(a[1], c[1])
        if (x0 < 1 || y0 < 1 || x1 > p.length - 1 || y1 > p.width - 1) {
          problems.push({ refId: o.id, panel: p, message: `«${o.name}» toca la vora de ${p.label}: caldria un rebaix del contorn (encara no es fa).` })
          continue
        }
        cut = { kind: "rect", x: x0, y: y0, w: Math.round((x1 - x0) * 10) / 10, h: Math.round((y1 - y0) * 10) / 10, tag: "ref" }
      }
      p.cutouts = [...(p.cutouts ?? []), cut]
    }
  }
  return problems
}

/**
 * Els passacables dels mòduls (versió anterior) passen a ser objectes que tallen: un cilindre
 * (o una caixa, si era rectangular) al mateix lloc, que travessa només aquella peça.
 */
export function migrateCableHoles(comp: Composition, boxOf: (p: Panel) => Box): Composition {
  if (!comp.modules.some((m) => m.extras.cableHoles.length)) return comp
  const places = modulePlacements(comp)
  const refs: RefObject[] = [...comp.references]
  const modules = comp.modules.map((m, i) => {
    if (!m.extras.cableHoles.length) return m
    const at = places[i]!
    const { panels } = buildModule({ ...m, extras: { ...m.extras, cableHoles: [] } })
    m.extras.cableHoles.forEach((h0, k) => {
      // Els que seguien un objecte (només durant un dia) es queden on era l'objecte.
      const follow = h0.ref ? comp.references.find((r) => r.id === h0.ref) : undefined
      const h = follow ? { ...h0, ...refOnPanel(follow, h0.panel, at), w: h0.w, h: h0.h } : h0
      const target =
        h.panel === "left" ? panels.find((p) => p.id === "side-left")
        : h.panel === "right" ? panels.find((p) => p.id === "side-right")
        : panels.find((p) => p.role === h.panel)
      if (!target) return
      const b0 = boxOf(target)
      const b: Box = { min: [b0.min[0] + at.x, b0.min[1] + at.y, b0.min[2]], max: [b0.max[0] + at.x, b0.max[1] + at.y, b0.max[2]] }
      // Centre del forat (coordenades de la composició) i eix normal de la peça.
      const c: [number, number, number] =
        h.panel === "back" ? [at.x + h.x, at.y + h.y, 0]
        : h.panel === "top" || h.panel === "bottom" ? [at.x + h.x, 0, h.y]
        : [0, at.y + h.y, h.x]
      const n = h.panel === "back" ? 2 : h.panel === "top" || h.panel === "bottom" ? 1 : 0
      const rect = h.shape === "rect"
      // Mida en cada eix: [u, v] del passacables en les dues direccions del pla.
      const su = rect ? (h.w ?? h.diameter) : h.diameter
      const sv = rect ? (h.h ?? h.diameter) : h.diameter
      const size: [number, number, number] = [0, 0, 0]
      const axes: [number, number] = n === 2 ? [0, 1] : n === 1 ? [0, 2] : [2, 1]
      size[axes[0]] = su
      size[axes[1]] = sv
      size[n] = b.max[n]! - b.min[n]! + 2
      const lo: [number, number, number] = [c[0] - size[0] / 2, c[1] - size[1] / 2, c[2] - size[2] / 2]
      lo[n] = b.min[n]! - 1
      refs.push({
        id: `${m.id}-cable${k + 1}`,
        name: rect ? `Passacables ${su} × ${sv}` : `Passacables Ø${h.diameter}`,
        w: size[0],
        h: size[1],
        d: size[2],
        x: Math.round(lo[0] * 10) / 10,
        y: Math.round(lo[1] * 10) / 10,
        z: Math.round(lo[2] * 10) / 10,
        effect: "cut",
        ...(rect ? {} : { shape: "cylinder" as const, axis: (["x", "y", "z"] as const)[n] }),
      })
    })
    return { ...m, extras: { ...m.extras, cableHoles: [] } }
  })
  return { ...comp, modules, references: refs }
}
