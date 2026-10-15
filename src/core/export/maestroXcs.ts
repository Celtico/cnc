import { zipStore } from "../file/zip"
import type { Panel } from "../model"
import { machineRules, type Machine } from "../model/machine"
import { RulePicker } from "../machine/rules"
import { encodingReadme, encodingWarning, xcsEncodingOf } from "./maestro/encoding"
import { panelXcs, type XcsPanelResult } from "./maestro/panel"
import { rulesReadme } from "./maestro/ops"
import { EOL, num } from "./maestro/script"
import { pieceRefs } from "./refs"

// Les peces (script, geometria, operacions, programa per peça, codificació) són a `./maestro/`: aquí, l'API de sempre.
export { cs, edgePoint, num, planeSize } from "./maestro/script"
export { cutLoop, dedupePolyline, edgeHoleOnFace, isCcw, maxToolDiameter, reverseLoop, sharpCorners, slotPts } from "./maestro/geometry"
export { contourPasses, passDepths, rampStart } from "./maestro/ops"
export { panelXcs } from "./maestro/panel"
export { encodingWarning } from "./maestro/encoding"

/**
 * Programes de Xilog Maestro en Maestro Scripting Language (MSL, `.xcs`), un per peça de CNC i un
 * altre «<ref>Volt» per a la cara B (com el «2a cara» de TopSolid). Maestro els importa (Importar
 * script) o els converteix a .pgmx amb XConverter (`-m 0`, manual MSL R4 §3.1.2.1 p9).
 *
 * Totes les instruccions segueixen els exemples del manual «Maestro Scripting Language» rev. 4
 * (docs/maestro/, pàgina entre parèntesis):
 *  - capçalera `SetMachiningParameters(camps, 1, taula, mecàniques, false)` (§3.9.1 p114, p8);
 *  - peça `CreateFinishedWorkpieceBox(nom, L, A, gruix)` (§3.2.2.1 p17) i
 *    `CreateRawWorkpiece(nom, 0, 0, 0, 0, 0, 0)` sense sobrant (§3.2.1 p16);
 *  - cares `SelectWorkplane("Top"|"Front"|"Back"|"Left"|"Right")` (§3.3.1 p19, §3.3.4 p23);
 *  - forats `CreateDrill(nom, x, y, fondària, Ø, "", TypeOfProcess.Drilling, eina, capçal)` (§3.5.1 p36);
 *  - ranures amb disc: `CreateSegment` + `CreateSlot(nom, fondària, desc, TypeOfProcess.GeneralRouting,
 *    eina, capçal, correcció, -1, -1, -1, 0)` (§3.5.7 p49);
 *  - ranures amb fresa: `CreatePolyline`/`AddSegmentToPolyline` (§3.4.1.4 p30-33) +
 *    `CreateRoughFinish(nom, fondària, desc, TypeOfProcess.GeneralRouting, eina, capçal, 0, -1, -1, -1, 0)` (§3.5.3 p40-41);
 *  - talls i contorn: polilínia tancada (`AddArc2PointRadiusToPolyline`, `ClosePolyline`, p31-32) o
 *    `CreateCircleCenterRadius` (§3.4.1.3 p28) + `CreateContour(nom, fondària, 1, costat, desc,
 *    TypeOfProcess.GeneralRouting, eina, capçal, 0, -1, -1, -1, 0)` amb costat 0 = dins, 1 = fora (§3.5.9 p53, p79).
 *  - semicercles (|bulge| = 1): `AddArc2PointCenterToPolyline(x, y, cx, cy, horari)` (Table 21 p31): amb el
 *    centre, el radi no s'ha d'arrodonir per sota de mitja corda.
 * El capçal va sempre a "-1" (Maestro el tria segons on és muntada l'eina); les broques horitzontals,
 * també l'eina (`"-1"`, p36): el parell esquerra/dreta depèn del cantell i no surt a l'.atrx. Les
 * verticals, `"-1"` per defecte (com els .pgmx del taller) o el nom de la broca (`Machine.verticalDrills`).
 * L'eina va pel seu nom de Maestro (`toolMslName`: el del .pgmx importat o el codi del .tlgx), sense
 * canviar-lo: cadena C# amb `\` i `"` escapats. Fitxer en UTF-8 amb BOM o sense
 * (`Machine.xcsEncoding`, `xcsBytes`/`xcsZip`; pendent de validar).
 *
 * Coordenades (vegeu docs/maestro-xcs.md, verificades amb el revisor): X = u (la llargada de la peça a
 * l'app, `length`), Y = v (`width`), origen a la cantonada de baix a l'esquerra de la cara A vista des de
 * dalt, Z = gruix. Cara B: la peça es gira sobre l'eix X (el cantell 1 passa a baix): (x, y) → (x, A − y).
 */

