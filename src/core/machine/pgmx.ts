import { unzip } from "../file/zip"
import { type Machine, type MachineTool, TOOL_EDITABLE, type ToolEditable } from "../model/machine"
import { headerFromNode, type HeaderParams } from "./maestro"
import { child, descendants, numOf, parseXml, textOf } from "./xml"

/**
 * Projectes de Maestro (.pgmx): un .zip amb l'XML del projecte (`Project`, DataContract). Se'n llegeix
 * el que l'export necessita i el context de màquina no diu bé:
 *  - els noms de les eines a la versió de Maestro del taller: `ToolKey` (ID, Name) de cada operació. El
 *    `Name` és el que va al paràmetre `tool` de l'MSL; l'ID és el mateix `Key/ID` del `CoreTool` del
 *    .tlgx (ID 2149647431 = «E128» / «Diamant D12» al .tlgx 2.00.004 i «12mm diamant nesting» al .pgmx
 *    2.0.5);
 *  - la capçalera (`MachiningParameters`, un XilogHeaderParameters) i la versió de Maestro.
 */

export interface PgmxInfo {
  /** «2.0.5 rev 1005». */
  version: string
  header?: HeaderParams
  /** Eines de les operacions (sense repetir; sense les buides, ID 0). */
  tools: { id: string; name: string }[]
}

export function parsePgmxXml(text: string): PgmxInfo {
  const root = parseXml(text.replace(/^﻿/, ""))
  if (root.name !== "Project") throw new Error("No és un projecte de Maestro (.pgmx)")
  const v = child(root, "Version")
  const version = v ? `${numOf(v, "Major") ?? 0}.${numOf(v, "Minor") ?? 0}.${numOf(v, "Build") ?? 0}${numOf(v, "Revision") ? ` rev ${numOf(v, "Revision")}` : ""}` : ""
  const mp = child(root, "MachiningParameters")
  const seen = new Map<string, string>()
  for (const k of descendants(root, "ToolKey")) {
    const id = textOf(k, "ID")
    const name = textOf(k, "Name")?.trim()
    if (!id || id === "0" || !name) continue
    if (!seen.has(id)) seen.set(id, name)
  }
  return { version, ...(mp ? { header: headerFromNode(mp) } : {}), tools: [...seen].map(([id, name]) => ({ id, name })) }
}

/** Un .pgmx (zip) o l'XML ja extret. */
export async function readPgmx(bytes: Uint8Array): Promise<PgmxInfo> {
  if (bytes[0] === 0x50 && bytes[1] === 0x4b) {
    const entries = (await unzip(bytes)).filter((e) => e.name.toLowerCase().endsWith(".xml"))
    const dec = new TextDecoder()
    // L'XML del projecte (n'hi pot haver d'altres): el que comença per <Project, el més gros.
    const xml = entries
      .map((e) => dec.decode(e.data))
      .filter((t) => /^﻿?\s*(<\?xml[^>]*>\s*)?<Project[\s>]/.test(t))
      .sort((a, b) => b.length - a.length)[0]
    if (!xml) throw new Error("El .pgmx no conté l'XML del projecte")
    return parsePgmxXml(xml)
  }
  return parsePgmxXml(new TextDecoder().decode(bytes))
}

export interface PgmxApplied {
  machine: Machine
  /** Eines de la màquina que han canviat de nom (codi, nom d'abans, nom del .pgmx). */
  renamed: { code: string; from: string; to: string }[]
  /** Eines que ja tenien aquest nom. */
  same: number
  /** Eines del .pgmx que no són a la màquina (per ID). */
  missing: { id: string; name: string }[]
  /** S'ha posat la capçalera del .pgmx. */
  header: boolean
}

/**
 * Aplica un .pgmx a una màquina: posa a cada eina amb el mateix ID el nom del .pgmx (`mslName`, el de
 * l'MSL; també `name` si no s'ha tocat a mà) i, si `withHeader`, la capçalera. El codi no canvia.
 */
