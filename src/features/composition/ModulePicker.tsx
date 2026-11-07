import { CloseButton, Drawer, Portal, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { addCompositionModules, type Composition } from "../../core/model"
import type { Selection } from "./StructureTree"
import type { Project } from "../../db/db"
import { readComposition } from "../../db/compositionStore"
import { FolderedGrid } from "../projects/Folders"
import { NewMobleGallery } from "../projects/NewMobleGallery"
import { ProjectCard } from "../projects/ProjectCard"
import { projectSearchText } from "../projects/searchText"
import { isObject } from "../objects/isObject"
import { useProjects } from "../useProject"

/**
 * Finestra «Afegir un mòdul» de l'editor (per decisió de l'usuari, 2026-10-21: «al fer mòdul nou, de zero o seleccionar
 * de mòduls ja fets com als ambients»): el botó «Mòdul en blanc» (el de sempre: demana el nom) i la mateixa galeria que
 * la pàgina Mobles (Historial · Projectes · Catàleg · Col·leccions · Models constructius). Tocar una targeta n'afegeix els
 * mòduls a aquest moble (`addCompositionModules`); el moble triat no canvia.
 */
export function ModulePicker({ open, onClose, onClosed, mobleName, onBlank, onPick }: { open: boolean; onClose: () => void; /** Quan s'acaba de tancar (l'animació): el «Mòdul en blanc» hi obre el seu diàleg. */ onClosed?: () => void; mobleName: string; onBlank: () => void; onPick: (c: Composition, name: string) => void }) {
  const history = useMobleHistory(onPick, "mobles:module-picker-folders")
  return (
    <Drawer.Root open={open} onOpenChange={(e) => !e.open && onClose()} onExitComplete={onClosed} size="full" placement="bottom">
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content pt="env(safe-area-inset-top, 0px)" pb="env(safe-area-inset-bottom, 0px)">
            <Drawer.Header>
              <Drawer.Title flex={1}>Afegir un mòdul a «{mobleName || "Moble"}»</Drawer.Title>
              <Drawer.CloseTrigger asChild top="calc(env(safe-area-inset-top, 0px) + 8px)">
                <CloseButton size="sm" aria-label="Tancar" />
              </Drawer.CloseTrigger>
            </Drawer.Header>
            <Drawer.Body>
              {open && (
                <NewMobleGallery
                  storageKey="mobles:module-picker"
                  onCreate={onPick}
                  history={history}
                  add={{ label: "Mòdul en blanc", onClick: onBlank }}
                />
              )}
            </Drawer.Body>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}

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
