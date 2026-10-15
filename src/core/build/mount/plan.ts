import type { Panel, PanelFitting, Vec3 } from "../../model"
import { r, toWorld } from "../geometry"
import { BUILTIN_HINGE, boxOf, fittingBox, holeEntry, mountHoles, worldDir } from "./box"
import type { HardwareMount } from "./types"

// --- El pla (vista de dalt, secció a l'alçada del forat principal) ----------------------------------------------------

/** Pla: x = X del mòdul (a la dreta), z = Z del mòdul (cap al davant = cap avall a la pantalla). */
export interface PlanRect {
  id: string
  label: string
  role: Panel["role"]
  thickness: number
  x0: number
  z0: number
  x1: number
  z1: number
  /** Gruix al llarg de x (una peça vertical de costat) o de z (un front). */
  along: "x" | "z" | "y"
}
export interface PlanHole {
  /** Rectangle (forat horitzontal, de costat) o cercle (forat vertical, vist des de dalt). */
  poly?: [number, number][]
  circle?: { cx: number; cz: number; r: number }
  /** El pla de tall el travessa (si no, és a sobre o a sota: es dibuixa amagat). */
  cut: boolean
  proposed: boolean
  own: boolean
  panelId: string
  tag?: string
}
export interface PlanDim {
  a: [number, number]
  b: [number, number]
  /** On va la línia de cota: desplaçament perpendicular des de a–b (mm, signe = costat). */
  offset: number
  label: string
  title: string
}
export interface PlanBox {
  x0: number
  z0: number
  x1: number
  z1: number
  dashed: boolean
  label?: string
}
export interface MountPlan {
  sectionY: number
  rects: PlanRect[]
  holes: PlanHole[]
  /** Ferratge (el volum del model importat o un de simplificat), projectat. */
  fittings: PlanBox[]
  dims: PlanDim[]
  view: { x: number; z: number; w: number; h: number }
}

const fmt = (v: number) => String(r(v)).replace(".", ",")

/**
 * El pla del muntatge: vista de dalt amb un tall a l'alçada del forat principal. Les peces que el tall travessa en
 * secció (rectangles amb el gruix), els forats a ±40 mm (els que el tall travessa, plens; els altres, amagats), el
 * ferratge projectat i les cotes (a les frontisses: cassoleta al cantell, C, recobriment, joc, fondària i la filera de
 * la placa al lateral). Tot surt de les peces del motor.
 */
