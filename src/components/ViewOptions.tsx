import { IconButton, Popover, Portal, SimpleGrid, Stack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuSlidersVertical } from "react-icons/lu"
import { Tooltip } from "./ui/tooltip"

/** Botó d'opció de vista (activa/inactiva) amb el nom al tooltip, el mateix a tots els visors. */
export function ViewTile({ label, icon, on, onClick, tip }: { label: string; icon: ReactNode; on: boolean; onClick: () => void; tip?: string }) {
  return (
    <Tooltip content={tip ?? label}>
      <IconButton size="sm" w="full" variant={on ? "solid" : "outline"} colorPalette={on ? "wood" : "gray"} aria-pressed={on} aria-label={label} onClick={onClick}>
        {icon}
      </IconButton>
    </Tooltip>
  )
}

/**
 * «Opcions de vista» d'un visor (com a l'editor): botó a la cantonada de dalt a la dreta que obre
 * un panell amb les accions ràpides (rajoles) i, a sota, la resta d'opcions.
 */
export function ViewOptions({ tiles, children }: { tiles: ReactNode; children?: ReactNode }) {
  return (
    <Popover.Root positioning={{ placement: "bottom-end" }}>
      <Popover.Trigger asChild>
        <IconButton aria-label="Opcions de vista" title="Opcions de vista" size="sm" variant="surface" colorPalette="wood">
          <LuSlidersVertical />
        </IconButton>
      </Popover.Trigger>
      <Portal>
        <Popover.Positioner>
          <Popover.Content w="300px">
            <Popover.Body>
              <Stack gap={3}>
                <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
                  Opcions de vista
                </Text>
                <SimpleGrid columns={5} gap={1.5}>
                  {tiles}
                </SimpleGrid>
                {children}
              </Stack>
            </Popover.Body>
          </Popover.Content>
        </Popover.Positioner>
      </Portal>
    </Popover.Root>
  )
}
