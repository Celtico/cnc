import { pickBlade, pickDrill, pickRouter, pickSmallRouter, drillsOfDiameter } from "../../machine/tools"
import { EDGE_NUMBER, flatten, polygonArea, type Cutout, type Panel } from "../../model"
import { cncBlindDepth, cutModeOf, isSmallPart, toolMslName, type CutMode, type Machine, type MachineTool } from "../../model/machine"
import { RulePicker } from "../../machine/rules"
import { needsSecondFace, panelProcesses, secondFaceProgram, type ProcessKind } from "../../process/processes"
import { closedPolyline, cutLoop, dedupePolyline, edgeHoleOnFace, grooveRouterPath, insideCircleClockwise, maxToolDiameter, rectPts, sharpCorners, slotPts } from "./geometry"
import { contourLine, contourPasses, cutWhat, grooveStrategy, grooveWhat, holeWhat, passDepths, pocketLines, rulesComment } from "./ops"
import { comment, cs, EDGE_PLANE, edgePoint, EOL, HEAD, num, Script, toolArg, type XcsOp } from "./script"

interface XcsProgram {
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

const EPS = 0.01

/** Estat d'una peça mentre s'escriuen els seus programes: els passos de `panelXcs` hi sumen els comptadors. */
interface PanelRun {
  p: Panel
  m: Machine
  L: number
  W: number
  T: number
  through: number
  warnings: string[]
  features: number
  skipped: number
  missingTool: number
  edgeHolesDone: number
  handled: number
  rp: RulePicker
  cutMode: CutMode
  A: Script
  B: Script
  skip: (what: string, why: string, tool?: boolean) => void
  vDrill: (s: Script, t: MachineTool, diameter: number) => string
  vTool: (t: MachineTool) => string
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
  const rp = rules ?? new RulePicker(m)
  // Sentit dels contorns i talls (regles del taller; «asIs» = tal com surt la geometria).
  const cutMode = cutModeOf(rp.rules)
  const A = new Script("A")
  const B = new Script("B")
  // Broques verticals: "-1" (la tria el Maestro, com als .pgmx del taller) o el nom de la triada.
  const autoDrill = (m.verticalDrills ?? "auto") === "auto"
  const run: PanelRun = {
    p,
    m,
    L,
    W,
    T,
    through,
    warnings,
    features: 0,
    skipped: 0,
    missingTool: 0,
    edgeHolesDone: 0,
    handled: 0,
    rp,
    cutMode,
    A,
    B,
    // `tool`: no surt perquè falta una eina (o no hi arriba).
    skip: (what: string, why: string, tool = false) => {
      run.skipped++
      if (tool) run.missingTool++
      warnings.push(`${what}: ${why}`)
    },
    vDrill: (s: Script, t: MachineTool, diameter: number): string => {
      if (!autoDrill) return toolArg(t)
      const same = drillsOfDiameter(m, diameter, "vertical").map(toolMslName)
      s.lines.push(comment(`broca vertical Ø${num(diameter)} (${[...new Set(same)].join("/")}): eina automatica`))
      return cs("-1")
    },
    vTool: (t: MachineTool) => (autoDrill ? "-1" : t.code),
  }

  faceHoles(run)
  edgeHoles(run)
  grooves(run)
  cutouts(run)
  outlineContour(run)

  // Inglets, cantells, encolar…: no són avisos, són els passos de després (`postProcesses`).
  const hasB = B.ops.length > 0
  if (needsSecondFace(p) && !hasB) warnings.push("la cara B no té cap mecanitzat que es pugui fer: no hi ha programa «Volt»")
  const post = postProcessesOf(p, ref, hasB, run.edgeHolesDone)
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
    run.missingTool += rp.missing
  }
  return { ref, programs, ops: [...A.ops, ...B.ops], warnings, missingTool: run.missingTool, postProcesses: post, route, features: run.features, skipped: run.skipped, handled: run.handled }
}

