import { Box, HStack, Text, Wrap } from "@chakra-ui/react"
import type { Panel, PanelRole } from "../../core/model"

/**
 * Colors «per tipus de peça» del mode Ràpida: famílies ben diferenciades
 * (estructura, prestatges, fons, fronts, calaixos…) i suaus per no cansar.
 */
export const ROLE_GROUPS: { label: string; color: string; roles: PanelRole[] }[] = [
  { label: "Estructura", color: "#e3dccf", roles: ["side", "top", "bottom", "divider", "fixedShelf", "facing", "spacer"] },
  { label: "Prestatges", color: "#b7d99b", roles: ["shelf"] },
  { label: "Fons", color: "#c8bfe3", roles: ["back"] },
  { label: "Portes i fronts", color: "#8fc1ea", roles: ["door", "flap", "hatch", "panel"] },
  { label: "Reixeta", color: "#86d3c7", roles: ["grille"] },
  { label: "Front calaix", color: "#f4b27a", roles: ["drawerFront"] },
  { label: "Caixa calaix", color: "#f2d98c", roles: ["drawerSide", "drawerBack", "drawerBottom"] },
  { label: "Sòcol", color: "#8e8780", roles: ["plinth"] },
  { label: "Taulell", color: "#c6924f", roles: ["worktop"] },
  { label: "Peces lliures", color: "#e7a8c9", roles: ["part"] },
]

export const ROLE_COLOR = Object.fromEntries(ROLE_GROUPS.flatMap((g) => g.roles.map((r) => [r, g.color]))) as Record<PanelRole, string>

/** Llegenda amb només les famílies que hi ha al moble. */
export function RoleLegend({ panels }: { panels: Panel[] }) {
  const present = new Set(panels.map((p) => p.role))
  const groups = ROLE_GROUPS.filter((g) => g.roles.some((r) => present.has(r)))
  if (!groups.length) return null
  return (
    <Wrap gap={1} maxW="280px" bg="bg.panel/85" backdropFilter="blur(6px)" borderWidth="1px" borderRadius="md" px={2} py={1.5} pointerEvents="none">
      {groups.map((g) => (
        <HStack key={g.label} gap={1}>
          <Box w="10px" h="10px" borderRadius="2px" bg={g.color} borderWidth="1px" borderColor="blackAlpha.300" />
          <Text fontSize="2xs" color="fg.muted" whiteSpace="nowrap">
            {g.label}
          </Text>
        </HStack>
      ))}
    </Wrap>
  )
}
