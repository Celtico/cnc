import { Text } from "@chakra-ui/react"
import { FloatingWindow } from "../../components/FloatingWindow"
import type { Composition } from "../../core/model"
import type { Project } from "../../db/db"
import { FolderedGrid } from "../projects/Folders"
import { NewMobleGallery } from "../projects/NewMobleGallery"
import { ProjectCard } from "../projects/ProjectCard"
import { projectSearchText } from "../projects/searchText"
import { ObjectsGallery } from "../objects/ObjectsGallery"
import { isObject } from "../objects/isObject"
import { useAmbientMembership } from "./useAmbientMembership"

/**
 * Finestra «Afegir un moble» / «Afegir un objecte» d'un ambient (una `FloatingWindow` gran): la mateixa galeria que la
 * pàgina Mobles o Objectes (Historial · Projectes, amb els grups com allà, · Catàleg), sense el botó «Nou». Tocar una targeta la
 * col·loca: un moble o objecte que ja tens s'enllaça (`onAdd`); una plantilla crea el moble i el col·loca (`onCreate`).
 * Sense «Seleccionar» ni «Grup nou» ni el menú dels grups: aquí només es tria (cap mode que es quedi els tocs).
 */
export function AmbientPicker({
  what,
  open,
  onClose,
  ambientId,
  ambientName,
  projects,
  onAdd,
  onCreate,
}: {
  what: "moble" | "object"
  open: boolean
  onClose: () => void
  ambientId: number
  ambientName: string
  projects: Project[] | undefined
  onAdd: (p: Project) => void
  onCreate: (composition: Composition, name: string) => void
}) {
  const membership = useAmbientMembership()
  const objects = what === "object"
  const history = (matches: (text: string) => boolean, searching: boolean) => {
    const mine = (projects ?? []).filter((p) => isObject(p) === objects)
    const shown = mine.filter((p) => !searching || matches(projectSearchText(p)))
    // Com a les pàgines: Historial = el que és de pas (sense grup); el que és en un grup, a Projectes.
    const loose = shown.filter((p) => !p.folder)
    const grouped = shown.filter((p) => p.folder)
    const grid = (show: "folders" | "loose", list: Project[]) => (
      <FolderedGrid
        show={show}
        items={list}
        folderOf={(p) => p.folder}
        keyOf={(p) => p.id}
        storageKey={objects ? "mobles:ambient-objects-folders" : "mobles:ambient-picker-folders"}
        searching={searching}
        render={(p) => <ProjectCard project={p} ambients={membership.get(p.id)} currentAmbient={ambientId} onAdd={() => onAdd(p)} />}
      />
    )
    const none = objects ? "Cap objecte no coincideix amb la cerca." : "Cap moble no coincideix amb la cerca."
    return {
      count: loose.length,
      node: loose.length ? (
        grid("loose", loose)
      ) : (
        <Text fontSize="sm" color="fg.muted">
          {shown.length
            ? "L'historial és buit: el que tens és a Projectes."
            : mine.length
              ? none
              : objects
                ? "Encara no tens cap objecte: tria'n un del catàleg."
                : "Encara no tens cap moble: tria'n un del catàleg."}
        </Text>
      ),
      projects: {
        count: grouped.length,
        node: grouped.length ? (
          grid("folders", grouped)
        ) : (
          <Text fontSize="sm" color="fg.muted">
            {objects ? "Cap objecte en un grup." : "Cap moble en un grup."} Els grups es fan a la pàgina {objects ? "Objectes" : "Mobles"} («Grup nou» o «Moure a un grup…»).
          </Text>
        ),
      },
    }
  }
  return (
    <FloatingWindow id="ambient-picker" open={open} onClose={onClose} title={`${objects ? "Afegir un objecte" : "Afegir un moble"} a «${ambientName}»`} width={1200} height={900}>
      {open &&
        (objects ? (
          <ObjectsGallery storageKey="mobles:ambient-objects" onCreate={onCreate} history={history} />
        ) : (
          <NewMobleGallery storageKey="mobles:ambient-picker" onCreate={onCreate} history={history} />
        ))}
    </FloatingWindow>
  )
}
