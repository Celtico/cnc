import { zipStore } from "../file/zip"
import { pickBlade, pickDrill, pickRouter, pickSmallRouter, drillsOfDiameter } from "../machine/tools"
import { arcOf, bulgeOf, EDGE_NUMBER, flatten, polygonArea, type BPt, type Cutout, type EdgeSide, type Groove, type Hole, type Panel } from "../model"
import { isSmallPart, machineRules, toolMslName, type Machine, type MachineRules, type MachineTool } from "../model/machine"
import { RulePicker } from "../machine/rules"
import { needsSecondFace, panelProcesses, secondFaceProgram, type ProcessKind } from "../process/processes"
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
 *  - semicercles (|bulge| = 1): `AddArc2PointCenterToPolyline(x, y, cx, cy, horari)` (Table 21 p31): amb el
 *    centre, el radi no s'ha d'arrodonir per sota de mitja corda.
 * El capçal va sempre a "-1" (Maestro el tria segons on és muntada l'eina); les broques horitzontals,
 * també l'eina (`"-1"`, p36): el parell esquerra/dreta depèn del cantell i no surt a l'.atrx. Les
 * verticals, `"-1"` per defecte (com els .pgmx del taller) o el nom de la broca (`Machine.verticalDrills`).
 * L'eina va pel seu nom de Maestro (`toolMslName`: el del .pgmx importat o el codi del .tlgx), sense
 * canviar-lo: cadena C# amb `\` i `"` escapats. Fitxer en UTF-8 amb BOM (`xcsBytes`; pendent de validar).
 *
 * Coordenades (vegeu docs/maestro-xcs.md, verificades amb el revisor): X = u (la llargada de la peça a
 * l'app, `length`), Y = v (`width`), origen a la cantonada de baix a l'esquerra de la cara A vista des de
 * dalt, Z = gruix. Cara B: la peça es gira sobre l'eix X (el cantell 1 passa a baix): (x, y) → (x, A − y).
 */

export type XcsPlane = "Top" | "Front" | "Back" | "Left" | "Right"

/** Un mecanitzat emès (per als tests i el resum). Punts en coordenades del pla. */
export interface XcsOp {
  program: "A" | "B"
  plane: XcsPlane
  kind: "drill" | "slot" | "route" | "contour" | "pocket"
  /** Codi de l'eina o "-1" (automàtica). */
  tool: string
  /** Amb eina automàtica: el codi de l'eina que l'app ha comprovat que existeix i hi arriba. */
  candidate?: string
  depth: number
  points: [number, number][]
  /** Què és: «forat Ø5 (x, y)». */
  what: string
  /** Ranures en diverses passades (regla): fondària de cada capa. */
  passes?: number[]
  /** Contorns: sobrant al costat (`overMaterial`) d'una passada de desbast de les peces petites. */
  xy?: number
  /** Contorns: passada n de m (peces petites). */
  pass?: { index: number; count: number }
  /** Entra en rampa (`SetApproachStrategy` en baixada). */
  ramp?: boolean
}

export interface XcsProgram {
  file: string
  face: "A" | "B"
  text: string
}

/** Un pas després de la CNC (o el programa de la cara B), per a l'etiqueta i la ruta de la peça. */
export interface XcsPostProcess {
  kind: ProcessKind
  /** «Inglet a 45° · cantells 2+4 (serra)». */
  text: string
  /** On es fa, per a la ruta: «serra (inglets)», «cantejadora»… */
  station: string
}

export interface XcsPanelResult {
  ref: string
  programs: XcsProgram[]
  ops: XcsOp[]
  /** Problemes de debò: mecanitzats que no surten (sense eina, fora de la peça…) o que canvien. */
  warnings: string[]
  /** Avisos de `warnings` per una eina que falta o no hi arriba (per a la pista «afegeix l'eina»). */
  missingTool: number
  /** El que li toca després de la CNC, en l'ordre del taller (`panelProcesses`), sense el que ja fa el programa. */
  postProcesses: XcsPostProcess[]
  /** «CNC: A.1.L.1.xcs + A.1.L.1Volt.xcs → serra (inglets) → cantejadora». */
  route: string
  /** Nombre de mecanitzats de la peça (forats, ranures, talls, contorn): cadascun és una op o un avís. */
  features: number
  /** Mecanitzats que no surten al programa (amb avís). */
  skipped: number
  /** Mecanitzats que surten al programa (una o més ops cadascun). `features = handled + skipped`. */
  handled: number
}

export const EOL = "\r\n"
const EPS = 0.01

/** Número per a l'MSL: punt decimal, fins a 3 decimals, sense zeros de més. Llança si no és finit. */
export function num(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`Número no vàlid a l'MSL: ${n}`)
  const r = Math.round(n * 1000) / 1000
  return Object.is(r, -0) ? "0" : String(r)
}

/** Cadena C# de l'MSL: el text tal qual (accents inclosos) amb `\` i `"` escapats; salts de línia i controls → espai. */
export function cs(s: string): string {
  // eslint-disable-next-line no-control-regex -- es busquen precisament els caràcters de control
  return `"${s.replace(/[\\"]/g, (c) => `\\${c}`).replace(/[\u0000-\u001f\u007f]/g, " ")}"`
}

// Fletxes, punts volats i graus en ASCII; la resta de no ASCII, «?».
export const comment = (s: string) =>
  `// ${asciiFold(s.replace(/→/g, "->").replace(/·/g, "-").replace(/°/g, " graus").replace(/[«»]/g, '"')).replace(/[^\x20-\x7e]/g, "?")}`

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

export const toolArg = (t: MachineTool | undefined) => cs(t ? toolMslName(t) : "-1")
export const HEAD = cs("-1")

/** Clau d'un punt tal com el veurà Maestro (arrodonit a 0,001 mm). */
const key = (p: BPt) => `${num(p[0])},${num(p[1])}`

/**
 * Treu els punts repetits (a 0,001 mm, el que s'escriu): un segment o arc de llargada zero no és vàlid.
 * Si dos punts seguits coincideixen, es queda el segon (amb el seu bulge, el del tram que de debò surt d'allà).
 */
export function dedupePolyline(pts: BPt[]): BPt[] {
  const out = [...pts]
  let changed = true
  while (changed && out.length > 1) {
    changed = false
    for (let i = 0; i < out.length && out.length > 1; i++) {
      const p = out[i]!
      const q = out[(i + 1) % out.length]!
      if (key(p) === key(q) || Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.001) {
        out.splice(i, 1)
        changed = true
        break
      }
    }
  }
  return out
}

/** Mig cercle (|bulge| = 1): es fa amb el centre (AddArc2PointCenterToPolyline). */
const isHalfCircle = (b: number) => Math.abs(Math.abs(b) - 1) < 0.01

/**
 * Polilínia tancada amb arcs (bulge) a la cara activa. `pts` sense punts repetits (`dedupePolyline`). Amb
 * `keepStart`, comença pel primer punt tal com ve (la rampa, `rampStart`, que deixa recte el costat de tancar).
 */
export function closedPolyline(name: string, ptsIn: BPt[], keepStart = false): string[] {
  // Si hi ha algun costat recte, que sigui el de tancar (ClosePolyline, p30-32); si no, s'acaba amb l'arc.
  let pts = ptsIn
  const k = ptsIn.findIndex((p) => Math.abs(bulgeOf(p)) < 1e-9)
  if (k >= 0 && !keepStart) pts = [...ptsIn.slice(k + 1), ...ptsIn.slice(0, k + 1)]
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
    if (isHalfCircle(b)) out.push(`AddArc2PointCenterToPolyline(${num(q[0])}, ${num(q[1])}, ${num(a.cx)}, ${num(a.cy)}, ${b < 0});`)
    else out.push(`AddArc2PointRadiusToPolyline(${num(q[0])}, ${num(q[1])}, ${num(a.r)}, ${b < 0}, ${Math.abs(b) > 1});`)
  }
  return out
}

