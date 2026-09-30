import { Box, HStack, Stack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"

/**
 * Grup d'opcions d'una pàgina de Preferències (com els grups de «Configuració» de macOS o de
 * Figma): targeta sempre oberta amb icona, títol, una línia d'explicació i les accions a la dreta.
 * Res s'obre ni es plega: tot el que hi ha a la pàgina es veu d'una ullada.
 */
export function SettingsGroup({ icon, title, summary, actions, children }: { icon?: ReactNode; title: ReactNode; summary?: ReactNode; actions?: ReactNode; children: ReactNode }) {
  return (
    <Box borderWidth="1px" rounded="lg" bg="bg.panel">
      {/* Icones alineades a dalt (amb la primera línia del títol) i el doble de marge. */}
      <HStack gap={2.5} px={6} pt={4} pb={3.5} borderBottomWidth="1px" bg="bg.subtle" roundedTop="lg" align="flex-start">
        {icon && (
          <Box color="wood.fg" flexShrink={0} display="inline-flex" mt="3px">
            {icon}
          </Box>
        )}
        <Stack gap={0} minW={0} flex={1}>
          <Text as="div" fontWeight="semibold" fontSize="sm" truncate>
            {title}
          </Text>
          {summary && (
            <Text as="div" fontSize="xs" color="fg.muted" truncate>
              {summary}
            </Text>
          )}
        </Stack>
        {actions && (
          <HStack gap={0} flexShrink={0}>
            {actions}
          </HStack>
        )}
      </HStack>
      <Stack gap={4} px={6} py={5}>
        {children}
      </Stack>
    </Box>
  )
}
