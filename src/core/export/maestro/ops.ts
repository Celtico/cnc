import { bulgeOf, type BPt, type Cutout, type Groove, type Hole } from "../../model"
import { blindRule, cutModeOf, type CutMode, type MachineRules, type MachineTool } from "../../model/machine"
import { closedPolyline } from "./geometry"
import { comment, cs, HEAD, num, toolArg } from "./script"
import { roundTo } from "../../../lib/format"

/** Línies d'operació (contorns, caixeres, rampes, passades) i els textos de les regles i dels mecanitzats. */

export const holeWhat = (h: Hole) => `forat Ø${num(h.diameter)} × ${num(h.depth)} a (${num(h.x)}, ${num(h.y)})${h.face === "edge" ? ` cantell ${h.edge ?? "?"}` : ` cara ${h.face}`}`
export const grooveWhat = (g: Groove) => `ranura ${num(g.w)} × ${num(g.h)} × ${num(g.depth)} a (${num(g.x)}, ${num(g.y)}) cara ${g.face}`
export const cutWhat = (c: Cutout) =>
  c.kind === "circle" ? `tall Ø${num(c.diameter)} a (${num(c.x)}, ${num(c.y)})` : c.kind === "polygon" ? `tall de ${c.points.length} punts` : `tall ${c.kind} ${num(c.w)} × ${num(c.h)} a (${num(c.x)}, ${num(c.y)})`

/**
 * Fondàries de les passades d'una ranura amb `CreateBidirectionalMillingStrategy(true, maxPass, 0)` (manual
 * §3.5.11.2 p60, Table 39; exemple p63): capes de `maxPass` fins a la fondària. Una sola si no passa de `maxPass`.
 */
export function passDepths(depth: number, maxPass: number): number[] {
  if (!(maxPass > 0) || depth <= maxPass + 1e-6) return [depth]
  const out: number[] = []
  for (let z = maxPass; z < depth - 1e-6; z += maxPass) out.push(roundTo(z, 3))
  out.push(depth)
  return out
}

/** Estratègia de passades d'una ranura (només si en cal més d'una): va just abans del `CreateRoughFinish` (p58). */
export const grooveStrategy = (depth: number, maxPass: number): string[] =>
  passDepths(depth, maxPass).length > 1 ? [`CreateBidirectionalMillingStrategy(true, ${num(maxPass)}, 0);`] : []

/** Una passada de perfilar: fondària i sobrant al costat (`overMaterial`, Table 36 p53). */
interface ContourPass {
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
export const pocketLines = (name: string, pts: BPt[], depth: number, tool: MachineTool): string[] => [...closedPolyline(`${name}_G`, pts), pocketLine(name, depth, tool)]
/** La caixera d'una geometria `<name>_G` que ja hi és (polilínia tancada o cercle). */
export const pocketLine = (name: string, depth: number, tool: MachineTool): string => `CreateContourPocket(${cs(name)}, ${num(depth)}, ${cs("caixera")}, TypeOfProcess.ConcentricalPocket, ${toolArg(tool)}, ${HEAD}, -1, -1, -1, 50);`

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
    `- Forats i ranures cecs: els que arriben a ${num(blindRule(r).threshold)} mm de la cara de sota es deixen a gruix − ${num(blindRule(r).minSkin)} mm (pell mínima).`,
    `- Sentit dels contorns i talls: ${CUT_MODE_README[cutModeOf(r)]}.`,
  ]
}

const CUT_MODE_README: Record<CutMode, string> = {
  asIs: "com surt la geometria (contorns de fora i talls de dins antihoraris)",
  conventional: "fresat en oposició (contorns de fora antihoraris, talls de dins horaris, com TopSolid)",
  climb: "fresat en concordança (contorns de fora horaris, talls de dins antihoraris)",
}
