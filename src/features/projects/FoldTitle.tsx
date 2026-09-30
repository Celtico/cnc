import { Badge, Box, HStack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"

/** Títol d'un acordió de les galeries: icona, nom i el nombre d'elements. */
export function FoldTitle({ icon, title, count }: { icon?: ReactNode; title: string; count: number }) {
  return (
    <HStack flex={1} gap={2} minW={0}>
      {icon && (
        <Box color="wood.fg" display="inline-flex">
          {icon}
        </Box>
      )}
      <Text fontWeight="semibold" fontSize="sm" truncate>
        {title}
      </Text>
      <Badge size="xs" variant="subtle" colorPalette="gray">
        {count}
      </Badge>
    </HStack>
  )
}
