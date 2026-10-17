import { drillsOfDiameter, pickDrill, pickRouter, pickSmallRouter } from "../../machine/tools"
import { flatten, polygonArea, type BPt, type Cutout, type Panel } from "../../model"
import { cncBlindDepth, isSmallPart, toolMslName, type CutMode, type Machine, type MachineRules, type MachineTool } from "../../model/machine"
import type { RulePicker } from "../../machine/rules"
import type { Placement } from "../../nesting/nest"
import { closedPolyline, cutLoop, dedupePolyline, grooveRouterPath, insideCircleClockwise, maxToolDiameter, rectPts, sharpCorners, slotPts } from "./geometry"
import { toBoard, toBoardPts, type Feat, type NestPart, type PartPlace } from "./nestModel"
import { contourLine, contourPasses, cutWhat, grooveStrategy, grooveWhat, holeWhat, passDepths, pocketLine, pocketLines, rampLines, rampStart } from "./ops"
import { pocketMachining, pocketWhat } from "./pockets"
import { comment, cs, HEAD, num, toolArg } from "./script"

/**
 * Mecanitzats d'una peça al tauler (nesting, cara A): forats, ranures, talls passants i contorn, en coordenades del
 * tauler, a punt d'ordenar (`orderFeats`).
 */

/** Estat de l'export compartit per totes les peces: avisos i eines que falten. */
export interface NestRun {
  m: Machine
  rp: RulePicker
  rules: MachineRules
  cutMode: CutMode
  autoDrill: boolean
  warnings: string[]
  missingTool: number
}

/** El tauler que s'omple: gruix, fondària dels passants, fresa dels contorns i el que s'hi va posant. */
export interface NestBoardRun {
  T: number
  through: number
  router: MachineTool | undefined
  feats: Feat[]
  parts: NestPart[]
}

/** Una peça col·locada mentre se'n treuen els mecanitzats. */
interface PartRun {
  run: NestRun
  p: Panel
  pl: Placement
  ref: string
  place: PartPlace
  T: number
  through: number
  router: MachineTool | undefined
  feats: Feat[]
  tr: (u: number, v: number) => [number, number]
  warn: (what: string, why: string, tool?: boolean) => void
  name: (prefix: string) => string
  drill: (x: number, y: number, depth: number, diameter: number, what: string, t: MachineTool, n: string) => void
  outline: BPt[]
  area: number
}


/** Un forat de cara més gros que això sense broca del Ø es fa de caixera rodona amb la fresa (làmpades encastades). */
const BIG_HOLE = 20

const EPS = 0.01

/**
 * Forat de cara amb els paràmetres opcionals com el programa real del taller (manual Table 28 p36): descàrregues 0,
 * velocitats −1 (les de l'eina), tipus de forat `"P"` (pla), alçada del con 0 i cota de seguretat 2.
 */
const drillLine = (name: string, x: number, y: number, depth: number, diameter: number, tool: string): string =>
  `CreateDrill(${cs(name)}, ${num(x)}, ${num(y)}, ${num(depth)}, ${num(diameter)}, "", TypeOfProcess.Drilling, ${tool}, ${HEAD}, 0, -1, -1, "P", 0, 2);`

/** Polilínia tancada + operació; amb rampa (regla), comença al mig del costat recte més llarg. */
function profiled(rules: MachineRules, name: string, pts: BPt[], t: MachineTool, ops: (n: string) => string[]): { lines: string[]; start: [number, number]; ramp: boolean } {
  const r = rules.ramp.enabled ? rampStart(pts, 2 * t.diameter) : null
  if (!r) return { lines: [...closedPolyline(`${name}_G`, pts), ...ops(name)], start: [pts[0]![0], pts[0]![1]], ramp: false }
  const ramp = rampLines(t, Math.min(rules.ramp.length, r.room))
  return { lines: [...closedPolyline(`${name}_G`, r.pts, true), ...ramp.on, ...ops(name), ...ramp.off], start: [r.pts[0]![0], r.pts[0]![1]], ramp: true }
}

