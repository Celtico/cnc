import type { EdgeRef, GenOp, PartKind } from "../model"

/**
 * Programes **Xilog** de SCM (`*.pgm`; els «Esquemas de taladrado» de Blum E-SERVICES, `docs/ferratges-import.md` §10):
 * un contenidor binari (capçalera `BMB`, «Xilog3-9.0», taules) amb els **registres en ASCII** acabats en NUL, p. ex.
 *
 *     H DX=200 DY=100 DZ=19 BX=0 BY=0 -AB C=0 T=0 R=1 *MM /"def.tlg"
 *     XBO X=0 Y=-16 Z=-6 x=0 y=0 D=10 R=1# F=1 C=0 K=0 P=0 N="P"
 *
 * Aquí es llegeixen els registres (també d'un programa en text pla, una línia per registre) sense entendre el binari, i
 * els `XBO` (forats) passen a **operacions exactes** del generador de mecanitzats (`GenOp`), com les capes d'un DXF del
 * taller: el Ø i la fondària els diu el programa, no s'endevinen. Pur, sense dependències; **mai llança** amb un fitxer
 * estrany: el que no entén ho diu (`warnings`, `unknown`).
 *
 * **Hipòtesis** (cap manual del Xilog3 a mà; contrastades amb els programes de Blum i el manual de Xilog Plus):
 * - `H`: peça de treball `DX × DY × DZ` (Blum hi posa una peça de mostra de 200 × 100 × 19) i l'origen `BX`, `BY`.
 * - `XBO`: forat a (`X`, `Y`) des de l'origen de la peça (Blum: el **punt de referència del producte** a 0, 0); `Z`
 *   negatiu = fondària des de la cara (`Z ≤ −DZ` → passant); `D` = Ø; `F` = cara (1 dalt = **cara A**; 2 dreta, 3 esquerra,
 *   4 davant, 5 darrere = cantells, com al manual de Xilog Plus; 6 = sota, **cara B**); `R` = **nombre total** de forats
 *   (Blum hi posa 1 amb `x = y = 0`) i `x`, `y` = pas de la repetició. El `#` d'un valor (`R=1#`) es treu.
 * - Forats de cantell (F 2–5): el cantell de la cara, la posició al llarg del cantell (Y als cantells esquerre/dret, X
 *   als de davant/darrere) i la fondària `|Z|`. Sense cap mostra real: es marquen a les notes per revisar-los.
 * - `N` (final del programa, «N X=0 Y=0»): no fa res. Els fresats (`XG0`, `XL2P`, `XA2P`…) i la resta no es llegeixen:
 *   es compten a `unknown` i surten a les notes («entra'ls a mà»).
 */

export interface XilogRecord {
  /** Nom del registre (`H`, `XBO`, `XG0`…). */
  name: string
  /** Paràmetres `CLAU=valor` (les claus distingeixen majúscules: `X` ≠ `x`). */
  params: Record<string, string>
  text: string
}

export interface XilogHole {
  x: number
  y: number
  /** Fondària (mm, positiva). */
  depth: number
  d: number
  /** Cara Xilog (1 dalt, 2 dreta, 3 esquerra, 4 davant, 5 darrere, 6 sota). */
  face: number
  through: boolean
}

export interface XilogProgram {
  /** «Xilog3-9.0» si el fitxer ho diu. */
  version?: string
  header: { dx: number; dy: number; dz: number; bx: number; by: number } | null
  records: XilogRecord[]
  holes: XilogHole[]
  /** Registres que no es converteixen (nom → quants). */
  unknown: Record<string, number>
  warnings: string[]
}

/** Registres de fresat (no es llegeixen, però se sap què són). */
const ROUTING = /^(XG0|XG|XGIN|XGOUT|XL2P|XL|XA2P|XA|XAR|XAR2|XP|XPL|XPA|XS|XSR|XO|XGO)$/

