import { CloseButton, Drawer, Portal } from "@chakra-ui/react"
import type { Composition } from "../../core/model"
import { NewMobleGallery } from "../projects/NewMobleGallery"
import { useMobleHistory } from "./moduleHistory"

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
