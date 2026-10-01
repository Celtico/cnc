import { Heading, HStack, Stack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"

/**
 * Capçalera de les pàgines d'inici (Ambients · Objectes · Mobles): títol gran, les accions **a sota del
 * títol** (a l'ordinador i al mòbil igual, com el títol gran d'iOS) i l'explicació.
 */
export function PageHeader({ title, description, actions }: { title: string; description: ReactNode; actions: ReactNode }) {
  return (
    <Stack gap={3}>
      <Heading size="xl">{title}</Heading>
      <HStack gap={2} wrap="wrap">
        {actions}
      </HStack>
      <Text fontSize="sm" color="fg.muted" maxW="640px">
        {description}
      </Text>
    </Stack>
  )
}
