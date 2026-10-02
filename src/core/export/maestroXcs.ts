import { pickBlade, pickDrill, pickRouter, drillsOfDiameter } from "../machine/tools"
import { arcOf, bulgeOf, EDGE_NUMBER, flatten, type BPt, type Cutout, type EdgeSide, type Groove, type Hole, type Panel } from "../model"
import type { Machine, MachineTool } from "../model/machine"
import { needsSecondFace, secondFaceProgram } from "../process/processes"
import { pieceRefs } from "./refs"
import { asciiFold } from "./text"

/**
 * Programes de Xilog Maestro en Maestro Scripting Language (MSL, `.xcs`), un per peça de CNC i un
 * altre «<ref>Volt» per a la cara B (com el «2a cara» de TopSolid). Maestro els importa (Importar
 * script) o els converteix a .pgmx amb XConverter (`-m 0`, manual MSL R4 §3.1.2.1 p9).
 *
 * Totes les instruccions segueixen els exemples del manual «Maestro Scripting Language» rev. 4
 * (docs/maestro/, pàgina entre parèntesis):
 *  - capçalera `SetMachiningParameters(camps, 1, taula, mecàniques, false)` (§3.9.1 p114, p8);
 *  - peça `CreateFinishedWorkpieceBox(nom, L, A, gruix)` (§3.2.2.1 p17) i
 *    `CreateRawWorkpiece(nom, 0, 0, 0, 0, 0, 0)` sense sobrant (§3.2.1 p16);
 *  - cares `SelectWorkplane("Top"|"Front"|"Back"|"Left"|"Right")` (§3.3.1 p19, §3.3.4 p23);
 *  - forats `CreateDrill(nom, x, y, fondària, Ø, "", TypeOfProcess.Drilling, eina, capçal)` (§3.5.1 p36);
 *  - ranures amb disc: `CreateSegment` + `CreateSlot(nom, fondària, desc, TypeOfProcess.GeneralRouting,
 *    eina, capçal, correcció, -1, -1, -1, 0)` (§3.5.7 p49);
 *  - ranures amb fresa: `CreatePolyline`/`AddSegmentToPolyline` (§3.4.1.4 p30-33) +
 *    `CreateRoughFinish(nom, fondària, desc, TypeOfProcess.GeneralRouting, eina, capçal, 0, -1, -1, -1, 0)` (§3.5.3 p40-41);
 *  - talls i contorn: polilínia tancada (`AddArc2PointRadiusToPolyline`, `ClosePolyline`, p31-32) o
 *    `CreateCircleCenterRadius` (§3.4.1.3 p28) + `CreateContour(nom, fondària, 1, costat, desc,
 *    TypeOfProcess.GeneralRouting, eina, capçal, 0, -1, -1, -1, 0)` amb costat 0 = dins, 1 = fora (§3.5.9 p53, p79).
 * El capçal va sempre a "-1" (Maestro el tria segons on és muntada l'eina); les broques horitzontals,
 * també l'eina (`"-1"`, p36): el parell esquerra/dreta depèn del cantell i no surt a l'.atrx.
 *
 * Coordenades (vegeu docs/maestro-xcs.md): la peça amb el costat llarg a X (u) i el curt a Y (v),
 * origen a la cantonada de baix a l'esquerra de la cara A vista des de dalt (la mateixa convenció
 * u/v de l'app), Z = gruix. Cara B: la peça es gira sobre l'eix X (el cantell 1 passa a baix):
 * (x, y) → (x, A − y).
 */

export type XcsPlane = "Top" | "Front" | "Back" | "Left" | "Right"

/** Un mecanitzat emès (per als tests i el resum). Punts en coordenades del pla. */
export interface XcsOp {
  program: "A" | "B"
  plane: XcsPlane
  kind: "drill" | "slot" | "route" | "contour"
  /** Codi de l'eina o "-1" (automàtica). */
  tool: string
  depth: number
  points: [number, number][]
  /** Què és: «forat Ø5 (x, y)». */
  what: string
}

export interface XcsProgram {
  file: string
  face: "A" | "B"
  text: string
}

