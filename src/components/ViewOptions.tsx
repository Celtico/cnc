import { CloseButton, Drawer, IconButton, Popover, Portal, SimpleGrid, Stack, useBreakpointValue } from "@chakra-ui/react"
import { Children, Fragment, isValidElement, type ReactNode } from "react"
import { LuSlidersVertical } from "react-icons/lu"
import { Tooltip } from "./ui/tooltip"
import { segItem } from "./segmented"
import { SectionLabel } from "./SectionLabel"

/** Botó d'opció de vista (activa/inactiva) amb el nom al tooltip, el mateix a tots els visors. */
export function ViewTile({ label, icon, on, onClick, tip }: { label: string; icon: ReactNode; on: boolean; onClick: () => void; tip?: string }) {
  return (
    <Tooltip content={tip ?? label}>
      {/* Estil discret comú (`segmented.ts`): la rajola activa, amb fons clar i la icona de color. */}
      <IconButton {...segItem(on)} size="sm" w="full" borderWidth="1px" borderColor={on ? "wood.solid/40" : "border"} aria-pressed={on} aria-label={label} onClick={onClick}>
        {icon}
      </IconButton>
    </Tooltip>
  )
}

/**
 * «Opcions de vista» d'un visor (com a l'editor): botó a la cantonada de dalt a la dreta que obre
 * un panell amb les accions ràpides (rajoles) i, a sota, la resta d'opcions. `lead`: un grup de
 * rajoles a part, a sobre (p. ex. el mode de vista de l'editor).
 */
export function ViewOptions({ tiles, lead, children }: { tiles: ReactNode; lead?: ReactNode; children?: ReactNode }) {
  const n = Math.max(1, countTiles(tiles))
  const rows = Math.ceil(n / 5)
  const cols = Math.ceil(n / rows)
  // Sense SSR: el valor de debò ja al primer render (si no, a l'ordinador sortia un instant el calaix). El tipus
  // encara admet `undefined`.
  const mobile = useBreakpointValue({ base: true, md: false }, { ssr: false }) ?? false
  // El títol és el nom accessible del calaix (`Drawer.Title`), amb el mateix aspecte.
  const body = (title: ReactNode) => (
    <Stack gap={3}>
      {title}
      {lead}
      {/* Files iguals (cap rajola sola a l'última fila): 6 → 3 + 3, 7 → 4 + 3, 8 → 4 + 4. */}
      <SimpleGrid columns={cols} gap={1.5}>
        {tiles}
      </SimpleGrid>
      {children}
    </Stack>
  )
  const trigger = (
    <IconButton aria-label="Opcions de vista" title="Opcions de vista" size="sm" variant="surface" colorPalette="wood">
      <LuSlidersVertical />
    </IconButton>
  )
  // Al mòbil, un calaix de baix (com a l'editor de mobles); a l'ordinador, un popover.
  if (mobile)
    return (
      <Drawer.Root placement="bottom">
        <Drawer.Trigger asChild>{trigger}</Drawer.Trigger>
        <Portal>
          <Drawer.Backdrop />
          <Drawer.Positioner>
            <Drawer.Content roundedTop="l3" maxH="75dvh" pb="env(safe-area-inset-bottom, 0px)">
              {/* Desplaçament propi (el de la pàgina no es mou). */}
              <Drawer.Body py={4} overflowY="auto">
                {body(
                  <Drawer.Title asChild>
                    <SectionLabel as="h2">Opcions de vista</SectionLabel>
                  </Drawer.Title>,
                )}
              </Drawer.Body>
              <Drawer.CloseTrigger asChild>
                <CloseButton size="sm" aria-label="Tancar" />
              </Drawer.CloseTrigger>
            </Drawer.Content>
          </Drawer.Positioner>
        </Portal>
      </Drawer.Root>
    )
  return (
    <Popover.Root positioning={{ placement: "bottom-end" }}>
      <Popover.Trigger asChild>{trigger}</Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content w="300px" aria-label="Opcions de vista">
            <Popover.Body>{body(<SectionLabel>Opcions de vista</SectionLabel>)}</Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}

/** Quantes rajoles hi ha (dins dels fragments, sense les que no es mostren). */
function countTiles(node: ReactNode): number {
  let n = 0
  Children.forEach(node, (c) => {
    if (isValidElement<{ children?: ReactNode }>(c) && c.type === Fragment) n += countTiles(c.props.children)
    else if (c !== null && c !== undefined && c !== false && c !== true && c !== "") n++
  })
  return n
}
