/** Fitxers triats o deixats anar (amb el camí relatiu dins de la carpeta): els importadors (Maestro, ferratges). */

/** Camí relatiu del fitxer (dins de la carpeta triada) o el nom. */
const rel = (f: File) => (f as File & { webkitRelativePath?: string }).webkitRelativePath || f.name

/** Fitxer amb el seu camí relatiu (el de la carpeta triada o deixada anar). */
export interface PickedFile {
  path: string
  file: File
}

export const pickedFromList = (list: FileList | File[]): PickedFile[] => [...list].map((file) => ({ path: rel(file), file }))

/** Fitxers i carpetes deixats anar (les carpetes es recorren amb `webkitGetAsEntry`). */
export async function pickedFromDrop(dt: DataTransfer): Promise<PickedFile[]> {
  const entries = [...dt.items].map((i) => i.webkitGetAsEntry?.()).filter((e): e is FileSystemEntry => !!e)
  if (!entries.length) return pickedFromList(dt.files)
  const out: PickedFile[] = []
  const walk = async (e: FileSystemEntry, prefix: string): Promise<void> => {
    if (e.isFile) {
      const file = await new Promise<File>((res, rej) => (e as FileSystemFileEntry).file(res, rej))
      out.push({ path: prefix + e.name, file })
      return
    }
    const reader = (e as FileSystemDirectoryEntry).createReader()
    // readEntries torna a trossos: es crida fins que torna buit.
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((res, rej) => reader.readEntries(res, rej))
      if (!batch.length) break
      for (const c of batch) await walk(c, `${prefix}${e.name}/`)
    }
  }
  for (const e of entries) await walk(e, "")
  return out
}