export interface XcsPanelResult {
  ref: string
  programs: XcsProgram[]
  ops: XcsOp[]
  /** Mecanitzats que no s'han pogut fer (sense eina, massa fondos…) o que fa un altre procés. */
  warnings: string[]
  /** Nombre de mecanitzats de la peça (forats, ranures, talls, contorn): cadascun és una op o un avís. */
  features: number
  /** Mecanitzats que no surten al programa (amb avís). */
  skipped: number
  /** Mecanitzats que surten al programa (una o més ops cadascun). `features = handled + skipped`. */
  handled: number
}

const EOL = "\r\n"
const EPS = 0.01

/** Número per a l'MSL: punt decimal, fins a 3 decimals, sense zeros de més. */
export function num(n: number): string {
  const r = Math.round(n * 1000) / 1000
  return Object.is(r, -0) ? "0" : String(r)
}

/** Cadena C#: ASCII (sense accents), sense cometes ni barres. */
export function cs(s: string): string {
  return `"${asciiFold(s).replace(/[^\x20-\x7e]/g, "?").replace(/["\\]/g, "_")}"`
}

const comment = (s: string) => `// ${asciiFold(s).replace(/[^\x20-\x7e]/g, "?")}`

/** Cara del cantell: 4 = esquerra (x = 0), 2 = dreta (x = L), 3 = baix (y = 0, «Front»), 1 = dalt (y = A, «Back»). */
export const EDGE_PLANE: Record<EdgeSide, XcsPlane> = { left: "Left", right: "Right", bottom: "Front", top: "Back" }

/**
 * Punt d'un forat de cantell al pla estàndard del cantell, vist des de fora (origen a baix a
 * l'esquerra, X horitzontal, Y = alçada des de la cara B; manual §3.4 p24). Front: X = u; Back
 * (vist des del darrere): X = L − u; Left (des de l'esquerra): X = A − v; Right: X = v. Y = gruix / 2.
 */
export function edgePoint(p: Pick<Panel, "length" | "width" | "thickness">, h: Pick<Hole, "x" | "y">, edge: EdgeSide): [number, number] {
  const y = p.thickness / 2
  if (edge === "bottom") return [h.x, y]
  if (edge === "top") return [p.length - h.x, y]
  if (edge === "left") return [p.width - h.y, y]
  return [h.y, y]
}

/** Mida del pla (X, Y) per comprovar que els punts hi cauen. */
export function planeSize(p: Pick<Panel, "length" | "width" | "thickness">, plane: XcsPlane): [number, number] {
  if (plane === "Top") return [p.length, p.width]
  if (plane === "Front" || plane === "Back") return [p.length, p.thickness]
  return [p.width, p.thickness]
}

class Script {
  lines: string[] = []
  ops: XcsOp[] = []
  private plane: XcsPlane | null = null
  private counters = new Map<string, number>()
  readonly program: "A" | "B"
  constructor(program: "A" | "B") {
    this.program = program
  }
  name(prefix: string): string {
    const n = (this.counters.get(prefix) ?? 0) + 1
    this.counters.set(prefix, n)
    return `${prefix}_${n}`
  }
  select(plane: XcsPlane) {
    if (this.plane === plane) return
    this.plane = plane
    this.lines.push("", `SelectWorkplane(${cs(plane)});`)
  }
  get current(): XcsPlane {
    return this.plane ?? "Top"
  }
  op(o: Omit<XcsOp, "program" | "plane">) {
    this.ops.push({ ...o, program: this.program, plane: this.current })
  }
}

const toolArg = (t: MachineTool | undefined) => cs(t ? t.code : "-1")
const HEAD = cs("-1")

