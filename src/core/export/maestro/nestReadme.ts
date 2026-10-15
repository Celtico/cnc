import { fittingReadmeLines } from "../../build/fittingOrders"
import type { KitOrderLine } from "../../build/drawerKit"
import type { KitOrder } from "../../build/buildModule"
import { kitReadmeLines } from "../../build/kitOrders"
import { lightReadmeLines, type LightOrder } from "../../build/lightOrders"
import { machineNesting, machineRules, nestProgram, toolMslName, type Machine, type MachineTool } from "../../model/machine"
import { encodingReadme } from "./encoding"
import type { NestPanelInfo, NestSheetXcs } from "./nestModel"
import { rulesReadme } from "./ops"
import { EOL, num } from "./script"

/** El LLEGEIX-ME dels programes per tauler. */
export function nestReadme(project: string, m: Machine, sheets: NestSheetXcs[], infos: NestPanelInfo[], unplaced: string[], warnings: string[], spacing: number, tool: MachineTool | undefined, margin: number, date: Date, kits: readonly (KitOrder & { module?: number })[], lights: readonly (LightOrder & { module?: number })[] = [], fittings: readonly (KitOrderLine & { module?: number })[] = []): string {
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
    `- Marge del tauler ${num(margin)} mm; separació entre peces ${num(spacing)} mm${tool ? ` (fresa ${toolMslName(tool)} Ø${num(tool.diameter)} + ${num(n.spacingExtra)})` : ""}.`,
    `- Contorns per fora i talls passants fins a gruix + ${num(n.overcut)} mm (dins del martiri).`,
    "- Ranures sempre amb fresa (un disc de cantell a cantell tallaria les peces del costat).",
    "- Forats de cantell, mecanitzats de la cara B i inglets no es fan al nesting: van a la ruta de cada peça.",
    m.verticalDrills === "tool" ? "- Broques verticals: el nom de la broca que ha triat l'app." : "- Broques verticals: eina automàtica (\"-1\"), com als projectes del taller.",
    "- Cada peça porta un comentari amb la ref i el centre (per a l'etiqueta) abans del seu contorn.",
    ...rulesReadme(machineRules(m), true),
    `- Capçalera com el programa de nesting real del taller: MechanicalOptions ${prog.mechanicalOptions}, SetPreserveWorkingSequence, SetWorkPieceFallPrevention(${prog.fallPrevention}), SetWorkpieceSetupPosition(${num(prog.setupPosition.x)}, ${num(prog.setupPosition.y)}, ${num(prog.setupPosition.z)}, ${num(prog.setupPosition.rot)})${prog.loadMacro ? ", macro Pload" : ""}, campana ${prog.pneumaticHood}. La peça de treball es diu com el tauler del CSV (<material>_<gruix>#NN).`,
    encodingReadme(m),
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
  // Calaixos de doble paret: el que cal comprar (números del catàleg) i la fusta que demana cada calaix.
  if (kits.length) lines.push("", "Ferratges dels jocs de calaix (comanda)", ...kitReadmeLines(kits))
  // Llums amb joc: les làmpades (el forat o el rebaix ja és als programes) i el sistema elèctric de cada mòdul.
  if (lights.length) lines.push("", "Llums i instal·lació elèctrica (comanda)", ...lightReadmeLines(lights))
  // Frontisses, tiradors, pistons i potes: el que cal comprar (els mecanitzats ja són als programes).
  if (fittings.length) lines.push("", "Ferratges (comanda)", ...fittingReadmeLines(fittings))
  if (warnings.length) {
    lines.push("", `Avisos (${warnings.length}): el que no surt als programes o s'ha canviat`)
    for (const w of warnings) lines.push(`- ${w}`)
  }
  return lines.join(EOL) + EOL
}
