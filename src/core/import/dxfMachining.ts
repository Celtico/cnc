import { axisRect, signedArea, type GenOp, type PartKind } from "../model"
import { readDxf, type DxfDrawing, type P2 } from "./dxf"

/**
 * Mecanitzats **exactes** d'un DXF per peça (el germà els exporta de TopSolid; `docs/ferratges-import.md` §7): les capes
 * amb el nom de la convenció del nostre export DXF diuen què és cada entitat i amb quines mides, sense endevinar res
 * (al revés que els cilindres del STEP). Pur.
 *
 * | Capa | Entitats | Operació |
 * |---|---|---|
 * | `DRILL_D<Ø>_P<fondària>` (cara A) · `DRILL_B_…` (cara B) | cercles | forat cec (el Ø de la capa) |
 * | `GROOVE_W<amplada>_P<fondària>` · `GROOVE_B_…` | rectangle tancat, o línia central (llargada + amplada) | ranura |
 * | `POCKET_P<fondària>` · `POCKET_B_…` | rectangle tancat | caixera |
 * | `CUT_THROUGH` | cercles (forat passant) i polilínies tancades | tall passant |
 * | `CONTOUR` | polilínies tancades | tall passant; la que ho envolta tot és el contorn de la peça: no es talla |
 *
 * Decimals amb `_` (`P17_5` = 17,5; R12 no admet el punt). Coordenades en mm amb l'**origen al punt de referència** del
 * ferratge: X al llarg de l'eix P de la peça i Y al llarg de Q (`partAxes`). Els forats de cantell (`DRILL_H_…`) i el que
 * no és d'aquestes formes no es llegeixen: es diu a les notes.
 */

export interface DxfMachining {
  ops: GenOp[]
  notes: string[]
}

type LayerSpec =
  | { kind: "drill"; face: "A" | "B"; d: number; depth: number }
  | { kind: "edge" }
  | { kind: "groove"; face: "A" | "B"; w: number; depth: number }
  | { kind: "pocket"; face: "A" | "B"; depth: number }
  | { kind: "through" }
  | { kind: "contour" }

const NUM = "(\\d+(?:[._]\\d+)?)"
const num = (s: string) => Number(s.replace("_", "."))

/** Què vol dir una capa (`null` si no és de la convenció). */
export function machiningLayer(name: string): LayerSpec | null {
  const s = name.trim().toUpperCase()
  let m = new RegExp(`^DRILL_(B_)?D${NUM}_P${NUM}$`).exec(s)
  if (m) return { kind: "drill", face: m[1] ? "B" : "A", d: num(m[2]!), depth: num(m[3]!) }
  if (/^DRILL_H_/.test(s)) return { kind: "edge" }
  m = new RegExp(`^GROOVE_(B_)?W${NUM}_P${NUM}$`).exec(s)
  if (m) return { kind: "groove", face: m[1] ? "B" : "A", w: num(m[2]!), depth: num(m[3]!) }
  m = new RegExp(`^POCKET_(B_)?P${NUM}$`).exec(s)
  if (m) return { kind: "pocket", face: m[1] ? "B" : "A", depth: num(m[2]!) }
  if (s === "CUT_THROUGH") return { kind: "through" }
  if (s === "CONTOUR") return { kind: "contour" }
  return null
}

/** La peça d'un DXF pel sufix del nom: `<ref>_porta.dxf`, `<ref>_lateral.dxf`… (`null` si no en diu cap). */
export function partFromFileName(name: string): PartKind | null {
  const base = name.split("/").pop()!.replace(/\.[^.]+$/, "").toLowerCase()
  const words = base.split(/[_\s.-]+/).filter(Boolean)
  const WORDS: [RegExp, PartKind][] = [
    [/^(porta|portes|front|frontal|door|abatible|tapeta)$/, "front"],
    [/^(lateral|laterals|side|costat|divisor)$/, "side"],
    [/^(base|bottom|terra)$/, "bottom"],
    [/^(tapa|sostre|top|tauler|taula|sobre)$/, "top"],
    [/^(prestatge|prestatges|shelf|estant)$/, "shelf"],
    [/^(fons|trassera|back|darrere)$/, "back"],
    [/^(calaix|caixa|drawer)$/, "drawer"],
    [/^(peca|peça|part|lliure)$/, "part"],
  ]
  // L'última paraula que en diu una (la ref va al davant: «70147_porta», «armari_2_lateral»).
  for (let i = words.length - 1; i >= 0; i--) for (const [re, k] of WORDS) if (re.test(words[i]!)) return k
  return null
}

