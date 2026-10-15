import { Badge, Box, Button, HStack, Stack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuTriangleAlert } from "react-icons/lu"
import { FloatingWindow } from "./FloatingWindow"
import { SearchBar } from "./SearchBar"

/**
 * **Selector amb finestra de tria**, el mateix a tota l'app (materials, ferratges): un botó (`PickerButton`: la mostra i el
 * nom, a tota l'amplada, sense fons ni fletxa: no ha de semblar un desplegable) que obre una finestra (`PickerWindow`, una
 * `FloatingWindow` de tipus `picker`: estreta i alta a la dreta a l'ordinador, a tota la pantalla al mòbil) amb el cercador a
 * dalt (amb el focus) i, a sota, el que hi posa cada selector (acordions per categoria amb les mostres o les targetes). En
 * tocar-ne una es tria i es tanca (ho fa qui el fa servir). No és modal: l'app de darrere es pot fer servir mentre és
 * oberta; la finestra és del camp que l'ha obert (si el camp desapareix, es tanca; a l'editor, també si canvia la selecció).
 */
export function PickerWindow({
  id,
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
  /** La mida i el lloc es recorden per tipus de tria («material», «hardware»). */
  id: string
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
    <FloatingWindow id={`picker:${id}`} kind="picker" width={size === "md" ? 480 : 380} open={open} onClose={() => onOpenChange(false)} title={title} testId={testId} bodyProps={{ overflowX: "hidden" }}>
      <Stack gap={3}>
        <SearchBar value={query} onChange={onQuery} placeholder={placeholder} ariaLabel={placeholder} maxW="none" />
        {children}
      </Stack>
    </FloatingWindow>
  )
}

/**
 * El botó dels selectors amb finestra de tria: la mostra (`swatch`), el nom i, si el valor actual no és dels que es poden triar
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

/** Una fila d'opció sense mostra a dalt de la finestra de tria («Com el cos», «Com el mòdul», «Genèriques»). */
export function PickerRow({ on, onClick, children, testId }: { on: boolean; onClick: () => void; children: ReactNode; testId?: string }) {
  return (
    // A tota l'amplada i sense desbordar: el text llarg salta de línia dins la fila (mai surt de la finestra).
    <Box asChild w="full" minW={0} p={1.5} rounded="md" borderWidth="2px" borderColor={on ? "wood.solid" : "transparent"} bg={on ? "wood.subtle" : undefined} _hover={{ bg: "bg.muted" }} textAlign="start" whiteSpace="normal" overflowWrap="anywhere">
      <button type="button" onClick={onClick} aria-pressed={on} data-testid={testId}>
        <HStack gap={3} w="full" minW={0}>
          {children}
        </HStack>
      </button>
    </Box>
  )
}
