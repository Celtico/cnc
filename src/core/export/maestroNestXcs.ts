import { drillsOfDiameter, pickDrill, pickRouter, pickSmallRouter, usableTool } from "../machine/tools"
import { flatten, polygonArea, type BPt, type Cutout, type Panel } from "../model"
import { isSmallPart, machineNesting, machineRules, nestProgram, toolMslName, type Machine, type MachineTool } from "../model/machine"
import { RulePicker } from "../machine/rules"
import type { NestOptions, Nesting } from "../nesting/nest"
import { needsSecondFace } from "../process/processes"
import {
  closedPolyline,
  comment,
  contourLine,
  contourPasses,
  cs,
  cutWhat,
  dedupePolyline,
  EOL,
  grooveRouterPath,
  grooveStrategy,
  grooveWhat,
  HEAD,
  holeWhat,
  maxToolDiameter,
  num,
  passDepths,
  pocketLines,
  postProcessesOf,
  rampLines,
  rampStart,
  rectPts,
  rulesComment,
  rulesReadme,
  sharpCorners,
  slotPts,
  toolArg,
  type XcsOp,
  type XcsPostProcess,
} from "./maestroXcs"
import { pieceRefs } from "./refs"
import { boardName } from "./topsolidCsv"
import { asciiFold } from "./text"

/**
 * Programes de Maestro **per tauler** (nesting): un `.xcs` per tauler del nesting, amb totes les peces que hi
 * van. Modelatge (manual MSL R4): **una sola peça de treball = el tauler** (`CreateFinishedWorkpieceBox` amb
 * L × A × gruix del tauler, §3.2.2.1 p17; `CreateRawWorkpiece` sense sobrant, §3.2.1 p16) i tots els
 * mecanitzats en coordenades del tauler. És com el projecte de nesting real del taller
 * (docs/maestro/samples/Proyecto1.pgmx.xml: un tauler 1200 × 800 × 18 amb forat, buidat i contorn amb la
 * «12mm diamant nesting», per fora). Les «peces mecanitzades alhora» (§3.11 p129-130) són peces separades,
 * cadascuna amb la seva bruta i `SetWorkpieceSetupPosition` a la taula: no és un tauler sencer que es talla.
 * El mòdul de nesting del Maestro (§4 p134) en seria l'alternativa (CSV + un .pgmx per peça), vegeu
 * docs/maestro-xcs.md.
 *
 * Al nesting només es fa la cara A (la de dalt): forats de cara, ranures (sempre amb fresa: un disc de cantell
 * a cantell tallaria les peces del costat), talls passants (per dins) i el contorn de cada peça (per fora, amb
 * la fresa de nesting), passants fins a gruix + `overcut` (dins del martiri). Ordre: forats → ranures → talls →
 * contorns (les peces petites al final, o al principi segons la màquina), per eina i pel veí més proper.
 * Forats de cantell, cara B i inglets van a la ruta de cada peça («CNC (tauler N) → …»).
 *
 * Capçalera, campanes, comentaris d'eina (`//BROCA PLANA …`), paràmetres del `CreateDrill` i nom de la peça (`<material>_<gruix>#NN`)
 * com el programa de nesting real del taller (docs/maestro/samples/taller_U767_Gris_cubanita_19_01.xcs). El real envia el
 * recorregut de l'eina (`CreateToolpath`…); aquí es dona la geometria i el calcula el Maestro (docs/maestro-xcs.md, «Comparació
 * amb un programa real del taller»).
 */

/** Gir de la peça al tauler (antihorari, vist des de dalt). El nesting en fa servir 0 i 90. Sense mirall. */
export type NestAngle = 0 | 90 | 180 | 270

/** Col·locació: cantonada de baix a l'esquerra de la petjada al tauler, gir i mides de la peça (L = u, A = v). */
export interface PartPlace {
  x: number
  y: number
  angle: NestAngle
  length: number
  width: number
}

