import { Accordion, Stack, Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { LuBookOpen } from "react-icons/lu"
import { FoldTitle } from "./FoldTitle"

export interface CatalogCategory {
  id: string
  label: string
  count: number
  content: ReactNode
}

/**
 * L'última secció de les tres pàgines (Ambients · Objectes · Mobles), igual a totes: «Catàleg», una línia
 * d'explicació i un acordió per categoria. Amb una cerca, s'obren totes les categories que hi coincideixen.
 * Va dins de l'`Accordion.Root` de la pàgina (`value` = el seu id en aquell acordió).
 */
export function CatalogSection({ value, description, categories, open, onOpenChange, searching }: { value: string; description: ReactNode; categories: CatalogCategory[]; open: string[]; onOpenChange: (v: string[]) => void; searching: boolean }) {
  const shown = categories.filter((c) => c.count > 0)
  return (
    <Accordion.Item value={value}>
      <Accordion.ItemTrigger cursor="pointer">
        <FoldTitle icon={<LuBookOpen />} title="Catàleg" count={shown.reduce((n, c) => n + c.count, 0)} />
        <Accordion.ItemIndicator />
      </Accordion.ItemTrigger>
      <Accordion.ItemContent>
        <Accordion.ItemBody>
          <Stack gap={3}>
            <Text fontSize="xs" color="fg.muted">
              {description}
            </Text>
            <Accordion.Root className="inner-accordion" multiple collapsible lazyMount variant="plain" value={searching ? shown.map((c) => c.id) : open} onValueChange={(e) => !searching && onOpenChange(e.value)}>
              {shown.map((c) => (
                <Accordion.Item key={c.id} value={c.id}>
                  <Accordion.ItemTrigger className="inner-head" cursor="pointer" borderBottomWidth="1px" rounded="none" px={0}>
                    <FoldTitle title={c.label} count={c.count} />
                    <Accordion.ItemIndicator />
                  </Accordion.ItemTrigger>
                  <Accordion.ItemContent>
                    <Accordion.ItemBody px={0}>{c.content}</Accordion.ItemBody>
                  </Accordion.ItemContent>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </Stack>
        </Accordion.ItemBody>
      </Accordion.ItemContent>
    </Accordion.Item>
  )
}
