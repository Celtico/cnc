import { Box, HStack, Stack, Text } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import { LuChevronDown, LuChevronRight } from "react-icons/lu"

/**
 * Acordió de segon nivell (dins d'una secció): fila plegable amb fletxa, icona, títol, un
 * resum quan està plegada i accions a la dreta. Comença plegada.
 */
export function SubFold({
  icon,
  title,
  summary,
  actions,
  defaultOpen = false,
  children,
}: {
  icon?: ReactNode
  title: ReactNode
  summary?: ReactNode
  actions?: ReactNode
  defaultOpen?: boolean
  children: ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <Box borderWidth="1px" rounded="md" bg={open ? undefined : "bg.subtle"}>
      <HStack gap={1} pl={2} pr={1} py={1.5}>
        <HStack as="button" flex={1} minW={0} gap={2} textAlign="left" cursor="pointer" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
          <Box color="fg.muted" flexShrink={0}>
            {open ? <LuChevronDown /> : <LuChevronRight />}
          </Box>
          {icon && (
            <Box color="wood.fg" flexShrink={0} display="inline-flex">
              {icon}
            </Box>
          )}
          <Stack gap={0} minW={0}>
            <Text as="div" fontWeight="semibold" fontSize="sm" truncate>
              {title}
            </Text>
            {!open && summary && (
              <Text as="div" fontSize="xs" color="fg.muted" truncate>
                {summary}
              </Text>
            )}
          </Stack>
        </HStack>
        {actions && (
          <HStack gap={0} flexShrink={0}>
            {actions}
          </HStack>
        )}
      </HStack>
      {open && (
        <Stack gap={3} px={3} pb={3} pt={1}>
          {children}
        </Stack>
      )}
    </Box>
  )
}
