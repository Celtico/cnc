import { Badge, Box, Card, HStack, Stack, Text } from "@chakra-ui/react"
import { PanelDrawing } from "../../components/PanelDrawing"
import type { CutListItem } from "../../core/cutlist/toCutList"
import { EDGE_NUMBER, EDGE_SIDES, type Panel } from "../../core/model"

/** Cantells i inglets reals d'una peça («cantell 3 · inglet 1, 2, 4»). */
function realSides(p: Panel): string {
  const edges = EDGE_SIDES.filter((s) => p.edges[s]).map((s) => EDGE_NUMBER[s]).sort((a, b) => a - b)
  const mitres = (p.mitres ?? []).map((s) => EDGE_NUMBER[s]).sort((a, b) => a - b)
  return [edges.length ? `cantell ${edges.join(", ")}` : "", mitres.length ? `inglet ${mitres.join(", ")}` : ""].filter(Boolean).join(" · ") || "sense cantell"
}

/** El plànol de la peça triada, al costat de la taula (com als programes de CAM). */
export function SelectedPieceCard({ sel, selPanel, panels, refs }: { sel: CutListItem; selPanel: Panel; panels: Panel[]; refs: Map<string, string> }) {
  return (
    <Card.Root variant="outline" display={{ base: "none", md: "flex" }} w={{ base: "full", lg: "400px" }} flexShrink={0} position={{ lg: "sticky" }} top={{ lg: "calc(48px + 1.5rem)" }}>
      <Card.Body gap={3}>
        <HStack justify="space-between" gap={2}>
          <Text fontWeight="semibold">{sel.label}</Text>
          <Badge variant="subtle">× {sel.qty}</Badge>
        </HStack>
        <Text fontSize="sm" color="fg.muted">
          {sel.length} × {sel.width} × {sel.thickness} mm · {sel.material} · {selPanel.holes.length} {selPanel.holes.length === 1 ? "forat" : "forats"} per peça
          {sel.qty > 1 && ` (${sel.holes} en total a les ${sel.qty} peces)`}
        </Text>
        {/* Cantells i inglets de cada peça tal com és (la fila els dona en l'orientació normalitzada, per agrupar les
            mirall): així coincideixen amb el LLEGEIX-ME i la ruta d'Exportar. */}
        {(sel.edgeNumbers.length > 0 || sel.mitreNumbers.length > 0) && (
          <Stack gap={0.5} fontSize="xs">
            {sel.panelIds.map((id) => {
              const p = panels.find((x) => x.id === id)
              return p ? (
                <Text key={id}>
                  <Text as="span" fontWeight="medium">{refs.get(id) ?? p.label}</Text> · {realSides(p)}
                </Text>
              ) : null
            })}
          </Stack>
        )}
        <Box bg="bg.muted" rounded="md" p={2}>
          <PanelDrawing panel={selPanel} />
        </Box>
        <Text fontSize="xs" color="fg.muted">
          Vist des de la cara mecanitzada, com anirà al DXF. Cercles plens: forats de cara. Cercles discontinus: forats de
          cantell. Línia gruixuda: cantell folrat.
        </Text>
      </Card.Body>
    </Card.Root>
  )
}
