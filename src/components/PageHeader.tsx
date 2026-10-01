import { Heading, HStack, Stack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"

/**
 * Capçalera de les pàgines d'inici (Ambients · Objectes · Mobles): títol gran, l'explicació i les accions.
 * A l'ordinador les accions van a la dreta del títol; al mòbil, a sota del títol (com iOS, on el títol
 * gran ocupa tota l'amplada).
 */
export function PageHeader({ title, description, actions }: { title: string; description: ReactNode; actions: ReactNode }) {
  return (
    <Stack gap={3}>
      <Stack direction={{ base: "column", md: "row" }} justify="space-between" align={{ base: "stretch", md: "center" }} gap={3}>
        <Heading size="xl">{title}</Heading>
        <HStack gap={2} wrap="wrap">
          {actions}
        </HStack>
      </Stack>
      <Text fontSize="sm" color="fg.muted" maxW="640px">
        {description}
      </Text>
    </Stack>
  )
}