const num = (s: string | undefined): number => {
  if (s === undefined) return NaN
  const v = Number(s.replace(/#$/, "").replace(/^"|"$/g, ""))
  return Number.isFinite(v) ? v : NaN
}

/** Els registres ASCII d'un programa (binari o text). */
export function xilogRecords(text: string): XilogRecord[] {
  const out: XilogRecord[] = []
  // Una tirada de text imprimible que comença per un nom en majúscules i porta algun «CLAU=».
  const re = /(?:^|[^\x20-\x7e])([A-Z][A-Z0-9]{0,7} [\x20-\x7e]*)/g
  for (const m of text.matchAll(re)) {
    const line = m[1]!.trim()
    if (!/[A-Za-z]=/.test(line)) continue
    const name = line.split(" ", 1)[0]!
    const params: Record<string, string> = {}
    for (const p of line.slice(name.length).matchAll(/([A-Za-z][A-Za-z0-9]*)=("[^"]*"|\S+)/g)) params[p[1]!] = p[2]!
    out.push({ name, params, text: line })
  }
  return out
}

const fmt = (v: number) => String(Math.round(v * 100) / 100).replace(".", ",")

/** Llegeix un programa Xilog (`.pgm` binari o el text). Mai llança. */
export function readXilog(src: Uint8Array | string): XilogProgram {
  const text = typeof src === "string" ? src : new TextDecoder("latin1").decode(src)
  const version = /Xilog[\w.-]*/.exec(text)?.[0]
  const records = xilogRecords(text)
  const warnings: string[] = []
  const unknown: Record<string, number> = {}
  const holes: XilogHole[] = []
  let header: XilogProgram["header"] = null
  for (const r of records) {
    const P = r.params
    if (r.name === "H") {
      const dx = num(P.DX), dy = num(P.DY), dz = num(P.DZ)
      if ([dx, dy, dz].every((v) => v > 0)) header = { dx, dy, dz, bx: num(P.BX) || 0, by: num(P.BY) || 0 }
      else warnings.push(`Capçalera sense mides vàlides: ${r.text}`)
      continue
    }
    if (r.name === "N") continue
    if (r.name !== "XBO") {
      unknown[r.name] = (unknown[r.name] ?? 0) + 1
      continue
    }
    const x = num(P.X), y = num(P.Y), z = num(P.Z), d = num(P.D)
    const face = P.F === undefined ? 1 : num(P.F)
    if (![x, y, z, d].every(Number.isFinite) || !(d > 0)) {
      warnings.push(`Forat que no s'entén (falta X, Y, Z o D): ${r.text}`)
      continue
    }
    if (!(face >= 1 && face <= 6 && Number.isInteger(face))) {
      warnings.push(`Forat a una cara desconeguda (F=${P.F}): ${r.text}`)
      continue
    }
    if (!(z < 0)) {
      warnings.push(`Forat sense fondària (Z=${fmt(z)}; s'espera negativa): ${r.text}`)
      continue
    }
    const depth = -z
    const dz = header?.dz ?? Infinity
    const through = (face === 1 || face === 6) && depth >= dz - 0.01
    const count = Math.max(1, Math.round(num(P.R) || 1))
    const sx = num(P.x) || 0, sy = num(P.y) || 0
    const n = count > 1 && (sx !== 0 || sy !== 0) ? count : 1
    if (count > 1 && n === 1) warnings.push(`R=${count} sense pas (x = y = 0): un sol forat.`)
    for (let k = 0; k < n; k++) holes.push({ x: x + k * sx, y: y + k * sy, depth, d, face, through })
  }
  if (!header) warnings.push("Sense capçalera H (mides de la peça): els forats no es poden comprovar com a passants.")
  for (const [name, count] of Object.entries(unknown))
    warnings.push(ROUTING.test(name) ? `${count} fresat${count === 1 ? "" : "s"} (${name}) no es llegeix${count === 1 ? "" : "en"}: entra'l${count === 1 ? "" : "s"} a mà al generador.` : `${count} registre${count === 1 ? "" : "s"} ${name} desconegut${count === 1 ? "" : "s"}: no es fa${count === 1 ? "" : "n"} servir.`)
  return { ...(version ? { version } : {}), header, records, holes, unknown, warnings }
}

/** El cantell d'una cara Xilog (2 dreta, 3 esquerra, 4 davant, 5 darrere), amb X → P i Y → Q. */
const EDGE_OF_FACE: Record<number, EdgeRef> = { 2: "pmax", 3: "pmin", 4: "qmin", 5: "qmax" }

/** Té algun registre de Xilog (per saber si un fitxer ho és). */
export const isXilog = (p: XilogProgram): boolean => p.header !== null || p.records.some((r) => r.name === "XBO")

/**
 * Les operacions exactes d'un programa per a la peça `part` (`X` → eix P de la peça, `Y` → eix Q, des del punt de
 * referència). Ids `<prefix>-1`, `<prefix>-2`…
 */
export function machiningFromXilog(src: Uint8Array | string | XilogProgram, part: PartKind, prefix = "pgm"): { ops: GenOp[]; notes: string[]; program: XilogProgram } {
  const program = typeof src === "object" && "records" in src ? src : readXilog(src)
  const ops: GenOp[] = []
  const notes = [...program.warnings]
  let k = 0
  const ref = (at: number) => ({ from: "ref" as const, at: Math.round(at * 100) / 100 })
  let edges = 0
  for (const h of program.holes) {
    const id = `${prefix}-${++k}`
    if (h.face === 1 || h.face === 6) {
      const face = h.face === 6 ? "B" : "A"
      ops.push(h.through ? { id, part, kind: "drill", face: "A", p: ref(h.x), q: ref(h.y), d: h.d, depth: 1, through: true } : { id, part, kind: "drill", face, p: ref(h.x), q: ref(h.y), d: h.d, depth: h.depth })
      continue
    }
    edges++
    ops.push({ id, part, kind: "drill", face: "edge", edge: EDGE_OF_FACE[h.face]!, p: ref(h.x), q: ref(h.y), d: h.d, depth: h.depth })
  }
  if (edges) notes.push(`${edges} forat${edges === 1 ? "" : "s"} de cantell (F 2–5): el cantell i la fondària són una hipòtesi; revisa'ls.`)
  if (program.holes.some((h) => h.face === 6)) notes.push("Forats a la cara de sota (F=6) → cara B (hipòtesi).")
  if (!ops.length) notes.push("El programa no porta cap forat (XBO).")
  return { ops, notes, program }
}
