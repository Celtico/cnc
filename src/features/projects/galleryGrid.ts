/** Columnes de totes les graelles de la pàgina Mobles (historial i plantilles): la mateixa mida de targeta. */
export const GALLERY_COLS = { base: 2, md: 3, lg: 4, "2xl": 5 }

/** Per cercar sense accents ni majúscules. */
export const fold = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()

/** Acordions oberts: comencen tancats i es recorden només durant la sessió (com les seccions). */
export { useSessionList } from "../../components/sessionState"

/** Separa una llista pels seus grups (carpetes, ordenats pel nom) i els que no en tenen. */
export function groupByFolder<T>(items: T[], folderOf: (t: T) => string | undefined): { folders: [string, T[]][]; loose: T[] } {
  const map = new Map<string, T[]>()
  const loose: T[] = []
  for (const t of items) {
    const f = folderOf(t)?.trim()
    if (!f) loose.push(t)
    else map.set(f, [...(map.get(f) ?? []), t])
  }
  return { folders: [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "ca")), loose }
}