interface XcsExport {
  files: { name: string; text: string }[]
  /** Codificació dels .xcs (la de la màquina): `xcsZip` la fa servir. */
  encoding: NonNullable<Machine["xcsEncoding"]>
  panels: XcsPanelResult[]
  /** Avisos amb la peça (només problemes de debò): «A.1.L.1 (lat e): forat Ø5…». */
  warnings: string[]
  /** Avisos per una eina que falta o no hi arriba. */
  missingTool: number
  /** Peces amb algun pas després de la CNC. */
  postProcessPanels: number
  programs: number
}

/**
 * Bytes d'un fitxer de l'export: UTF-8 amb BOM (per defecte; pendent de validar a Maestro) o sense (`bom` false: el
 * programa real del taller és ASCII sense BOM; amb text ASCII, els bytes són els mateixos).
 */
export function xcsBytes(text: string, bom = true): Uint8Array {
  const body = new TextEncoder().encode(text)
  if (!bom) return body
  const out = new Uint8Array(body.length + 3)
  out.set([0xef, 0xbb, 0xbf])
  out.set(body, 3)
  return out
}

/**
 * El .zip de l'export (sense compressió). Els .xcs amb la codificació de l'export (`encoding`, la de la màquina; sense,
 * UTF-8 amb BOM); el LLEGEIX-ME sempre amb BOM (porta accents).
 */
export function xcsZip(x: Pick<XcsExport, "files"> & { encoding?: Machine["xcsEncoding"] }, when?: Date): Uint8Array {
  const bom = (name: string) => x.encoding !== "ascii" || !name.toLowerCase().endsWith(".xcs")
  return zipStore(x.files.map((f) => ({ name: f.name, data: xcsBytes(f.text, bom(f.name)) })), when)
}

/** Tots els programes d'un moble + un LLEGEIX-ME.txt. */
export function toMaestroXcs(panels: Panel[], m: Machine, opts: { project: string; date?: Date }): XcsExport {
  const refs = pieceRefs(panels)
  const rp = new RulePicker(m)
  const results = panels.map((p) => panelXcs(p, refs.get(p.id) ?? p.id, m, rp))
  const files: { name: string; text: string }[] = []
  // Primer les regles amb eines que falten (un sol cop per export), després els de cada peça.
  const warnings: string[] = [...rp.notes]
  results.forEach((r, i) => {
    for (const prog of r.programs) files.push({ name: prog.file, text: prog.text })
    for (const w of r.warnings) warnings.push(`${r.ref} (${panels[i]!.label}): ${w}`)
  })
  const empty = results.filter((r) => !r.programs.length).map((r) => r.ref)
  const enc = encodingWarning(m, files)
  if (enc) warnings.unshift(enc)
  files.push({ name: "LLEGEIX-ME.txt", text: readme(opts.project, m, results, panels, warnings, empty, opts.date ?? new Date()) })
  return {
    files,
    encoding: xcsEncodingOf(m),
    panels: results,
    warnings,
    missingTool: results.reduce((a, r) => a + r.missingTool, 0) + rp.missing,
    postProcessPanels: results.filter((r) => r.postProcesses.length).length,
    programs: results.reduce((a, r) => a + r.programs.length, 0),
  }
}

