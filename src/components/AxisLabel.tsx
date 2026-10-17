import { Box, HStack, Text } from "@chakra-ui/react"
import type { IconType } from "react-icons"

/** Rètol d'una direcció de moviment: icona + nom, i la lletra de l'eix en petit. */
/** Mateixos colors que les fletxes del 3D: vermell de costat, verd amunt, blau endavant. */
const AXIS_TINT: Record<string, string> = { X: "#e5484d", Y: "#30a46c", Z: "#0090ff" }

export function AxisLabel({ icon: Icon, name, axis, hint }: { icon: IconType; name: string; axis: string; hint: string }) {
  return (
    <HStack as="span" gap={1} title={`${name} (${axis}): ${hint}`}>
      <Box as="span" color={AXIS_TINT[axis]} display="inline-flex">
        <Icon />
      </Box>
      <span>{name}</span>
      <Text as="span" color="fg.subtle" fontSize="2xs">
        {axis}
      </Text>
    </HStack>
  )
}
