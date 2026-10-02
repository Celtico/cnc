import { Accordion, Badge, Box, Button, CloseButton, Flex, HStack, IconButton, Input, InputGroup, Stack, Text } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import { LuChevronLeft, LuChevronRight, LuPlus, LuSearch } from "react-icons/lu"
import { ChoiceChips } from "./FormRow"
import { SectionLabel } from "./SectionLabel"

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
  /** Icona de la capçalera (només a l'acordió, com els apartats de les pàgines principals). */
  icon?: ReactNode
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
  collapsible,
}: {
  /**
   * Grups plegables (acordió, com el selector de materials): clau de sessió per recordar quins són oberts.
   * Per defecte només és obert el grup de l'element triat; la cerca obre els que tenen resultats.
   */
  collapsible?: string
  /** A dalt de la llista (títol de la pàgina): així el detall comença a dalt de tot, a l'altura del menú. */
  head?: ReactNode
  /** Sota el detall (opcions de tota la llista, p. ex. els materials per defecte). */
  footer?: ReactNode
  /** Filtre per categoria (fila de botons sota el cercador): «Tots» i una per grup. */
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
  const openKey = collapsible ? `mobles:md-open:${collapsible}` : null
  const [openState, setOpenState] = useState<Record<string, boolean>>(() => {
    if (!openKey) return {}
    try {
      return JSON.parse(sessionStorage.getItem(openKey) ?? "{}") as Record<string, boolean>
    } catch {
      return {}
    }
  })
  const visibleGroups = groups.filter((g) => g.items.length)
  const searching = !!query.trim()
  const isOpen = (g: MasterGroup) =>
    !collapsible || searching || visibleGroups.length === 1 || (openState[g.id] ?? g.items.some((it) => it.id === selected))
  const setOpen = (ids: string[]) => {
    const next = { ...openState }
    for (const g of visibleGroups) next[g.id] = ids.includes(g.id)
    setOpenState(next)
    try {
      if (openKey) sessionStorage.setItem(openKey, JSON.stringify(next))
    } catch {
      /* només aquesta vista */
    }
  }

  const rows = (g: MasterGroup, withHint = true) => (
    <Stack gap={1}>
      {/* Dins de l'acordió (withHint = false) les files van a sang: la vora ja és la de l'apartat. */}
      <Box borderWidth={withHint ? "1px" : 0} rounded={withHint ? "lg" : "none"} overflow="hidden" bg="bg.panel">
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
      {withHint && g.hint && (
        <Text fontSize="xs" color="fg.subtle" px={1}>
          {g.hint}
        </Text>
      )}
    </Stack>
  )
  const list = (
    <Stack gap={3} minW={0}>
      {head}
      {/* Cercador i filtres sempre a dalt de la llista (la llista es desplaça per sota). */}
      <Stack gap={2} position="sticky" top={0} zIndex={1} bg="bg" pb={1}>
      <HStack gap={2}>
        <InputGroup flex={1} minW={0} startElement={<LuSearch />} endElement={query ? <CloseButton size="xs" aria-label="Esborrar la cerca" onClick={() => onQuery("")} /> : undefined}>
          <Input size="sm" value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Cercar…" aria-label="Cercar" />
        </InputGroup>
        {/* Només la icona: el cercador té més lloc (el text surt en passar-hi per sobre). */}
        <IconButton size="sm" variant="outline" flexShrink={0} onClick={onAdd} aria-label={addLabel} title={addLabel}>
          <LuPlus />
        </IconButton>
      </HStack>
      {/* Categories en pastilles a la seva fila (salten de línia si no hi caben). */}
      {filters && (
        <ChoiceChips
          label="Categoria"
          options={filters.map((f) => ({
            id: f.id,
            label: (
              <>
                {f.label}
                <Text as="span" color="fg.subtle" ms={1}>
                  {f.count}
                </Text>
              </>
            ),
          }))}
          value={filter ?? filters[0]?.id ?? ""}
          onChange={(v) => onFilter?.(v)}
        />
      )}
      </Stack>
      {collapsible && visibleGroups.length > 1 ? (
        // El mateix acordió que els apartats de les pàgines principals (Historial, Catàleg…): `gallery-accordion`, tancat
        // amb vora, icona, nom i comptador; a sota del nom, per a què serveix el grup.
        <Accordion.Root
          className="gallery-accordion"
          multiple
          collapsible
          variant="enclosed"
          value={visibleGroups.filter(isOpen).map((g) => g.id)}
          onValueChange={(e) => setOpen(e.value)}
        >
          {visibleGroups.map((g) => (
            <Accordion.Item key={g.id} value={g.id}>
              <Accordion.ItemTrigger cursor="pointer">
                <Stack flex={1} gap={0.5} minW={0} textAlign="left">
                  <HStack gap={2} minW={0}>
                    {g.icon && (
                      <Box color="wood.fg" display="inline-flex">
                        {g.icon}
                      </Box>
                    )}
                    <Text fontWeight="semibold" fontSize="sm" truncate>
                      {g.label}
                    </Text>
                    <Badge size="xs" variant="subtle" colorPalette="gray">
                      {g.items.length}
                    </Badge>
                  </HStack>
                  {g.hint && (
                    <Text fontSize="xs" color="fg.muted" fontWeight="normal">
                      {g.hint}
                    </Text>
                  )}
                </Stack>
                <Accordion.ItemIndicator />
              </Accordion.ItemTrigger>
              <Accordion.ItemContent>
                <Accordion.ItemBody>{rows(g, false)}</Accordion.ItemBody>
              </Accordion.ItemContent>
            </Accordion.Item>
          ))}
        </Accordion.Root>
      ) : (
        groups.map((g) =>
          g.items.length ? (
            <Stack key={g.id} gap={1}>
              <HStack gap={2} px={1}>
                <SectionLabel>{g.label}</SectionLabel>
                <Badge size="xs" variant="subtle" colorPalette="gray">
                  {g.items.length}
                </Badge>
              </HStack>
              {rows(g)}
            </Stack>
          ) : null,
        )
      )}
      {/* Llista buida: «Cap resultat» només si és la cerca o un filtre (que no sigui el primer) que no troben res. */}
      {groups.every((g) => !g.items.length) && (
        <Text fontSize="sm" color="fg.muted" px={1}>
          {query.trim() || (filters && filter !== undefined && filter !== filters[0]?.id) ? "Cap resultat." : "Encara no n'hi ha cap."}
        </Text>
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