/** Els mecanitzats de la peça `p` col·locada a `pl`: van a `bd.feats` (i la peça a `bd.parts`). */
export function partFeats(run: NestRun, bd: NestBoardRun, p: Panel, pl: Placement, ref: string): void {
  const { m, autoDrill, warnings } = run
  const { T, through, router, feats, parts } = bd
  const place: PartPlace = { x: pl.x, y: pl.y, angle: pl.angle, length: p.length, width: p.width }
  const tr = (u: number, v: number) => toBoard(place, u, v)
  const warn = (what: string, why: string, tool = false) => {
    if (tool) run.missingTool++
    warnings.push(`${ref} (${p.label}): ${what}: ${why}`)
  }
  const counters = new Map<string, number>()
  const name = (prefix: string) => {
    const n = (counters.get(prefix) ?? 0) + 1
    counters.set(prefix, n)
    return `${ref}_${prefix}_${n}`
  }
  const outline = p.outline?.length ? dedupePolyline(p.outline) : rectPts(0, 0, p.length, p.width)
  const area = p.outline?.length ? polygonArea(flatten(outline)) : p.length * p.width
  parts.push({ ref, panelId: p.id, label: p.label, name: p.name, x: pl.x, y: pl.y, w: pl.w, h: pl.h, angle: pl.angle, cx: pl.cx, cy: pl.cy, area })

  const drill = (x: number, y: number, depth: number, diameter: number, what: string, t: MachineTool, n: string) => {
    const same = [...new Set(drillsOfDiameter(m, diameter, "vertical").map(toolMslName))].join("/")
    feats.push({
      stage: "drill",
      key: `D${num(diameter)}|${t.code}`,
      start: [x, y],
      end: [x, y],
      area: 0,
      groupNote: autoDrill ? `Ø${num(diameter)}: eina automatica ("-1"), broques del diametre ${same}` : undefined,
      tool: { kind: "BROCA", name: toolMslName(t) },
      lines: [drillLine(n, x, y, depth, diameter, autoDrill ? cs("-1") : toolArg(t))],
      op: { program: "A", plane: "Top", kind: "drill", tool: autoDrill ? "-1" : t.code, candidate: t.code, depth, points: [[x, y]], what, ref, stage: "drill" },
    })
  }

  const part: PartRun = { run, p, pl, ref, place, T, through, router, feats, tr, warn, name, drill, outline, area }
  faceHoles(part)
  grooves(part)
  pockets(part)
  cutouts(part)
  contour(part)
}

/** Forats de la cara A. */
function faceHoles(part: PartRun): void {
  const { p, T, warn, tr, name, drill, feats, ref } = part
  const { m, rp, rules, cutMode } = part.run
  for (const h of p.holes) {
    if (h.face !== "A") continue
    const bd = cncBlindDepth(T, h.depth, rules)
    const depth = bd.depth
    if (bd.shortened) warn(holeWhat(h), `més fondo que el gruix − ${num(bd.minSkin)}; s'escurça a ${num(depth)}`)
    const t = pickDrill(m, h.diameter, depth, "vertical")
    if (!t) {
      const same = drillsOfDiameter(m, h.diameter, "vertical")
      // Forat gros sense broca (el d'una làmpada encastada, Ø55/Ø60): caixera rodona amb la fresa de les caixeres.
      const pt = !same.length && h.diameter > BIG_HOLE ? (rp.tool("pocket", rules.pockets.tool, h.diameter - 0.5, depth) ?? pickRouter(m, h.diameter - 0.5, depth)) : undefined
      if (pt) {
        const [x, y] = tr(h.x, h.y)
        const n = name("Caixera")
        feats.push({
          stage: "groove",
          key: `pocket:${pt.code}`,
          start: [x, y],
          end: [x, y],
          area: 0,
          tool: { kind: "FRESA", name: toolMslName(pt) },
          lines: [`CreateCircleCenterRadius(${cs(`${n}_G`)}, ${num(x)}, ${num(y)}, ${num(h.diameter / 2)}, ${insideCircleClockwise(cutMode)});`, pocketLine(n, depth, pt)],
          op: { program: "A", plane: "Top", kind: "pocket", tool: pt.code, depth, points: flatten([[x + h.diameter / 2, y, 1], [x - h.diameter / 2, y, 1]]), what: holeWhat(h), ref, stage: "groove" },
        })
        continue
      }
      warn(holeWhat(h), same.length ? `la broca ${same.map((x) => x.code).join("/")} no arriba a ${num(depth)} mm` : `cap broca vertical de Ø${num(h.diameter)} muntada${h.diameter > BIG_HOLE ? " ni fresa per fer-lo de caixera" : ""}`, true)
      continue
    }
    const [x, y] = tr(h.x, h.y)
    drill(x, y, depth, h.diameter, holeWhat(h), t, name("Forat"))
  }
}

