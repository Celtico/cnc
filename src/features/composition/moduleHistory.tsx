import { Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { addCompositionModules, type Composition } from "../../core/model"
import type { Selection } from "./StructureTree"
import type { Project } from "../../db/db"
import { readComposition } from "../../db/compositionStore"
import { FolderedGrid } from "../projects/Folders"
import { ProjectCard } from "../projects/ProjectCard"
import { projectSearchText } from "../projects/searchText"
import { isObject } from "../objects/isObject"
import { useProjects } from "../useProject"

/**
 * L'Historial i els Projectes de la galeria «Afegir un mòdul» (la finestra i el Catàleg del panell de l'editor): els mobles
 * i els models que ja tens (no els objectes); tocar-ne un en porta els mòduls (`onPick`).
 */
export function useMobleHistory(onPick: (c: Composition, name: string) => void, storageKey: string) {
  const projects = useProjects()
  return (matches: (text: string) => boolean, searching: boolean): { count: number; node: ReactNode; projects: { count: number; node: ReactNode } } => {
    const mine = (projects ?? []).filter((p) => !isObject(p))
    const shown = mine.filter((p) => !searching || matches(projectSearchText(p)))
    const loose = shown.filter((p) => !p.folder)
    const grouped = shown.filter((p) => p.folder)
    const pick = (p: Project) => onPick(readComposition(p).composition, p.name)
    const grid = (show: "folders" | "loose", list: Project[]) => (
      <FolderedGrid show={show} items={list} folderOf={(p) => p.folder} keyOf={(p) => p.id} storageKey={storageKey} searching={searching} render={(p) => <ProjectCard project={p} onAdd={() => pick(p)} />} />
    )
    return {
      count: loose.length,
      node: loose.length ? (
        grid("loose", loose)
      ) : (
        <Text fontSize="sm" color="fg.muted">
          {shown.length ? "L'historial és buit: el que tens és a Projectes." : mine.length ? "Cap moble no coincideix amb la cerca." : "Encara no tens cap moble: tria'n un del catàleg."}
        </Text>
      ),
      projects: {
        count: grouped.length,
        node: grouped.length ? grid("folders", grouped) : <Text fontSize="sm" color="fg.muted">Cap moble en un grup.</Text>,
      },
    }
  }
}

/** Porta els mòduls (i peces) d'un moble triat a la galeria a aquest (`addCompositionModules`) i selecciona el que ha entrat. */
export function pickInto(comp: Composition, c: Composition, name: string, onChange: (c: Composition) => void, onSelect: (s: Selection) => void): void {
  const r = addCompositionModules(comp, c, name)
  onChange(r.comp)
  const first = r.items[0]
  if (first) onSelect(r.items.length > 1 ? { kind: "multi", items: r.items } : first.kind === "module" ? { kind: "module", id: first.id } : first.kind === "part" ? { kind: "part", id: first.id } : { kind: "model", id: first.id })
}