/**
 * Punt (u, v) de la peça (cara A amunt) → punt del tauler. Gir antihorari al voltant de la cantonada de la
 * petjada (el mateix que `localToBoard` del CSV): 90° → (A − v, u). Un gir conserva el sentit dels contorns
 * (antihorari segueix antihorari) i el signe dels bulges.
 */
export function toBoard(pl: PartPlace, u: number, v: number): [number, number] {
  const { x, y, length: L, width: W } = pl
  if (pl.angle === 90) return [x + W - v, y + u]
  if (pl.angle === 180) return [x + L - u, y + W - v]
  if (pl.angle === 270) return [x + v, y + L - u]
  return [x + u, y + v]
}

const toBoardPts = (pl: PartPlace, pts: BPt[]): BPt[] => pts.map((p) => (p.length > 2 ? [...toBoard(pl, p[0], p[1]), p[2]!] : toBoard(pl, p[0], p[1])))

/**
 * Fresa del contorn de les peces: la triada a la màquina (`nesting.tool`), si no la que diu «nesting» al nom
 * (la «12mm diamant nesting» del taller) i, si no, la més petita que travessa (menys separació entre peces).
 */
export function nestingRouter(m: Machine, depth: number): MachineTool | undefined {
  const ok = (t: MachineTool) => usableTool(t) && t.kind === "router" && t.diameter > 0 && (t.maxDepth <= 0 || t.maxDepth + 1e-6 >= depth)
  const want = machineNesting(m).tool
  const chosen = want ? m.tools.find((t) => t.code === want) : undefined
  if (chosen && ok(chosen)) return chosen
  const named = m.tools.filter((t) => ok(t) && /nesting/i.test(`${t.mslName ?? ""} ${t.name}`)).sort((a, b) => a.diameter - b.diameter || a.code.localeCompare(b.code))
  return named[0] ?? pickSmallRouter(m, Infinity, depth)
}

/**
 * Fresa del contorn d'un tauler de gruix `T`: la de la regla de perfilar del gruix (si la màquina la té) o la de nesting
 * (`nestingRouter`), que travessi fins a `T + overcut`. És la mateixa que fa servir `toMaestroNestXcs` per a cada tauler.
 */
export const boardRouter = (rp: RulePicker, m: Machine, T: number, overcut: number): MachineTool | undefined => rp.profileTool(T, Infinity, T + overcut) ?? nestingRouter(m, T + overcut)

/**
 * Opcions del nesting per a la CNC: les del moble (taulers, veta) amb la separació = Ø de la fresa de nesting
 * + `spacingExtra` (en lloc del gruix de la serra) i el marge del tauler de la màquina (`edgeTrim`). La separació és una
 * per a tots els taulers: la del Ø més gros de les freses de contorn de cada gruix (`boardRouter`); `tool` és aquesta.
 */
export function cncNestOptions(panels: Panel[], m: Machine, base: NestOptions): { options: NestOptions; tool?: MachineTool; spacing: number } {
  const n = machineNesting(m)
  const rp = new RulePicker(m)
  // Només els gruixos de les peces que caben en algun tauler: una que no hi cap (un taulell de 3500 mm) no surt a cap
  // programa i no ha de fer més ampla la separació de tots els taulers.
  const fits = (p: Panel) => {
    const sh = base.sheetsByMaterial?.[p.material] ?? base.sheet
    const W = Math.max(sh.w, sh.h) - 2 * n.edgeTrim, H = Math.min(sh.w, sh.h) - 2 * n.edgeTrim
    const a = Math.max(p.length, p.width), b = Math.min(p.length, p.width)
    return a <= W && b <= H
  }
  const placed = panels.filter(fits)
  const tools = [...new Set((placed.length ? placed : panels).map((p) => p.thickness))].map((t) => boardRouter(rp, m, t, n.overcut)).filter((t): t is MachineTool => !!t)
  const tool = tools.sort((a, b) => b.diameter - a.diameter || a.code.localeCompare(b.code))[0]
  const spacing = (tool ? tool.diameter : base.kerf) + n.spacingExtra
  return { options: { ...base, kerf: spacing, margin: n.edgeTrim }, ...(tool ? { tool } : {}), spacing }
}

