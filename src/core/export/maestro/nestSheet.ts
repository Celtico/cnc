import type { Panel } from "../../model"
import { DEFAULT_LOAD_MACRO_ARGS, parseMacroArgs, toolMslName, type Machine, type machineNesting, type MachineRules, type MachineTool, type nestProgram } from "../../model/machine"
import type { NestedBoard, Nesting } from "../../nesting/nest"
import { boardName } from "../topsolidCsv"
import type { NestBoardRun } from "./nestFeats"
import type { NestSheetXcs, NestStage } from "./nestModel"
import { orderFeats, pad2, sheetFile } from "./nestOrder"
import { rulesComment } from "./ops"
import { comment, cs, EOL, num } from "./script"

/** El text del programa d'un tauler: capçalera (peces, etiquetes, màquina) i els mecanitzats ordenats. */


/**
 * La macro de càrrega del taller (§3.6.2 p103: aplica una macro .xsp que ja és a Maestro) amb els paràmetres de la màquina
 * (`NestProgram.loadMacroArgs`; sense, o si no es poden llegir, els del programa real).
 */
export const loadMacroLine = (args?: string): string =>
  `CreateMacro("Pload", "PLOAD", ${(parseMacroArgs(args ?? DEFAULT_LOAD_MACRO_ARGS) ?? parseMacroArgs(DEFAULT_LOAD_MACRO_ARGS)!).join(", ")});`

/** La macro de càrrega tal com surt al programa real. */
export const LOAD_MACRO = loadMacroLine()

/** Comentari d'eina com el del programa real (`//BROCA PLANA FO-FPL-8`, `//FRESA PLANA 12mm diamant nesting`), en ASCII. */
const toolComment = (t: { kind: "BROCA" | "FRESA"; name: string }): string => `//${t.kind} PLANA ${comment(t.name).slice(3)}`

/** El que és igual per a tots els taulers de l'export. `boardCount` numera els taulers per material i gruix. */
export interface SheetArgs {
  m: Machine
  rules: MachineRules
  nopt: ReturnType<typeof machineNesting>
  prog: ReturnType<typeof nestProgram>
  nesting: Nesting
  spacing: number
  spacingTool: MachineTool | undefined
  byId: Map<string, Panel>
  boardCount: Map<string, number>
}

/** El programa del tauler `b` amb els mecanitzats de les seves peces (`bd`). */
export function boardSheet(a: SheetArgs, b: NestedBoard, bd: NestBoardRun): NestSheetXcs {
  const { m, rules, nopt, prog, nesting, spacing, spacingTool, byId, boardCount } = a
  const { T, through, router, feats, parts } = bd
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
      `Marge del tauler ${num(nesting.options.margin)} mm, separacio ${num(spacing)} mm${spacingTool ? ` (${toolMslName(spacingTool)} D${num(spacingTool.diameter)} + ${num(nopt.spacingExtra)})` : ""}${router ? `, contorns amb ${toolMslName(router)} (D${num(router.diameter)})` : ""}, passants fins a ${num(through)} (gruix + ${num(nopt.overcut)} al martiri)`,
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
    ...(prog.loadMacro ? [loadMacroLine(prog.loadMacroArgs)] : []),
  ]
  return { file, workpiece, tab: b.tab, material: b.material, thickness: T, w: b.w, h: b.h, efficiency: b.efficiency, parts, ops: ordered.map((f) => f.op), text: [...header, ...body, ""].join(EOL) }
}
