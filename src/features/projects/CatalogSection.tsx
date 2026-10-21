import { Stack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import type { IconType } from "react-icons"
import { LuBookOpen } from "react-icons/lu"
import { FoldGroup, FoldItem } from "../../components/Fold"

interface CatalogCategory {
  id: string
  label: string
  count: number
  content: ReactNode
}

/**
 * L'última secció de les tres pàgines (Ambients · Objectes · Mobles), igual a totes: «Catàleg», una línia
 * d'explicació i un acordió per categoria. Amb una cerca, s'obren totes les categories que hi coincideixen.
 * Va dins del `FoldGroup` de la pàgina (`value` = el seu id en aquell acordió). La mateixa secció serveix per a una
 * altra galeria per categories (els «Llistons» de Mobles): el títol i la icona.
 */
export function CatalogSection({
  value,
  title = "Catàleg",
  icon = LuBookOpen,
  description,
  categories,
  open,
  onOpenChange,
  searching,
}: {
  value: string
  title?: string
  icon?: IconType
  description: ReactNode
  categories: CatalogCategory[]
  open: string[]
  onOpenChange: (v: string[]) => void
  searching: boolean
}) {
  const shown = categories.filter((c) => c.count > 0)
  return (
    <FoldItem id={value} icon={icon} title={title} count={shown.reduce((n, c) => n + c.count, 0)}>
      <Stack gap={3}>
        <Text fontSize="xs" color="fg.muted" px="var(--gallery-px, 0)" pt={3}>
          {description}
        </Text>
        <FoldGroup variant="nested" value={open} onValueChange={onOpenChange} forceOpen={searching ? shown.map((c) => c.id) : null}>
          {shown.map((c) => (
            <FoldItem key={c.id} id={c.id} title={c.label} count={c.count}>
              {c.content}
            </FoldItem>
          ))}
        </FoldGroup>
      </Stack>
    </FoldItem>
  )
}
