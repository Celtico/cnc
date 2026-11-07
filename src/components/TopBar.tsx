import { Box, Breadcrumb, Editable, HStack } from "@chakra-ui/react"
import { createContext, useContext, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { LuChevronLeft, LuChevronRight, LuSettings } from "react-icons/lu"
import { renameProject } from "../db/db"
import { useProject } from "../features/useProject"
import { IconAction } from "./IconAction"

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

/** Pestanyes que una pàgina posa al mig de la barra (les eines de Modelatge, `ModelingRibbon`). */
const TabsTarget = createContext<HTMLElement | null>(null)
export function TopBarTabsProvider({ value, children }: { value: HTMLElement | null; children: ReactNode }) {
  return <TabsTarget.Provider value={value}>{children}</TabsTarget.Provider>
}
export function TopBarTabs({ children }: { children: ReactNode }) {
  const target = useContext(TabsTarget)
  return target ? createPortal(children, target) : null
}

/** Barra del moble o l'objecte obert: el nom és el del projecte (i es reanomena a la base de dades). */
export function TopBar({ projectId, rootLabel = "Mobles", ...rest }: { projectId: number; rootLabel?: string } & Omit<DocBarProps, "name" | "onRename" | "rootLabel" | "nameLabel">) {
  const project = useProject(projectId)
  const name = project?.name ?? ""
  // Els objectes s'editen amb el mateix editor: «Nom de l'objecte» (la barra diu «Objectes › …»).
  return <DocBar {...rest} rootLabel={rootLabel} name={name} nameLabel={rootLabel === "Objectes" ? "Nom de l'objecte" : rootLabel === "Modelatge" ? "Nom del model" : "Nom del moble"} onRename={(v) => void renameProject(projectId, v)} />
}

interface DocBarProps {
  /** Pàgines del document (Editor · Peces · Nesting · Exportar), al mig de la barra a l'ordinador. */
  tabs?: ReactNode
  /** On torna la molla de pa («Mobles», «Objectes» o «Ambients»). */
  rootLabel: string
  name: string
  /** Nom accessible del camp del nom (p. ex. «Nom del moble»). */
  nameLabel: string
  onRename: (name: string) => void
  onBack: () => void
  onSettings: () => void
  actionsRef: (el: HTMLDivElement | null) => void
  /** Menú ⋯ del document (desar com a fitxer, com a plantilla...). */
  menu?: ReactNode
}

/**
 * Barra superior d'un document obert (moble, objecte o ambient), la mateixa a tot arreu: al mòbil
 * fletxa enrere, a l'ordinador la molla de pa «Apartat › Nom»; el nom s'edita amb un clic; les
 * accions de la pàgina (<TopBarActions>) i el menú ⋯ a la dreta.
 */
export function DocBar({ onBack, onSettings, actionsRef, menu, tabs, rootLabel, name, nameLabel, onRename }: DocBarProps) {
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
      zIndex="sticky"
      justify="space-between"
      gap={2}
      flexShrink={0}
    >
      <HStack gap={1} minW={0} flex={1}>
        {/* Mòbil: fletxa enrere. Escriptori: molla de pa «Mobles ›». */}
        <IconAction display={{ base: "inline-flex", md: "none" }} label={`Tornar a ${rootLabel}`} variant="ghost" size="sm" onClick={onBack}>
          <LuChevronLeft />
        </IconAction>
        {/* La molla de pa de Chakra: «Mobles ›» (només a l'ordinador) i el nom, que s'edita amb un clic. */}
        <Breadcrumb.Root aria-label="Ruta" minW={0} flex={1}>
          <Breadcrumb.List gap={1} flexWrap="nowrap" minW={0}>
            <Breadcrumb.Item display={{ base: "none", md: "inline-flex" }} flexShrink={0}>
              <Breadcrumb.Link asChild px={1.5} py={1} rounded="sm" _hover={{ color: "fg", bg: "bg.muted" }}>
                <button type="button" onClick={onBack}>
                  {rootLabel}
                </button>
              </Breadcrumb.Link>
            </Breadcrumb.Item>
            <Breadcrumb.Separator display={{ base: "none", md: "inline-flex" }} color="fg.subtle" opacity={1}>
              <LuChevronRight />
            </Breadcrumb.Separator>
            <Breadcrumb.Item minW={0} color="fg" aria-current="page">
              <Editable.Root
                key={name} // si es reanomena des d'un altre lloc, s'actualitza
                defaultValue={name}
                onValueCommit={(e) => {
                  const v = e.value.trim()
                  if (v && v !== name) onRename(v)
                }}
                fontSize="sm"
                fontWeight="semibold"
                minW={0}
                w="auto"
                maxW="100%"
                aria-label={nameLabel}
              >
                <Editable.Preview title="Clica per canviar el nom" truncate px={1.5} />
                <Editable.Input px={1.5} />
              </Editable.Root>
            </Breadcrumb.Item>
          </Breadcrumb.List>
        </Breadcrumb.Root>
      </HStack>
      {tabs && (
        <Box display={{ base: "none", md: "flex" }} flexShrink={0}>
          {tabs}
        </Box>
      )}
      <HStack gap={1} flexShrink={0} flex={tabs ? { md: 1 } : undefined} justify="flex-end">
        <HStack gap={1} ref={actionsRef} />
        {menu}
        <IconAction display={{ base: "inline-flex", md: "none" }} label="Preferències" variant="ghost" size="sm" onClick={onSettings}>
          <LuSettings />
        </IconAction>
      </HStack>
    </HStack>
  )
}
