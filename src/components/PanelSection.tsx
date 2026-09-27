import { Box, HStack, Heading, Stack } from "@chakra-ui/react"
import { createContext, useContext, useEffect, useId, useState, type ReactNode } from "react"
import type { IconType } from "react-icons"
import { LuChevronDown } from "react-icons/lu"

/**
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
      const v = localStorage.getItem(storageKey)
      return v === null ? defaultOpen : v === "" ? null : v
    } catch {
      return defaultOpen
    }
  })
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, openId ?? "")
    } catch {
      /* sense localStorage: només en memòria */
    }
  }, [storageKey, openId])
  return <GroupContext.Provider value={{ openId, setOpenId }}>{children}</GroupContext.Provider>
}

/** Obre una secció des de fora (p. ex. en triar la pestanya Foto). */
export function usePanelGroup() {
  return useContext(GroupContext)
}

/**
 * Sense animació d'alçada: el contingut es munta en obrir. (El Collapsible de Chakra
 * mesura l'alçada en obrir i, si el contingut arriba després, p. ex. per un portal,
 * es queda a 0.)
 */
export function PanelSection({ title, id, icon: Icon, children }: { title: string; id: string; icon?: IconType; children: ReactNode }) {
  const group = useContext(GroupContext)
  const [localOpen, setLocalOpen] = useState(true) // fora d'un grup: independent
  const contentId = useId()
  const isOpen = group ? group.openId === id : localOpen
  const toggle = () => {
    if (group) group.setOpenId(isOpen ? null : id)
    else setLocalOpen(!isOpen)
  }
  return (
    <Box borderBottomWidth="1px">
      <HStack asChild w="full" justify="space-between" py={3} cursor="pointer" color={isOpen ? "fg" : "fg.muted"} _hover={{ color: "fg" }}>
        <button type="button" aria-expanded={isOpen} aria-controls={contentId} onClick={toggle}>
          <HStack gap={2.5}>
            {Icon && (
              <Box color={isOpen ? "wood.fg" : "fg.muted"} fontSize="md">
                <Icon />
              </Box>
            )}
            <Heading size="sm">{title}</Heading>
          </HStack>
          <Box transform={isOpen ? "rotate(180deg)" : undefined} transition="transform 0.2s">
            <LuChevronDown />
          </Box>
        </button>
      </HStack>
      {isOpen && (
        <Stack id={contentId} gap={4} pb={4}>
          {children}
        </Stack>
      )}
    </Box>
  )
}
