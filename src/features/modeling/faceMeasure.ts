import type { FaceHit } from "../../components/viewer/facePick"
import { panelAabb, type Panel, type Vec3 } from "../../core/model"
import type { FaceToolOpts, FaceToolResult } from "./faceToolOptions"
import { add3, fmtMm, fromLocal, local, rayBox, sub } from "./pieceSpace"

/** On comença el làser: el punt clicat o, a menys de `tol` mm d'una aresta de la cara (o de dues, un vèrtex), a sobre. */
function laserStart(p: Panel, pt: Vec3, n: Vec3, tol: number): { pt: Vec3; snap?: "aresta" | "vèrtex" } {
  const l = local(p, pt, n)
  if (l.face === "edge" || tol <= 0 || p.outline) return { pt }
  const near = (x: number, len: number) => (x < tol ? 0 : len - x < tol ? len : null)
  const [u, v] = [near(l.u, p.length), near(l.v, p.width)]
  if (u === null && v === null) return { pt }
  return { pt: fromLocal(p, u ?? l.u, v ?? l.v, l.face === "A" ? p.thickness : 0), snap: u !== null && v !== null ? "vèrtex" : "aresta" }
}

/** Làser eix a eix: el centre del forat clicat (si n'hi ha un a sota del ratolí) o el mig del gruix de la peça. */
function axisPoint(P: Panel, pt: Vec3, n: Vec3): { at: Vec3; what: string } {
  const l = local(P, pt, n)
  if (l.face !== "edge") {
    const h = P.holes.find((x) => (x.face ?? "A") === l.face && Math.hypot(x.x - l.u, x.y - l.v) <= x.diameter / 2 + 3)
    if (h) return { at: fromLocal(P, h.x, h.y, P.thickness / 2), what: `forat Ø${h.diameter} de ${P.label}` }
    return { at: fromLocal(P, l.u, l.v, P.thickness / 2), what: `mig del gruix de ${P.label}` }
  }
  return { at: pt, what: `cantell de ${P.label}` }
}

/** Mesurar (punt a punt) i el Làser (de la cara cap endavant, o eix a eix), com al Taulell. */
export function measureTool(tool: "measure" | "laser", o: FaceToolOpts, panels: Panel[], hit: FaceHit): FaceToolResult {
  const { panel: p, point: pt, normal: n } = hit
  if (tool === "measure") {
    if (!o.measureFrom) return { opts: { ...o, measureFrom: pt, measureLine: undefined }, message: "" }
    return between(o, o.measureFrom, pt, "Distància")
  }
  if (o.laserMode === "axis") {
    const q = axisPoint(p, pt, n)
    if (!o.measureFrom) return { opts: { ...o, measureFrom: q.at, measureLine: undefined }, message: `Primer eix: ${q.what}. Clica el segon.` }
    return between(o, o.measureFrom, q.at, "Eix a eix")
  }
  // Com el Taulell: l'inici s'imanta al vèrtex o a l'aresta de la cara si el ratolí hi és a prop (10 píxels).
  const { pt: a, snap } = laserStart(p, pt, n, 10 * (hit.probe?.mmPerPx(pt) ?? 0))
  let best = Infinity, to: Panel | undefined
  // El raig de veritat (toca el fons de les ranures i els forats); si no toca res, les capses de les peces.
  const shot = hit.probe?.cast(a, n)
  if (shot) {
    best = shot.t
    to = panels.find((q) => q.id === shot.panel)
  } else
    for (const q of panels) {
      if (q.id === p.id || q.role === "hardware") continue
      const t = rayBox(a, n, panelAabb(q))
      if (t !== null && t > 0.1 && t < best) {
        best = t
        to = q
      }
    }
  if (!isFinite(best)) return { message: "Davant d'aquesta cara no hi ha cap peça.", error: true }
  // Com el Taulell: la mida i de quina peça a quina.
  const what = `${p.label}${snap ? ` (${snap})` : ""} → ${to?.label ?? "la peça del davant"}`
  return { opts: { ...o, measureLine: [a, add3(a, n, best)], measureLabel: what }, message: `${fmtMm(best)} mm · ${what}` }
}

/** La mida d'`a` a `b` (la línia queda dibuixada) amb els tres eixos. */
function between(o: FaceToolOpts, a: Vec3, b: Vec3, title: string): FaceToolResult {
  const d = sub(b, a)
  const f = (v: number) => fmtMm(Math.abs(v))
  return { opts: { ...o, measureFrom: undefined, measureLine: [a, b], measureLabel: undefined }, message: `${title}: ${f(Math.hypot(...d))} mm (X ${f(d[0])} · Y ${f(d[1])} · Z ${f(d[2])})` }
}
