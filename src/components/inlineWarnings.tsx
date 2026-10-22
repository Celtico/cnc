import { HStack, Stack, Text } from "@chakra-ui/react"
import { type InlineWarning } from "./inlineWarningsContext"
import { LuInfo, LuTriangleAlert } from "react-icons/lu"

/** Els avisos, un per línia (taronja els que cal arreglar; gris els que només informen). */
export function InlineWarningList({ items }: { items: InlineWarning[] }) {
  if (!items.length) return null
  return (
    <Stack gap={1}>
      {items.map((w, i) => (
        <HStack key={i} gap={1.5} align="start" fontSize="xs" color={w.info ? "fg.muted" : "orange.fg"}>
          <Text as="span" pt="2px" flexShrink={0}>
            {w.info ? <LuInfo /> : <LuTriangleAlert />}
          </Text>
          <Text as="span">{w.message}</Text>
        </HStack>
      ))}
    </Stack>
  )
}
