import { classifyContextFiles, machineFromContext } from "../../core/machine/maestro"
import { applyPgmx, pgmxSummary, readPgmx } from "../../core/machine/pgmx"
import { newId, type Machine } from "../../core/model"

/** Camí relatiu del fitxer (dins de la carpeta triada) o el nom. */
const rel = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name

/**
 * Llegeix una màquina dels fitxers triats: la carpeta `<sèrie>.machinecontext` sencera
 * (`webkitdirectory`) o els fitxers solts (.tlgx, .atrx, .cfgx, XilogHeaderParameters.xml).
 */
export async function importMachineFiles(list: FileList | File[]): Promise<{ machine: Machine; problems: string[] }> {
  const files = [...list]
  const byName = new Map(files.map((f) => [rel(f), f]))
  const c = classifyContextFiles([...byName.keys()])
  const text = async (n?: string) => (n ? await byName.get(n)!.text() : undefined)
  const tlgx = await text(c.tlgx)
  if (!tlgx) throw new Error("No hi ha cap biblioteca d'eines (.tlgx). Tria la carpeta .machinecontext o el fitxer Tlgx/def.tlgx.")
  const atrx = await text(c.atrx)
  const header = await text(c.header)
  const cfgx = c.cfgx ? new Uint8Array(await byName.get(c.cfgx)!.arrayBuffer()) : undefined
  return machineFromContext(
    { tlgx, ...(atrx ? { atrx } : {}), ...(header ? { header } : {}), ...(cfgx ? { cfgx } : {}), ...(c.serial ? { serial: c.serial } : {}) },
    newId("mach"),
  )
}

/** Llegeix un projecte de Maestro (.pgmx, o l'XML ja extret) i l'aplica a la màquina: noms de les eines per ID i capçalera. */
export async function importPgmxFile(file: File, m: Machine): Promise<{ machine: Machine; summary: string; changed: boolean }> {
  const info = await readPgmx(new Uint8Array(await file.arrayBuffer()))
  if (!m.tools.some((t) => t.id)) throw new Error("Les eines d'aquesta màquina no porten l'ID de Maestro: torna a importar el context de màquina i després el .pgmx.")
  const r = applyPgmx(m, info, file.name, { withHeader: true })
  return { machine: r.machine, summary: pgmxSummary(r, info), changed: r.renamed.length > 0 || r.header }
}
