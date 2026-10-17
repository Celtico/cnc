import { pickBallRouter, pickRouter } from "../../machine/tools"
import type { RulePicker } from "../../machine/rules"
import { defaultRelief, reliefPlan, reliefPoints, type P3 } from "../../machine/relief"
import { flatten, isFlatPocket, pocketBounds, type BPt, type Panel, type Pocket } from "../../model"
import { cncBlindDepth, toolMslName, type Machine, type MachineTool } from "../../model/machine"
import { dedupePolyline, maxToolDiameter } from "./geometry"
import { pocketLines } from "./ops"
import { comment, cs, HEAD, num, toolArg } from "./script"

/**
 * Buidats de qualsevol forma (`Panel.pockets`) al programa: els de fons pla, una caixera amb `CreateContourPocket` sobre el
 * contorn (el Maestro hi fa el buidat); els de fons arrodonit o de mapa, **recorreguts 3D explícits** (`CreateToolpath`,
 * com el programa real del taller) de desbast i d'acabat (`core/machine/relief.ts`). Coordenades de la cara on és el buidat
 * (el pas al programa —cara B girada, tauler del nesting— el fa qui crida, amb `tr`).
 */

export const pocketWhat = (pk: Pocket) => {
  const b = pocketBounds(pk)
  const kind = pk.map ? "relleu" : pk.round ? `pica (fons R${num(pk.round)})` : "buidat"
  return `${kind} ${num(b.x1 - b.x0)} × ${num(b.y1 - b.y0)} × ${num(pk.depth)} a (${num(b.x0)}, ${num(b.y0)}) cara ${pk.face}`
}

/** La Z més baixa dels trams (sense `Math.min(...)`: un relleu en té massa per a la pila). */
function lowestZ(paths: P3[][]): number {
  let z = Infinity
  for (const p of paths) for (const q of p) if (q[2] < z) z = q[2]
  return z
}

/** Alçada de seguretat dels recorreguts (sobre la cara). */
const SAFE = 5
/** Punts com a molt per recorregut (un de més llarg es parteix). */
const MAX_POINTS = 3000

interface PocketStep {
  lines: string[]
  tool: MachineTool
  /** Punts (2D, ja passats al programa) i fondària, per a l'op. */
  points: [number, number][]
  depth: number
  kind: "pocket" | "route"
  label: string
}

interface PocketMachining {
  steps: PocketStep[]
  warnings: string[]
  /** No es pot fer (sense eina): el motiu. */
  skip?: { why: string; tool: boolean }
}

/**
 * Les línies d'un recorregut 3D: polilínia d'un punt i `CreateRoughFinish` de farciment (la fondària i la geometria no
 * compten: «només com l'ha especificat l'usuari», manual §3.5.13 p88) i el recorregut del centre de l'eina amb Z (0 a la
 * cara, negativa a dins). Entre trams, s'aixeca a l'alçada de seguretat.
 */
function toolpathLines(name: string, paths: P3[][], tool: MachineTool, ball: boolean, tr: (x: number, y: number) => [number, number]): string[] {
  const first = paths.find((p) => p.length)?.[0]
  if (!first) return []
  const [fx, fy] = tr(first[0], first[1])
  const minZ = lowestZ(paths)
  const out = [
    ...(ball ? [comment(`FRESA ESFERICA ${toolMslName(tool)}`)] : []),
    `CreatePolyline(${cs(`${name}_Polyline`)}, ${num(fx)}, ${num(fy)});`,
    `AddSegmentToPolyline(${num(fx)}, ${num(fy)});`,
    `SetAttribute("DEPTH", ${num(minZ - 0.01)});`,
    `CreateRoughFinish(${cs(name)}, ${num(minZ)}, "", TypeOfProcess.GeneralRouting, ${toolArg(tool)}, ${HEAD}, 0, -1, -1, -1, 0);`,
    `CreateToolpath(${cs(`${name}_ToolPath`)}, ${num(fx)}, ${num(fy)}, ${SAFE});`,
  ]
  let last: [number, number] = [fx, fy]
  for (const p of paths) {
    if (!p.length) continue
    const [sx, sy] = tr(p[0]![0], p[0]![1])
    if (Math.hypot(sx - last[0], sy - last[1]) > 1e-6) {
      out.push(`AddSegmentToToolpath(${num(last[0])}, ${num(last[1])}, ${SAFE});`)
      out.push(`AddSegmentToToolpath(${num(sx)}, ${num(sy)}, ${SAFE});`)
    }
    for (const q of p) {
      const [x, y] = tr(q[0], q[1])
      out.push(`AddSegmentToToolpath(${num(x)}, ${num(y)}, ${num(q[2])});`)
      last = [x, y]
    }
  }
  out.push(`AddSegmentToToolpath(${num(last[0])}, ${num(last[1])}, ${SAFE});`)
  return out
}

