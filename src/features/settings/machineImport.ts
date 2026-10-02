import { classifyContextFiles, machineFromContext } from "../../core/machine/maestro"
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