export type NestStage = "drill" | "groove" | "inner" | "outer"
const STAGES: NestStage[] = ["drill", "groove", "inner", "outer"]

/** Un mecanitzat del programa del tauler: punts en coordenades del tauler. */
export interface NestOp extends XcsOp {
  ref: string
  stage: NestStage
}

export interface NestPart {
  ref: string
  panelId: string
  label: string
  name: string
  /** Cantonada de la petjada, mida al tauler i gir. */
  x: number
  y: number
  w: number
  h: number
  angle: NestAngle
  /** Centre (etiqueta). */
  cx: number
  cy: number
  /** Àrea real de la peça (amb forma, la del contorn). */
  area: number
}

export interface NestSheetXcs {
  file: string
  /** Nom de la peça de treball (el tauler) al programa: el mateix que el tauler del CSV, `Melamina_blanca_19#01`. */
  workpiece: string
  /** Número del tauler (1..n). */
  tab: number
  material: string
  thickness: number
  w: number
  h: number
  /** Aprofitament 0..1. */
  efficiency: number
  parts: NestPart[]
  ops: NestOp[]
  text: string
}

export interface NestPanelInfo {
  ref: string
  label: string
  /** Tauler on va (sense: no hi cap). */
  tab?: number
  route: string
  postProcesses: XcsPostProcess[]
}

export interface XcsNestExport {
  files: { name: string; text: string }[]
  sheets: NestSheetXcs[]
  panels: NestPanelInfo[]
  warnings: string[]
  missingTool: number
  postProcessPanels: number
  programs: number
  /** Refs de les peces que no caben a cap tauler. */
  unplaced: string[]
  spacing: number
  /** La fresa que fixa la separació (`cncNestOptions`), si el nesting es va fer amb aquesta separació. */
  tool?: MachineTool
}

interface Feat {
  stage: NestStage
  /** Agrupa per eina (menys canvis d'eina). */
  key: string
  start: [number, number]
  end: [number, number]
  /** Contorns: àrea de la peça. */
  area: number
  /** Comentari del grup (la broca automàtica). */
  groupNote?: string
  /**
   * Eina del grup per al comentari `//BROCA PLANA <nom>` / `//FRESA PLANA <nom>` que la precedeix (com el programa real del
   * taller: el parser del taller, `parseXcs`, atribueix els forats a l'últim comentari d'eina).
   */
  tool: { kind: "BROCA" | "FRESA"; name: string }
  /** Contorns de les peces petites: passada n de m (els desbastos van abans, la final amb les petites). */
  pass?: { index: number; count: number }
  /** Contorn d'una peça petita (`isSmallPart`): la passada final (o l'única) va amb les petites, al final o al principi. */
  small?: boolean
  lines: string[]
  op: NestOp
}

