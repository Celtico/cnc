import { HStack, Stack, Text } from "@chakra-ui/react"
import { createContext, useContext } from "react"
import { LuInfo, LuTriangleAlert } from "react-icons/lu"

/** Un avís tal com surt al seu lloc de l'inspector. */
export interface InlineWarning {
  message: string
  info: boolean
}

/**
 * Els avisos de la selecció, al seu lloc (per decisió de l'usuari, 2026-10-20: «els avisos al seu lloc, sota l'opció»):
 * per opció (`BuildWarning.option`, a sota de la `FormRow` d'aquella opció) i, els que no en diuen cap, per secció (a dalt
 * del `FoldItem` on s'arreglen, `warningTarget`). També surten a la llista d'avisos.
 */
export interface InlineWarnings {
  byOption: ReadonlyMap<string, InlineWarning[]>
  byFold: ReadonlyMap<string, InlineWarning[]>
}

const NONE: InlineWarning[] = []
const EMPTY: InlineWarnings = { byOption: new Map(), byFold: new Map() }

export const InlineWarningsContext = createContext<InlineWarnings>(EMPTY)

/** Els avisos d'una opció (sense `optionId`, cap). */
export const useOptionWarnings = (optionId: string | undefined): InlineWarning[] => {
  const ctx = useContext(InlineWarningsContext)
  return (optionId && ctx.byOption.get(optionId)) || NONE
}

/** Els avisos d'una secció plegable (pel seu `id`). */
export const useFoldWarnings = (id: string): InlineWarning[] => useContext(InlineWarningsContext).byFold.get(id) ?? NONE

/** Els avisos, un per línia (taronja els que cal arreglar; gris els que només informen). */
export function InlineWarningList({ items }: { items: InlineWarning[] }) {
  if (!items.length) return null
  return (
    <Stack gap={1}>
      {items.map((w, i) => (
        <HStack key={i} gap={1.5} align="start" fontSize="xs" color={w.info ? "fg.muted" : "orange.fg"}>
          <Text as="span" pt="2px" flexShrink={0}>
            {w.info ? <LuInfo /> : <LuTriangleAlert />}
          </Text>
          <Text as="span">{w.message}</Text>
        </HStack>
      ))}
    </Stack>
  )
}
