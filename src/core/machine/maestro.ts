import { unzip } from "../file/zip"
import type { Machine, MachineTool, ToolKind } from "../model/machine"
import { child, childrenOf, descendants, numOf, parseXml, textOf, type XmlNode } from "./xml"

/**
 * Lectura del context de màquina de Xilog Maestro (`<sèrie>.machinecontext`), en XML de
 * DataContract de .NET:
 *  - `Tlgx/def.tlgx` (CoreToolLibrary): la biblioteca d'eines. Cada `CoreTool` porta `Name` (el codi
 *    que fa servir l'MSL: «003», «E128»; manual MSL §3.5.1 p36 i §5 p135 `GetTool("E101")`),
 *    `Description`, el tipus (`i:type` CuttingTool / AggregateComponent / TouchProbingTool), el cos
 *    (`ToolBody` FlatDrill, Endmill, UniversalBlade…) amb `ToolDimension` (Diameter, SinkingLength =
 *    fondària útil, BladeThickness) i `HandOfCut`.
 *  - `Atrx/def.atrx` (ToolEquipmentProject): quina eina hi ha a cada capçal. Capçals d'un mandrí
 *    (`OneSpindleHeadToolEquipment`, electromandrins amb magatzem: `AvailableTools`) i la perforadora
 *    (`FixedHeadToolEquipment`): mandrins solts (verticals) i grups de dos (`SpindleGroupToolEquipment`,
 *    horitzontals, un per sentit).
 *  - `Cfgx/<sèrie>.cfgx`: un .zip amb l'XML de la configuració (descripció «5020*1905 …», àrees A…P).
 *  - `Settings/XilogHeaderParameters.xml`: capçalera per defecte (ExecutionFields, TableOptions…).
 */

export interface AtrxHead {
  number: number
  /** «router» = capçal d'un mandrí (electromandrí); «boring» = perforadora de mandrins fixos. */
  kind: "router" | "boring"
  tools: { code: string; spindle?: number; horizontal?: boolean }[]
}

export interface Atrx {
  /** «2.00.004» (Major.Minor.Build com el mostra Maestro). */
  version: string
  heads: AtrxHead[]
}

export interface CfgxInfo {
  description: string
  basement?: string
  workArea?: { x: number; y: number }
  areas: string[]
}

export interface HeaderParams {
  executionFields: string
  tableOptions: number
  mechanicalOptions: number
}

const kindOfBody = (body: string | undefined, coreType: string | undefined): ToolKind => {
  if (coreType === "AggregateComponent") return "aggregate"
  if (coreType === "TouchProbingTool") return "probe"
  const b = (body ?? "").toLowerCase()
  if (b.includes("blade") || b.includes("saw")) return "blade"
  if (b.includes("drill")) return "drill"
  if (b.includes("mill") || b.includes("router") || b.includes("cutter")) return "router"
  return "other"
}

/** Biblioteca d'eines (.tlgx) → eines normalitzades (sense equipament: `mounted` = true). */
export function parseTlgx(text: string): MachineTool[] {
  const root = parseXml(text)
  const out: MachineTool[] = []
  const seen = new Set<string>()
  for (const t of descendants(root, "CoreTool")) {
    const code = textOf(t, "Name")
    if (!code || seen.has(code)) continue
    seen.add(code)
    const desc = textOf(t, "Description") ?? ""
    const body = child(t, "ToolBody")
    const kind = kindOfBody(body?.type, t.type)
    const dim = child(body, "ToolDimension")
    const diameter = numOf(dim, "Diameter") ?? numOf(t, "OverallAssemblyDiameter") ?? 0
    const maxDepth = numOf(dim, "SinkingLength") ?? 0
    const length = numOf(t, "OverallAssemblyLength") || numOf(dim, "PilotLength") || undefined
    const hand = textOf(body, "HandOfCut")
    const disabled = textOf(t, "IsDisabled") === "true"
    const isExample = /^example\b/i.test(desc)
    const tool: MachineTool = {
      code,
      name: desc || code,
      kind,
      ...(kind === "drill" ? { orientation: /\bHOR\b/i.test(desc) ? ("horizontal" as const) : ("vertical" as const) } : {}),
      diameter,
      maxDepth,
      ...(length ? { length } : {}),
      ...(kind === "blade" && numOf(dim, "BladeThickness") ? { bladeThickness: numOf(dim, "BladeThickness")! } : {}),
      ...(hand === "Left" ? { rotation: "left" as const } : hand === "Right" ? { rotation: "right" as const } : {}),
      ...(body?.type ? { tip: body.type } : {}),
      mounted: true,
      auto: !disabled && !isExample && diameter > 0 && (kind === "drill" || kind === "router" || kind === "blade"),
    }
    out.push(tool)
  }
  return out
}

