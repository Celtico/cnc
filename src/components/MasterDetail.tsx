import { Badge, Box, Button, CloseButton, Flex, HStack, Input, InputGroup, NativeSelect, Stack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuChevronLeft, LuChevronRight, LuPlus, LuSearch } from "react-icons/lu"

export interface MasterItem {
  id: string
  title: ReactNode
  subtitle?: ReactNode
  /** Mostra (color, textura) o icona a l'esquerra. */
  lead?: ReactNode
  badge?: ReactNode
  dimmed?: boolean
}
export interface MasterGroup {
  id: string
  label: string
  hint?: string
  items: MasterItem[]
}

/**
 * Llista i detall (com Configuració de macOS, els comptes de Mail o els estils de Figma): a
 * l'esquerra la llista agrupada amb cercador i «Afegir»; a la dreta, l'element triat per editar-lo.
 * Al mòbil, primer la llista i, en triar-ne un, el detall a pantalla sencera amb «‹ Tornar».
 */
export function MasterDetail({
  groups,
  selected,
  onSelect,
  query,
  onQuery,
  addLabel,
  onAdd,
  backLabel,
  detail,
  empty,
  filters,
  filter,
  onFilter,
  detailMaxW = "680px",
  head,
  footer,
}: {
  /** A dalt de la llista (títol de la pàgina): així el detall comença a dalt de tot, a l'altura del menú. */
  head?: ReactNode
  /** Sota el detall (opcions de tota la llista, p. ex. els materials per defecte). */
  footer?: ReactNode
  /** Filtre per categoria (desplegable al costat del cercador): «Tots» i una per grup. */
  filters?: { id: string; label: string; count: number }[]
  filter?: string
  onFilter?: (id: string) => void
  /** Amplada màxima del detall (els camps no s'estiren fins a la vora). */
  detailMaxW?: string
  groups: MasterGroup[]
  selected: string | null
  onSelect: (id: string | null) => void
  query: string
  onQuery: (q: string) => void
  addLabel: string
  onAdd: () => void
  backLabel: string
  detail: ReactNode
  empty?: ReactNode
}) {
  const list = (
    <Stack gap={3} minW={0}>
      {head}
      {/* Cercador i filtres sempre a dalt de la llista (la llista es desplaça per sota). */}
      <Stack gap={2} position="sticky" top={0} zIndex={1} bg="bg" pb={1}>
      <HStack gap={2}>
        <InputGroup flex={1} minW={0} startElement={<LuSearch />} endElement={query ? <CloseButton size="xs" aria-label="Esborrar la cerca" onClick={() => onQuery("")} /> : undefined}>
          <Input size="sm" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Cercar…" aria-label="Cercar" />
        </InputGroup>
        {filters && (
          <NativeSelect.Root size="sm" w="124px" flexShrink={0}>
            <NativeSelect.Field aria-label="Categoria" value={filter} onChange={(e) => onFilter?.(e.target.value)}>
              {filters.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label} ({f.count})
                </option>
              ))}
            </NativeSelect.Field>
            <NativeSelect.Indicator />
          </NativeSelect.Root>
        )}
        <Button size="sm" variant="outline" flexShrink={0} onClick={onAdd}>
          <LuPlus /> {addLabel}
        </Button>
      </HStack>
      </Stack>
      {groups.map((g) =>
        g.items.length ? (
          <Stack key={g.id} gap={1}>
            <HStack gap={2} px={1}>
              <Text fontSize="xs" fontWeight="semibold" color="fg.muted" textTransform="uppercase" letterSpacing="wide">
                {g.label}
              </Text>
              <Badge size="xs" variant="subtle" colorPalette="gray">
                {g.items.length}
              </Badge>
            </HStack>
            <Box borderWidth="1px" rounded="lg" overflow="hidden" bg="bg.panel">
              {g.items.map((it, i) => {
                const on = it.id === selected
                return (
                  <HStack
                    key={it.id}
                    as="button"
                    w="full"
                    textAlign="left"
                    gap={2.5}
                    px={3}
                    py={2}
                    alignItems="flex-start"
                    borderTopWidth={i ? "1px" : 0}
                    bg={on ? "wood.subtle" : undefined}
                    _hover={{ bg: on ? "wood.subtle" : "bg.muted" }}
                    opacity={it.dimmed ? 0.55 : 1}
                    cursor="pointer"
                    aria-current={on ? "true" : undefined}
                    onClick={() => onSelect(it.id)}
                  >
                    {it.lead && (
                      <Box flexShrink={0} display="inline-flex" color="wood.fg" mt="2px">
                        {it.lead}
                      </Box>
                    )}
                    <Stack gap={0} minW={0} flex={1}>
                      <HStack gap={1.5} minW={0}>
                        <Text fontSize="sm" fontWeight={on ? "semibold" : "medium"} truncate>
                          {it.title}
                        </Text>
                        {it.badge}
                      </HStack>
                      {it.subtitle && (
                        <Text fontSize="xs" color="fg.muted" truncate>
                          {it.subtitle}
                        </Text>
                      )}
                    </Stack>
                    <Box color="fg.subtle" display={{ base: "inline-flex", lg: "none" }} alignSelf="center">
                      <LuChevronRight />
                    </Box>
                  </HStack>
                )
              })}
            </Box>
            {g.hint && (
              <Text fontSize="xs" color="fg.subtle" px={1}>
                {g.hint}
              </Text>
            )}
          </Stack>
        ) : null,
      )}
    </Stack>
  )
  return (
    <Flex gap={5} align="flex-start">
      {/* Llista: sempre a l'ordinador gran; al mòbil i a pantalles estretes, només si no n'hi ha cap de triat. */}
      {/* A l'ordinador, la llista té el seu propi desplaçament i el detall queda fix al costat: triar
          un element de baix de tot no deixa el detall fora de la vista. */}
      <Box
        w={{ base: "full", lg: "360px" }}
        flexShrink={0}
        display={{ base: selected ? "none" : "block", lg: "block" }}
        position={{ lg: "sticky" }}
        top={{ lg: 0 }}
        maxH={{ lg: "calc(100dvh - 40px)" }}
        overflowY={{ lg: "auto" }}
        pr={{ lg: 1 }}
        css={{ scrollbarWidth: "thin" }}
      >
        {list}
      </Box>
      <Box flex={1} minW={0} maxW={detailMaxW} display={{ base: selected ? "block" : "none", lg: "block" }} position={{ lg: "sticky" }} top={{ lg: 0 }}>
        <Button display={{ base: "inline-flex", lg: "none" }} variant="ghost" size="sm" mb={2} ml={-2} onClick={() => onSelect(null)}>
          <LuChevronLeft /> {backLabel}
        </Button>
        <Stack gap={6}>
          {selected ? detail : (empty ?? null)}
          {footer}
        </Stack>
      </Box>
    </Flex>
  )
}
