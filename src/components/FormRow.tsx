import { Box, Button, Grid, HStack, Stack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"

/**
 * Fila de formulari, la mateixa a tota l'app (com la Configuració de macOS o l'inspector de Figma):
 * l'etiqueta a l'esquerra, el control i l'ajuda a la dreta. S'adapta a l'amplada **del lloc on
 * és** (consulta de contenidor, no de pantalla): en un panell estret o al mòbil, l'etiqueta va a
 * sobre. `maxW` limita l'amplada del control (els números no s'estiren fins a la vora).
 */
export function FormRow({ label, help, maxW, children }: { label: ReactNode; help?: ReactNode; maxW?: string; children: ReactNode }) {
  return (
    <Box css={{ containerType: "inline-size" }} minW={0}>
      <Grid
        templateColumns="1fr"
        columnGap={4}
        rowGap={1.5}
        alignItems="start"
        css={{
          "@container (min-width: 300px)": {
            gridTemplateColumns: "min(150px, 36%) minmax(0, 1fr)",
            "& > .form-row-label": { paddingTop: "7px" },
          },
        }}
      >
        <Text as="div" className="form-row-label" fontSize="sm" color="fg.muted">
          {label}
        </Text>
        <Stack gap={1} minW={0}>
          <Box maxW={maxW} minW={0}>
            {children}
          </Box>
          {help && (
            <Text as="div" fontSize="xs" color="fg.subtle">
              {help}
            </Text>
          )}
        </Stack>
      </Grid>
    </Box>
  )
}

/** Secció d'una targeta amb files (títol petit en majúscules i una línia a dalt). */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack gap={3.5} px={{ base: 4, sm: 6 }} py={5} borderTopWidth="1px">
      <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
        {title}
      </Text>
      {children}
    </Stack>
  )
}

/**
 * Tria d'una opció amb pastilles que salten de línia (no es desborden com un control segmentat
 * quan hi ha moltes opcions o la pantalla és estreta).
 */
export function ChoiceChips<T extends string>({ label, options, value, onChange }: { label: string; options: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return (
    <HStack gap={1.5} wrap="wrap" role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.id === value
        return (
          <Button key={o.id} size="sm" rounded="full" role="radio" aria-checked={on} variant={on ? "solid" : "outline"} colorPalette={on ? "wood" : "gray"} onClick={() => onChange(o.id)}>
            {o.label}
          </Button>
        )
      })}
    </HStack>
  )
}