/** Polilínia tancada amb arcs (bulge) a la cara activa. Retorna les línies i els punts. */
function closedPolyline(name: string, ptsIn: BPt[]): string[] {
  // Si hi ha algun costat recte, que sigui el de tancar (ClosePolyline, p30-32); si no, s'acaba amb l'arc.
  let pts = ptsIn
  const k = ptsIn.findIndex((p) => Math.abs(bulgeOf(p)) < 1e-9)
  if (k >= 0) pts = [...ptsIn.slice(k + 1), ...ptsIn.slice(0, k + 1)]
  const first = pts[0]!
  const out = [`CreatePolyline(${cs(name)}, ${num(first[0])}, ${num(first[1])});`]
  const n = pts.length
  for (let i = 0; i < n; i++) {
    const p = pts[i]!
    const q = pts[(i + 1) % n]!
    const last = i === n - 1
    const b = bulgeOf(p)
    if (Math.abs(b) < 1e-9) {
      if (last) out.push(`ClosePolyline("");`)
      else out.push(`AddSegmentToPolyline(${num(q[0])}, ${num(q[1])});`)
      continue
    }
    const a = arcOf(p, q, b)
    // isClockwise = bulge negatiu; isOver180 = |bulge| > 1 (més de mig cercle).
    out.push(`AddArc2PointRadiusToPolyline(${num(q[0])}, ${num(q[1])}, ${num(a.r)}, ${b < 0}, ${Math.abs(b) > 1});`)
  }
  return out
}

const rectPts = (x: number, y: number, w: number, h: number): BPt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
]

/** Ranura de cantells rodons com a contorn: semicercles exactes (bulge 1). */
function slotPts(c: Extract<Cutout, { kind: "slot" }>): BPt[] {
  const r = Math.min(c.w, c.h) / 2
  if (c.w >= c.h) {
    return [
      [c.x + r, c.y],
      [c.x + c.w - r, c.y, 1],
      [c.x + c.w - r, c.y + c.h],
      [c.x + r, c.y + c.h, 1],
    ]
  }
  return [
    [c.x + c.w, c.y + r],
    [c.x + c.w, c.y + c.h - r, 1],
    [c.x, c.y + c.h - r],
    [c.x, c.y + r, 1],
  ]
}

const bbox = (pts: [number, number][]) => {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) }
}

/**
 * Fresa més grossa que pot resseguir un contorn tancat pel costat `side` (dins = un forat, fora = el
 * contorn de la peça): el radi no pot passar del dels arcs que la fresa recorre per la banda còncava
 * (els «dogbones» de les mortalles, els extrems d'una ranura) i, per dins, Ø < l'amplada més petita
 * de la caixa (− 0,5 mm). Les cantonades vives queden amb el radi de la fresa (inevitable).
 */
export function maxToolDiameter(pts: BPt[], side: "inside" | "outside"): number {
  const flat = flatten(pts)
  let area = 0
  for (let i = 0; i < flat.length; i++) {
    const a = flat[i]!
    const b = flat[(i + 1) % flat.length]!
    area += a[0] * b[1] - b[0] * a[1]
  }
  const ccw = area > 0
  let max = Infinity
  if (side === "inside") {
    const bb = bbox(flat)
    max = Math.min(bb.x1 - bb.x0, bb.y1 - bb.y0) - 0.5
  }
  for (let i = 0; i < pts.length; i++) {
    const b = bulgeOf(pts[i]!)
    if (Math.abs(b) < 1e-9) continue
    // Antihorari: l'interior queda a l'esquerra; un arc que gira a l'esquerra (b > 0) el té a la banda còncava.
    const interiorConcave = (b > 0) === ccw
    if (interiorConcave === (side === "inside")) max = Math.min(max, 2 * arcOf(pts[i]!, pts[(i + 1) % pts.length]!, b).r)
  }
  // Arcs ja convertits en segments (els dogbones de les mortalles): girs petits seguits cap al mateix costat.
  const n = flat.length
  const turn = (i: number) => {
    const a = flat[(i - 1 + n) % n]!
    const b = flat[i]!
    const c = flat[(i + 1) % n]!
    const u = [b[0] - a[0], b[1] - a[1]]
    const v = [c[0] - b[0], c[1] - b[1]]
    return { ang: Math.atan2(u[0]! * v[1]! - u[1]! * v[0]!, u[0]! * v[0]! + u[1]! * v[1]!), lu: Math.hypot(u[0]!, u[1]!), lv: Math.hypot(v[0]!, v[1]!) }
  }
  const arcLike = (i: number) => {
    const t = turn(i)
    const deg = Math.abs(t.ang) * (180 / Math.PI)
    return deg > 1 && deg < 35 && t.lu > 0 && t.lv > 0 && t.lu / t.lv < 2.5 && t.lv / t.lu < 2.5 ? Math.sign(t.ang) : 0
  }
  const signs = flat.map((_, i) => arcLike(i))
  for (let i = 0; i < n; i++) {
    if (!signs[i] || signs[(i - 1 + n) % n] === signs[i]) continue
    let j = i
    while (signs[(j + 1) % n] === signs[i] && (j + 1) % n !== i) j++
    if (j - i < 1) continue
    // Cercle per l'inici, el mig i el final de la tirada.
    const p1 = flat[(i - 1 + n) % n]!
    const p2 = flat[(i + Math.floor((j - i) / 2)) % n]!
    const p3 = flat[(j + 1) % n]!
    const d = 2 * (p1[0] * (p2[1] - p3[1]) + p2[0] * (p3[1] - p1[1]) + p3[0] * (p1[1] - p2[1]))
    if (Math.abs(d) < 1e-9) continue
    const ab = Math.hypot(p1[0] - p2[0], p1[1] - p2[1])
    const bc = Math.hypot(p2[0] - p3[0], p2[1] - p3[1])
    const ca = Math.hypot(p3[0] - p1[0], p3[1] - p1[1])
    const r = (ab * bc * ca) / Math.abs(d)
    const interiorConcave = (signs[i]! > 0) === ccw
    if (interiorConcave === (side === "inside")) max = Math.min(max, 2 * r)
  }
  return max
}