export const rectPts = (x: number, y: number, w: number, h: number): BPt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
]

/** Ranura de cantells rodons com a contorn: semicercles exactes (bulge 1). */
export function slotPts(c: Extract<Cutout, { kind: "slot" }>): BPt[] {
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

/**
 * Cantonades vives que la fresa arrodoneix (amb el seu radi): per dins, les que giren cap a l'interior del
 * forat (angle < 180° vist des del forat); per fora, les entrants de la peça. Els girs de menys de 35° (arcs
 * fets de segments) no compten.
 */
export function sharpCorners(pts: BPt[], side: "inside" | "outside"): number {
  const flat = flatten(pts)
  const n = flat.length
  let area = 0
  for (let i = 0; i < n; i++) {
    const a = flat[i]!
    const b = flat[(i + 1) % n]!
    area += a[0] * b[1] - b[0] * a[1]
  }
  const ccw = area > 0
  let count = 0
  for (let i = 0; i < n; i++) {
    const a = flat[(i - 1 + n) % n]!
    const b = flat[i]!
    const c = flat[(i + 1) % n]!
    const u = [b[0] - a[0], b[1] - a[1]] as const
    const v = [c[0] - b[0], c[1] - b[1]] as const
    const ang = Math.atan2(u[0] * v[1] - u[1] * v[0], u[0] * v[0] + u[1] * v[1])
    if (Math.abs(ang) < (35 * Math.PI) / 180) continue
    // Antihorari: girar a l'esquerra (ang > 0) és una cantonada convexa del polígon.
    const convex = ang > 0 === ccw
    if (convex === (side === "inside")) count++
  }
  return count
}

/** Distància d'un punt a un contorn (polígon tancat). */
function distToOutline(flat: [number, number][], x: number, y: number): number {
  let best = Infinity
  for (let i = 0; i < flat.length; i++) {
    const a = flat[i]!
    const b = flat[(i + 1) % flat.length]!
    const dx = b[0] - a[0]
    const dy = b[1] - a[1]
    const l2 = dx * dx + dy * dy
    const t = l2 > 0 ? Math.max(0, Math.min(1, ((x - a[0]) * dx + (y - a[1]) * dy) / l2)) : 0
    best = Math.min(best, Math.hypot(a[0] + t * dx - x, a[1] + t * dy - y))
  }
  return best
}

/**
 * Un forat de cantell d'una peça amb forma només es pot fer a la cara estàndard si el contorn toca la caixa
 * en aquell punt (tot el diàmetre del forat): si no, la broca entraria a l'aire o en una corba.
 */
export function edgeHoleOnFace(p: Pick<Panel, "length" | "width" | "outline">, h: Pick<Hole, "x" | "y" | "diameter">, edge: EdgeSide): boolean {
  if (!p.outline?.length) return true
  const flat = flatten(p.outline)
  const r = h.diameter / 2
  const along: [number, number][] =
    edge === "bottom" ? [[h.x - r, 0], [h.x, 0], [h.x + r, 0]]
    : edge === "top" ? [[h.x - r, p.width], [h.x, p.width], [h.x + r, p.width]]
    : edge === "left" ? [[0, h.y - r], [0, h.y], [0, h.y + r]]
    : [[p.length, h.y - r], [p.length, h.y], [p.length, h.y + r]]
  return along.every(([x, y]) => distToOutline(flat, x, y) < 0.05)
}

export const holeWhat = (h: Hole) => `forat Ø${num(h.diameter)} × ${num(h.depth)} a (${num(h.x)}, ${num(h.y)})${h.face === "edge" ? ` cantell ${h.edge ?? "?"}` : ` cara ${h.face}`}`
export const grooveWhat = (g: Groove) => `ranura ${num(g.w)} × ${num(g.h)} × ${num(g.depth)} a (${num(g.x)}, ${num(g.y)}) cara ${g.face}`
export const cutWhat = (c: Cutout) =>
  c.kind === "circle" ? `tall Ø${num(c.diameter)} a (${num(c.x)}, ${num(c.y)})` : c.kind === "polygon" ? `tall de ${c.points.length} punts` : `tall ${c.kind} ${num(c.w)} × ${num(c.h)} a (${num(c.x)}, ${num(c.y)})`

/**
 * Recorregut de la fresa d'una ranura (x0..x1 × y0..y1, ja retallada a la peça L × W): els extrems oberts
 * (al cantell) amb el centre al cantell, els tancats a r de la vora; zig-zag si cal més d'una passada
 * (solapament del 25 %). `null` si és massa curta per a la fresa.
 */
export function grooveRouterPath(x0: number, x1: number, y0: number, y1: number, L: number, W: number, diameter: number): [number, number][] | null {
  const alongX = x1 - x0 >= y1 - y0
  const [a0, a1, b0, b1, aMax] = alongX ? [x0, x1, y0, y1, L] : [y0, y1, x0, x1, W]
  const width = b1 - b0
  const pt = (a: number, b: number): [number, number] => (alongX ? [a, b] : [b, a])
  const r = diameter / 2
  const start = a0 <= EPS ? a0 : a0 + r
  const end = a1 >= aMax - EPS ? a1 : a1 - r
  if (end < start - EPS) return null
  const lanes =
    diameter >= width - EPS
      ? [(b0 + b1) / 2]
      : (() => {
          const n = Math.ceil((width - diameter) / (0.75 * diameter)) + 1
          return Array.from({ length: n }, (_, k) => b0 + r + ((width - 2 * r) * k) / (n - 1))
        })()
  const pts: [number, number][] = []
  lanes.forEach((c, k) => {
    const [p0, p1] = k % 2 === 0 ? [start, end] : [end, start]
    pts.push(pt(p0, c), pt(p1, c))
  })
  return pts
}

/**
 * Fondàries de les passades d'una ranura amb `CreateBidirectionalMillingStrategy(true, maxPass, 0)` (manual
 * §3.5.11.2 p60, Table 39; exemple p63): capes de `maxPass` fins a la fondària. Una sola si no passa de `maxPass`.
 */
export function passDepths(depth: number, maxPass: number): number[] {
  if (!(maxPass > 0) || depth <= maxPass + 1e-6) return [depth]
  const out: number[] = []
  for (let z = maxPass; z < depth - 1e-6; z += maxPass) out.push(Math.round(z * 1000) / 1000)
  out.push(depth)
  return out
}

/** Estratègia de passades d'una ranura (només si en cal més d'una): va just abans del `CreateRoughFinish` (p58). */
export const grooveStrategy = (depth: number, maxPass: number): string[] =>
  passDepths(depth, maxPass).length > 1 ? [`CreateBidirectionalMillingStrategy(true, ${num(maxPass)}, 0);`] : []

/** Una passada de perfilar: fondària i sobrant al costat (`overMaterial`, Table 36 p53). */
export interface ContourPass {
  depth: number
  xy: number
}

/**
 * Passades del contorn d'una peça: les petites, les de desbast de les regles (deixen `z` a baix: fondària = gruix −
 * z; i `xy` al costat) i la final fins a `finalDepth` (el martiri o els passants de més); les normals, només la final.
 */
export function contourPasses(thickness: number, finalDepth: number, small: boolean, passes: readonly { z: number; xy: number }[]): ContourPass[] {
  const rough = small ? passes.filter((p) => thickness - p.z > 0.05).map((p) => ({ depth: Math.round((thickness - p.z) * 1000) / 1000, xy: p.xy })) : []
  return [...rough, { depth: finalDepth, xy: 0 }]
}

/** `CreateContour(nom, fondària, 1, costat, desc, GeneralRouting, eina, capçal, 0, -1, -1, -1, sobrant)` (p53). */
export const contourLine = (name: string, depth: number, side: 0 | 1, desc: string, tool: MachineTool | undefined, xy = 0) =>
  `CreateContour(${cs(name)}, ${num(depth)}, 1, ${side}, ${cs(desc)}, TypeOfProcess.GeneralRouting, ${toolArg(tool)}, ${HEAD}, 0, -1, -1, -1, ${num(xy)});`

/**
 * Inici de la rampa: el contorn comença al mig del costat recte més llarg (s'hi afegeix un punt) i acaba amb aquell
 * mateix costat recte (ClosePolyline). Així l'entrada lineal tangent (`SetApproachStrategy(true, false, k)`, p71:
 * lineal i «en baixada») va per sobre del mateix tall i no surt de la peça cap a les del costat. `room` = la meitat
 * del costat (la rampa no pot ser més llarga). `null` si no té cap costat recte de `minLen` o més.
 */
export function rampStart(pts: BPt[], minLen: number): { pts: BPt[]; room: number } | null {
  let best = -1
  let len = 0
  for (let i = 0; i < pts.length; i++) {
    if (Math.abs(bulgeOf(pts[i]!)) > 1e-9) continue
    const a = pts[i]!
    const b = pts[(i + 1) % pts.length]!
    const l = Math.hypot(b[0] - a[0], b[1] - a[1])
    if (l > len + 1e-9) {
      len = l
      best = i
    }
  }
  if (best < 0 || len < minLen) return null
  const a = pts[best]!
  const b = pts[(best + 1) % pts.length]!
  const mid: BPt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
  // mid → b → … → a (recte) → mid.
  const rest = [...pts.slice(best + 1), ...pts.slice(0, best + 1)]
  return { pts: [mid, ...rest], room: len / 2 }
}

/**
 * Rampa d'entrada (manual §3.5.11.6 p71, Tables 45-46; exemple p72): `SetApproachStrategy(isLinear = true,
 * isQuote = false: «en baixada», des de l'alçada de seguretat, k = llargada / radi)` i la sortida igual
 * (`SetRetractStrategy(true, false, k, 0)`). No són d'una operació (p71): es reinicien abans i després.
 */
export function rampLines(tool: MachineTool, length: number): { on: string[]; off: string[] } {
  const k = length / Math.max(0.5, tool.diameter / 2)
  return {
    on: ["ResetApproachStrategy();", "ResetRetractStrategy();", `SetApproachStrategy(true, false, ${num(k)});`, `SetRetractStrategy(true, false, ${num(k)}, 0);`],
    off: ["ResetApproachStrategy();", "ResetRetractStrategy();"],
  }
}

/**
 * Una caixera (rebaix cec tancat pels quatre costats) amb `CreateContourPocket(nom, fondària, desc,
 * TypeOfProcess.ConcentricalPocket, eina, capçal, -1, -1, -1, 50)` sobre la polilínia tancada (manual §3.5.10 p55,
 * Table 37; exemples p55 i p57; l'eina ha de ser més petita que la caixera, p56). Solapament del 50 % (el per
 * defecte, com la «ClosedPocket» del .pgmx del taller: Overlap 0,5).
 */
export const pocketLines = (name: string, pts: BPt[], depth: number, tool: MachineTool): string[] => [
  ...closedPolyline(`${name}_G`, pts),
  `CreateContourPocket(${cs(name)}, ${num(depth)}, ${cs("caixera")}, TypeOfProcess.ConcentricalPocket, ${toolArg(tool)}, ${HEAD}, -1, -1, -1, 50);`,
]

/** Resum de les regles per als comentaris de la capçalera (ASCII). */
export function rulesComment(r: MachineRules, nesting: boolean): string[] {
  const prof = r.profile.map((x) => `${num(x.min)}-${num(x.max)} mm ${x.tool || "auto"}`).join(", ")
  return [
    comment(`Regles: ranures ${r.grooves.tool || "auto"} (max ${num(r.grooves.maxPass)} mm per passada), caixeres ${r.pockets.tool || "auto"}, perfilar ${prof || "auto"}`),
    comment(
      `Peces petites (< ${num(r.small.maxArea)} m2${r.small.maxSide > 0 ? ` o costat < ${num(r.small.maxSide)} mm` : ""}; grans, una passada): ${r.small.passes.map((p) => `Z ${num(p.z)}/XY ${num(p.xy)}`).join(" + ") || "sense desbast"} + final${nesting && r.ramp.enabled ? `; entrada en rampa ${num(r.ramp.length)} mm` : ""}`,
    ),
  ]
}

/** Les regles al LLEGEIX-ME. */
export function rulesReadme(r: MachineRules, nesting: boolean): string[] {
  const prof = r.profile.map((x) => `${num(x.min)}–${num(x.max)} mm «${x.tool || "automàtica"}»`).join(", ")
  return [
    `- Regles del taller: ranures amb «${r.grooves.tool || "automàtica"}» (com a molt ${num(r.grooves.maxPass)} mm per passada), caixeres amb «${r.pockets.tool || "automàtica"}» (CreateContourPocket), perfilar per gruix: ${prof || "automàtica"}.`,
    `- Peces petites (menys de ${num(r.small.maxArea)} m²${r.small.maxSide > 0 ? ` o algun costat < ${num(r.small.maxSide)} mm` : ""}; les grans, d'una passada): contorn en ${r.small.passes.length + 1} passades (${r.small.passes.map((p) => `deixa Z ${num(p.z)} · XY ${num(p.xy)}`).join(", ")}${r.small.passes.length ? ", " : ""}final ${nesting ? "al martiri" : "als passants"}).`,
    ...(nesting && r.ramp.enabled ? [`- Perfilats amb entrada en rampa de ${num(r.ramp.length)} mm (com a molt la meitat del costat recte més llarg), començant al mig d'aquest costat.`] : []),
  ]
}

/**
 * Programes d'una peça. `ref` = la ref del taller (`A.1.L.1`): nom del fitxer i de la peça a Maestro. `rules`: la tria
 * per regles compartida per tot l'export (els avisos d'eina que falta, un sol cop); sense, els avisos van a la peça.
 */
export function panelXcs(p: Panel, ref: string, m: Machine, rules?: RulePicker): XcsPanelResult {
  const L = p.length
  const W = p.width
  const T = p.thickness
  const through = T + m.throughExtra
  const warnings: string[] = []
  let features = 0
  let skipped = 0
  let missingTool = 0
  const rp = rules ?? new RulePicker(m)
  // `tool`: no surt perquè falta una eina (o no hi arriba).
  const skip = (what: string, why: string, tool = false) => {
    skipped++
    if (tool) missingTool++
    warnings.push(`${what}: ${why}`)
  }
  let edgeHolesDone = 0
  let handled = 0
  const A = new Script("A")
  const B = new Script("B")
  // Broques verticals: "-1" (la tria el Maestro, com als .pgmx del taller) o el nom de la triada.
  const autoDrill = (m.verticalDrills ?? "auto") === "auto"
  const vDrill = (s: Script, t: MachineTool, diameter: number): string => {
    if (!autoDrill) return toolArg(t)
    const same = drillsOfDiameter(m, diameter, "vertical").map(toolMslName)
    s.lines.push(comment(`broca vertical Ø${num(diameter)} (${[...new Set(same)].join("/")}): eina automatica`))
    return cs("-1")
  }
  const vTool = (t: MachineTool) => (autoDrill ? "-1" : t.code)

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
      skip(holeWhat(h), same.length ? `la broca ${same.map((x) => x.code).join("/")} no arriba a ${num(depth)} mm` : `cap broca vertical de Ø${num(h.diameter)} muntada`, true)
      continue
    }
    const x = h.x
    const y = h.face === "A" ? h.y : W - h.y
    s.select("Top")
    const name = s.name("Forat")
    const arg = vDrill(s, t, h.diameter)
    s.lines.push(`CreateDrill(${cs(name)}, ${num(x)}, ${num(y)}, ${num(depth)}, ${num(h.diameter)}, "", TypeOfProcess.Drilling, ${arg}, ${HEAD});`)
    s.op({ kind: "drill", tool: vTool(t), depth, points: [[x, y]], what: holeWhat(h), candidate: t.code })
    handled++
  }

  // --- Forats de cantell (programa A): cara estàndard de cada cantell ------------------------
  const edgeHoles = p.holes.filter((h) => h.face === "edge")
  for (const side of ["bottom", "right", "top", "left"] as const) {
    for (const h of edgeHoles.filter((x) => x.edge === side)) {
      features++
      if (!edgeHoleOnFace(p, h, side)) {
        skip(holeWhat(h), `la peça té forma i el contorn no toca la cara del cantell ${EDGE_NUMBER[side]} en aquest punt`)
        continue
      }
      const t = pickDrill(m, h.diameter, h.depth, "horizontal")
      if (!t) {
        const same = drillsOfDiameter(m, h.diameter, "horizontal")
        skip(holeWhat(h), same.length ? `la broca horitzontal ${same.map((x) => x.code).join("/")} no arriba a ${num(h.depth)} mm` : `cap broca horitzontal de Ø${num(h.diameter)} muntada`, true)
        continue
      }
      const [x, y] = edgePoint(p, h, side)
      A.select(EDGE_PLANE[side])
      const name = A.name("ForatCantell")
      const pair = drillsOfDiameter(m, h.diameter, "horizontal")
        .map(toolMslName)
        .join("/")
      A.lines.push(comment(`broca horitzontal ${pair}: Maestro tria el mandri segons el cantell`))
      A.lines.push(`CreateDrill(${cs(name)}, ${num(x)}, ${num(y)}, ${num(h.depth)}, ${num(h.diameter)}, "", TypeOfProcess.Drilling, ${cs("-1")}, ${HEAD});`)
      A.op({ kind: "drill", tool: "-1", depth: h.depth, points: [[x, y]], what: holeWhat(h), candidate: t.code })
      handled++
      edgeHolesDone++
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

    // Caixera (tancada pels dos extrems): la fresa de la regla amb CreateContourPocket, si hi cap.
    const closed = a0 > EPS && a1 < aMax - EPS
    const pocketTool = closed ? rp.tool("pocket", rp.rules.pockets.tool, width - 0.5, depth) : undefined
    if (pocketTool) {
      const pts = rectPts(x0, y0, x1 - x0, y1 - y0)
      s.select("Top")
      const name = s.name("Caixera")
      s.lines.push(...pocketLines(name, pts, depth, pocketTool))
      s.op({ kind: "pocket", tool: pocketTool.code, depth, points: pts as [number, number][], what: grooveWhat(g) })
      handled++
      continue
    }
    // Ranura amb la fresa de la regla (si no es prefereix el disc), en passades de `maxPass` com a molt.
    const ruleRouter = m.grooves !== "blade" ? rp.tool("groove", rp.rules.grooves.tool, width, depth) : undefined
    const blade = !ruleRouter && m.grooves !== "router" && fullLength ? pickBlade(m, depth, width) : undefined
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
    const router = ruleRouter ?? pickRouter(m, width, depth)
    if (!router) {
      skip(grooveWhat(g), `cap fresa de Ø ≤ ${num(width)} que arribi a ${num(depth)} mm`, true)
      continue
    }
    const maxPass = rp.rules.grooves.maxPass
    const pts = grooveRouterPath(x0, x1, y0, y1, L, W, router.diameter)
    if (!pts) {
      skip(grooveWhat(g), `massa curta per a la fresa ${router.code} (Ø${num(router.diameter)})`, true)
      continue
    }
    s.select("Top")
    const name = s.name("Ranura")
    s.lines.push(`CreatePolyline(${cs(`${name}_G`)}, ${num(pts[0]![0])}, ${num(pts[0]![1])});`)
    for (const q of pts.slice(1)) s.lines.push(`AddSegmentToPolyline(${num(q[0])}, ${num(q[1])});`)
    s.lines.push(...grooveStrategy(depth, maxPass))
    s.lines.push(`CreateRoughFinish(${cs(name)}, ${num(depth)}, ${cs("ranura")}, TypeOfProcess.GeneralRouting, ${toolArg(router)}, ${HEAD}, 0, -1, -1, -1, 0);`)
    s.op({ kind: "route", tool: router.code, depth, points: pts, what: grooveWhat(g), passes: passDepths(depth, maxPass) })
    handled++
  }

  // --- Talls passants (programa A) ---------------------------------------------------------
  for (const c0 of p.cutouts ?? []) {
    features++
    // Ranura tan ampla com llarga: és un cercle (els dos semicercles farien segments de llargada zero).
    const c: Cutout = c0.kind === "slot" && Math.abs(c0.w - c0.h) < 0.001 ? { ...c0, kind: "circle", x: c0.x + c0.w / 2, y: c0.y + c0.h / 2, diameter: Math.min(c0.w, c0.h) } as Cutout : c0
    if (c.kind === "circle") {
      const drill = pickDrill(m, c.diameter, through, "vertical")
      if (drill) {
        A.select("Top")
        const name = A.name("ForatPassant")
        const arg = vDrill(A, drill, c.diameter)
        A.lines.push(`CreateDrill(${cs(name)}, ${num(c.x)}, ${num(c.y)}, ${num(through)}, ${num(c.diameter)}, "", TypeOfProcess.Drilling, ${arg}, ${HEAD});`)
        A.op({ kind: "drill", tool: vTool(drill), depth: through, points: [[c.x, c.y]], what: cutWhat(c), candidate: drill.code })
        handled++
        continue
      }
      const router = rp.profileTool(T, c.diameter - 1, through) ?? pickRouter(m, c.diameter - 1, through)
      if (!router) {
        skip(cutWhat(c), `cap broca de Ø${num(c.diameter)} ni fresa més petita que arribin a ${num(through)} mm`, true)
        continue
      }
      A.select("Top")
      const name = A.name("Tall")
      A.lines.push(`CreateCircleCenterRadius(${cs(`${name}_G`)}, ${num(c.x)}, ${num(c.y)}, ${num(c.diameter / 2)}, false);`)
      A.lines.push(contourLine(name, through, 0, "tall passant", router))
      const pts = flatten([[c.x + c.diameter / 2, c.y, 1], [c.x - c.diameter / 2, c.y, 1]])
      A.op({ kind: "contour", tool: router.code, depth: through, points: pts, what: cutWhat(c) })
      handled++
      continue
    }
    const pts = dedupePolyline(c.kind === "rect" ? rectPts(c.x, c.y, c.w, c.h) : c.kind === "slot" ? slotPts(c) : c.points)
    if (pts.length < 2) {
      skip(cutWhat(c), "contorn sense mida")
      continue
    }
    const flat = flatten(pts)
    const maxDia = maxToolDiameter(pts, "inside")
    // Amb cantonades vives, la fresa més petita (el radi que hi deixa és el seu).
    const sharp = sharpCorners(pts, "inside")
    // Perfilar: la fresa de la regla pel gruix si hi cap; amb cantonades vives, la més petita (com sempre).
    const ruled = sharp ? undefined : rp.profileTool(T, maxDia, through)
    const router = ruled ?? (sharp ? pickSmallRouter(m, maxDia, through) : pickRouter(m, maxDia, through))
    if (!router) {
      skip(cutWhat(c), `cap fresa prou petita (Ø ≤ ${num(maxDia)}) que arribi a ${num(through)} mm`, true)
      continue
    }
    if (sharp && router.diameter / 2 > 0.5) warnings.push(`${cutWhat(c)}: ${sharp} cantonades vives queden amb radi ${num(router.diameter / 2)} mm (fresa ${toolMslName(router)} Ø${num(router.diameter)})`)
    A.select("Top")
    const name = A.name("Tall")
    A.lines.push(...closedPolyline(`${name}_G`, pts))
    A.lines.push(contourLine(name, through, 0, "tall passant", router))
    A.op({ kind: "contour", tool: router.code, depth: through, points: flat, what: cutWhat(c) })
    handled++
  }

  // --- Contorn de les peces amb forma (programa A, l'últim) -----------------------------------
  if (p.outline?.length) {
    features++
    const outline = dedupePolyline(p.outline)
    const maxDia = maxToolDiameter(outline, "outside")
    const sharp = sharpCorners(outline, "outside")
    const ruled = sharp ? undefined : rp.profileTool(T, maxDia, through)
    const router = ruled ?? (sharp ? pickSmallRouter(m, maxDia, through) : pickRouter(m, maxDia, through))
    if (outline.length < 3) skip("contorn de la peça", "contorn sense mida")
    else if (!router) skip("contorn de la peça", `cap fresa${Number.isFinite(maxDia) ? ` de Ø ≤ ${num(maxDia)}` : ""} que arribi a ${num(through)} mm`, true)
    else {
      if (sharp && router.diameter / 2 > 0.5) warnings.push(`contorn de la peça: ${sharp} cantonades entrants queden amb radi ${num(router.diameter / 2)} mm (fresa ${toolMslName(router)} Ø${num(router.diameter)})`)
      A.select("Top")
      const name = A.name("Contorn")
      A.lines.push(...closedPolyline(`${name}_G`, outline))
      // Peça petita: passades de desbast (regles) i la final; normal: una passada.
      const flatOutline = flatten(outline)
      const small = isSmallPart(rp.rules, L, W, Math.abs(polygonArea(flatOutline)))
      const passes = contourPasses(T, through, small, rp.rules.small.passes)
      passes.forEach((ps, k) => {
        const n = passes.length > 1 ? `${name}_P${k + 1}` : name
        if (passes.length > 1) A.lines.push(comment(`peca petita: passada ${k + 1} de ${passes.length} (fondaria ${num(ps.depth)}, sobrant ${num(ps.xy)})`))
        A.lines.push(contourLine(n, ps.depth, 1, "contorn", router, ps.xy))
        A.op({ kind: "contour", tool: router.code, depth: ps.depth, points: flatOutline, what: "contorn de la peça", ...(passes.length > 1 ? { xy: ps.xy, pass: { index: k + 1, count: passes.length } } : {}) })
      })
      handled++
    }
  }

  // Inglets, cantells, encolar…: no són avisos, són els passos de després (`postProcesses`).
  const hasB = B.ops.length > 0
  if (needsSecondFace(p) && !hasB) warnings.push("la cara B no té cap mecanitzat que es pugui fer: no hi ha programa «Volt»")
  const post = postProcessesOf(p, ref, hasB, edgeHolesDone)
  const cncFiles = [...(A.ops.length ? [`${ref}.xcs`] : []), ...(hasB ? [`${secondFaceProgram(ref)}.xcs`] : [])]
  const route = [cncFiles.length ? `CNC: ${cncFiles.join(" + ")}` : "CNC: sense programa", ...post.filter((x) => x.kind !== "secondFace").map((x) => x.station)].join(" → ")

  const programs: XcsProgram[] = []
  const header = (face: "A" | "B") => {
    const lines = [
      comment(`Mobles CNC - programa Maestro (MSL .xcs) - BETA: comprova'l a Maestro abans de mecanitzar`),
      comment(`Peca ${ref}: ${p.label} (${p.name}) - ${num(L)} x ${num(W)} x ${num(T)} - ${p.material}`),
      face === "A"
        ? comment(`Cara A amunt. X = u (${num(L)} mm), Y = v (${num(W)} mm), origen a la cantonada de baix a l'esquerra (cantell 4 a X = 0, cantell 3 a Y = 0)`)
        : comment(`Cara B amunt: la peca girada sobre l'eix X (${num(L)} mm; el cantell 1 passa a Y = 0). Forats de cantell i talls: al programa de la cara A`),
      comment(`Maquina ${m.name}${m.serial ? ` (${m.serial})` : ""}${m.maestroVersion ? ` - Maestro ${m.maestroVersion}` : ""}`),
      ...(m.pgmx ? [comment(`Noms d'eina i capcalera del projecte ${m.pgmx.file} (Maestro ${m.pgmx.version})`)] : []),
      ...rulesComment(rp.rules, false),
      // Només comentaris (cap missatge a l'operari, que aturaria la màquina).
      ...(post.length ? [comment(`Ordre de treball: ${route}`), comment("Despres de la CNC:"), ...post.map((x, i) => comment(`  ${i + 1}. ${x.text}`))] : []),
      "",
      `SetMachiningParameters(${cs(m.header.executionFields)}, ${m.header.repetitions ?? 1}, ${m.header.tableOptions}, ${m.header.mechanicalOptions}, ${m.header.continuousCycle ?? false});`,
      `CreateFinishedWorkpieceBox(${cs(ref)}, ${num(L)}, ${num(W)}, ${num(T)});`,
      `CreateRawWorkpiece(${cs(ref)}, 0, 0, 0, 0, 0, 0);`,
    ]
    return lines
  }
  if (A.ops.length) programs.push({ file: `${ref}.xcs`, face: "A", text: [...header("A"), ...A.lines, ""].join(EOL) })
  if (hasB) programs.push({ file: `${secondFaceProgram(ref)}.xcs`, face: "B", text: [...header("B"), ...B.lines, ""].join(EOL) })
  // Sola (sense l'export): els avisos de les regles, a la peça.
  if (!rules) {
    warnings.unshift(...rp.notes)
    missingTool += rp.missing
  }
  return { ref, programs, ops: [...A.ops, ...B.ops], warnings, missingTool, postProcesses: post, route, features, skipped, handled }
}