const pad2 = (n: number) => String(n).padStart(2, "0")
const slug = (s: string) =>
  asciiFold(s)
    .replace(/[^A-Za-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "") || "tauler"

/** Nom del fitxer d'un tauler: `T01_Melamina_blanca_19.xcs`. */
export const sheetFile = (tab: number, material: string, thickness: number): string => `T${pad2(tab)}_${slug(material)}_${num(thickness)}.xcs`

const dist = (a: [number, number], b: [number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Veí més proper des de `pos`: retorna l'ordre i la posició final. */
function nearest(feats: Feat[], pos: [number, number]): { out: Feat[]; pos: [number, number] } {
  const left = [...feats]
  const out: Feat[] = []
  let p = pos
  while (left.length) {
    let k = 0
    for (let i = 1; i < left.length; i++) if (dist(left[i]!.start, p) < dist(left[k]!.start, p) - 1e-9) k = i
    const f = left.splice(k, 1)[0]!
    out.push(f)
    p = f.end
  }
  return { out, pos: p }
}

/**
 * Ordre dels mecanitzats: forats → ranures → talls → contorns. Dins de cada etapa, per eina (en l'ordre en què
 * surten) i pel veí més proper; els contorns, per mida (classes de ×2 d'àrea: les petites al final o al
 * principi, `smallParts`) i, dins de cada classe, pel veí més proper.
 */
export function orderFeats<F extends Pick<Feat, "stage" | "key" | "start" | "end" | "area" | "pass" | "small">>(feats: F[], smallParts: "last" | "first" = "last"): F[] {
  const out: F[] = []
  let pos: [number, number] = [0, 0]
  for (const stage of STAGES) {
    const of = feats.filter((f) => f.stage === stage)
    const groups = new Map<string, F[]>()
    if (stage === "outer") {
      // Peces petites en passades: primer els desbastos (passada 1 de totes, després la 2…), amb el tauler sencer.
      const isRough = (f: F) => !!f.pass && f.pass.index < f.pass.count
      const rough = of.filter(isRough)
      for (const k of [...new Set(rough.map((f) => f.pass!.index))].sort((a, b) => a - b)) groups.set(`P${k}`, rough.filter((f) => f.pass!.index === k))
      // Les peces petites van marcades (`small`), tinguin passades de desbast o no.
      const finals = of.filter((f) => !isRough(f) && (f.small || !!f.pass))
      const rest = of.filter((f) => !isRough(f) && !f.small && !f.pass)
      const tier = (f: F) => Math.floor(Math.log2(Math.max(1, f.area)))
      const tiers = [...new Set(rest.map(tier))].sort((a, b) => (smallParts === "last" ? b - a : a - b))
      if (smallParts === "first" && finals.length) groups.set("final", finals)
      for (const t of tiers) groups.set(String(t), rest.filter((f) => tier(f) === t))
      if (smallParts === "last" && finals.length) groups.set("final", finals)
    } else {
      for (const f of of) groups.set(f.key, [...(groups.get(f.key) ?? []), f])
    }
    for (const g of groups.values()) {
      const r = nearest(g as unknown as Feat[], pos)
      out.push(...(r.out as unknown as F[]))
      pos = r.pos
    }
  }
  return out
}

const EPS = 0.01

/**
 * Forat de cara amb els paràmetres opcionals com el programa real del taller (manual Table 28 p36): descàrregues 0,
 * velocitats −1 (les de l'eina), tipus de forat `"P"` (pla), alçada del con 0 i cota de seguretat 2.
 */
export const drillLine = (name: string, x: number, y: number, depth: number, diameter: number, tool: string): string =>
  `CreateDrill(${cs(name)}, ${num(x)}, ${num(y)}, ${num(depth)}, ${num(diameter)}, "", TypeOfProcess.Drilling, ${tool}, ${HEAD}, 0, -1, -1, "P", 0, 2);`

/** La macro de càrrega del taller, tal com surt al programa real (§3.6.2 p103: aplica una macro .xsp que ja és a Maestro). */
export const LOAD_MACRO = `CreateMacro("Pload", "PLOAD", 1, 0, 1, 0, 4, 2, false, 0, 0, 0, 0);`

/** Comentari d'eina com el del programa real (`//BROCA PLANA FO-FPL-8`, `//FRESA PLANA 12mm diamant nesting`), en ASCII. */
export const toolComment = (t: { kind: "BROCA" | "FRESA"; name: string }): string => `//${t.kind} PLANA ${comment(t.name).slice(3)}`

/** Programes per tauler d'un nesting fet amb `cncNestOptions`. */
export function toMaestroNestXcs(panels: Panel[], nesting: Nesting, m: Machine, opts: { project: string; date?: Date }): XcsNestExport {
  const nopt = machineNesting(m)
  const refs = pieceRefs(panels)
  const byId = new Map(panels.map((p) => [p.id, p]))
  const refOf = (p: Panel) => refs.get(p.id) ?? p.id
  const warnings: string[] = []
  let missingTool = 0
  const autoDrill = (m.verticalDrills ?? "auto") === "auto"
  const tabOf = new Map<string, number>()
  const sheets: NestSheetXcs[] = []
  const maxT = panels.reduce((a, p) => Math.max(a, p.thickness), 0)
  const rp = new RulePicker(m)
  const rules = rp.rules
  const prog = nestProgram(m)
  const boardCount = new Map<string, number>()
  const mainTool = boardRouter(rp, m, maxT, nopt.overcut)
  const spacing = nesting.options.kerf
  // La fresa que ha fixat la separació (la més grossa dels gruixos del moble), si el nesting es va fer amb aquesta.
  const plan = cncNestOptions(panels, m, nesting.options)
  const spacingTool = plan.tool && Math.abs(plan.spacing - spacing) < 1e-6 ? plan.tool : undefined
  /** Polilínia tancada + operació; amb rampa (regla), comença al mig del costat recte més llarg. */
  const profiled = (name: string, pts: BPt[], t: MachineTool, ops: (n: string) => string[]): { lines: string[]; start: [number, number]; ramp: boolean } => {
    const r = rules.ramp.enabled ? rampStart(pts, 2 * t.diameter) : null
    if (!r) return { lines: [...closedPolyline(`${name}_G`, pts), ...ops(name)], start: [pts[0]![0], pts[0]![1]], ramp: false }
    const ramp = rampLines(t, Math.min(rules.ramp.length, r.room))
    return { lines: [...closedPolyline(`${name}_G`, r.pts, true), ...ramp.on, ...ops(name), ...ramp.off], start: [r.pts[0]![0], r.pts[0]![1]], ramp: true }
  }

  for (const b of nesting.boards) {
    const T = b.thickness
    const through = T + nopt.overcut
    const router = boardRouter(rp, m, T, nopt.overcut)
    const feats: Feat[] = []
    const parts: NestPart[] = []
    for (const pl of b.placements) {
      const p = byId.get(pl.panelId)
      if (!p) continue
      const ref = refOf(p)
      tabOf.set(p.id, b.tab)
      const place: PartPlace = { x: pl.x, y: pl.y, angle: pl.angle, length: p.length, width: p.width }
      const tr = (u: number, v: number) => toBoard(place, u, v)
      const warn = (what: string, why: string, tool = false) => {
        if (tool) missingTool++
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

      // Forats de la cara A.
      for (const h of p.holes) {
        if (h.face !== "A") continue
        let depth = h.depth
        if (depth >= T - 0.5) {
          depth = Math.max(0.5, T - 1)
          warn(holeWhat(h), `més fondo que el gruix − 1; s'escurça a ${num(depth)}`)
        }
        const t = pickDrill(m, h.diameter, depth, "vertical")
        if (!t) {
          const same = drillsOfDiameter(m, h.diameter, "vertical")
          warn(holeWhat(h), same.length ? `la broca ${same.map((x) => x.code).join("/")} no arriba a ${num(depth)} mm` : `cap broca vertical de Ø${num(h.diameter)} muntada`, true)
          continue
        }
        const [x, y] = tr(h.x, h.y)
        drill(x, y, depth, h.diameter, holeWhat(h), t, name("Forat"))
      }

      // Ranures de la cara A: sempre amb fresa (un disc de cantell a cantell tallaria les peces del costat).
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
        let depth = g.depth
        if (depth >= T - 0.5) {
          depth = Math.max(0.5, T - 1)
          warn(grooveWhat(g), `més fonda que el gruix − 1; s'escurça a ${num(depth)}`)
        }
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

      // Talls passants: per dins.
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
              `CreateCircleCenterRadius(${cs(`${n}_G`)}, ${num(x)}, ${num(y)}, ${num(c.diameter / 2)}, false);`,
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
        const pts = toBoardPts(place, local)
        const n = name("Tall")
        const pr = profiled(n, pts, t, (nm) => [contourLine(nm, through, 0, "tall passant", t)])
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

      // Contorn de la peça, per fora: la fresa de nesting (o una de més petita si la forma té arcs més tancats).
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
          const pts = toBoardPts(place, outline)
          const n = name("Contorn")
          // Peça petita: passades de desbast (regles) i la final al martiri; normal: una passada.
          const small = isSmallPart(rules, p.length, p.width, area)
          const passes = contourPasses(T, through, small, rules.small.passes)
          passes.forEach((ps, k) => {
            const many = passes.length > 1
            const nm = many ? `${n}_P${k + 1}` : n
            const pr = profiled(nm, pts, t, (x) => [contourLine(x, ps.depth, 1, "contorn", t, ps.xy)])
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

    const ordered = orderFeats(feats, nopt.smallParts)
    // Com el programa real del taller: la cara de dalt i les campanes/recollidor reiniciats un cop, al principi.
    const body: string[] = ["", `SelectWorkplane(${cs("Top")});`, `SetPneumaticHoodPosition(${prog.pneumaticHood});`, "ResetAuxiliaryHood();", "ResetDustpan();"]
    const TITLES: Record<NestStage, string> = { drill: "Forats", groove: "Ranures", inner: "Talls passants (per dins)", outer: "Contorns de les peces (per fora)" }
    let stage: NestStage | null = null
    let group: string | null = null
    let lastTool: string | null = null
    for (const f of ordered) {
      if (f.stage !== stage) {
        stage = f.stage
        group = null
        lastTool = null
        body.push("", comment(`--- ${TITLES[f.stage]} ---`))
      }
      const tc = toolComment(f.tool)
      if (tc !== lastTool) {
        body.push(tc)
        lastTool = tc
      }
      if (f.groupNote && f.key !== group) body.push(comment(f.groupNote))
      group = f.key
      body.push(...f.lines)
    }
    const file = sheetFile(b.tab, b.material, T)
    const wp = `T${pad2(b.tab)}`
    // Peça de treball = el tauler, amb el nom del tauler del CSV (`<material>_<gruix>#NN`, numerat per material i gruix).
    const base = `${b.material}|${T}`
    const nb = (boardCount.get(base) ?? 0) + 1
    boardCount.set(base, nb)
    const workpiece = boardName(b.material, T, nb)
    const header = [
      comment("Mobles CNC - programa Maestro (MSL .xcs) per tauler (nesting) - BETA: comprova'l a Maestro abans de mecanitzar"),
      comment(`Tauler ${wp} (${workpiece}): ${b.material} - ${num(b.w)} x ${num(b.h)} x ${num(T)} - ${parts.length} peces - aprofitament ${Math.round(b.efficiency * 100)}%`),
      comment(`Cara de dalt (cara A de les peces). X, Y del tauler, origen a la cantonada de baix a l'esquerra`),
      comment(
        `Marge del tauler ${num(nopt.edgeTrim)} mm, separacio ${num(spacing)} mm${spacingTool ? ` (${toolMslName(spacingTool)} D${num(spacingTool.diameter)} + ${num(nopt.spacingExtra)})` : ""}${router ? `, contorns amb ${toolMslName(router)} (D${num(router.diameter)})` : ""}, passants fins a ${num(through)} (gruix + ${num(nopt.overcut)} al martiri)`,
      ),
      comment(`Maquina ${m.name}${m.serial ? ` (${m.serial})` : ""}${m.maestroVersion ? ` - Maestro ${m.maestroVersion}` : ""}`),
      ...(m.pgmx ? [comment(`Noms d'eina i capcalera del projecte ${m.pgmx.file} (Maestro ${m.pgmx.version})`)] : []),
      ...rulesComment(rules, true),
      comment("Peces (ref - nom - mida - cantonada al tauler - gir antihorari):"),
      ...parts.map((x) => {
        const p = byId.get(x.panelId)!
        return comment(`  ${x.ref} ${p.name} (${x.label}) ${num(p.length)} x ${num(p.width)} a (${num(x.x)}, ${num(x.y)}) gir ${x.angle}`)
      }),
      comment("Etiquetes (centre de cada peca):"),
      ...parts.map((x) => comment(`  ${x.ref} (${num(x.cx)}, ${num(x.cy)})`)),
      "",
      // Capçalera com el programa de nesting real del taller (docs/maestro-xcs.md, «Comparació amb un programa real del taller»).
      "MachineParameters mp=GetMachiningParameters();",
      `SetMachiningParameters(${cs(m.header.executionFields)}, ${m.header.repetitions ?? 1}, ${m.header.tableOptions}, ${prog.mechanicalOptions}, ${m.header.continuousCycle ?? false});`,
      `SetPreserveWorkingSequence(${m.header.preserveWorkingSequence ?? true});`,
      `SetWorkPieceFallPrevention(${prog.fallPrevention});`,
      "",
      `CreateFinishedWorkpieceBox(${cs(workpiece)}, ${num(b.w)}, ${num(b.h)}, ${num(T)});`,
      `CreateRawWorkpiece(${cs(workpiece)}, 0, 0, 0, 0, 0, 0);`,
      `SetWorkpieceSetupPosition(${num(prog.setupPosition.x)}, ${num(prog.setupPosition.y)}, ${num(prog.setupPosition.z)}, ${num(prog.setupPosition.rot)});`,
      ...(prog.loadMacro ? [LOAD_MACRO] : []),
    ]
    sheets.push({ file, workpiece, tab: b.tab, material: b.material, thickness: T, w: b.w, h: b.h, efficiency: b.efficiency, parts, ops: ordered.map((f) => f.op), text: [...header, ...body, ""].join(EOL) })
  }

  // Ruta de cada peça: «CNC (tauler N) → …»; cara B i forats de cantell, fora de la CNC.
  const infos: NestPanelInfo[] = panels.map((p) => {
    const ref = refOf(p)
    const tab = tabOf.get(p.id)
    const post = postProcessesOf(p, ref, false, 0)
    if (needsSecondFace(p)) {
      const n = p.holes.filter((h) => h.face === "B").length
      const g = p.grooves.filter((x) => x.face === "B").length
      const what = [n ? `${n} ${n === 1 ? "forat" : "forats"}` : "", g ? `${g} ${g === 1 ? "ranura" : "ranures"}` : ""].filter(Boolean).join(" i ")
      post.unshift({ kind: "secondFace", station: "perforadora / 2a passada", text: `Mecanitzats cara B (${what}): fer a la perforadora / segona passada` })
    }
    const route = [tab ? `CNC (tauler ${tab})` : "no cap a cap tauler", ...post.map((x) => x.station)].join(" → ")
    return { ref, label: p.label, tab, route, postProcesses: post }
  })
  const unplaced = nesting.unplaced.map((id) => {
    const p = byId.get(id)
    return p ? refOf(p) : id
  })
  for (const id of nesting.unplaced) {
    const p = byId.get(id)
    if (p) warnings.push(`${refOf(p)} (${p.label}): no cap a cap tauler (${num(p.length)} × ${num(p.width)})`)
  }
  if (!mainTool && panels.length) {
    missingTool++
    warnings.push(`cap fresa que travessi ${num(maxT + nopt.overcut)} mm per als contorns del nesting`)
  }

  warnings.unshift(...rp.notes)
  missingTool += rp.missing
  const files = sheets.map((s) => ({ name: s.file, text: s.text }))
  files.push({ name: "LLEGEIX-ME.txt", text: nestReadme(opts.project, m, sheets, infos, unplaced, warnings, spacing, spacingTool, opts.date ?? new Date()) })
  return {
    files,
    sheets,
    panels: infos,
    warnings,
    missingTool,
    postProcessPanels: infos.filter((x) => x.postProcesses.length).length,
    programs: sheets.length,
    unplaced,
    spacing,
    ...(spacingTool ? { tool: spacingTool } : {}),
  }
}

function nestReadme(project: string, m: Machine, sheets: NestSheetXcs[], infos: NestPanelInfo[], unplaced: string[], warnings: string[], spacing: number, tool: MachineTool | undefined, date: Date): string {
  const n = machineNesting(m)
  const prog = nestProgram(m)
  const lines = [
    `Programes Maestro (.xcs) per tauler (nesting) - ${project}`,
    `Generat per Mobles CNC el ${date.toISOString().slice(0, 10)} per a la màquina ${m.name}${m.serial ? ` (${m.serial})` : ""}${m.maestroVersion ? `, Maestro ${m.maestroVersion}` : ""}.`,
    "",
    "BETA: encara no s'ha validat al taller. Obre cada programa a Maestro i revisa'l a la vista",
    "CAM (posició de les peces, eines, ordre) abans de mecanitzar.",
    "",
    "Què hi ha",
    "- Txx_<material>_<gruix>.xcs: un programa per tauler. La peça de treball és el tauler sencer i",
    "  totes les peces hi van col·locades (com un projecte de nesting de Maestro).",
    "- Ordre: forats → ranures → talls passants (per dins) → contorns de les peces (per fora),",
    `  per eina i pel veí més proper; les peces petites ${n.smallParts === "last" ? "al final" : "al principi"}.`,
    "",
    "Com es fan servir",
    "- A Maestro: importar l'script (.xcs) i desar-lo com a .pgmx; o bé, per a tots alhora:",
    `  XConverter.exe -s -m 0 -i "T01_<material>_<gruix>.xcs" -t "def.tlgx"   (manual MSL §3.1.2.1)`,
    "",
    "Convencions",
    "- X, Y del tauler, origen a la cantonada de baix a l'esquerra, cara de dalt = cara A de les peces.",
    `- Marge del tauler ${num(n.edgeTrim)} mm; separació entre peces ${num(spacing)} mm${tool ? ` (fresa ${toolMslName(tool)} Ø${num(tool.diameter)} + ${num(n.spacingExtra)})` : ""}.`,
    `- Contorns per fora i talls passants fins a gruix + ${num(n.overcut)} mm (dins del martiri).`,
    "- Ranures sempre amb fresa (un disc de cantell a cantell tallaria les peces del costat).",
    "- Forats de cantell, mecanitzats de la cara B i inglets no es fan al nesting: van a la ruta de cada peça.",
    m.verticalDrills === "tool" ? "- Broques verticals: el nom de la broca que ha triat l'app." : "- Broques verticals: eina automàtica (\"-1\"), com als projectes del taller.",
    "- Cada peça porta un comentari amb la ref i el centre (per a l'etiqueta) abans del seu contorn.",
    ...rulesReadme(machineRules(m), true),
    `- Capçalera com el programa de nesting real del taller: MechanicalOptions ${prog.mechanicalOptions}, SetPreserveWorkingSequence, SetWorkPieceFallPrevention(${prog.fallPrevention}), SetWorkpieceSetupPosition(${num(prog.setupPosition.x)}, ${num(prog.setupPosition.y)}, ${num(prog.setupPosition.z)}, ${num(prog.setupPosition.rot)})${prog.loadMacro ? ", macro Pload" : ""}, campana ${prog.pneumaticHood}. La peça de treball es diu com el tauler del CSV (<material>_<gruix>#NN).`,
    "- Fitxers .xcs en UTF-8 amb BOM.",
    "",
    `Taulers: ${sheets.length}`,
  ]
  for (const s of sheets) {
    lines.push(`- ${s.file}: ${s.material} ${num(s.w)} × ${num(s.h)} × ${num(s.thickness)} · ${s.parts.length} ${s.parts.length === 1 ? "peça" : "peces"} · aprofitament ${Math.round(s.efficiency * 100)} %`)
    lines.push(`    ${s.parts.map((p) => `${p.ref} (${p.label})`).join(", ")}`)
  }
  if (unplaced.length) lines.push("", `No caben a cap tauler: ${unplaced.join(", ")}`)
  const withPost = infos.filter((x) => x.postProcesses.length)
  lines.push("", `Ordre de treball de cada peça (${infos.length})`)
  for (const x of infos) {
    lines.push("", `${x.ref} (${x.label})`, `  Ordre de treball: ${x.route}`)
    if (x.postProcesses.length) {
      lines.push("  Després de la CNC:")
      x.postProcesses.forEach((p, k) => lines.push(`    ${k + 1}. ${p.text}`))
    }
  }
  if (!withPost.length) lines.push("", "Cap peça té res a fer després de la CNC.")
  if (warnings.length) {
    lines.push("", `Avisos (${warnings.length}): el que no surt als programes o s'ha canviat`)
    for (const w of warnings) lines.push(`- ${w}`)
  }
  return lines.join(EOL) + EOL
}
