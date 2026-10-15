import type { KitOrderLine } from "../build/drawerKit"
import type { Panel } from "../model"
import { cutModeOf, machineNesting, nestProgram, type Machine } from "../model/machine"
import { RulePicker } from "../machine/rules"
import type { Nesting } from "../nesting/nest"
import { needsSecondFace } from "../process/processes"
import { encodingWarning, xcsEncodingOf } from "./maestro/encoding"
import { partFeats, type NestBoardRun, type NestRun } from "./maestro/nestFeats"
import type { NestPanelInfo, NestSheetXcs, XcsNestExport } from "./maestro/nestModel"
import { nestReadme } from "./maestro/nestReadme"
import { boardSheet, type SheetArgs } from "./maestro/nestSheet"
import { boardRouter, cncNestOptions } from "./maestro/nestTools"
import { postProcessesOf } from "./maestro/panel"
import { num } from "./maestro/script"
import { pieceRefs } from "./refs"
import type { KitOrder } from "../build/buildModule"
import type { LightOrder } from "../build/lightOrders"

// Els passos (mecanitzats de cada peça, programa de cada tauler, LLEGEIX-ME) són a `./maestro/nest*`: aquí, l'API de sempre.
export { toBoard, type NestAngle, type PartPlace } from "./maestro/nestModel"
export { cncNestOptions, nestingRouter } from "./maestro/nestTools"
export { orderFeats, sheetFile } from "./maestro/nestOrder"
export { LOAD_MACRO, loadMacroLine } from "./maestro/nestSheet"

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

/** Programes per tauler d'un nesting fet amb `cncNestOptions`. */
export function toMaestroNestXcs(panels: Panel[], nesting: Nesting, m: Machine, opts: { project: string; date?: Date; /** Jocs de calaix (comanda) per al LLEGEIX-ME. */ kits?: readonly (KitOrder & { module?: number })[]; /** Llums amb joc (làmpades i sistema elèctric) per al LLEGEIX-ME. */ lights?: readonly (LightOrder & { module?: number })[]; /** Ferratges col·locats (comanda) per al LLEGEIX-ME. */ fittings?: readonly (KitOrderLine & { module?: number })[] }): XcsNestExport {
  const nopt = machineNesting(m)
  const refs = pieceRefs(panels)
  const byId = new Map(panels.map((p) => [p.id, p]))
  const refOf = (p: Panel) => refs.get(p.id) ?? p.id
  const warnings: string[] = []
  const autoDrill = (m.verticalDrills ?? "auto") === "auto"
  const tabOf = new Map<string, number>()
  const sheets: NestSheetXcs[] = []
  const maxT = panels.reduce((a, p) => Math.max(a, p.thickness), 0)
  const rp = new RulePicker(m)
  const rules = rp.rules
  // Sentit dels contorns i talls (regles del taller; «asIs» = tal com surt la geometria).
  const cutMode = cutModeOf(rules)
  const prog = nestProgram(m)
  const boardCount = new Map<string, number>()
  const mainTool = boardRouter(rp, m, maxT, nopt.overcut)
  const spacing = nesting.options.kerf
  // El marge amb què s'ha fet el nesting (`cncNestOptions`: fix o Ø de la fresa).
  const margin = nesting.options.margin
  // La fresa que ha fixat la separació (la més grossa dels gruixos del moble), si el nesting es va fer amb aquesta.
  const plan = cncNestOptions(panels, m, nesting.options)
  const spacingTool = plan.tool && Math.abs(plan.spacing - spacing) < 1e-6 ? plan.tool : undefined
  // Avisos i eines que falten de tot l'export (les peces hi sumen).
  const run: NestRun = { m, rp, rules, cutMode, autoDrill, warnings, missingTool: 0 }
  const sheetArgs: SheetArgs = { m, rules, nopt, prog, nesting, spacing, spacingTool, byId, boardCount }

  for (const b of nesting.boards) {
    const T = b.thickness
    const through = T + nopt.overcut
    const router = boardRouter(rp, m, T, nopt.overcut)
    const bd: NestBoardRun = { T, through, router, feats: [], parts: [] }
    for (const pl of b.placements) {
      const p = byId.get(pl.panelId)
      if (!p) continue
      const ref = refOf(p)
      tabOf.set(p.id, b.tab)
      partFeats(run, bd, p, pl, ref)
    }
    sheets.push(boardSheet(sheetArgs, b, bd))
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
    run.missingTool++
    warnings.push(`cap fresa que travessi ${num(maxT + nopt.overcut)} mm per als contorns del nesting`)
  }

  warnings.unshift(...rp.notes)
  run.missingTool += rp.missing
  const files = sheets.map((s) => ({ name: s.file, text: s.text }))
  const enc = encodingWarning(m, files)
  if (enc) warnings.unshift(enc)
  files.push({ name: "LLEGEIX-ME.txt", text: nestReadme(opts.project, m, sheets, infos, unplaced, warnings, spacing, spacingTool, margin, opts.date ?? new Date(), opts.kits ?? [], opts.lights ?? [], opts.fittings ?? []) })
  return {
    files,
    encoding: xcsEncodingOf(m),
    sheets,
    panels: infos,
    warnings,
    missingTool: run.missingTool,
    postProcessPanels: infos.filter((x) => x.postProcesses.length).length,
    programs: sheets.length,
    unplaced,
    spacing,
    ...(spacingTool ? { tool: spacingTool } : {}),
  }
}