export function applyPgmx(m: Machine, info: PgmxInfo, file: string, opts: { withHeader: boolean; now?: number }): PgmxApplied {
  const byId = new Map(info.tools.map((t) => [t.id, t.name]))
  const renamed: PgmxApplied["renamed"] = []
  let same = 0
  const tools = m.tools.map((t) => {
    const to = t.id ? byId.get(t.id) : undefined
    if (!to) return t
    if (t.mslName === to && (t.name === to || t.edited?.includes("name"))) {
      same++
      return t
    }
    renamed.push({ code: t.code, from: t.mslName ?? t.name, to })
    return { ...t, mslName: to, ...(t.edited?.includes("name") ? {} : { name: to }) }
  })
  const ids = new Set(m.tools.map((t) => t.id).filter(Boolean))
  const missing = info.tools.filter((t) => !ids.has(t.id))
  const header = opts.withHeader && !!info.header
  return {
    machine: {
      ...m,
      tools,
      ...(header ? { header: info.header! } : {}),
      pgmx: { file, version: info.version, tools: info.tools.length, importedAt: opts.now ?? Date.now() },
    },
    renamed,
    same,
    missing,
    header,
  }
}

/** Resum de l'aplicació d'un .pgmx, en català. */
export function pgmxSummary(r: PgmxApplied, info: PgmxInfo): string {
  const parts = [`Maestro ${info.version || "?"}: ${info.tools.length} ${info.tools.length === 1 ? "eina" : "eines"} al projecte.`]
  if (r.renamed.length) parts.push(`Noms nous: ${r.renamed.map((x) => `${x.code} «${x.from}» → «${x.to}»`).join(", ")}.`)
  if (r.same) parts.push(`${r.same} ja tenien el nom.`)
  if (r.missing.length) parts.push(`No són a la màquina (cal tornar a importar el context?): ${r.missing.map((x) => `«${x.name}» (ID ${x.id})`).join(", ")}.`)
  if (r.header) parts.push("Capçalera del projecte aplicada.")
  return parts.join(" ")
}

const pick = (t: MachineTool, keys: readonly ToolEditable[]): Partial<MachineTool> => {
  const out: Partial<MachineTool> = {}
  for (const k of keys) if (t[k] !== undefined) (out as Record<string, unknown>)[k] = t[k]
  return out
}

/**
 * Torna a importar una màquina ja importada (la mateixa sèrie): les eines noves del context, però per a
 * cada eina (per ID o, si no en té, per codi) es conserven els camps tocats a mà (`edited`), el nom de
 * l'MSL del .pgmx i les eines afegides a mà. També el nom, el per defecte i les opcions de la màquina.
 */
export function mergeReimport(old: Machine, fresh: Machine): Machine {
  const tools = fresh.tools.map((t) => {
    const o = old.tools.find((x) => (t.id && x.id ? x.id === t.id : x.code === t.code))
    if (!o) return t
    const edited = (o.edited ?? []).filter((k) => (TOOL_EDITABLE as readonly string[]).includes(k))
    return { ...t, ...pick(o, edited), ...(edited.length ? { edited } : {}), ...(o.mslName && !t.mslName ? { mslName: o.mslName } : {}) }
  })
  const manual = old.tools.filter((t) => t.manual && !tools.some((x) => x.code === t.code))
  return {
    ...fresh,
    id: old.id,
    name: old.name,
    isDefault: old.isDefault,
    throughExtra: old.throughExtra,
    grooves: old.grooves,
    verticalDrills: old.verticalDrills,
    ...(old.nesting ? { nesting: old.nesting } : {}),
    ...(old.rules ? { rules: old.rules } : {}),
    // La capçalera del .pgmx (o la retocada) mana sobre la de XilogHeaderParameters.
    ...(old.pgmx ? { header: old.header, pgmx: old.pgmx } : {}),
    tools: [...tools, ...manual],
  }
}
