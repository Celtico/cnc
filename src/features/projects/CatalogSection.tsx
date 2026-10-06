import { Stack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuBookOpen } from "react-icons/lu"
import { FoldGroup, FoldItem } from "../../components/Fold"

export interface CatalogCategory {
  id: string
  label: string
  count: number
  content: ReactNode
}

/**
 * L'última secció de les tres pàgines (Ambients · Objectes · Mobles), igual a totes: «Catàleg», una línia
 * d'explicació i un acordió per categoria. Amb una cerca, s'obren totes les categories que hi coincideixen.
 * Va dins del `FoldGroup` de la pàgina (`value` = el seu id en aquell acordió).
 */
export function CatalogSection({ value, description, categories, open, onOpenChange, searching }: { value: string; description: ReactNode; categories: CatalogCategory[]; open: string[]; onOpenChange: (v: string[]) => void; searching: boolean }) {
  const shown = categories.filter((c) => c.count > 0)
  return (
    <FoldItem id={value} icon={LuBookOpen} title="Catàleg" count={shown.reduce((n, c) => n + c.count, 0)}>
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
