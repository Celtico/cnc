import { Box, Button, CloseButton, HStack, Input, InputGroup, Menu, Portal, type ButtonProps } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuPlus, LuSearch } from "react-icons/lu"
import { Tooltip } from "./ui/tooltip"

/**
 * El cercador de les llistes i galeries (Mobles, Objectes, Ambients, Preferències) amb el botó principal «+»
 * **al costat**: un sol aspecte a tota l'app. El «+» porta el text a l'ordinador i només la icona al mòbil
 * (`iconOnly` el deixa sempre en icona, p. ex. en una columna estreta); l'`aria-label` i el tooltip diuen què fa.
 * `extra`: més accions a la mateixa fila (a Mobles, «Obrir fitxer»). Amb `add.menu`, el «+» obre un menú amb els punts de
 * partida (com el «+» dels grups de l'arbre de l'Editor): «Nou moble» › Moble · Cuina · Armari · Taula.
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
  add?: { label: string; onClick?: () => void; menu?: ReactNode }
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
      {add && !add.menu && (
        <Tooltip content={add.label}>
          <AddButton label={add.label} iconOnly={iconOnly} onClick={add.onClick} />
        </Tooltip>
      )}
      {add?.menu && (
        <Menu.Root positioning={{ placement: "bottom-end" }}>
          <Menu.Trigger asChild>
            <AddButton label={add.label} iconOnly={iconOnly} />
          </Menu.Trigger>
          <Portal>
            <Menu.Positioner>
              <Menu.Content maxW="340px">{add.menu}</Menu.Content>
            </Menu.Positioner>
          </Portal>
        </Menu.Root>
      )}
      {extra}
    </HStack>
  )
}

/** El «+» del cercador: text a l'ordinador i només la icona al mòbil (o sempre, `iconOnly`). */
function AddButton({ label, iconOnly, ...rest }: { label: string; iconOnly?: boolean } & ButtonProps) {
  return (
    <Button size="sm" colorPalette="wood" flexShrink={0} px={iconOnly ? 0 : { base: 0, md: 3 }} minW={9} aria-label={label} {...rest}>
      <LuPlus />
      {!iconOnly && (
        <Box as="span" display={{ base: "none", md: "inline" }}>
          {label}
        </Box>
      )}
    </Button>
  )
}