/** Equipament d'eines (.atrx): capçals i eines muntades. */
export function parseAtrx(text: string): Atrx {
  const root = parseXml(text)
  const v = child(root, "Version")
  const pad = (n: number | undefined, w: number) => String(n ?? 0).padStart(w, "0")
  const version = v ? `${numOf(v, "Major") ?? 0}.${pad(numOf(v, "Minor"), 2)}.${pad(numOf(v, "Build"), 3)}` : ""
  const heads: AtrxHead[] = []
  for (const h of descendants(root, "HeadToolEquipment")) {
    const number = numOf(h, "HeadNumber") ?? 0
    const available = child(h, "AvailableTools")
    if (available) {
      const tools = childrenOf(available, "SpindleAvailableToolEquipment")
        .map((x) => textOf(x, "ToolName"))
        .filter((c): c is string => !!c)
        .map((code) => ({ code }))
      heads.push({ number, kind: "router", tools })
      continue
    }
    const spindles = child(h, "SpindleTools")
    if (!spindles) continue
    const tools: AtrxHead["tools"] = []
    const walk = (n: XmlNode, inGroup: boolean) => {
      for (const s of childrenOf(n, "BaseSpindleToolEquipment")) {
        if (s.type === "SpindleGroupToolEquipment") {
          const inner = child(s, "BaseSpindleToolEquipments")
          if (inner) walk(inner, true)
          continue
        }
        const code = textOf(s, "ToolName")
        if (!code || textOf(s, "IsExcluded") === "true") continue
        tools.push({ code, spindle: numOf(s, "SpindleNumber"), horizontal: inGroup })
      }
    }
    walk(spindles, false)
    heads.push({ number, kind: "boring", tools })
  }
  return { version, heads }
}

/** Aplica l'equipament a les eines: capçals, mandrins, orientació de les broques i si són muntades. */
export function applyAtrx(tools: MachineTool[], atrx: Atrx): MachineTool[] {
  return tools.map((t) => {
    const heads = new Set<number>()
    const spindles: number[] = []
    let horizontal = false
    for (const h of atrx.heads)
      for (const x of h.tools)
        if (x.code === t.code) {
          heads.add(h.number)
          if (x.spindle !== undefined) spindles.push(x.spindle)
          if (x.horizontal) horizontal = true
        }
    const mounted = heads.size > 0
    return {
      ...t,
      ...(t.kind === "drill" && mounted ? { orientation: horizontal ? ("horizontal" as const) : t.orientation } : {}),
      ...(heads.size ? { heads: [...heads].sort((a, b) => a - b) } : {}),
      ...(spindles.length ? { spindles: [...new Set(spindles)].sort((a, b) => a - b) } : {}),
      mounted,
    }
  })
}

/** XML de la configuració (dins del .cfgx): descripció, àrees i, si la descripció la diu, la mida del camp. */
export function parseCfgxXml(text: string): CfgxInfo {
  // Només calen uns quants valors: es busquen al text (l'XML sencer fa 600 kB).
  const general = /i:type="\w+:GeneralData"[\s\S]*?<Description>([^<]*)<\/Description>/.exec(text)
  const description = general?.[1]?.trim() ?? ""
  const basement = /i:type="\w+:Basement"[\s\S]*?<Name[^>]*>([^<]*)<\/Name>/.exec(text)?.[1]?.trim()
  const size = /(\d{3,5})\s*[*x×]\s*(\d{3,5})/.exec(description)
  const areas = [...text.matchAll(/i:type="\w+:WorkingArea(?:Collection)?"[\s\S]*?<Name[^>]*>([^<]*)<\/Name>/g)]
    .map((m) => m[1]!.trim())
    .filter((a) => /^[A-Z]{1,2}$/.test(a))
  return {
    description,
    ...(basement ? { basement } : {}),
    ...(size ? { workArea: { x: Number(size[1]), y: Number(size[2]) } } : {}),
    areas: [...new Set(areas)].sort(),
  }
}