/** On es fa cada post-procés (per a la ruta). */
export const STATION: Record<ProcessKind, string> = {
  secondFace: "CNC cara B",
  mitre: "serra (inglets)",
  edge: "cantejadora",
  edgeDrill: "perforadora horitzontal",
  glue: "encolar",
  push: "muntar el push",
}

const plural = (detail: string, one: string, many: string) => (detail.includes("+") ? many : one)

/**
 * Passos de després de la CNC (`panelProcesses`, mateix ordre), sense el que ja fa el programa: la cara B
 * és el programa «Volt» i els forats de cantell que surten al programa A no compten. Cantells amb la
 * numeració de l'app (1 dalt · 2 dreta · 3 baix · 4 esquerra, com la llista de peces).
 */
export function postProcessesOf(p: Panel, ref: string, hasB: boolean, edgeHolesDone: number): XcsPostProcess[] {
  const out: XcsPostProcess[] = []
  for (const x of panelProcesses(p)) {
    const station = STATION[x.kind]
    if (x.kind === "secondFace") {
      if (hasB) out.push({ kind: x.kind, station, text: `Programa cara B: ${secondFaceProgram(ref)}.xcs (girar la peça sobre l'eix X)` })
    } else if (x.kind === "mitre") {
      const n = x.detail.replace(/^cantell /, "")
      out.push({ kind: x.kind, station, text: `Inglet a 45° · ${plural(n, "cantell", "cantells")} ${n} (serra)` })
    } else if (x.kind === "edge") {
      out.push({ kind: x.kind, station, text: `Cantejar ${plural(x.detail, "cantell", "cantells")} ${x.detail} (cantejadora)` })
    } else if (x.kind === "edgeDrill") {
      const left = p.holes.filter((h) => h.face === "edge").length - edgeHolesDone
      if (left > 0) out.push({ kind: x.kind, station, text: `Forats de cantell · ${left} ${left === 1 ? "forat" : "forats"} que no fa la CNC (perforadora horitzontal)` })
    } else if (x.kind === "glue") {
      out.push({ kind: x.kind, station, text: `Encolar · ${x.detail}` })
    } else {
      out.push({ kind: x.kind, station, text: `Push (Tip-On) · ${x.detail}` })
    }
  }
  return out
}

