import { Box, Card, HStack, Stack, Text } from "@chakra-ui/react"

export function ExportCard({
  icon,
  title,
  description,
  files,
  action,
  highlight,
  children,
}: {
  icon: React.ReactNode
  title: string
  description: string
  files?: string
  action: React.ReactNode
  highlight?: boolean
  children?: React.ReactNode
}) {
  return (
    <Card.Root variant="outline" bg={highlight ? "wood.subtle" : undefined}>
      <Card.Body gap={3}>
        <Stack direction={{ base: "column", md: "row" }} gap={4} justify="space-between" align={{ base: "stretch", md: "center" }}>
          <Stack gap={1} flex={1} minW={0}>
            <HStack color="wood.fg" fontSize="lg" gap={2}>
              {icon}
              <Text fontWeight="semibold" fontSize="md" color="fg">
                {title}
              </Text>
            </HStack>
            <Text fontSize="sm" color="fg.muted">
              {description}
            </Text>
            {files && (
              <Text fontSize="xs" color="fg.subtle" fontFamily="mono">
                {files}
              </Text>
            )}
          </Stack>
          <Box flexShrink={0}>{action}</Box>
        </Stack>
        {children}
      </Card.Body>
    </Card.Root>
  )
}