/** El .cfgx és un .zip amb un sol XML. */
export async function parseCfgx(bytes: Uint8Array): Promise<CfgxInfo> {
  const entries = await unzip(bytes)
  const xml = entries.find((e) => e.name.toLowerCase().endsWith(".xml"))
  if (!xml) throw new Error("El .cfgx no conté cap XML")
  return parseCfgxXml(new TextDecoder().decode(xml.data))
}

export function parseHeaderParams(text: string): HeaderParams {
  const root = parseXml(text)
  return {
    executionFields: textOf(root, "ExecutionFields") ?? "AB",
    tableOptions: numOf(root, "TableOptions") ?? 0,
    mechanicalOptions: numOf(root, "MechanicalOptions") ?? 0,
  }
}

/** Fitxers del context (pel nom, sense importar la carpeta). */
export interface ContextFiles {
  tlgx?: string
  atrx?: string
  cfgx?: Uint8Array
  header?: string
  /** Nom del context o del .cfgx: «AA10008021». */
  serial?: string
}

/**
 * Classifica una llista de fitxers (`path` relatiu, com `webkitRelativePath`) pel tipus: serveix
 * per a la carpeta `.machinecontext` sencera o per a fitxers solts.
 */
export function classifyContextFiles(names: string[]): { tlgx?: string; atrx?: string; cfgx?: string; header?: string; serial?: string } {
  const out: { tlgx?: string; atrx?: string; cfgx?: string; header?: string; serial?: string } = {}
  for (const n of names) {
    const low = n.toLowerCase()
    if (low.endsWith(".tlgx")) out.tlgx ??= n
    else if (low.endsWith(".atrx")) out.atrx ??= n
    else if (low.endsWith(".cfgx")) out.cfgx ??= n
    else if (low.endsWith("xilogheaderparameters.xml")) out.header ??= n
  }
  const ctx = names.map((n) => /([^/\\]+)\.machinecontext[/\\]/i.exec(n)?.[1]).find(Boolean)
  const cfgName = out.cfgx ? /([^/\\]+)\.cfgx$/i.exec(out.cfgx)?.[1] : undefined
  const serial = ctx ?? cfgName
  if (serial) out.serial = serial
  return out
}

/**
 * Màquina a partir dels fitxers del context. Cal com a mínim el .tlgx (sense, no hi ha eines).
 * `problems` diu el que falta o no s'ha pogut llegir (en català).
 */
export async function machineFromContext(files: ContextFiles, id: string): Promise<{ machine: Machine; problems: string[] }> {
  const problems: string[] = []
  if (!files.tlgx) throw new Error("Falta la biblioteca d'eines (.tlgx)")
  let tools = parseTlgx(files.tlgx)
  let version = ""
  if (files.atrx) {
    try {
      const atrx = parseAtrx(files.atrx)
      tools = applyAtrx(tools, atrx)
      version = atrx.version
    } catch (e) {
      problems.push(`No s'ha pogut llegir l'equipament (.atrx): ${String(e)}`)
    }
  } else problems.push("Sense l'equipament (.atrx) no se sap quines eines són muntades: es consideren totes disponibles.")
  let cfg: CfgxInfo | undefined
  if (files.cfgx) {
    try {
      cfg = await parseCfgx(files.cfgx)
    } catch (e) {
      problems.push(`No s'ha pogut llegir la configuració (.cfgx): ${String(e)}`)
    }
  }
  let header: HeaderParams = { executionFields: "AB", tableOptions: 0, mechanicalOptions: 0 }
  if (files.header) {
    try {
      header = parseHeaderParams(files.header)
    } catch (e) {
      problems.push(`No s'ha pogut llegir la capçalera (XilogHeaderParameters.xml): ${String(e)}`)
    }
  } else problems.push("Sense XilogHeaderParameters.xml: capçalera «AB» per defecte (revisa-la).")
  const serial = files.serial ?? ""
  const machine: Machine = {
    id,
    name: serial ? `SCM ${serial}` : "Màquina SCM",
    serial,
    model: cfg?.description || cfg?.basement || "",
    maestroVersion: version,
    ...(cfg?.workArea ? { workArea: cfg.workArea } : {}),
    areas: cfg?.areas ?? [],
    header,
    throughExtra: 1,
    grooves: "auto",
    isDefault: false,
    tools,
    importedAt: Date.now(),
  }
  return { machine, problems }
}