/** Ranures de la cara A: sempre amb fresa (un disc de cantell a cantell tallaria les peces del costat). */
function grooves(part: PartRun): void {
  const { p, T, warn, tr, name, place, feats, ref } = part
  const { m, rp, rules } = part.run
  for (const g of p.grooves) {
    if (g.face !== "A") continue
    const x0 = Math.max(0, g.x)
    const x1 = Math.min(p.length, g.x + g.w)
    const y0 = Math.max(0, g.y)
    const y1 = Math.min(p.width, g.y + g.h)
    if (x1 - x0 <= EPS || y1 - y0 <= EPS) {
      warn(grooveWhat(g), "fora de la peça")
      continue
    }
    const bd = cncBlindDepth(T, g.depth, rules)
    const depth = bd.depth
    if (bd.shortened) warn(grooveWhat(g), `més fonda que el gruix − ${num(bd.minSkin)}; s'escurça a ${num(depth)}`)
    const width = Math.min(x1 - x0, y1 - y0)
    const alongX = x1 - x0 >= y1 - y0
    const closed = alongX ? x0 > EPS && x1 < p.length - EPS : y0 > EPS && y1 < p.width - EPS
    // Caixera (tancada pels dos extrems): la fresa de la regla amb CreateContourPocket, si hi cap.
    const pt = closed ? rp.tool("pocket", rules.pockets.tool, width - 0.5, depth) : undefined
    if (pt) {
      const pts = toBoardPts(place, rectPts(x0, y0, x1 - x0, y1 - y0))
      const n = name("Caixera")
      feats.push({
        stage: "groove",
        key: `pocket:${pt.code}`,
        start: [pts[0]![0], pts[0]![1]],
        end: [pts[0]![0], pts[0]![1]],
        area: 0,
        tool: { kind: "FRESA", name: toolMslName(pt) },
        lines: pocketLines(n, pts, depth, pt),
        op: { program: "A", plane: "Top", kind: "pocket", tool: pt.code, depth, points: flatten(pts), what: grooveWhat(g), ref, stage: "groove" },
      })
      continue
    }
    const t = rp.tool("groove", rules.grooves.tool, width, depth) ?? pickRouter(m, width, depth)
    if (!t) {
      warn(grooveWhat(g), `cap fresa de Ø ≤ ${num(width)} que arribi a ${num(depth)} mm`, true)
      continue
    }
    const local = grooveRouterPath(x0, x1, y0, y1, p.length, p.width, t.diameter)
    if (!local) {
      warn(grooveWhat(g), `massa curta per a la fresa ${t.code} (Ø${num(t.diameter)})`, true)
      continue
    }
    const pts = local.map(([u, v]) => tr(u, v))
    const n = name("Ranura")
    feats.push({
      stage: "groove",
      key: t.code,
      start: pts[0]!,
      end: pts[pts.length - 1]!,
      area: 0,
      tool: { kind: "FRESA", name: toolMslName(t) },
      lines: [
        `CreatePolyline(${cs(`${n}_G`)}, ${num(pts[0]![0])}, ${num(pts[0]![1])});`,
        ...pts.slice(1).map((q) => `AddSegmentToPolyline(${num(q[0])}, ${num(q[1])});`),
        ...grooveStrategy(depth, rules.grooves.maxPass),
        `CreateRoughFinish(${cs(n)}, ${num(depth)}, ${cs("ranura")}, TypeOfProcess.GeneralRouting, ${toolArg(t)}, ${HEAD}, 0, -1, -1, -1, 0);`,
      ],
      op: { program: "A", plane: "Top", kind: "route", tool: t.code, depth, points: pts, what: grooveWhat(g), ref, stage: "groove", passes: passDepths(depth, rules.grooves.maxPass) },
    })
  }
}