/** Parteix els trams en grups de `MAX_POINTS` punts com a molt (un recorregut cada grup). */
function chunks(paths: P3[][]): P3[][][] {
  const out: P3[][][] = []
  let cur: P3[][] = []
  let n = 0
  for (const p of paths) {
    if (n + p.length > MAX_POINTS && cur.length) {
      out.push(cur)
      cur = []
      n = 0
    }
    cur.push(p)
    n += p.length
  }
  if (cur.length) out.push(cur)
  return out
}

/**
 * Com es fa un buidat: `tr` passa (x, y) de la cara del buidat al programa (cara B girada o tauler), `trB` els contorns
 * amb bulge (el gir o el mirall en canvia el signe), `name` dona noms únics.
 */
export function pocketMachining(
  p: Panel,
  pk0: Pocket,
  m: Machine,
  rp: RulePicker,
  tr: (x: number, y: number) => [number, number],
  trB: (pts: BPt[]) => BPt[],
  name: (prefix: string) => string,
): PocketMachining {
  const warnings: string[] = []
  const bd = cncBlindDepth(p.thickness, pk0.depth, rp.rules)
  if (bd.shortened) warnings.push(`${pocketWhat(pk0)}: més fondo que el gruix − ${num(bd.minSkin)}; s'escurça a ${num(bd.depth)}`)
  const pk: Pocket = { ...pk0, depth: bd.depth }
  if (isFlatPocket(pk)) {
    const pts = dedupePolyline(trB(pk.points))
    const maxDia = maxToolDiameter(pts, "inside")
    const tool = rp.tool("pocket", rp.rules.pockets.tool, maxDia - 0.5, pk.depth) ?? pickRouter(m, maxDia - 0.5, pk.depth)
    if (!tool) return { steps: [], warnings, skip: { why: `cap fresa de Ø < ${num(maxDia)} que arribi a ${num(pk.depth)} mm`, tool: true } }
    const n = name("Caixera")
    return { steps: [{ lines: pocketLines(n, pts, pk.depth, tool), tool, points: flatten(pts), depth: pk.depth, kind: "pocket", label: "caixera" }], warnings }
  }
  // Fons arrodonit o de forma: desbast amb la fresa de les caixeres i acabat amb l'esfèrica (si n'hi ha).
  const b = pocketBounds(pk)
  const span = Math.min(b.x1 - b.x0, b.y1 - b.y0)
  const rough = rp.tool("pocket", rp.rules.pockets.tool, Math.max(1, span - 1), pk.depth) ?? pickRouter(m, Math.max(1, Math.min(20, span - 1)), pk.depth)
  const ball = pickBallRouter(m, pk.depth)
  const finish = ball ?? pickRouter(m, Math.max(1, Math.min(8, span / 4)), pk.depth) ?? rough
  if (!rough && !finish) return { steps: [], warnings, skip: { why: `cap fresa de Ø < ${num(span)} que arribi a ${num(pk.depth)} mm`, tool: true } }
  if (!ball) warnings.push(`${pocketWhat(pk)}: sense fresa esfèrica (marca-la a Preferències › Màquines › Eines › Punta), l'acabat es fa amb la plana ${finish ? toolMslName(finish) : ""}: queden graons petits per polir`)
  const passes = reliefPlan(pk, defaultRelief(rough, finish, !!ball, rp.rules.grooves.maxPass))
  const total = reliefPoints(passes)
  if (total > 60_000) warnings.push(`${pocketWhat(pk)}: recorreguts molt llargs (${total} punts); comprova que el Maestro els carregui`)
  const steps: PocketStep[] = []
  for (const pass of passes) {
    for (const group of chunks(pass.paths)) {
      const n = name(pass.kind === "rough" ? "Desbast" : "Acabat")
      const lines = [comment(`${pocketWhat(pk)}: ${pass.label}`), ...toolpathLines(n, group, pass.tool, pass.ball, tr)]
      const pts = group.flatMap((q) => q.map((x) => tr(x[0], x[1])))
      steps.push({ lines, tool: pass.tool, points: pts, depth: -lowestZ(group), kind: "route", label: pass.label })
    }
  }
  return { steps, warnings }
}
