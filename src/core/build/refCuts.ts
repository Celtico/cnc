import { bounds, bulgeOf, ccwB, polygonTouchesRect, refSection, signedArea, type BPt, type Composition, type Cutout, type Panel, type RefObject, type Vec3 } from "../model"
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

/** L'objecte i la caixa de la peça es toquen (amb la secció real: rodona o de perfil). */
export function refTouchesBox(o: RefObject, b: Box, tol = 0.5): boolean {
  const sec = refSection(o)
  if (sec.range[1] <= b.min[sec.a]! + tol || b.max[sec.a]! <= sec.range[0] + tol) return false
  const { u, v } = sec
  if (sec.circle) {
    const { cu, cv, r } = sec.circle
    const du = Math.max(b.min[u]! - cu, 0, cu - b.max[u]!)
    const dv = Math.max(b.min[v]! - cv, 0, cv - b.max[v]!)
    return du * du + dv * dv < (r - tol) * (r - tol)
  }
  return polygonTouchesRect(sec.poly, b.min[u]!, b.min[v]!, b.max[u]!, b.max[v]!, tol)
}

export interface RefCutProblem {
  refId: string
  panel: Panel
  message: string
}

/**
 * Objectes que tallen: a cada peça que travessen en la seva direcció (`axis`, per defecte cap
 * a la paret) hi fan un forat passant amb la seva secció: cercle (cilindre), rectangle (caixa)
 * o polígon (perfil). Si arribaria a la vora de la peça (seria un rebaix del contorn) no es
 * fa i es retorna com a problema. Modifica les peces (afegeix `cutouts`).
 */
export function applyRefCuts(panels: Panel[], refs: RefObject[], boxOf: (p: Panel) => Box): RefCutProblem[] {
  const problems: RefCutProblem[] = []
  const r1 = (v: number) => Math.round(v * 10) / 10
  for (const o of refs) {
    if (o.effect !== "cut") continue
    const sec = refSection(o)
    for (const p of panels) {
      const b = boxOf(p)
      // Només talla les peces que travessa en la seva direcció (un tub cap a la paret forada
      // el fons, no el cantell dels prestatges; un desguàs vertical, la base i els prestatges).
      if (normalIndex(p) !== sec.a) {
        // Peça lliure que talla però travessa la peça de costat: no és un forat passant (seria
        // un forat al cantell o un buidat en 3D); s'avisa perquè es giri.
        if (o.id.startsWith("part:") && refTouchesBox(o, b)) {
          const lo = [0, 1, 2].map((a) => Math.max(o[(["x", "y", "z"] as const)[a]!], b.min[a]!))
          const size = [o.w, o.h, o.d]
          const hi = [0, 1, 2].map((a) => Math.min(o[(["x", "y", "z"] as const)[a]!] + size[a]!, b.max[a]!))
          if (hi.every((h, a) => h - lo[a]! > 1))
            problems.push({ refId: o.id, panel: p, message: `«${o.name}» travessa ${p.label} de costat, no en la direcció del seu gruix: no s'hi pot fer un forat passant. Posa la peça que talla amb la mateixa orientació que ${p.label}.` })
        }
        continue
      }
      if (!refTouchesBox(o, b)) continue
      const mid = (b.min[sec.a]! + b.max[sec.a]!) / 2
      const local = (pu: number, pv: number): [number, number] => {
        const q: [number, number, number] = [0, 0, 0]
        q[sec.u] = pu
        q[sec.v] = pv
        q[sec.a] = mid
        const l = toLocal(p, q)
        return [l[0], l[1]]
      }
      let cut: Cutout
      let pts: [number, number][]
      if (sec.circle) {
        const c = local(sec.circle.cu, sec.circle.cv)
        const r = sec.circle.r
        cut = { kind: "circle", x: c[0], y: c[1], diameter: r1(2 * r), tag: "ref" }
        pts = [[c[0] - r, c[1] - r], [c[0] + r, c[1] + r]]
      } else {
        pts = sec.poly.map(([pu, pv]) => local(pu, pv))
        if (sec.outline) {
          // Contorn exacte (amb arcs) a les coordenades de la peça. Si el pas (u, v) → peça
          // fa de mirall, els arcs giren al revés.
          const mirror = Math.sign(signedArea(pts)) !== Math.sign(signedArea(sec.poly))
          const outline = sec.outline.map((q): BPt => {
            const [x, y] = local(q[0], q[1])
            const b = bulgeOf(q) * (mirror ? -1 : 1)
            return b ? [r1(x), r1(y), b] : [r1(x), r1(y)]
          })
          cut = { kind: "polygon", points: ccwB(outline), tag: "ref" }
        } else {
          const bb = bounds(pts)
          cut = { kind: "rect", x: bb.x0, y: bb.y0, w: r1(bb.x1 - bb.x0), h: r1(bb.y1 - bb.y0), tag: "ref" }
        }
      }
      const bb = bounds(pts)
      if (bb.x0 < 1 || bb.y0 < 1 || bb.x1 > p.length - 1 || bb.y1 > p.width - 1) {
        problems.push({ refId: o.id, panel: p, message: `«${o.name}» toca la vora de ${p.label}: caldria un rebaix del contorn (encara no es fa).` })
        continue
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
