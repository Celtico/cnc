import { arcOf, bulgeOf, ccwB, flatten, type Hole, type Panel } from "../../model"
import { pointInRing, rectsOverlap, type Pt2, type Rect2 } from "../region2d"
import { cutoutFeature, cylPocket } from "./features"
import { stepReal } from "./writer"
import { cross, neg, sub, unit, X, Z, type CylFace, type Face, type Loop, type PlaneFace, type V3 } from "./vec"

// --- Sòlid d'una peça -------------------------------------------------------------

export interface PanelSolid {
  faces: Face[]
  warnings: string[]
}

/**
 * Peça amb contorn (tauler de taula oval, arrodonit…): prisma del contorn (rectes i arcs,
 * cares planes i cilíndriques cap enfora). Els mecanitzats d'aquestes peces no es modelen
 * al STEP (surten al DXF i al CSV): s'avisa.
 */
export function outlineSolid(p: Panel, cad = false): PanelSolid {
  const T = p.thickness
  const pts = ccwB(p.outline!)
  const n = pts.length
  const at = (i: number, z: number): V3 => [pts[i]![0], pts[i]![1], z]
  const arcs = pts.map((q, i) => {
    const b = bulgeOf(q)
    if (Math.abs(b) < 1e-9) return null
    const a = arcOf(q, pts[(i + 1) % n]!, b)
    return { b, r: a.r, top: [a.cx, a.cy, T] as V3, bot: [a.cx, a.cy, 0] as V3, ax: b > 0 ? Z : neg(Z) }
  })
  const faces: Face[] = pts.map((_, i) => {
    const j = (i + 1) % n
    const arc = arcs[i]
    if (arc)
      return {
        kind: "cyl",
        loc: arc.bot,
        axis: Z,
        ref: unit(sub(at(i, 0), arc.bot)),
        radius: arc.r,
        // Arc convex (bulge +, contorn antihorari): el material és a dins, la cara mira enfora.
        outward: arc.b > 0,
        loop: [{ p: at(i, 0), arc: { center: arc.bot, axis: arc.ax } }, { p: at(j, 0) }, { p: at(j, T), arc: { center: arc.top, axis: neg(arc.ax) } }, { p: at(i, T) }],
      } satisfies CylFace
    const normal = unit(cross(sub(at(j, 0), at(i, 0)), Z))
    return { kind: "plane", loc: at(i, 0), normal, loops: [[{ p: at(i, 0) }, { p: at(j, 0) }, { p: at(j, T) }, { p: at(i, T) }]] } satisfies PlaneFace
  })
  // Cara A (dalt, +Z): el contorn en sentit antihorari; cara B (baix, −Z): al revés.
  const loopA: Loop = pts.map((_, i) => {
    const arc = arcs[i]
    return arc ? { p: at(i, T), arc: { center: arc.top, axis: arc.ax } } : { p: at(i, T) }
  })
  const loopB: Loop = []
  for (let k = 0; k < n; k++) {
    const j = (n - k) % n
    const i = (j - 1 + n) % n
    const arc = arcs[i]
    loopB.push(arc ? { p: at(j, 0), arc: { center: arc.bot, axis: neg(arc.ax) } } : { p: at(j, 0) })
  }
  const warnings: string[] = []
  const loopsA: Loop[] = [loopA]
  const loopsB: Loop[] = [loopB]
  if (cad) {
    // STEP per a TopSolid: talls passants (encaixos, mortalles) i forats de cara dins del contorn.
    const ring = flatten(pts)
    const taken: Rect2[] = []
    let skipped = p.grooves.length + p.holes.filter((h) => h.face === "edge").length
    const place = (bbox: Rect2, probe: Pt2[]): boolean => {
      if (!probe.every((q) => pointInRing(q, ring))) return false
      if (taken.some((r) => rectsOverlap(r, bbox, 0.01))) return false
      taken.push(bbox)
      return true
    }
    for (const c of p.cutouts ?? []) {
      const cc = c.kind === "rect" ? { kind: "polygon" as const, points: [[c.x, c.y], [c.x + c.w, c.y], [c.x + c.w, c.y + c.h], [c.x, c.y + c.h]] as [number, number][], tag: c.tag } : c
      const rf = cutoutFeature(cc, T)
      const probe: Pt2[] =
        cc.kind === "polygon" ? flatten(cc.points) : cc.kind === "circle" ? Array.from({ length: 8 }, (_, i) => [cc.x + (cc.diameter / 2) * Math.cos((i * Math.PI) / 4), cc.y + (cc.diameter / 2) * Math.sin((i * Math.PI) / 4)] as Pt2) : [[cc.x, cc.y], [cc.x + cc.w, cc.y], [cc.x + cc.w, cc.y + cc.h], [cc.x, cc.y + cc.h]]
      if (!place(rf.bbox, probe)) {
        skipped += 1
        continue
      }
      loopsA.push(rf.loop)
      if (rf.exit) loopsB.push(rf.exit.loop)
      faces.push(...rf.faces)
    }
    for (const h of p.holes) {
      if (h.face === "edge") continue
      const r = h.diameter / 2
      const top = h.face === "A"
      const bbox: Rect2 = { a0: h.x - r, a1: h.x + r, b0: h.y - r, b1: h.y + r }
      if (!place(bbox, [[h.x - r, h.y - r], [h.x + r, h.y - r], [h.x + r, h.y + r], [h.x - r, h.y + r]])) {
        skipped += 1
        continue
      }
      const pocket = cylPocket([h.x, h.y, top ? T : 0], top ? Z : neg(Z), X, r, blindDepth(p, h, warnings), false)
      ;(top ? loopsA : loopsB).push(pocket.loop)
      faces.push(...pocket.faces)
    }
    if (skipped) warnings.push(`${p.name} (${p.id}): peça amb forma; ${skipped} mecanitzats (ranures, forats de cantell o que surten del contorn) no es modelen al STEP.`)
  } else {
    const features = p.holes.length + p.grooves.length + (p.cutouts?.length ?? 0)
    if (features) warnings.push(`${p.name} (${p.id}): peça amb forma; els seus ${features} mecanitzats no es modelen al STEP (surten al DXF i al CSV).`)
  }
  faces.push({ kind: "plane", loc: at(0, T), normal: Z, loops: loopsA })
  faces.push({ kind: "plane", loc: at(0, 0), normal: neg(Z), loops: loopsB })
  return { faces, warnings }
}

/**
 * Fondària màxima d'un forat cec de cara: el taller descarta els cilindres amb fondària
 * ≥ gruix − 0,5 (els pren per radis de cantonada), així que en deixem 1 mm.
 */
const FACE_HOLE_FLOOR = 1

/** Fondària d'un forat cec de cara al STEP, amb avís si s'ha d'escurçar. */
export function blindDepth(p: Panel, h: Hole, warnings: string[]): number {
  const max = p.thickness - FACE_HOLE_FLOOR
  if (h.depth <= max) return h.depth
  warnings.push(`${p.name} (${p.id}): forat Ø${h.diameter} × ${h.depth} a (${h.x}, ${h.y}) cara ${h.face} massa fondo per a ${p.thickness} mm; al STEP fa ${stepReal(max)} mm.`)
  return max
}
