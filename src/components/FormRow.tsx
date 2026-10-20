import { Box, Button, Grid, HStack, Stack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { segGroup, segItem } from "./segmented"
import { SectionLabel } from "./SectionLabel"
import { InlineWarningList, useOptionWarnings } from "./inlineWarnings"

/**
 * Fila de formulari, la mateixa a tota l'app (com la Configuració de macOS o l'inspector de Figma):
 * l'etiqueta a l'esquerra, el control i l'ajuda a la dreta. S'adapta a l'amplada **del lloc on
 * és** (consulta de contenidor, no de pantalla): en un panell estret o al mòbil, l'etiqueta va a
 * sobre. `maxW` limita l'amplada del control (els números no s'estiren fins a la vora). A l'Editor, `optionId` és l'id
 * de la fila al registre de les opcions en cascada (`core/model/options`): marca la fila (`data-option`) i hi posa a sota
 * els avisos d'aquesta opció (`useOptionWarnings`).
 */
export function FormRow({ label, help, maxW, optionId, children }: { label: ReactNode; help?: ReactNode; maxW?: string; optionId?: string; children: ReactNode }) {
  const warnings = useOptionWarnings(optionId)
  return (
    <Box className="form-row" css={{ containerType: "inline-size" }} minW={0} data-option={optionId}>
      <Grid
        templateColumns="1fr"
        columnGap={4}
        rowGap={1.5}
        alignItems="start"
        css={{
          "@container (min-width: 300px)": {
            gridTemplateColumns: "min(150px, 36%) minmax(0, 1fr)",
            // Centrada amb un control d'una línia (36 px a l'ordinador, 44 a les pantalles tàctils: `layout.css`).
            "& > .form-row-label": { paddingTop: "var(--form-row-label-pt, 7px)" },
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
          <InlineWarningList items={warnings} />
        </Stack>
      </Grid>
    </Box>
  )
}

/** Secció d'una targeta amb files (títol petit en majúscules i una línia a dalt). */
export function FormSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack className="form-section" gap={3.5} px={{ base: 4, sm: 6 }} py={5} borderTopWidth="1px">
      <SectionLabel>
        {title}
      </SectionLabel>
      {children}
    </Stack>
  )
}

/**
 * Tria d'una opció amb pastilles que salten de línia (no es desborden com un control segmentat
 * quan hi ha moltes opcions o la pantalla és estreta).
 */
export function ChoiceChips<T extends string>({ label, options, value, onChange, retap = false }: { label: string; options: { id: T; label: ReactNode; disabled?: boolean }[]; value: T; onChange: (v: T) => void; retap?: boolean }) {
  return (
    <HStack {...segGroup} role="radiogroup" aria-label={label}>
      {options.map((o) => {
        const on = o.id === value
        const text = typeof o.label === "string" ? o.label : undefined
        return (
          // Tornar a tocar la triada no fa res (com un desplegable): si no, es refeia (p. ex. l'acabat del material).
          // Amb `retap`, sí (una opció que es torna a aplicar, com la forma del tauler després de canviar-ne la mida).
          // Els noms llargs es tallen amb punts suspensius (al mòbil no desborden) i el sencer surt al `title`.
          <Button key={o.id} {...segItem(on)} px={2.5} maxW="full" role="radio" aria-checked={on} title={text} disabled={o.disabled} onClick={() => (retap || !on) && onChange(o.id)}>
            {text !== undefined ? (
              <Box as="span" minW={0} truncate>
                {text}
              </Box>
            ) : (
              o.label
            )}
          </Button>
        )
      })}
    </HStack>
  )
}
