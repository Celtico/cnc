import { Badge, Box, HStack, Heading, Stack } from "@chakra-ui/react"
import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react"
import type { IconType } from "react-icons"
import { LuChevronDown } from "react-icons/lu"

/**
 * Seccions plegables. Dins d'un `PanelGroup` (Preferències) fan d'acordió: només una
 * oberta alhora. Fora d'un grup (l'inspector de l'editor) són independents. Totes comencen
 * tancades en obrir l'app; l'estat es recorda només mentre dura la sessió (sessionStorage).
 *
 * Acordió del panell esquerre: només una secció oberta alhora. En obrir-ne una es
 * tanquen les altres. La secció oberta es recorda (preferència de vista).
 */
interface Group {
  openId: string | null
  setOpenId: (id: string | null) => void
}
const GroupContext = createContext<Group | null>(null)

export function PanelGroup({ storageKey, defaultOpen, children }: { storageKey: string; defaultOpen: string; children: ReactNode }) {
  const [openId, setOpenId] = useState<string | null>(() => {
    try {
      const v = sessionStorage.getItem(storageKey)
      return v === null ? defaultOpen : v === "" ? null : v
    } catch {
      return defaultOpen
    }
  })
  useEffect(() => {
    try {
      sessionStorage.setItem(storageKey, openId ?? "")
    } catch {
      /* sense sessionStorage: només en memòria */
    }
  }, [storageKey, openId])
  return <GroupContext.Provider value={{ openId, setOpenId }}>{children}</GroupContext.Provider>
}

/**
 * Sense animació d'alçada: el contingut es munta en obrir. (El Collapsible de Chakra
 * mesura l'alçada en obrir i, si el contingut arriba després, p. ex. per un portal,
 * es queda a 0.)
 */
export function PanelSection({
  title,
  id,
  icon: Icon,
  defaultOpen = false,
  actions,
  badge,
  badgePalette = "wood",
  children,
}: {
  title: string
  id: string
  icon?: IconType
  /** Fora d'un grup: si comença oberta (per defecte, tancada; després es recorda el que triï l'usuari durant la sessió). */
  defaultOpen?: boolean
  /** Botons a la dreta del títol (p. ex. «Afegir»). No pleguen la secció. */
  actions?: ReactNode
  /** Resum curt al costat del títol, en una insígnia (p. ex. el nombre de prestatges). */
  badge?: ReactNode
  /** Color de la insígnia (per defecte el color principal; `orange` per a avisos). */
  badgePalette?: string
  children: ReactNode
}) {
  const group = useContext(GroupContext)
  // Fora d'un grup: secció independent (com els inspectors de Figma o Fusion); cada una
  // recorda si és oberta o tancada.
  const key = `mobles:section:${id}`
  const [localOpen, setLocalOpen] = useState(() => {
    try {
      const v = sessionStorage.getItem(key)
      return v === null ? defaultOpen : v === "1"
    } catch {
      return defaultOpen
    }
  })
  const contentId = useId()
  const isOpen = group ? group.openId === id : localOpen
  const toggle = () => {
    if (group) group.setOpenId(isOpen ? null : id)
    else {
      setLocalOpen(!isOpen)
      try {
        sessionStorage.setItem(key, isOpen ? "0" : "1")
      } catch {
        /* només en memòria */
      }
    }
  }
  return (
    <Box borderBottomWidth="1px">
      <HStack gap={1}>
      <HStack asChild flex={1} minW={0} justify="space-between" py={3} cursor="pointer" color={isOpen ? "fg" : "fg.muted"} _hover={{ color: "fg" }}>
        <button type="button" aria-expanded={isOpen} aria-controls={contentId} onClick={toggle}>
          <HStack gap={2.5} minW={0}>
            {Icon && (
              <Box color={isOpen ? "wood.fg" : "fg.muted"} fontSize="md">
                <Icon />
              </Box>
            )}
            <Heading size="sm" truncate>
              {title}
            </Heading>
            {badge !== undefined && badge !== null && badge !== "" && (
              <Badge size="sm" variant="subtle" colorPalette={badgePalette} flexShrink={0}>
                {badge}
              </Badge>
            )}
          </HStack>
          <Box transform={isOpen ? "rotate(180deg)" : undefined} transition="transform 0.2s">
            <LuChevronDown />
          </Box>
        </button>
      </HStack>
      {actions}
      </HStack>
      {isOpen && (
        <Stack id={contentId} gap={4} pb={4}>
          {children}
        </Stack>
      )}
    </Box>
  )
}