export interface XcsExport {
  files: { name: string; text: string }[]
  panels: XcsPanelResult[]
  /** Avisos amb la peça (només problemes de debò): «A.1.L.1 (lat e): forat Ø5…». */
  warnings: string[]
  /** Avisos per una eina que falta o no hi arriba. */
  missingTool: number
  /** Peces amb algun pas després de la CNC. */
  postProcessPanels: number
  programs: number
}

/** Bytes d'un fitxer de l'export: UTF-8 amb BOM (els .xcs i el LLEGEIX-ME; pendent de validar a Maestro). */
export function xcsBytes(text: string): Uint8Array {
  const body = new TextEncoder().encode(text)
  const out = new Uint8Array(body.length + 3)
  out.set([0xef, 0xbb, 0xbf])
  out.set(body, 3)
  return out
}

/** El .zip de l'export (sense compressió). */
export function xcsZip(x: Pick<XcsExport, "files">, when?: Date): Uint8Array {
  return zipStore(x.files.map((f) => ({ name: f.name, data: xcsBytes(f.text) })), when)
}

/** Tots els programes d'un moble + un LLEGEIX-ME.txt. */
export function toMaestroXcs(panels: Panel[], m: Machine, opts: { project: string; date?: Date }): XcsExport {
  const refs = pieceRefs(panels)
  const rp = new RulePicker(m)
  const results = panels.map((p) => panelXcs(p, refs.get(p.id) ?? p.id, m, rp))
  const files: { name: string; text: string }[] = []
  // Primer les regles amb eines que falten (un sol cop per export), després els de cada peça.
  const warnings: string[] = [...rp.notes]
  results.forEach((r, i) => {
    for (const prog of r.programs) files.push({ name: prog.file, text: prog.text })
    for (const w of r.warnings) warnings.push(`${r.ref} (${panels[i]!.label}): ${w}`)
  })
  const empty = results.filter((r) => !r.programs.length).map((r) => r.ref)
  files.push({ name: "LLEGEIX-ME.txt", text: readme(opts.project, m, results, panels, warnings, empty, opts.date ?? new Date()) })
  return {
    files,
    panels: results,
    warnings,
    missingTool: results.reduce((a, r) => a + r.missingTool, 0) + rp.missing,
    postProcessPanels: results.filter((r) => r.postProcesses.length).length,
    programs: results.reduce((a, r) => a + r.programs.length, 0),
  }
}