export function mountPlan(m: HardwareMount): MountPlan | null {
  // Un accessori sense cap forat (barra, perfil LED, marc): el tall a l'alçada del que es veu (`aim`).
  const at = m.focus?.at ?? m.aim?.at
  if (!at) return null
  const Y0 = at[1]
  const band = 40
  const rects: PlanRect[] = []
  const holes: PlanHole[] = []
  const fittings: PlanBox[] = []
  const own = (h: { tag?: string }) => !!h.tag && m.tags.includes(h.tag)
  const proposed = (h: { tag?: string }) => !!h.tag && m.proposedTags.includes(h.tag)
  for (const p of m.panels) {
    const b = boxOf(p)
    if (Y0 < b.min[1] - 0.01 || Y0 > b.max[1] + 0.01) continue
    const sx = b.max[0] - b.min[0]
    const sy = b.max[1] - b.min[1]
    const sz = b.max[2] - b.min[2]
    const along = Math.abs(sx - p.thickness) < 0.01 ? "x" : Math.abs(sz - p.thickness) < 0.01 ? "z" : Math.abs(sy - p.thickness) < 0.01 ? "y" : "x"
    rects.push({ id: p.id, label: p.label, role: p.role, thickness: p.thickness, x0: b.min[0], z0: b.min[2], x1: b.max[0], z1: b.max[2], along })
  }
  const inPlan = new Set(rects.map((x) => x.id))
  for (const p of m.panels) {
    if (!inPlan.has(p.id)) continue
    for (const h of mountHoles(p)) {
      const e = holeEntry(p, h)
      const E = toWorld(p, e.at)
      const n = worldDir(p, e.normal)
      const B: Vec3 = [E[0] - n[0] * h.depth, E[1] - n[1] * h.depth, E[2] - n[2] * h.depth]
      const rad = h.diameter / 2
      const vertical = Math.abs(n[1]) > 0.7
      const base = { panelId: p.id, proposed: proposed(h), own: own(h), ...(h.tag ? { tag: h.tag } : {}) }
      if (vertical) {
        const lo = Math.min(E[1], B[1])
        const hi = Math.max(E[1], B[1])
        if (Y0 < lo - band || Y0 > hi + band) continue
        holes.push({ ...base, circle: { cx: E[0], cz: E[2], r: rad }, cut: Y0 >= lo && Y0 <= hi })
      } else {
        if (Math.abs(E[1] - Y0) > band + rad) continue
        // Perpendicular a l'eix al pla x–z.
        const len = Math.hypot(n[0], n[2]) || 1
        const px = (-n[2] / len) * rad
        const pz = (n[0] / len) * rad
        holes.push({ ...base, poly: [[E[0] + px, E[2] + pz], [B[0] + px, B[2] + pz], [B[0] - px, B[2] - pz], [E[0] - px, E[2] - pz]], cut: Math.abs(E[1] - Y0) <= rad + 0.01 })
      }
    }
    // El ferratge: el model importat (la seva caixa) o, a les frontisses de l'app, un volum simplificat a cada cassoleta.
    const fits: { f: Pick<PanelFitting, "x" | "y" | "face" | "v">; bb: { min: Vec3; max: Vec3 }; label?: string }[] = (p.fittings ?? []).flatMap((f) => (f.bbox ? [{ f, bb: f.bbox }] : []))
    if (p.role === "door" && !p.fittings?.length)
      for (const h of p.holes.filter((x) => x.tag === "hinge")) fits.push({ f: { x: h.x, y: h.y, face: h.face === "B" ? "B" : "A", v: [0, 1] }, bb: BUILTIN_HINGE(h.diameter) })
    for (const { f, bb } of fits) {
      const fb = fittingBox(p, f, bb)
      if (Y0 < fb.min[1] - 0.01 || Y0 > fb.max[1] + 0.01) continue
      fittings.push({ x0: fb.min[0], z0: fb.min[2], x1: fb.max[0], z1: fb.max[2], dashed: !p.fittings?.length })
    }
  }
  const dims: PlanDim[] = []
  const door = m.hinge && rects.find((x) => x.id === m.hinge!.doorId)
  const side = m.hinge && rects.find((x) => x.id === m.hinge!.sideId)
  const cup = holes.find((h) => h.tag === "hinge" && h.cut && h.poly)
  if (door && side && cup?.poly) {
    // Porta a l'esquerra (la frontissa a l'esquerra): el cantell de la porta és door.x0.
    const xs = cup.poly.map((q) => q[0])
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2
    const rad = (Math.max(...xs) - Math.min(...xs)) / 2
    const zs = cup.poly.map((q) => q[1])
    const xe = door.x0
    const below = door.z1
    const row = (k: number) => below - door.z1 + 14 + 12 * k
    const k0 = xe - side.x0 > 0.05 ? 1 : 0
    if (xe - side.x0 > 0.05) dims.push({ a: [side.x0, below], b: [xe, below], offset: row(0), label: fmt(xe - side.x0), title: "Joc: del cantell de fora del lateral al cantell de la porta" })
    dims.push(
      side.x1 > xe
        ? { a: [xe, below], b: [side.x1, below], offset: row(k0), label: fmt(side.x1 - xe), title: "Recobriment: quant tapa la porta el cantell del lateral" }
        : { a: [side.x1, below], b: [xe, below], offset: row(k0), label: fmt(xe - side.x1), title: "Joc entre el lateral i la porta (encastada)" },
    )
    dims.push({ a: [xe, below], b: [cx, below], offset: row(k0 + 1), label: fmt(cx - xe), title: "Del cantell de la porta al centre de la cassoleta" })
    dims.push({ a: [xe, below], b: [cx - rad, below], offset: row(k0 + 2), label: `C ${fmt(cx - rad - xe)}`, title: "C: del cantell de la porta a la vora de la cassoleta (distància de perforació del fabricant)" })
    const depth = Math.max(...zs) - Math.min(...zs)
    dims.push({ a: [cx + rad, door.z0], b: [cx + rad, door.z0 + depth], offset: -10, label: fmt(depth), title: "Fondària de la cassoleta" })
    if (door.z0 - side.z1 > 0.05) dims.push({ a: [side.x1, side.z1], b: [side.x1, door.z0], offset: 10, label: fmt(door.z0 - side.z1), title: "Joc entre el lateral i la porta" })
    // La filera de la placa (o la del System 32) des del davant del lateral.
    const zMid = (q: [number, number][]) => q.reduce((t, c) => t + c[1], 0) / q.length
    const rowHole = holes
      .filter((h) => h.panelId === side.id && h.poly)
      .sort((a, b) => Number(b.tag === "plate") - Number(a.tag === "plate") || Number(b.cut) - Number(a.cut) || zMid(b.poly!) - zMid(a.poly!))[0]
    if (rowHole?.poly) {
      const z = zMid(rowHole.poly)
      dims.push({ a: [side.x0, side.z1], b: [side.x0, z], offset: -14, label: fmt(side.z1 - z), title: rowHole.tag === "plate" ? "Placa: del davant del lateral a la filera dels forats" : "Filera System 32: del davant del lateral" })
    }
  } else if (!m.focus) {
    // Accessori sense forats: la mida de la peça que es veu (la barra, el perfil, el marc) i on és respecte del lateral.
    // (Els ferratges per metres —la regleta, el sòcol d'alumini— són peces de només veure: rol `hardware`.)
    const own = rects.filter((x) => x.role === "part" || (x.role === "hardware" && m.solid.includes(x.id)))
    // El tirador de vitrina (sense forats): el front on es mira.
    if (!own.length) own.push(...rects.filter((x) => x.role === "drawerFront"))
    const first = own[0]
    const side = rects.find((x) => x.role === "side")
    if (first) dims.push({ a: [first.x0, first.z0], b: [first.x1, first.z0], offset: -16, label: fmt(first.x1 - first.x0), title: `${first.label}: llarg` })
    if (first && side && side.z1 > first.z1 + 0.5) dims.push({ a: [first.x0, first.z1], b: [first.x0, side.z1], offset: -14, label: fmt(side.z1 - first.z1), title: "Del davant del lateral a l'accessori" })
  } else {
    // Qualsevol altre: el forat principal fins als cantells de la seva peça.
    const f = m.focus
    const rect = rects.find((x) => x.id === f.panelId)
    if (rect) {
      const E: [number, number] = [f.at[0], f.at[2]]
      const n = f.normal
      const alongX = Math.abs(n[0]) > 0.7
      const alongZ = Math.abs(n[2]) > 0.7
      if (!alongZ) {
        const zEdge = Math.abs(E[1] - rect.z0) < Math.abs(E[1] - rect.z1) ? rect.z0 : rect.z1
        if (Math.abs(zEdge - E[1]) > 0.5) dims.push({ a: [E[0], zEdge], b: [E[0], E[1]], offset: alongX ? -16 : 16, label: fmt(Math.abs(zEdge - E[1])), title: "Del centre del forat al cantell de la peça" })
      }
      if (!alongX) {
        const xEdge = Math.abs(E[0] - rect.x0) < Math.abs(E[0] - rect.x1) ? rect.x0 : rect.x1
        if (Math.abs(xEdge - E[0]) > 0.5) dims.push({ a: [xEdge, E[1]], b: [E[0], E[1]], offset: 16, label: fmt(Math.abs(xEdge - E[0])), title: "Del centre del forat al cantell de la peça" })
      }
      // Dos forats del ferratge al tall, a la mateixa peça (un tirador): la distància entre centres.
      const mates = holes.filter((h) => h.own && h.cut && h.panelId === f.panelId && h.poly)
      if (mates.length === 2) {
        const c = mates.map((h) => [h.poly!.reduce((t, q) => t + q[0], 0) / 4, h.poly!.reduce((t, q) => t + q[1], 0) / 4] as [number, number])
        const [a, b] = c[0]![0] <= c[1]![0] ? [c[0]!, c[1]!] : [c[1]!, c[0]!]
        dims.push({ a, b, offset: -16, label: fmt(Math.hypot(b[0] - a[0], b[1] - a[1])), title: "Entre els centres dels forats" })
      }
      const d = f.hole.depth
      if (alongX || alongZ) {
        const b: [number, number] = [E[0] - n[0] * d, E[1] - n[2] * d]
        dims.push({ a: E, b, offset: alongX ? 12 : -12, label: fmt(d), title: "Fondària del forat" })
      }
    }
  }
  // Vista: els forats del ferratge a prop del principal, amb els cantells propers i les cotes.
  const pts: [number, number][] = []
  const fx = at[0]
  const fz = at[2]
  for (const h of holes) {
    if (!h.own) continue
    const ps = h.poly ?? (h.circle ? [[h.circle.cx - h.circle.r, h.circle.cz - h.circle.r], [h.circle.cx + h.circle.r, h.circle.cz + h.circle.r]] as [number, number][] : [])
    if (ps.some((q) => Math.hypot(q[0] - fx, q[1] - fz) <= 120)) pts.push(...ps)
  }
  for (const b of fittings) if (Math.hypot((b.x0 + b.x1) / 2 - fx, (b.z0 + b.z1) / 2 - fz) <= 120) pts.push([b.x0, b.z0], [b.x1, b.z1])
  pts.push([fx, fz])
  let x0 = Math.min(...pts.map((q) => q[0])) - 25
  let x1 = Math.max(...pts.map((q) => q[0])) + 25
  let z0 = Math.min(...pts.map((q) => q[1])) - 25
  let z1 = Math.max(...pts.map((q) => q[1])) + 25
  // Els cantells de les peces a menys de 70 mm hi entren (es veu a quina distància hi és el forat).
  for (const rc of rects) {
    for (const x of [rc.x0, rc.x1]) if ((x < x0 && x0 - x < 70) || (x > x1 && x - x1 < 70)) [x0, x1] = [Math.min(x0, x - 12), Math.max(x1, x + 12)]
    for (const z of [rc.z0, rc.z1]) if ((z < z0 && z0 - z < 70) || (z > z1 && z - z1 < 70)) [z0, z1] = [Math.min(z0, z - 12), Math.max(z1, z + 12)]
  }
  for (const d of dims) {
    const vx = d.b[0] - d.a[0]
    const vz = d.b[1] - d.a[1]
    const len = Math.hypot(vx, vz) || 1
    const ox = (-vz / len) * d.offset
    const oz = (vx / len) * d.offset
    for (const q of [d.a, d.b]) {
      x0 = Math.min(x0, q[0] + ox - 8)
      x1 = Math.max(x1, q[0] + ox + 8)
      z0 = Math.min(z0, q[1] + oz - 8)
      z1 = Math.max(z1, q[1] + oz + 8)
    }
  }
  // Com a mínim 140 × 100 mm i sense ser més alt que ample del compte.
  const w = Math.max(140, x1 - x0)
  const h = Math.max(100, z1 - z0, w / 2.2)
  const cxv = (x0 + x1) / 2
  const czv = (z0 + z1) / 2
  return { sectionY: Y0, rects, holes, fittings, dims, view: { x: r(cxv - w / 2), z: r(czv - h / 2), w: r(w), h: r(h) } }
}