const holeWhat = (h: Hole) => `forat Ø${num(h.diameter)} × ${num(h.depth)} a (${num(h.x)}, ${num(h.y)})${h.face === "edge" ? ` cantell ${h.edge ?? "?"}` : ` cara ${h.face}`}`
const grooveWhat = (g: Groove) => `ranura ${num(g.w)} × ${num(g.h)} × ${num(g.depth)} a (${num(g.x)}, ${num(g.y)}) cara ${g.face}`
const cutWhat = (c: Cutout) =>
  c.kind === "circle" ? `tall Ø${num(c.diameter)} a (${num(c.x)}, ${num(c.y)})` : c.kind === "polygon" ? `tall de ${c.points.length} punts` : `tall ${c.kind} ${num(c.w)} × ${num(c.h)} a (${num(c.x)}, ${num(c.y)})`

/** Programes d'una peça. `ref` = la ref del taller (`A.1.L.1`): nom del fitxer i de la peça a Maestro. */
export function panelXcs(p: Panel, ref: string, m: Machine): XcsPanelResult {
  const L = p.length
  const W = p.width
  const T = p.thickness
  const through = T + m.throughExtra
  const warnings: string[] = []
  let features = 0
  let skipped = 0
  const skip = (what: string, why: string) => {
    skipped++
    warnings.push(`${what}: ${why}`)
  }
  let handled = 0
  const A = new Script("A")
  const B = new Script("B")

  // --- Forats de cara (A a dalt; B al programa girat) --------------------------------------
  for (const h of p.holes) {
    if (h.face === "edge") continue
    features++
    const s = h.face === "A" ? A : B
    let depth = h.depth
    if (depth >= T - 0.5) {
      depth = Math.max(0.5, T - 1)
      warnings.push(`${holeWhat(h)}: més fondo que el gruix − 1; s'escurça a ${num(depth)} (com al STEP)`)
    }
    const t = pickDrill(m, h.diameter, depth, "vertical")
    if (!t) {
      const same = drillsOfDiameter(m, h.diameter, "vertical")
      skip(holeWhat(h), same.length ? `la broca ${same.map((x) => x.code).join("/")} no arriba a ${num(depth)} mm` : `cap broca vertical de Ø${num(h.diameter)} muntada`)
      continue
    }
    const x = h.x
    const y = h.face === "A" ? h.y : W - h.y
    s.select("Top")
    const name = s.name("Forat")
    s.lines.push(`CreateDrill(${cs(name)}, ${num(x)}, ${num(y)}, ${num(depth)}, ${num(h.diameter)}, "", TypeOfProcess.Drilling, ${toolArg(t)}, ${HEAD});`)
    s.op({ kind: "drill", tool: t.code, depth, points: [[x, y]], what: holeWhat(h) })
    handled++
  }

  // --- Forats de cantell (programa A): cara estàndard de cada cantell ------------------------
  const edgeHoles = p.holes.filter((h) => h.face === "edge")
  for (const side of ["bottom", "right", "top", "left"] as const) {
    for (const h of edgeHoles.filter((x) => x.edge === side)) {
      features++
      const t = pickDrill(m, h.diameter, h.depth, "horizontal")
      if (!t) {
        const same = drillsOfDiameter(m, h.diameter, "horizontal")
        skip(holeWhat(h), same.length ? `la broca horitzontal ${same.map((x) => x.code).join("/")} no arriba a ${num(h.depth)} mm` : `cap broca horitzontal de Ø${num(h.diameter)} muntada`)
        continue
      }
      const [x, y] = edgePoint(p, h, side)
      A.select(EDGE_PLANE[side])
      const name = A.name("ForatCantell")
      const pair = drillsOfDiameter(m, h.diameter, "horizontal")
        .map((d) => d.code)
        .join("/")
      A.lines.push(comment(`broca horitzontal ${pair}: Maestro tria el mandri segons el cantell`))
      A.lines.push(`CreateDrill(${cs(name)}, ${num(x)}, ${num(y)}, ${num(h.depth)}, ${num(h.diameter)}, "", TypeOfProcess.Drilling, ${cs("-1")}, ${HEAD});`)
      A.op({ kind: "drill", tool: "-1", depth: h.depth, points: [[x, y]], what: holeWhat(h) })
      handled++
    }
  }
  for (const h of edgeHoles.filter((x) => !x.edge)) {
    features++
    skip(holeWhat(h), "forat de cantell sense cantell")
  }

  // --- Ranures ---------------------------------------------------------------------------------
  for (const g of p.grooves) {
    features++
    const s = g.face === "A" ? A : B
    // Al programa B, la peça girada: y → A − y − alt.
    const x0 = Math.max(0, g.x)
    const x1 = Math.min(L, g.x + g.w)
    const yA0 = Math.max(0, g.y)
    const yA1 = Math.min(W, g.y + g.h)
    const y0 = g.face === "A" ? yA0 : W - yA1
    const y1 = g.face === "A" ? yA1 : W - yA0
    if (x1 - x0 <= EPS || y1 - y0 <= EPS) {
      skip(grooveWhat(g), "fora de la peça")
      continue
    }
    let depth = g.depth
    if (depth >= T - 0.5) {
      depth = Math.max(0.5, T - 1)
      warnings.push(`${grooveWhat(g)}: més fonda que el gruix − 1; s'escurça a ${num(depth)}`)
    }
    const alongX = x1 - x0 >= y1 - y0
    // Coordenades en «llarg» (a) i «ample» (b) de la ranura.
    const [a0, a1, b0, b1, aMax] = alongX ? [x0, x1, y0, y1, L] : [y0, y1, x0, x1, W]
    const width = b1 - b0
    const fullLength = a0 <= EPS && a1 >= aMax - EPS
    const pt = (a: number, b: number): [number, number] => (alongX ? [a, b] : [b, a])

    const blade = m.grooves !== "router" && fullLength ? pickBlade(m, depth, width) : undefined
    if (blade && m.grooves !== "router") {
      const t = blade.bladeThickness!
      const n = Math.max(1, Math.ceil(width / t - 1e-6))
      s.select("Top")
      const base = s.name("Ranura")
      for (let k = 0; k < n; k++) {
        const c = n === 1 ? (b0 + b1) / 2 : b0 + t / 2 + ((width - t) * k) / (n - 1)
        const [sx, sy] = pt(0, c)
        const [ex, ey] = pt(aMax, c)
        const seg = `${base}_S${k + 1}`
        s.lines.push(`CreateSegment(${cs(seg)}, ${num(sx)}, ${num(sy)}, ${num(ex)}, ${num(ey)});`)
        s.lines.push(`CreateSlot(${cs(`${base}_${k + 1}`)}, ${num(depth)}, ${cs(base)}, TypeOfProcess.GeneralRouting, ${toolArg(blade)}, ${HEAD}, 0, -1, -1, -1, 0);`)
        s.op({ kind: "slot", tool: blade.code, depth, points: [[sx, sy], [ex, ey]], what: grooveWhat(g) })
      }
      handled++
      continue
    }
    if (m.grooves === "blade") warnings.push(`${grooveWhat(g)}: no es pot fer amb disc (${fullLength ? "cap disc prou prim o prou gran" : "no va de cantell a cantell"}); es prova amb fresa`)
    const router = pickRouter(m, width, depth)
    if (!router) {
      skip(grooveWhat(g), `cap fresa de Ø ≤ ${num(width)} que arribi a ${num(depth)} mm`)
      continue
    }
    const r = router.diameter / 2
    // El centre de la fresa al cantell talla fins al cantell; als extrems tancats, a r de la vora.
    const start = a0 <= EPS ? a0 : a0 + r
    const end = a1 >= aMax - EPS ? a1 : a1 - r
    if (end < start - EPS) {
      skip(grooveWhat(g), `massa curta per a la fresa ${router.code} (Ø${num(router.diameter)})`)
      continue
    }
    const lanes = router.diameter >= width - EPS ? [(b0 + b1) / 2] : (() => {
      const n = Math.ceil((width - router.diameter) / (0.75 * router.diameter)) + 1
      return Array.from({ length: n }, (_, k) => b0 + r + ((width - 2 * r) * k) / (n - 1))
    })()
    const pts: [number, number][] = []
    lanes.forEach((c, k) => {
      const [p0, p1] = k % 2 === 0 ? [start, end] : [end, start]
      pts.push(pt(p0, c), pt(p1, c))
    })
    s.select("Top")
    const name = s.name("Ranura")
    s.lines.push(`CreatePolyline(${cs(`${name}_G`)}, ${num(pts[0]![0])}, ${num(pts[0]![1])});`)
    for (const q of pts.slice(1)) s.lines.push(`AddSegmentToPolyline(${num(q[0])}, ${num(q[1])});`)
    s.lines.push(`CreateRoughFinish(${cs(name)}, ${num(depth)}, ${cs("ranura")}, TypeOfProcess.GeneralRouting, ${toolArg(router)}, ${HEAD}, 0, -1, -1, -1, 0);`)
    s.op({ kind: "route", tool: router.code, depth, points: pts, what: grooveWhat(g) })
    handled++
  }

  // --- Talls passants (programa A) ---------------------------------------------------------
  for (const c of p.cutouts ?? []) {
    features++
    if (c.kind === "circle") {
      const drill = pickDrill(m, c.diameter, through, "vertical")
      if (drill) {
        A.select("Top")
        const name = A.name("ForatPassant")
        A.lines.push(`CreateDrill(${cs(name)}, ${num(c.x)}, ${num(c.y)}, ${num(through)}, ${num(c.diameter)}, "", TypeOfProcess.Drilling, ${toolArg(drill)}, ${HEAD});`)
        A.op({ kind: "drill", tool: drill.code, depth: through, points: [[c.x, c.y]], what: cutWhat(c) })
        handled++
        continue
      }
      const router = pickRouter(m, c.diameter - 1, through)
      if (!router) {
        skip(cutWhat(c), `cap broca de Ø${num(c.diameter)} ni fresa més petita que arribin a ${num(through)} mm`)
        continue
      }
      A.select("Top")
      const name = A.name("Tall")
      A.lines.push(`CreateCircleCenterRadius(${cs(`${name}_G`)}, ${num(c.x)}, ${num(c.y)}, ${num(c.diameter / 2)}, false);`)
      A.lines.push(`CreateContour(${cs(name)}, ${num(through)}, 1, 0, ${cs("tall passant")}, TypeOfProcess.GeneralRouting, ${toolArg(router)}, ${HEAD}, 0, -1, -1, -1, 0);`)
      const pts = flatten([[c.x + c.diameter / 2, c.y, 1], [c.x - c.diameter / 2, c.y, 1]])
      A.op({ kind: "contour", tool: router.code, depth: through, points: pts, what: cutWhat(c) })
      handled++
      continue
    }
    const pts: BPt[] = c.kind === "rect" ? rectPts(c.x, c.y, c.w, c.h) : c.kind === "slot" ? slotPts(c) : c.points
    const flat = flatten(pts)
    const maxDia = maxToolDiameter(pts, "inside")
    const router = pickRouter(m, maxDia, through)
    if (!router) {
      skip(cutWhat(c), `cap fresa prou petita (Ø ≤ ${num(maxDia)}) que arribi a ${num(through)} mm`)
      continue
    }
    A.select("Top")
    const name = A.name("Tall")
    A.lines.push(...closedPolyline(`${name}_G`, pts))
    A.lines.push(`CreateContour(${cs(name)}, ${num(through)}, 1, 0, ${cs("tall passant")}, TypeOfProcess.GeneralRouting, ${toolArg(router)}, ${HEAD}, 0, -1, -1, -1, 0);`)
    A.op({ kind: "contour", tool: router.code, depth: through, points: flat, what: cutWhat(c) })
    handled++
  }

  // --- Contorn de les peces amb forma (programa A, l'últim) -----------------------------------
  if (p.outline?.length) {
    features++
    const maxDia = maxToolDiameter(p.outline, "outside")
    const router = pickRouter(m, maxDia, through)
    if (!router) skip("contorn de la peça", `cap fresa${Number.isFinite(maxDia) ? ` de Ø ≤ ${num(maxDia)}` : ""} que arribi a ${num(through)} mm`)
    else {
      A.select("Top")
      const name = A.name("Contorn")
      A.lines.push(...closedPolyline(`${name}_G`, p.outline))
      A.lines.push(`CreateContour(${cs(name)}, ${num(through)}, 1, 1, ${cs("contorn")}, TypeOfProcess.GeneralRouting, ${toolArg(router)}, ${HEAD}, 0, -1, -1, -1, 0);`)
      A.op({ kind: "contour", tool: router.code, depth: through, points: flatten(p.outline), what: "contorn de la peça" })
      handled++
    }
  }

  if (p.mitres?.length) warnings.push(`inglet a 45° al cantell ${p.mitres.map((e) => EDGE_NUMBER[e]).sort().join("+")}: no surt al programa (serra)`)

  const programs: XcsProgram[] = []
  const header = (face: "A" | "B") => {
    const lines = [
      comment(`Mobles CNC - programa Maestro (MSL .xcs) - BETA: comprova'l a Maestro abans de mecanitzar`),
      comment(`Peca ${ref}: ${p.label} (${p.name}) - ${num(L)} x ${num(W)} x ${num(T)} - ${p.material}`),
      face === "A"
        ? comment("Cara A amunt. X = llarg, Y = ample, origen a la cantonada de baix a l'esquerra (cantell 4 a X = 0, cantell 3 a Y = 0)")
        : comment("Cara B amunt: la peca girada sobre l'eix X (el cantell 1 passa a Y = 0). Forats de cantell i talls: al programa de la cara A"),
      comment(`Maquina ${m.name}${m.serial ? ` (${m.serial})` : ""}${m.maestroVersion ? ` - Maestro ${m.maestroVersion}` : ""}`),
      "",
      `SetMachiningParameters(${cs(m.header.executionFields)}, 1, ${m.header.tableOptions}, ${m.header.mechanicalOptions}, false);`,
      `CreateFinishedWorkpieceBox(${cs(ref)}, ${num(L)}, ${num(W)}, ${num(T)});`,
      `CreateRawWorkpiece(${cs(ref)}, 0, 0, 0, 0, 0, 0);`,
    ]
    return lines
  }
  if (A.ops.length) programs.push({ file: `${ref}.xcs`, face: "A", text: [...header("A"), ...A.lines, ""].join(EOL) })
  if (B.ops.length) programs.push({ file: `${secondFaceProgram(ref)}.xcs`, face: "B", text: [...header("B"), ...B.lines, ""].join(EOL) })
  else if (needsSecondFace(p) && !B.ops.length) warnings.push("la cara B no té cap mecanitzat que es pugui fer: no hi ha programa «Volt»")
  return { ref, programs, ops: [...A.ops, ...B.ops], warnings, features, skipped, handled }
}

