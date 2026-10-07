import { Badge, Box, Button, CloseButton, Drawer, HStack, Portal, Stack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuTriangleAlert } from "react-icons/lu"
import { SearchBar } from "./SearchBar"

/**
 * **Selector amb calaix**, el mateix a tota l'app (materials, ferratges): un botó (`PickerButton`: la mostra i el nom, a
 * tota l'amplada, sense fons ni fletxa: no ha de semblar un desplegable) que obre un calaix (`PickerDrawer`: a la dreta a
 * l'ordinador, de baix al mòbil) amb el cercador a dalt i, a sota, el que hi posa cada selector (acordions per
 * categoria amb les mostres o les targetes). En tocar-ne una es tria i es tanca (ho fa qui el fa servir).
 */
export function PickerDrawer({
  open,
  onOpenChange,
  title,
  query,
  onQuery,
  placeholder,
  size = "sm",
  testId,
  children,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  query: string
  onQuery: (q: string) => void
  /** El text del cercador («Buscar un material»). */
  placeholder: string
  /** Amplada a l'ordinador (les targetes dels ferratges, `md`). */
  size?: "sm" | "md"
  testId?: string
  children: ReactNode
}) {
  return (
    <Drawer.Root open={open} onOpenChange={(e) => onOpenChange(e.open)} placement={{ base: "bottom", md: "end" }} size={{ base: "full", md: size }}>
      <Portal>
        <Drawer.Backdrop />
        <Drawer.Positioner>
          <Drawer.Content roundedTop={{ base: "l3", md: "none" }} maxH={{ base: "85dvh", md: "none" }} pb="env(safe-area-inset-bottom, 0px)" data-testid={testId}>
            <Drawer.Header pt={{ base: 4, md: "calc(var(--chakra-spacing-4) + env(safe-area-inset-top, 0px))" }}>
              <Drawer.Title>{title}</Drawer.Title>
            </Drawer.Header>
            <Drawer.Body>
              <Stack gap={3}>
                <SearchBar value={query} onChange={onQuery} placeholder={placeholder} ariaLabel={placeholder} maxW="none" />
                {children}
              </Stack>
            </Drawer.Body>
            {/* Al mòbil és un full de baix: la zona segura de dalt no hi toca (només a la columna de la dreta, a l'iPad). */}
            <Drawer.CloseTrigger asChild top={{ base: 3, md: "calc(var(--chakra-spacing-3) + env(safe-area-inset-top, 0px))" }}>
              <CloseButton size="sm" aria-label="Tancar" />
            </Drawer.CloseTrigger>
          </Drawer.Content>
        </Drawer.Positioner>
      </Portal>
    </Drawer.Root>
  )
}

/**
 * El botó dels selectors amb calaix: la mostra (`swatch`), el nom i, si el valor actual no és dels que es poden triar
 * aquí (`warn`), ⚠ i la nota a sota.
 */
export function PickerButton({ ariaLabel, swatch, text, warn, onClick }: { ariaLabel: string; swatch: ReactNode; text: string; warn?: string; onClick: () => void }) {
  return (
    <>
      <Button size="sm" variant="ghost" w="full" justifyContent="flex-start" gap={2} px={2} fontWeight="normal" aria-label={ariaLabel} onClick={onClick}>
        {swatch}
        <Text truncate textAlign="start">
          {text}
        </Text>
        {warn && (
          <Box as="span" color="orange.fg" flexShrink={0} ml="auto" display="inline-flex" title={warn}>
            <LuTriangleAlert />
          </Box>
        )}
      </Button>
      {warn && (
        <Badge size="xs" colorPalette="orange" variant="subtle" alignSelf="flex-start" mt={1} whiteSpace="normal">
          {warn}
        </Badge>
      )}
    </>
  )
}

/** Una fila d'opció sense mostra a dalt del calaix («Com el cos», «Com el mòdul», «Genèriques»). */
export function PickerRow({ on, onClick, children, testId }: { on: boolean; onClick: () => void; children: ReactNode; testId?: string }) {
  return (
    <Box asChild p={1.5} rounded="md" borderWidth="2px" borderColor={on ? "wood.solid" : "transparent"} bg={on ? "wood.subtle" : undefined} _hover={{ bg: "bg.muted" }}>
      <button type="button" onClick={onClick} aria-pressed={on} data-testid={testId}>
        <HStack gap={3}>{children}</HStack>
      </button>
    </Box>
  )
}
