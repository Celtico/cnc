import { Box, HStack, Stack, Text } from "@chakra-ui/react"
import { MOBILE_BAR, type Section } from "./nav"

/** Navegació inferior (mòbil) */
export function MobileNav({ section, assistantOpen, onSection, onAssistant }: { section: Section; assistantOpen: boolean; onSection: (id: string) => void; onAssistant: () => void }) {
  return (
    <HStack
      className="bottom-nav"
      display={{ base: "flex", md: "none" }}
      as="nav"
      position="fixed"
      bottom={0}
      left={0}
      right={0}
      zIndex="sticky"
      bg="bg.panel"
      borderTopWidth="1px"
      pb="env(safe-area-inset-bottom, 0px)"
      justify="space-around"
    >
      {/* Sempre el menú general (com les apps de l'iPhone): les pàgines del moble són a dalt. */}
      {MOBILE_BAR.map((n) => {
        const disabled = false
        const active = n.id === "assistant" ? assistantOpen : section === n.id
        return (
          <Box
            key={n.id}
            asChild
            flex={1}
            py={2}
            color={active ? "wood.fg" : disabled ? "fg.subtle" : "fg.muted"}
            opacity={disabled ? 0.5 : 1}
          >
            <button disabled={disabled} onClick={() => (n.id === "assistant" ? onAssistant() : onSection(n.id))} aria-current={active && n.id !== "assistant" ? "page" : undefined}>
              <Stack align="center" gap={0.5}>
                {/* Com la barra de pestanyes d'iOS: icona de ~25 i nom petit (10–11). */}
                <Box fontSize="2xl">
                  <n.icon />
                </Box>
                <Text fontSize="2xs" fontWeight={active ? "semibold" : "medium"}>
                  {n.label}
                </Text>
              </Stack>
            </button>
          </Box>
        )
      })}
    </HStack>
  )
}
