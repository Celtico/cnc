import { importMaestro, maestroCandidate, type ImportFile, type MaestroImportResult } from "../../core/machine/maestroImport"
import { newId, type Machine } from "../../core/model"
import type { PickedFile } from "../../components/pickedFiles"

export { pickedFromDrop, pickedFromList, type PickedFile } from "../../components/pickedFiles"

/**
 * Importa de Maestro el que s'hagi triat (carpeta .machinecontext, projecte .pgmx en fitxer o carpeta, fitxers
 * solts): només es llegeixen els fitxers que poden ser de Maestro. `target` = on van els .pgmx sense màquina pròpia.
 */
export async function importMaestroFiles(picked: PickedFile[], machines: Machine[], target?: string): Promise<MaestroImportResult> {
  const files: ImportFile[] = await Promise.all(
    picked.filter((p) => maestroCandidate(p.path)).map(async (p) => ({ path: p.path, bytes: new Uint8Array(await p.file.arrayBuffer()) })),
  )
  return importMaestro(files, machines, { ...(target ? { target } : {}), newId: () => newId("mach") })
}