/** Buidats de qualsevol forma de la cara A (caixeres i relleus 3D, `pockets.ts`). */
function pockets(part: PartRun): void {
  const { p, warn, tr, name, place, feats, ref } = part
  const { m, rp, warnings } = part.run
  for (const pk of p.pockets ?? []) {
    if (pk.face !== "A") continue
    const res = pocketMachining(p, pk, m, rp, tr, (pts) => toBoardPts(place, pts), name)
    for (const w of res.warnings) warnings.push(`${ref} (${p.label}): ${w}`)
    if (res.skip) {
      warn(pocketWhat(pk), res.skip.why, res.skip.tool)
      continue
    }
    for (const st of res.steps) {
      const a = st.points[0] ?? [0, 0]
      const b = st.points[st.points.length - 1] ?? a
      feats.push({
        stage: "groove",
        key: `${st.kind}:${st.tool.code}`,
        start: [a[0], a[1]],
        end: [b[0], b[1]],
        area: 0,
        tool: { kind: "FRESA", name: toolMslName(st.tool) },
        lines: st.lines,
        op: { program: "A", plane: "Top", kind: st.kind, tool: st.tool.code, depth: st.depth, points: st.points, what: `${pocketWhat(pk)}: ${st.label}`, ref, stage: "groove" },
      })
    }
  }
}

/** Talls passants: per dins. */
function cutouts(part: PartRun): void {
  const { p, T, through, warn, tr, name, place, drill, feats, ref } = part
  const { m, rp, rules, cutMode } = part.run
  for (const c0 of p.cutouts ?? []) {
    const c: Cutout = c0.kind === "slot" && Math.abs(c0.w - c0.h) < 0.001 ? ({ ...c0, kind: "circle", x: c0.x + c0.w / 2, y: c0.y + c0.h / 2, diameter: Math.min(c0.w, c0.h) } as Cutout) : c0
    if (c.kind === "circle") {
      const [x, y] = tr(c.x, c.y)
      const d = pickDrill(m, c.diameter, through, "vertical")
      if (d) {
        drill(x, y, through, c.diameter, cutWhat(c), d, name("ForatPassant"))
        continue
      }
      const t = rp.profileTool(T, c.diameter - 1, through) ?? pickRouter(m, c.diameter - 1, through)
      if (!t) {
        warn(cutWhat(c), `cap broca de Ø${num(c.diameter)} ni fresa més petita que arribin a ${num(through)} mm`, true)
        continue
      }
      const n = name("Tall")
      const start: [number, number] = [x + c.diameter / 2, y]
      feats.push({
        stage: "inner",
        key: t.code,
        start,
        end: start,
        area: 0,
        tool: { kind: "FRESA", name: toolMslName(t) },
        lines: [
          `CreateCircleCenterRadius(${cs(`${n}_G`)}, ${num(x)}, ${num(y)}, ${num(c.diameter / 2)}, ${insideCircleClockwise(cutMode)});`,
          contourLine(n, through, 0, "tall passant", t),
        ],
        op: { program: "A", plane: "Top", kind: "contour", tool: t.code, depth: through, points: flatten([[x + c.diameter / 2, y, 1], [x - c.diameter / 2, y, 1]]), what: cutWhat(c), ref, stage: "inner" },
      })
      continue
    }
    const local = dedupePolyline(c.kind === "rect" ? rectPts(c.x, c.y, c.w, c.h) : c.kind === "slot" ? slotPts(c) : c.points)
    if (local.length < 2) {
      warn(cutWhat(c), "contorn sense mida")
      continue
    }
    const maxDia = maxToolDiameter(local, "inside")
    const sharp = sharpCorners(local, "inside")
    const t = (sharp ? undefined : rp.profileTool(T, maxDia, through)) ?? (sharp ? pickSmallRouter(m, maxDia, through) : pickRouter(m, maxDia, through))
    if (!t) {
      warn(cutWhat(c), `cap fresa prou petita (Ø ≤ ${num(maxDia)}) que arribi a ${num(through)} mm`, true)
      continue
    }
    if (sharp && t.diameter / 2 > 0.5) warn(cutWhat(c), `${sharp} cantonades vives queden amb radi ${num(t.diameter / 2)} mm (fresa ${toolMslName(t)} Ø${num(t.diameter)})`)
    const pts = cutLoop(toBoardPts(place, local), "inside", cutMode)
    const n = name("Tall")
    const pr = profiled(rules, n, pts, t, (nm) => [contourLine(nm, through, 0, "tall passant", t)])
    feats.push({
      stage: "inner",
      key: t.code,
      start: pr.start,
      end: pr.start,
      area: 0,
      tool: { kind: "FRESA", name: toolMslName(t) },
      lines: pr.lines,
      op: { program: "A", plane: "Top", kind: "contour", tool: t.code, depth: through, points: flatten(pts), what: cutWhat(c), ref, stage: "inner", ...(pr.ramp ? { ramp: true } : {}) },
    })
  }
}

