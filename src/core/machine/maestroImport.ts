import { DEFAULT_HEADER, MACHINE_RULES_VERSION, type Machine, type MachineTool } from "../model/machine"
import { classifyContextFiles, machineFromContext, parseAtrx, parseCfgx, type CfgxInfo } from "./maestro"
import { applyPgmx, mergeReimport, pgmxSummary, readPgmx, type PgmxInfo } from "./pgmx"

/**
 * Importador únic de Maestro: rep el que l'usuari hagi triat o deixat anar (la carpeta `.machinecontext`,
 * un projecte `.pgmx` en zip o desplegat en carpeta, o fitxers solts) i ho reparteix:
 *  1. context de màquina (.tlgx/.atrx/.cfgx/XilogHeaderParameters) → crea o actualitza la màquina (per sèrie);
 *  2. projectes .pgmx → noms de les eines i capçalera a la màquina de la seva carpeta, a la triada, a la
 *     per defecte o, si no n'hi ha cap, a una màquina nova feta només amb el .pgmx.
 * El tipus de cada fitxer es mira pel contingut (element arrel de l'XML o zip), no només per l'extensió.
 */

type MaestroFileKind = "tlgx" | "atrx" | "cfgx" | "header" | "pgmx" | "other"

export interface ImportFile {
  /** Camí relatiu (`webkitRelativePath` o el del drag & drop) o el nom del fitxer solt. */
  path: string
  bytes: Uint8Array
}

const ext = (p: string) => /\.([^./\\]+)$/.exec(p)?.[1]?.toLowerCase() ?? ""

/** Fitxers que cal llegir per decidir (la resta del context —materials, etiquetes…— no interessa). */
export const maestroCandidate = (path: string): boolean => ["tlgx", "atrx", "cfgx", "xml", "pgmx", "zip"].includes(ext(path))

/** Nom local de l'element arrel d'un XML (sense BOM, declaració ni comentaris). */
export function xmlRoot(head: string): string | undefined {
  const s = head.replace(/^﻿/, "").replace(/<\?[\s\S]*?\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>/g, "").trimStart()
  return /^<(?:[\w.-]+:)?([\w.-]+)[\s/>]/.exec(s)?.[1]
}

const ROOTS: Record<string, MaestroFileKind> = {
  CoreToolLibrary: "tlgx",
  ToolEquipmentProject: "atrx",
  XilogHeaderParameters: "header",
  Project: "pgmx",
}

/** Tipus d'un fitxer de Maestro pel contingut (n'hi ha prou amb els primers kB). */
export function detectMaestroFile(path: string, bytes: Uint8Array): MaestroFileKind {
  const e = ext(path)
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) return e === "cfgx" ? "cfgx" : e === "pgmx" || e === "zip" ? "pgmx" : "other"
  const root = xmlRoot(new TextDecoder().decode(bytes.subarray(0, 4096)))
  const byRoot = root ? ROOTS[root] : undefined
  if (byRoot) return byRoot
  return e === "tlgx" ? "tlgx" : e === "atrx" ? "atrx" : "other"
}

/** Grup d'un fitxer: la carpeta de dalt de tot (cada carpeta deixada anar és un grup) o "" per als solts. */
const groupOf = (p: string) => (/^([^/\\]+)[/\\]/.exec(p)?.[1] ?? "")
const stem = (p: string) => (p.split(/[/\\]/).pop() ?? p).replace(/(\.pgmx|\.xml|\.zip)+$/i, "")

interface MaestroPlan {
  group: string
  context: { tlgx?: string; atrx?: string; cfgx?: string; header?: string; serial?: string }
  pgmx: string[]
}

/**
 * Pla de la importació (pur): per grup, els fitxers del context i els projectes .pgmx. En una carpeta
 * `.pgmx` desplegada només compta l'XML del projecte més gros (com en llegir el zip).
 */
export function planMaestroImport(files: { path: string; kind: MaestroFileKind; size: number }[]): MaestroPlan[] {
  const groups = new Map<string, typeof files>()
  for (const f of files) {
    if (f.kind === "other") continue
    const g = groupOf(f.path)
    groups.set(g, [...(groups.get(g) ?? []), f])
  }
  return [...groups].map(([group, fs]) => {
    const pick = (k: MaestroFileKind) => fs.filter((f) => f.kind === k).map((f) => f.path)
    const names = [...pick("tlgx"), ...pick("atrx"), ...pick("cfgx"), ...pick("header")]
    // La sèrie, del camí (`<sèrie>.machinecontext/`) o del nom del .cfgx; el tipus, pel contingut.
    const serial = classifyContextFiles(names).serial
    const context: MaestroPlan["context"] = {}
    for (const k of ["tlgx", "atrx", "cfgx", "header"] as const) {
      const first = pick(k)[0]
      if (first) context[k] = first
    }
    if (serial) context.serial = serial
    let pgmx = fs.filter((f) => f.kind === "pgmx")
    if (/\.pgmx$/i.test(group)) {
      const zips = pgmx.filter((f) => ext(f.path) !== "xml")
      const xml = pgmx.filter((f) => ext(f.path) === "xml").sort((a, b) => b.size - a.size)[0]
      pgmx = [...zips, ...(xml ? [xml] : [])]
    }
    return { group, context, pgmx: pgmx.map((f) => f.path) }
  })
}