function readme(project: string, m: Machine, results: XcsPanelResult[], panels: Panel[], warnings: string[], empty: string[], date: Date): string {
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
    "- X = llargada de la peça a l'app (u), Y = amplada (v), Z = gruix. Origen a la cantonada de baix",
    "  a l'esquerra de la cara A (cantell 4 a l'esquerra, cantell 3 a baix, com a l'app).",
    "- Forats de cantell a les cares estàndard (Front = cantell 3, Back = 1, Left = 4, Right = 2),",
    "  a mig gruix. Broques horitzontals amb eina automàtica (\"-1\").",
    m.verticalDrills === "tool" ? "- Broques verticals: el nom de la broca que ha triat l'app." : "- Broques verticals: eina automàtica (\"-1\"), com als projectes del taller.",
    `- Eines pel nom de Maestro${m.pgmx ? ` (noms del projecte ${m.pgmx.file}, Maestro ${m.pgmx.version})` : " (codi del .tlgx)"}.`,
    "- Fitxers .xcs en UTF-8 amb BOM.",
    "- Cantells amb la numeració de l'app: 1 dalt · 2 dreta · 3 baix · 4 esquerra (pendent de confirmar",
    "  amb la del taller).",
    `- Talls i forats passants: gruix + ${num(m.throughExtra)} mm.`,
    ...rulesReadme(machineRules(m), false),
    "",
    `Peces: ${results.length} · programes: ${results.reduce((a, r) => a + r.programs.length, 0)}`,
  ]
  if (empty.length) lines.push(`Sense mecanitzats (no tenen programa): ${empty.join(", ")}`)
  // Per peça: la ruta i el que li toca després de la CNC (per a l'etiqueta).
  const withPost = results.map((r, i) => ({ r, p: panels[i]! })).filter(({ r }) => r.postProcesses.length)
  if (withPost.length) {
    lines.push("", `Ordre de treball i després de la CNC (${withPost.length} ${withPost.length === 1 ? "peça" : "peces"})`)
    for (const { r, p } of withPost) {
      lines.push("", `${r.ref} (${p.label})`, `  Ordre de treball: ${r.route}`, "  Després de la CNC:")
      r.postProcesses.forEach((x, k) => lines.push(`    ${k + 1}. ${x.text}`))
    }
  }
  if (warnings.length) {
    lines.push("", `Avisos (${warnings.length}): el que no surt als programes o s'ha canviat`)
    for (const w of warnings) lines.push(`- ${w}`)
  }
  return lines.join(EOL) + EOL
}