/** Té alguna capa de mecanitzat (per saber si un DXF és d'aquests o una vista del fabricant). */
export function hasMachiningLayers(d: DxfDrawing): boolean {
  return [...d.circles, ...d.polylines].some((e) => { const l = machiningLayer(e.layer); return !!l && l.kind !== "contour" })
}

const r2 = (v: number) => Math.round(v * 100) / 100
const fmt = (v: number) => String(r2(v)).replace(".", ",")

/**
 * Les operacions d'un DXF (text o ja llegit) per a la peça `part`. Les ids són `dxf-1`, `dxf-2`… (`prefix`).
 */
export function machiningFromDxf(src: string | DxfDrawing, part: PartKind, prefix = "dxf"): DxfMachining {
  const d = typeof src === "string" ? readDxf(src) : src
  const ops: GenOp[] = []
  const notes: string[] = []
  let k = 0
  const id = () => `${prefix}-${++k}`
  const ref0 = (at: number) => ({ from: "ref" as const, at: r2(at) })
  // Els cercles també surten com a polilínia tancada (el lector els dibuixa): aquestes no compten.
  const isCircle = (layer: string, pts: P2[]) =>
    d.circles.some((c) => c.layer === layer && pts.length > 8 && pts.every(([x, y]) => Math.abs(Math.hypot(x - c.x, y - c.y) - c.r) < Math.max(0.05, c.r * 0.01)))
  const skipped = new Map<string, number>()
  const skip = (why: string) => skipped.set(why, (skipped.get(why) ?? 0) + 1)

  for (const c of d.circles) {
    const spec = machiningLayer(c.layer)
    if (!spec) continue
    const dia = r2(2 * c.r)
    if (spec.kind === "drill") {
      if (Math.abs(dia - spec.d) > 0.1) notes.push(`Un cercle de Ø${fmt(dia)} a la capa ${c.layer}: es fa amb el Ø de la capa (${fmt(spec.d)}).`)
      ops.push({ id: id(), part, kind: "drill", face: spec.face, p: ref0(c.x), q: ref0(c.y), d: spec.d, depth: spec.depth })
    } else if (spec.kind === "through" || spec.kind === "contour") {
      ops.push({ id: id(), part, kind: "drill", face: "A", p: ref0(c.x), q: ref0(c.y), d: dia, depth: 1, through: true })
    } else if (spec.kind === "edge") skip("forats de cantell (DRILL_H_…): entra'ls a mà")
    else skip(`cercles a la capa ${c.layer}`)
  }

  // Polilínies: les del contorn de la peça (la que envolta totes les altres entitats) no es tallen.
  const polys = d.polylines.filter((pl) => {
    const spec = machiningLayer(pl.layer)
    return spec && spec.kind !== "drill" && spec.kind !== "edge" && !isCircle(pl.layer, pl.pts)
  })
  // El contorn de la peça: la polilínia tancada més gran de la capa CONTOUR, si envolta tota la resta (o no n'hi ha res més).
  const areaOf = (pl: (typeof polys)[number]) => Math.abs(signedArea(closedPts(pl.pts, pl.closed) ?? []))
  const biggest = polys.filter((pl) => machiningLayer(pl.layer)!.kind === "contour" && closedPts(pl.pts, pl.closed)).sort((a, b) => areaOf(b) - areaOf(a))[0]
  const rest: P2[] = [...d.circles.filter((c) => machiningLayer(c.layer)).map((c) => [c.x, c.y] as P2), ...polys.filter((pl) => pl !== biggest).flatMap((pl) => pl.pts)]
  const outline = biggest && (rest.length === 0 || encloses(closedPts(biggest.pts, biggest.closed)!, rest)) ? biggest : null
  for (const pl of polys) {
    const spec = machiningLayer(pl.layer)!
    const pts = closedPts(pl.pts, pl.closed)
    if (spec.kind === "contour" || spec.kind === "through") {
      if (!pts) {
        skip(`polilínies obertes a ${pl.layer}`)
        continue
      }
      if (pl === outline) {
        notes.push("El contorn de la peça (capa CONTOUR) no es talla: només marca la peça.")
        continue
      }
      ops.push({ id: id(), part, kind: "contour", face: "A", p: ref0(0), q: ref0(0), depth: 1, through: true, points: pts.map(([x, y]) => [r2(x), r2(y)]) })
      continue
    }
    if (spec.kind === "pocket") {
      const rect = pts ? axisRect(pts) : null
      if (!rect) {
        skip(`caixeres que no són un rectangle (${pl.layer})`)
        continue
      }
      const [x0, y0, x1, y1] = rect
      ops.push({ id: id(), part, kind: "pocket", face: spec.face, p: ref0((x0 + x1) / 2), q: ref0((y0 + y1) / 2), w: r2(x1 - x0), h: r2(y1 - y0), depth: spec.depth })
      continue
    }
    if (spec.kind !== "groove") continue
    if (pts) {
      const rect = axisRect(pts)
      if (!rect) {
        skip(`ranures que no són un rectangle d'eixos (${pl.layer})`)
        continue
      }
      const [x0, y0, x1, y1] = rect
      const alongP = x1 - x0 >= y1 - y0
      const width = alongP ? y1 - y0 : x1 - x0
      if (Math.abs(width - spec.w) > 0.1) notes.push(`Una ranura de ${fmt(width)} mm a la capa ${pl.layer}: es fa amb la mida del dibuix.`)
      ops.push({ id: id(), part, kind: "groove", face: spec.face, p: ref0((x0 + x1) / 2), q: ref0((y0 + y1) / 2), w: r2(width), len: r2(alongP ? x1 - x0 : y1 - y0), along: alongP ? "p" : "q", depth: spec.depth })
      continue
    }
    // Línia central: un tram per segment d'eixos, de la llargada del tram + l'amplada (els extrems de la fresa).
    for (let i = 0; i + 1 < pl.pts.length; i++) {
      const [ax, ay] = pl.pts[i]!
      const [bx, by] = pl.pts[i + 1]!
      const dx = bx - ax, dy = by - ay
      if (Math.hypot(dx, dy) < 0.01) continue
      if (Math.abs(dx) > 0.01 && Math.abs(dy) > 0.01) {
        skip(`trams de ranura en diagonal (${pl.layer})`)
        continue
      }
      const alongP = Math.abs(dx) >= Math.abs(dy)
      ops.push({ id: id(), part, kind: "groove", face: spec.face, p: ref0((ax + bx) / 2), q: ref0((ay + by) / 2), w: spec.w, len: r2(Math.hypot(dx, dy) + spec.w), along: alongP ? "p" : "q", depth: spec.depth })
    }
  }
  for (const [why, count] of skipped) notes.push(`No es llegeixen ${count} ${why}.`)
  if (!ops.length) notes.push("Cap mecanitzat amb les capes de la convenció (DRILL_D…_P…, GROOVE_W…_P…, POCKET_P…, CUT_THROUGH, CONTOUR).")
  return { ops, notes }
}

/** Els punts d'una polilínia tancada (la que acaba on comença també compta), sense el darrer repetit; `null` si és oberta. */
function closedPts(pts: P2[], closed: boolean): P2[] | null {
  if (pts.length < 3) return null
  const [fx, fy] = pts[0]!
  const [lx, ly] = pts[pts.length - 1]!
  const loops = Math.hypot(fx - lx, fy - ly) < 1e-3
  if (!closed && !loops) return null
  const out = loops ? pts.slice(0, -1) : pts
  return out.length >= 3 && Math.abs(signedArea(out)) > 1e-6 ? out : null
}

/** El polígon conté tots els punts (i n'hi ha algun): és el contorn de la peça. */
function encloses(poly: P2[], pts: P2[]): boolean {
  if (!pts.length) return false
  const inside = ([px, py]: P2) => {
    let c = false
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      const [xi, yi] = poly[i]!
      const [xj, yj] = poly[j]!
      if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c
    }
    return c
  }
  return pts.every(inside)
}
