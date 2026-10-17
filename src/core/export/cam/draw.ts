import { toolMslName, type Machine, type MachineTool } from "../../model/machine"
import { signedArea } from "../../model/polygon"
import { dist, flattenPath, offsetPolyline, toolpath3 } from "./geometry"
import type { CamOp, CamOpKind, Pt } from "./types"

/** Què dibuixar de cada operació, la llegenda d'eines i la llista compacta. */

/** Eina de la màquina pel nom de l'MSL (el del .pgmx), el codi o el nom, sense majúscules ni espais de més. */
export function findTool(m: Pick<Machine, "tools"> | undefined, name: string): MachineTool | undefined {
  if (!m || !name || name === "-1") return undefined
  const k = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase()
  const want = k(name)
  return m.tools.find((t) => k(toolMslName(t)) === want) ?? m.tools.find((t) => k(t.code) === want) ?? m.tools.find((t) => k(t.name) === want)
}

/** Amplada del tall d'una eina: el gruix del disc o el Ø. */
export const cutWidth = (t: MachineTool | undefined): number | undefined => (t ? (t.kind === "blade" && t.bladeThickness ? t.bladeThickness : t.diameter) || undefined : undefined)

export interface CamDraw {
  /** La geometria del fitxer, en punts. */
  outline: Pt[]
  closed: boolean
  /** Recorregut del centre de l'eina (aproximat): l'òfset de mig Ø cap al costat que toca, o el `CreateToolpath`. */
  centre: Pt[]
  /** Amplada de la franja que treu l'eina (Ø), si se sap. */
  width?: number
  /** Caixera: tota l'àrea es buida. */
  fill: boolean
  /** Recorregut amb Z (relleus 3D, `CreateToolpath`): punts del centre de l'eina amb la Z (0 a la cara de dalt). */
  centre3?: [number, number, number][]
}

/** Què dibuixar d'una operació de fresa (no forats): la geometria, el centre de l'eina al costat bo i l'amplada. */
export function camDraw(op: CamOp, width: number | undefined): CamDraw | null {
  if (op.kind === "drill") return null
  if (op.toolpath) {
    const tp = flattenPath(op.toolpath)
    const c3 = toolpath3(op.toolpath)
    return { outline: op.path ? flattenPath(op.path) : tp, closed: !!op.path?.closed, centre: tp, ...(width ? { width } : {}), fill: false, ...(c3 ? { centre3: c3 } : {}) }
  }
  if (!op.path) return null
  const outline = flattenPath(op.path)
  const closed = op.path.closed
  const r = (width ?? 0) / 2
  const base = { outline, closed, ...(width ? { width } : {}), fill: op.kind === "pocket" }
  if (!r) return { ...base, centre: outline }
  if (op.path.circle && (op.side === "inside" || op.side === "outside")) {
    const { c, r: R } = op.path.circle
    const rr = op.side === "inside" ? R - r : R + r
    if (rr <= 1e-6) return { ...base, centre: [c] }
    const n = 72
    return { ...base, centre: Array.from({ length: n }, (_, k): Pt => [c[0] + rr * Math.cos((2 * Math.PI * k) / n), c[1] + rr * Math.sin((2 * Math.PI * k) / n)]) }
  }
  let s = 0
  if (op.side === "left") s = r
  else if (op.side === "right") s = -r
  else if ((op.side === "inside" || op.side === "outside") && closed) {
    const ccw = signedArea(outline) > 0
    // Antihorari: l'interior és a l'esquerra.
    s = (op.side === "inside") === ccw ? r : -r
  }
  return { ...base, centre: offsetPolyline(outline, closed, s) }
}

/** Entrada lineal: el tram de `length` mm que acaba al començament del recorregut, en la direcció del primer tram. */
export function approachSegment(centre: Pt[], length: number): [Pt, Pt] | null {
  if (centre.length < 2 || length <= 0) return null
  const a = centre[0]!
  const b = centre.find((q) => dist(q, a) > 1e-6)
  if (!b) return null
  const l = dist(a, b)
  return [[a[0] - ((b[0] - a[0]) / l) * length, a[1] - ((b[1] - a[1]) / l) * length], a]
}

// ——— Llegenda i llista ———

export interface CamToolInfo {
  /** Clau per al color. */
  key: string
  name: string
  kind: "drill" | "router" | "blade"
  diameter?: number
  /** Forats o operacions. */
  count: number
}

/** Clau d'eina d'una operació: forats pel nom i el Ø (una broca automàtica pot ser de diversos Ø). */
export const toolKey = (op: CamOp): string => (op.kind === "drill" ? `D|${op.tool}|${op.diameter}` : `R|${op.tool}`)

/** Llegenda: una fila per eina, en l'ordre en què surten. */
export function camTools(ops: CamOp[], m?: Pick<Machine, "tools">): CamToolInfo[] {
  const out = new Map<string, CamToolInfo>()
  for (const o of ops) {
    const key = toolKey(o)
    const cur = out.get(key)
    if (cur) {
      cur.count++
      continue
    }
    const t = findTool(m, o.tool)
    const diameter = o.kind === "drill" ? o.diameter : cutWidth(t)
    out.set(key, { key, name: o.tool === "-1" ? "automàtica" : o.tool, kind: o.kind === "drill" ? "drill" : o.kind === "slot" || t?.kind === "blade" ? "blade" : "router", ...(diameter ? { diameter } : {}), count: 1 })
  }
  return [...out.values()]
}

export interface CamRow {
  /** Primera i darrera operació (forats seguits de la mateixa eina i fondària, en una fila). */
  from: number
  to: number
  ops: CamOp[]
  tool: string
  key: string
  kind: CamOpKind
  depth: number
  count: number
}

/** Llista compacta: les operacions en ordre, amb els forats seguits iguals (eina, Ø i fondària) junts. */
export function camRows(ops: CamOp[]): CamRow[] {
  const rows: CamRow[] = []
  for (const o of ops) {
    const last = rows[rows.length - 1]
    if (last && o.kind === "drill" && last.kind === "drill" && last.key === toolKey(o) && Math.abs(last.depth - o.depth) < 1e-6 && last.to === o.n - 1) {
      last.to = o.n
      last.count++
      last.ops.push(o)
      continue
    }
    rows.push({ from: o.n, to: o.n, ops: [o], tool: o.tool, key: toolKey(o), kind: o.kind, depth: o.depth, count: 1 })
  }
  return rows
}
