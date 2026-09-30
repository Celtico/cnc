import { Box, HStack, Text, Wrap } from "@chakra-ui/react"
import type { Panel } from "../../core/model"
import { ROLE_GROUPS } from "./roleColorMap"

/** Llegenda amb només les famílies que hi ha al moble. */
export function RoleLegend({ panels }: { panels: Panel[] }) {
  const present = new Set(panels.map((p) => p.role))
  const groups = ROLE_GROUPS.filter((g) => g.roles.some((r) => present.has(r)))
  if (!groups.length) return null
  return (
    <Wrap gap={1} maxW="280px" bg="bg.panel/85" backdropFilter="blur(6px)" borderWidth="1px" borderRadius="md" px={2} py={1.5} pointerEvents="none">
      {groups.map((g) => (
        <HStack key={g.label} gap={1}>
          <Box w="10px" h="10px" borderRadius="2px" bg={g.color} borderWidth="1px" borderColor="blackAlpha.300" />
          <Text fontSize="2xs" color="fg.muted" whiteSpace="nowrap">
            {g.label}
          </Text>
        </HStack>
      ))}
    </Wrap>
  )
}