/** Màquina sense .tlgx (carpeta .pgmx desplegada): eines de l'equipament (.atrx), sense mides (no automàtiques). */
async function machineFromAtrx(files: { atrx?: string; cfgx?: Uint8Array; serial?: string }, id: string, name?: string): Promise<{ machine: Machine; problems: string[] }> {
  const problems: string[] = []
  let tools: MachineTool[] = []
  let version = ""
  if (files.atrx) {
    try {
      const atrx = parseAtrx(files.atrx)
      version = atrx.version
      const byCode = new Map<string, MachineTool>()
      for (const h of atrx.heads)
        for (const x of h.tools) {
          const t = byCode.get(x.code) ?? {
            code: x.code,
            name: x.code,
            kind: h.kind === "boring" ? ("drill" as const) : ("router" as const),
            ...(h.kind === "boring" ? { orientation: x.horizontal ? ("horizontal" as const) : ("vertical" as const) } : {}),
            diameter: 0,
            maxDepth: 0,
            mounted: true,
            auto: false,
          }
          const heads = [...new Set([...(t.heads ?? []), h.number])].sort((a, b) => a - b)
          const spindles = x.spindle !== undefined ? [...new Set([...(t.spindles ?? []), x.spindle])].sort((a, b) => a - b) : t.spindles
          byCode.set(x.code, { ...t, heads, ...(spindles?.length ? { spindles } : {}) })
        }
      tools = [...byCode.values()]
    } catch (e) {
      problems.push(`No s'ha pogut llegir l'equipament (.atrx): ${String(e)}`)
    }
  }
  let cfg: CfgxInfo | undefined
  if (files.cfgx) {
    try {
      cfg = await parseCfgx(files.cfgx)
    } catch (e) {
      problems.push(`No s'ha pogut llegir la configuració (.cfgx): ${String(e)}`)
    }
  }
  problems.push("Sense la biblioteca d'eines (.tlgx) les eines no tenen mides: importa la carpeta .machinecontext per completar-les.")
  const serial = files.serial ?? ""
  return {
    machine: {
      id,
      name: name ?? (serial ? `SCM ${serial}` : "Màquina SCM"),
      serial,
      model: cfg?.description || cfg?.basement || "",
      maestroVersion: version,
      ...(cfg?.workArea ? { workArea: cfg.workArea } : {}),
      areas: cfg?.areas ?? [],
      header: { ...DEFAULT_HEADER },
      throughExtra: 1,
      grooves: "auto",
      verticalDrills: "auto",
      rulesVersion: MACHINE_RULES_VERSION,
      isDefault: false,
      tools,
      importedAt: Date.now(),
    },
    problems,
  }
}

/**
 * Afegeix a una màquina feta sense .tlgx les eines del .pgmx: si el nom coincideix amb un codi de l'.atrx
 * hi posa l'ID; si no, una eina nova amb el nom del projecte (sense mides).
 */
function addPgmxTools(m: Machine, info: PgmxInfo): Machine {
  const tools = [...m.tools]
  for (const p of info.tools) {
    if (tools.some((t) => t.id === p.id)) continue
    const k = tools.findIndex((t) => !t.id && t.code === p.name)
    if (k >= 0) tools[k] = { ...tools[k]!, id: p.id, mslName: p.name }
    else tools.push({ code: p.name, name: p.name, id: p.id, mslName: p.name, kind: "other", diameter: 0, maxDepth: 0, mounted: true, auto: false })
  }
  return { ...m, tools }
}

export interface MaestroImportResult {
  machines: Machine[]
  /** La darrera màquina tocada (per seleccionar-la). */
  selected?: string
  /** Què s'ha importat, una línia per cosa (en català). */
  lines: string[]
  problems: string[]
}

/**
 * Importa el que s'hagi triat. `target` = la màquina on van els .pgmx sense context propi (la seleccionada);
 * si no, la per defecte o la primera. Llança si no hi ha res de Maestro.
 */