export interface XcsExport {
  files: { name: string; text: string }[]
  panels: XcsPanelResult[]
  /** Avisos amb la peça: «A.1.L.1 (lat e): forat Ø5…». */
  warnings: string[]
  programs: number
}

/** Tots els programes d'un moble + un LLEGEIX-ME.txt. */
export function toMaestroXcs(panels: Panel[], m: Machine, opts: { project: string; date?: Date }): XcsExport {
  const refs = pieceRefs(panels)
  const results = panels.map((p) => panelXcs(p, refs.get(p.id) ?? p.id, m))
  const files: { name: string; text: string }[] = []
  const warnings: string[] = []
  results.forEach((r, i) => {
    for (const prog of r.programs) files.push({ name: prog.file, text: prog.text })
    for (const w of r.warnings) warnings.push(`${r.ref} (${panels[i]!.label}): ${w}`)
  })
  const empty = results.filter((r) => !r.programs.length).map((r) => r.ref)
  files.push({ name: "LLEGEIX-ME.txt", text: readme(opts.project, m, results, warnings, empty, opts.date ?? new Date()) })
  return { files, panels: results, warnings, programs: results.reduce((a, r) => a + r.programs.length, 0) }
}

function readme(project: string, m: Machine, results: XcsPanelResult[], warnings: string[], empty: string[], date: Date): string {
  const lines = [
    `Programes Maestro (.xcs) - ${project}`,
    `Generat per Mobles CNC el ${date.toISOString().slice(0, 10)} per a la màquina ${m.name}${m.serial ? ` (${m.serial})` : ""}${m.maestroVersion ? `, Maestro ${m.maestroVersion}` : ""}.`,
    "",
    "BETA: encara no s'ha validat al taller. Obre cada programa a Maestro i revisa'l a la vista",
    "CAM (cares, origen, eines) abans de mecanitzar.",
    "",
    "Què hi ha",
    "- <ref>.xcs: la peça amb la cara A amunt (forats de cara, forats de cantell, ranures, talls",
    "  passants i el contorn de les peces amb forma).",
    "- <ref>Volt.xcs: la mateixa peça girada sobre l'eix X (cara B amunt), si té mecanitzats a la cara B.",
    "  És el «2a cara» del CSV de TopSolid (columna SEGUNDO_NOMBRE_DE_FICHERO_DE_MECANIZADO).",
    "",
    "Com es fan servir",
    "- A Maestro: importar l'script (.xcs) i desar-lo com a .pgmx; o bé, per a tots alhora:",
    `  XConverter.exe -s -m 0 -i "<ref>.xcs" -t "def.tlgx"   (manual MSL §3.1.2.1)`,
    "",
    "Convencions",
    "- X = costat llarg de la peça, Y = costat curt, Z = gruix. Origen a la cantonada de baix a",
    "  l'esquerra de la cara A (cantell 4 a l'esquerra, cantell 3 a baix, com a l'app).",
    "- Forats de cantell a les cares estàndard (Front = cantell 3, Back = 1, Left = 4, Right = 2),",
    "  a mig gruix. Broques horitzontals amb eina automàtica (\"-1\").",
    `- Talls i forats passants: gruix + ${num(m.throughExtra)} mm.`,
    "",
    `Peces: ${results.length} · programes: ${results.reduce((a, r) => a + r.programs.length, 0)}`,
  ]
  if (empty.length) lines.push(`Sense mecanitzats (no tenen programa): ${empty.join(", ")}`)
  if (warnings.length) {
    lines.push("", `Avisos (${warnings.length}): el que no surt als programes o s'ha canviat`)
    for (const w of warnings) lines.push(`- ${w}`)
  }
  return lines.join(EOL) + EOL
}