function readme(project: string, m: Machine, results: XcsPanelResult[], panels: Panel[], warnings: string[], empty: string[], date: Date): string {
  const lines = [
    `Programes Maestro (.xcs) - ${project}`,
    `Generat per Mobles CNC el ${date.toISOString().slice(0, 10)} per a la màquina ${m.name}${m.serial ? ` (${m.serial})` : ""}${m.maestroVersion ? `, Maestro ${m.maestroVersion}` : ""}.`,
    "",
    "BETA: encara no s'ha validat al taller. Obre cada programa a Maestro i revisa'l a la vista",
    "CAM (cares, origen, eines) abans de mecanitzar.",
    "",
    "Què hi ha",
    "- <ref>.xcs: la peça amb la cara A amunt (forats de cara, forats de cantell, ranures, talls",
    "  passants i el contorn de les peces amb forma).",
    "- <ref>Volt.xcs: la mateixa peça girada sobre l'eix X (cara B amunt), si té mecanitzats a la cara B.",
    "  És el «2a cara» del CSV de TopSolid (columna SEGUNDO_NOMBRE_DE_FICHERO_DE_MECANIZADO).",
    "",
    "Com es fan servir",
    "- A Maestro: importar l'script (.xcs) i desar-lo com a .pgmx; o bé, per a tots alhora:",
    `  XConverter.exe -s -m 0 -i "<ref>.xcs" -t "def.tlgx"   (manual MSL §3.1.2.1)`,
    "",
    "Convencions",
    "- X = llargada de la peça a l'app (u), Y = amplada (v), Z = gruix. Origen a la cantonada de baix",
    "  a l'esquerra de la cara A (cantell 4 a l'esquerra, cantell 3 a baix, com a l'app).",
    "- Forats de cantell a les cares estàndard (Front = cantell 3, Back = 1, Left = 4, Right = 2),",
    "  a mig gruix. Broques horitzontals amb eina automàtica (\"-1\").",
    m.verticalDrills === "tool" ? "- Broques verticals: el nom de la broca que ha triat l'app." : "- Broques verticals: eina automàtica (\"-1\"), com als projectes del taller.",
    `- Eines pel nom de Maestro${m.pgmx ? ` (noms del projecte ${m.pgmx.file}, Maestro ${m.pgmx.version})` : " (codi del .tlgx)"}.`,
    encodingReadme(m),
    "- Cantells amb la numeració de l'app: 1 dalt · 2 dreta · 3 baix · 4 esquerra (pendent de confirmar",
    "  amb la del taller).",
    `- Talls i forats passants: gruix + ${num(m.throughExtra)} mm.`,
    ...rulesReadme(machineRules(m), false),
    "",
    `Peces: ${results.length} · programes: ${results.reduce((a, r) => a + r.programs.length, 0)}`,
  ]
  if (empty.length) lines.push(`Sense mecanitzats (no tenen programa): ${empty.join(", ")}`)
  // Per peça: la ruta i el que li toca després de la CNC (per a l'etiqueta).
  const withPost = results.map((r, i) => ({ r, p: panels[i]! })).filter(({ r }) => r.postProcesses.length)
  if (withPost.length) {
    lines.push("", `Ordre de treball i després de la CNC (${withPost.length} ${withPost.length === 1 ? "peça" : "peces"})`)
    for (const { r, p } of withPost) {
      lines.push("", `${r.ref} (${p.label})`, `  Ordre de treball: ${r.route}`, "  Després de la CNC:")
      r.postProcesses.forEach((x, k) => lines.push(`    ${k + 1}. ${x.text}`))
    }
  }
  if (warnings.length) {
    lines.push("", `Avisos (${warnings.length}): el que no surt als programes o s'ha canviat`)
    for (const w of warnings) lines.push(`- ${w}`)
  }
  return lines.join(EOL) + EOL
}