export async function importMaestro(files: ImportFile[], machines: Machine[], opts: { target?: string; newId: () => string }): Promise<MaestroImportResult> {
  const byPath = new Map(files.map((f) => [f.path, f]))
  const plans = planMaestroImport(files.map((f) => ({ path: f.path, kind: detectMaestroFile(f.path, f.bytes), size: f.bytes.length })))
  const dec = new TextDecoder()
  const text = (p?: string) => (p ? dec.decode(byPath.get(p)!.bytes) : undefined)
  let list = [...machines]
  const lines: string[] = []
  const problems: string[] = []
  const groupTarget = new Map<string, string>()
  /** Màquines fetes sense .tlgx en aquesta importació (s'hi afegeixen les eines del .pgmx). */
  const partial = new Set<string>()
  let selected: string | undefined
  const upsert = (m: Machine) => {
    list = list.some((x) => x.id === m.id) ? list.map((x) => (x.id === m.id ? m : x)) : [...list, { ...m, isDefault: list.length === 0 }]
    selected = m.id
  }

  // 1. Context de màquina.
  for (const p of plans) {
    const c = p.context
    if (c.tlgx) {
      const atrx = text(c.atrx)
      const header = text(c.header)
      const cfgx = c.cfgx ? byPath.get(c.cfgx)!.bytes : undefined
      const { machine, problems: pr } = await machineFromContext(
        { tlgx: text(c.tlgx)!, ...(atrx ? { atrx } : {}), ...(header ? { header } : {}), ...(cfgx ? { cfgx } : {}), ...(c.serial ? { serial: c.serial } : {}) },
        opts.newId(),
      )
      // La mateixa sèrie ja importada: s'actualitza conservant el que s'ha tocat a mà.
      const old = list.find((x) => machine.serial && x.serial === machine.serial)
      const merged = old ? mergeReimport(old, machine) : machine
      upsert(merged)
      groupTarget.set(p.group, merged.id)
      lines.push(`Màquina ${merged.name} ${old ? "actualitzada" : "importada"}: ${merged.tools.length} eines, ${merged.tools.filter((t) => t.mounted && t.auto).length} disponibles per a l'export.`)
      problems.push(...pr)
    } else if ((c.atrx || c.cfgx) && p.pgmx.length) {
      // Carpeta .pgmx desplegada: l'.atrx i el .cfgx diuen de quina màquina és.
      const old = c.serial ? list.find((x) => x.serial === c.serial) : undefined
      if (old) {
        groupTarget.set(p.group, old.id)
        continue
      }
      const cfgx = c.cfgx ? byPath.get(c.cfgx)!.bytes : undefined
      const atrx = text(c.atrx)
      const { machine, problems: pr } = await machineFromAtrx({ ...(atrx ? { atrx } : {}), ...(cfgx ? { cfgx } : {}), ...(c.serial ? { serial: c.serial } : {}) }, opts.newId())
      upsert(machine)
      partial.add(machine.id)
      groupTarget.set(p.group, machine.id)
      lines.push(`Màquina ${machine.name} creada de l'equipament del projecte: ${machine.tools.length} eines.`)
      problems.push(...pr)
    } else if (c.atrx || c.cfgx || c.header) {
      problems.push(`${p.group || "Fitxers solts"}: falta la biblioteca d'eines (.tlgx); tria la carpeta .machinecontext sencera.`)
    }
  }

  // 2. Projectes .pgmx.
  for (const p of plans)
    for (const path of p.pgmx) {
      const file = path.split(/[/\\]/).pop() ?? path
      let info: PgmxInfo
      try {
        info = await readPgmx(byPath.get(path)!.bytes)
      } catch (e) {
        problems.push(`${file}: ${e instanceof Error ? e.message : String(e)}`)
        continue
      }
      const tid = groupTarget.get(p.group) ?? (opts.target && list.some((x) => x.id === opts.target) ? opts.target : undefined) ?? list.find((x) => x.isDefault)?.id ?? list[0]?.id
      let m = list.find((x) => x.id === tid)
      let created = false
      if (!m) {
        // Cap màquina: se'n fa una només amb el .pgmx.
        const name = stem(p.group && /\.pgmx$/i.test(p.group) ? p.group : file)
        m = { ...(await machineFromAtrx({}, opts.newId(), `Màquina de ${name}`)).machine, maestroVersion: info.version }
        partial.add(m.id)
        created = true
      }
      if (partial.has(m.id)) m = addPgmxTools(m, info)
      else if (!m.tools.some((t) => t.id)) {
        problems.push(`${file}: les eines de ${m.name} no porten l'ID de Maestro; torna a importar el context de màquina i després el .pgmx.`)
        continue
      }
      const r = applyPgmx(m, info, file, { withHeader: true })
      upsert(r.machine)
      groupTarget.set(p.group, r.machine.id)
      lines.push(created ? `Màquina ${r.machine.name} creada del projecte ${file}: ${r.machine.tools.length} eines (sense mides).` : `${file} → ${r.machine.name}. ${pgmxSummary(r, info)}`)
    }

  if (!lines.length) {
    if (problems.length) throw new Error(problems.join(" "))
    throw new Error("No s'hi ha trobat res de Maestro: tria la carpeta .machinecontext, un projecte .pgmx (fitxer o carpeta) o fitxers .tlgx / .atrx.")
  }
  return { machines: list, ...(selected ? { selected } : {}), lines, problems }
}
