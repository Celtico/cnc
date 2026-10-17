import type { EdgeSide, Hole, Panel } from "../../model"
import { toolMslName, type MachineTool } from "../../model/machine"
import { asciiFold } from "../text"
import { roundTo } from "../../../lib/format"

/** Peces bàsiques de l'MSL: números, cadenes, comentaris, plans i l'script d'un programa (`Script`). */

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

export const EOL = "\r\n"

/** Número per a l'MSL: punt decimal, fins a 3 decimals, sense zeros de més. Llança si no és finit. */
export function num(n: number): string {
  if (!Number.isFinite(n)) throw new Error(`Número no vàlid a l'MSL: ${n}`)
  const r = roundTo(n, 3)
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

export class Script {
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
