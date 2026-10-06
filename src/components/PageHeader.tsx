import { Heading, HStack, Stack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"

/**
 * Capçalera de les pàgines d'inici (Mobles · Ambients · Objectes · Preferències): títol gran (com el títol gran
 * d'iOS) i l'explicació. Les galeries posen el botó principal al costat del cercador (`SearchBar`), no aquí;
 * `actions` (opcional) va a sota del títol.
 */
export function PageHeader({ title, description, actions }: { title: string; description: ReactNode; actions?: ReactNode }) {
  return (
    <Stack gap={3}>
      <Heading size="xl">{title}</Heading>
      {actions && (
        <HStack gap={2} wrap="wrap">
          {actions}
        </HStack>
      )}
      <Text fontSize="sm" color="fg.muted" maxW="640px">
        {description}
      </Text>
    </Stack>
  )
}
