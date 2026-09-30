import { Box, Editable, HStack, IconButton } from "@chakra-ui/react"
import { createContext, useContext, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { LuChevronLeft, LuChevronRight, LuSettings } from "react-icons/lu"
import { renameProject } from "../db/db"
import { useProject } from "../features/useProject"

/**
 * Barra superior del moble obert, com a les apps professionals (Figma, Onshape, Notion):
 * «Mobles › Nom del moble» a l'esquerra (el nom s'edita amb un clic) i les accions del
 * document a la dreta. Cada pàgina hi pot posar les seves accions amb <TopBarActions>.
 */
const ActionsTarget = createContext<HTMLElement | null>(null)
export function TopBarActionsProvider({ value, children }: { value: HTMLElement | null; children: ReactNode }) {
  return <ActionsTarget.Provider value={value}>{children}</ActionsTarget.Provider>
}

/** Pinta els fills a la dreta de la barra superior (p. ex. desfer/refer de l'Editor). */
export function TopBarActions({ children }: { children: ReactNode }) {
  const target = useContext(ActionsTarget)
  return target ? createPortal(children, target) : null
}

export function TopBar({
  projectId,
  onBack,
  onSettings,
  actionsRef,
  menu,
  rootLabel = "Mobles",
}: {
  /** On torna la molla de pa («Mobles» o «Objectes»). */
  rootLabel?: string
  projectId: number
  onBack: () => void
  onSettings: () => void
  actionsRef: (el: HTMLDivElement | null) => void
  /** Menú ⋯ del document (desar com a fitxer, com a plantilla...). */
  menu?: ReactNode
}) {
  const project = useProject(projectId)
  const name = project?.name ?? ""
  return (
    <HStack
      as="header"
      px={{ base: 2, md: 4 }}
      pt="env(safe-area-inset-top, 0px)"
      h={{ base: "calc(52px + env(safe-area-inset-top, 0px))", md: "48px" }}
      borderBottomWidth="1px"
      bg="bg.panel"
      position="sticky"
      top={0}
      zIndex={3}
      justify="space-between"
      gap={2}
      flexShrink={0}
    >
      <HStack gap={1} minW={0} flex={1}>
        {/* Mòbil: fletxa enrere. Escriptori: molla de pa «Mobles ›». */}
        <IconButton display={{ base: "inline-flex", md: "none" }} aria-label={`Tornar a ${rootLabel}`} variant="ghost" size="sm" onClick={onBack}>
          <LuChevronLeft />
        </IconButton>
        <HStack display={{ base: "none", md: "flex" }} gap={1} flexShrink={0}>
          <Box
            asChild
            color="fg.muted"
            fontSize="sm"
            px={1.5}
            py={1}
            rounded="sm"
            cursor="pointer"
            _hover={{ color: "fg", bg: "bg.muted" }}
          >
            <button type="button" onClick={onBack}>
              {rootLabel}
            </button>
          </Box>
          <Box color="fg.subtle" aria-hidden>
            <LuChevronRight />
          </Box>
        </HStack>
        <Editable.Root
          key={name} // si es reanomena des d'un altre lloc, s'actualitza
          defaultValue={name}
          onValueCommit={(e) => {
            const v = e.value.trim()
            if (v && v !== name) void renameProject(projectId, v)
          }}
          fontSize="sm"
          fontWeight="semibold"
          minW={0}
          w="auto"
          maxW="100%"
          aria-label="Nom del moble"
        >
          <Editable.Preview title="Clica per canviar el nom del moble" truncate px={1.5} />
          <Editable.Input px={1.5} />
        </Editable.Root>
      </HStack>
      <HStack gap={1} flexShrink={0}>
        <HStack gap={1} ref={actionsRef} />
        {menu}
        <IconButton display={{ base: "inline-flex", md: "none" }} aria-label="Preferències" variant="ghost" size="sm" onClick={onSettings}>
          <LuSettings />
        </IconButton>
      </HStack>
    </HStack>
  )
}