/** Contorn de la peça, per fora: la fresa de nesting (o una de més petita si la forma té arcs més tancats). */
function contour(part: PartRun): void {
  const { p, pl, T, through, router, warn, name, place, feats, ref, outline, area } = part
  const { m, rp, rules, cutMode } = part.run
  if (outline.length < 3) {
    warn("contorn de la peça", "contorn sense mida")
  } else {
    const maxDia = p.outline?.length ? maxToolDiameter(outline, "outside") : Infinity
    const sharp = p.outline?.length ? sharpCorners(outline, "outside") : 0
    const t = router && router.diameter <= maxDia + 1e-6 && !sharp ? router : sharp ? pickSmallRouter(m, maxDia, through) : (rp.profileTool(T, maxDia, through) ?? pickRouter(m, maxDia, through))
    if (!t) {
      warn("contorn de la peça", `cap fresa${Number.isFinite(maxDia) ? ` de Ø ≤ ${num(maxDia)}` : ""} que arribi a ${num(through)} mm`, true)
    } else {
      if (sharp && t.diameter / 2 > 0.5) warn("contorn de la peça", `${sharp} cantonades entrants queden amb radi ${num(t.diameter / 2)} mm (fresa ${toolMslName(t)} Ø${num(t.diameter)})`)
      const pts = cutLoop(toBoardPts(place, outline), "outside", cutMode)
      const n = name("Contorn")
      // Peça petita: passades de desbast (regles) i la final al martiri; normal: una passada.
      const small = isSmallPart(rules, p.length, p.width, area)
      const passes = contourPasses(T, through, small, rules.small.passes)
      passes.forEach((ps, k) => {
        const many = passes.length > 1
        const nm = many ? `${n}_P${k + 1}` : n
        const pr = profiled(rules, nm, pts, t, (x) => [contourLine(x, ps.depth, 1, "contorn", t, ps.xy)])
        feats.push({
          stage: "outer",
          key: t.code,
          start: pr.start,
          end: pr.start,
          area,
          tool: { kind: "FRESA", name: toolMslName(t) },
          ...(small ? { small } : {}),
          ...(many ? { pass: { index: k + 1, count: passes.length } } : {}),
          lines: [
            comment(`Peca ${ref} (${p.label}) - etiqueta al centre (${num(pl.cx)}, ${num(pl.cy)})${many ? ` - peca petita, passada ${k + 1} de ${passes.length} (fondaria ${num(ps.depth)}, sobrant ${num(ps.xy)})` : small ? " - peca petita" : ""}`),
            ...pr.lines,
          ],
          op: {
            program: "A",
            plane: "Top",
            kind: "contour",
            tool: t.code,
            depth: ps.depth,
            points: flatten(pts),
            what: "contorn de la peça",
            ref,
            stage: "outer",
            ...(many ? { xy: ps.xy, pass: { index: k + 1, count: passes.length } } : {}),
            ...(pr.ramp ? { ramp: true } : {}),
          },
        })
      })
    }
  }
}
