import { Button, HStack, Text } from "@chakra-ui/react"
import { LuChevronLeft } from "react-icons/lu"

/**
 * Mòbil: les pàgines d'inici porten el seu títol gran (com iOS); aquí només hi ha barra quan cal
 * tornar enrere (Preferències obertes des d'un moble).
 */
export function SettingsBackBar({ label, onBack }: { label: string; onBack: () => void }) {
  return (
    <HStack
      display={{ base: "flex", md: "none" }}
      as="header"
      px={2}
      pt="env(safe-area-inset-top, 0px)"
      h="calc(52px + env(safe-area-inset-top, 0px))"
      borderBottomWidth="1px"
      bg="bg.panel"
      position="sticky"
      top={0}
      zIndex="sticky"
    >
      <Button variant="ghost" size="sm" onClick={onBack} maxW="80%">
        <LuChevronLeft /> <Text truncate>{label}</Text>
      </Button>
    </HStack>
  )
}
