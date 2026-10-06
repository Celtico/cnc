import { Box, Button, CloseButton, HStack, Input, InputGroup } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuPlus, LuSearch } from "react-icons/lu"
import { Tooltip } from "./ui/tooltip"

/**
 * El cercador de les llistes i galeries (Mobles, Objectes, Ambients, Preferències) amb el botó principal «+»
 * **al costat**: un sol aspecte a tota l'app. El «+» porta el text a l'ordinador i només la icona al mòbil
 * (`iconOnly` el deixa sempre en icona, p. ex. en una columna estreta); l'`aria-label` i el tooltip diuen què fa.
 * `extra`: més accions a la mateixa fila (a Mobles, «Obrir fitxer»).
 */
export function SearchBar({
  value,
  onChange,
  placeholder = "Cercar…",
  ariaLabel = "Cercar",
  add,
  extra,
  iconOnly,
  maxW = { base: "full", md: "420px" },
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  /** Botó principal (crear o afegir). Sense, només el cercador (p. ex. la galeria dins d'un ambient). */
  add?: { label: string; onClick: () => void }
  extra?: ReactNode
  iconOnly?: boolean
  /** Amplada màxima del cercador (no de la fila). */
  maxW?: string | Record<string, string>
}) {
  return (
    <HStack gap={2} minW={0}>
      <InputGroup
        flex={1}
        minW={0}
        maxW={maxW}
        startElement={<LuSearch />}
        endElement={value ? <CloseButton size="xs" aria-label="Esborrar la cerca" onClick={() => onChange("")} /> : undefined}
      >
        <Input size="sm" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} aria-label={ariaLabel} />
      </InputGroup>
      {add && (
        <Tooltip content={add.label}>
          <Button size="sm" colorPalette="wood" flexShrink={0} px={iconOnly ? 0 : { base: 0, md: 3 }} minW={9} aria-label={add.label} onClick={add.onClick}>
            <LuPlus />
            {!iconOnly && (
              <Box as="span" display={{ base: "none", md: "inline" }}>
                {add.label}
              </Box>
            )}
          </Button>
        </Tooltip>
      )}
      {extra}
    </HStack>
  )
}