/** Forats de cara (A a dalt; B al programa girat). */
function faceHoles(run: PanelRun): void {
  const { p, m, W, T, warnings, rp, A, B, skip, vDrill, vTool } = run
  for (const h of p.holes) {
    if (h.face === "edge") continue
    run.features++
    const s = h.face === "A" ? A : B
    const bd = cncBlindDepth(T, h.depth, rp.rules)
    const depth = bd.depth
    if (bd.shortened) warnings.push(`${holeWhat(h)}: més fondo que el gruix − ${num(bd.minSkin)}; s'escurça a ${num(depth)}${bd.minSkin === 1 ? " (com al STEP)" : ""}`)
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
    run.handled++
  }
}

/** Forats de cantell (programa A): cara estàndard de cada cantell. */
function edgeHoles(run: PanelRun): void {
  const { p, m, A, skip } = run
  const edgeHoles = p.holes.filter((h) => h.face === "edge")
  for (const side of ["bottom", "right", "top", "left"] as const) {
    for (const h of edgeHoles.filter((x) => x.edge === side)) {
      run.features++
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
      run.handled++
      run.edgeHolesDone++
    }
  }
  for (const h of edgeHoles.filter((x) => !x.edge)) {
    run.features++
    skip(holeWhat(h), "forat de cantell sense cantell")
  }
}

/** Ranures. */
function grooves(run: PanelRun): void {
  const { p, m, L, W, T, warnings, rp, A, B, skip } = run
  for (const g of p.grooves) {
    run.features++
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
    const bd = cncBlindDepth(T, g.depth, rp.rules)
    const depth = bd.depth
    if (bd.shortened) warnings.push(`${grooveWhat(g)}: més fonda que el gruix − ${num(bd.minSkin)}; s'escurça a ${num(depth)}`)
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
      run.handled++
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
      run.handled++
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
    run.handled++
  }
}

/** Talls passants (programa A). */
function cutouts(run: PanelRun): void {
  const { p, m, T, through, warnings, rp, cutMode, A, skip, vDrill, vTool } = run
  for (const c0 of p.cutouts ?? []) {
    run.features++
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
        run.handled++
        continue
      }
      const router = rp.profileTool(T, c.diameter - 1, through) ?? pickRouter(m, c.diameter - 1, through)
      if (!router) {
        skip(cutWhat(c), `cap broca de Ø${num(c.diameter)} ni fresa més petita que arribin a ${num(through)} mm`, true)
        continue
      }
      A.select("Top")
      const name = A.name("Tall")
      A.lines.push(`CreateCircleCenterRadius(${cs(`${name}_G`)}, ${num(c.x)}, ${num(c.y)}, ${num(c.diameter / 2)}, ${insideCircleClockwise(cutMode)});`)
      A.lines.push(contourLine(name, through, 0, "tall passant", router))
      const pts = flatten([[c.x + c.diameter / 2, c.y, 1], [c.x - c.diameter / 2, c.y, 1]])
      A.op({ kind: "contour", tool: router.code, depth: through, points: pts, what: cutWhat(c) })
      run.handled++
      continue
    }
    const pts = cutLoop(dedupePolyline(c.kind === "rect" ? rectPts(c.x, c.y, c.w, c.h) : c.kind === "slot" ? slotPts(c) : c.points), "inside", cutMode)
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
    run.handled++
  }
}

/** Contorn de les peces amb forma (programa A, l'últim). */
function outlineContour(run: PanelRun): void {
  const { p, m, L, W, T, through, warnings, rp, cutMode, A, skip } = run
  if (p.outline?.length) {
    run.features++
    const outline = cutLoop(dedupePolyline(p.outline), "outside", cutMode)
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
      run.handled++
    }
  }
}


/** On es fa cada post-procés (per a la ruta). */
const STATION: Record<ProcessKind, string> = {
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
