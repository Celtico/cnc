import { Badge, Box, Button, Card, HStack, SimpleGrid, Stack, Stat, Table, Text, VStack } from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { LuDownload } from "react-icons/lu"
import { PanelDrawing } from "../../components/PanelDrawing"
import { toCutList } from "../../core/cutlist/toCutList"
import { cutListToCsv } from "../../core/export/csv"
import type { Grain } from "../../core/model"
import { downloadText, slugify } from "../download"
import { useCompositionPanels, useProject } from "../useProject"

const GRAIN: Record<Grain, string> = { x: "Llarg", y: "Ample", none: "—" }

export function CutListScreen({ projectId }: { projectId: number }) {
  const project = useProject(projectId)
  const panels = useCompositionPanels(project)
  const list = useMemo(() => toCutList(panels), [panels])
  // Peça seleccionada a la taula: se'n mostra el plànol al costat (com als programes de CAM).
  const [selected, setSelected] = useState(0)
  const sel = list.items[Math.min(selected, list.items.length - 1)]
  const selPanel = sel ? panels.find((p) => p.id === sel.panelIds[0]) : undefined

  if (!project) return null

  const exportCsv = () => {
    downloadText(cutListToCsv(list), `${slugify(project.name)}-peces.csv`, "text/csv")
  }

  return (
    <VStack align="stretch" gap={5}>
      <HStack justify="flex-end" wrap="wrap" gap={3}>
        <Button colorPalette="wood" onClick={exportCsv}>
          <LuDownload /> Exportar CSV
        </Button>
      </HStack>

      <SimpleGrid columns={3} gap={3}>
        <StatBox label="Peces" value={String(list.totalPanels)} />
        <StatBox label="Superfície" value={`${list.totalArea.toFixed(2)} m²`} />
        <StatBox label="Cantell" value={`${list.totalEdgeLength.toFixed(1)} m`} />
      </SimpleGrid>

      <Stack direction={{ base: "column", lg: "row" }} gap={4} align="flex-start">
      <Box flex={1} minW={0} w="full">
      <Table.ScrollArea borderWidth="1px" rounded="lg">
        <Table.Root size="sm" variant="line" striped>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Peça</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Qt</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Llarg</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Ample</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Gruix</Table.ColumnHeader>
              <Table.ColumnHeader>Material</Table.ColumnHeader>
              <Table.ColumnHeader>Veta</Table.ColumnHeader>
              <Table.ColumnHeader>Cantells</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Forats</Table.ColumnHeader>
              <Table.ColumnHeader>Després del nesting</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {list.items.map((it, i) => (
              <Table.Row
                key={i}
                cursor="pointer"
                onClick={() => setSelected(i)}
                aria-selected={i === selected}
                bg={i === selected ? "wood.subtle" : undefined}
                _hover={{ bg: i === selected ? "wood.subtle" : "bg.muted" }}
              >
                <Table.Cell fontWeight="medium">{it.label}</Table.Cell>
                <Table.Cell textAlign="end">{it.qty}</Table.Cell>
                <Table.Cell textAlign="end">{it.length}</Table.Cell>
                <Table.Cell textAlign="end">{it.width}</Table.Cell>
                <Table.Cell textAlign="end">{it.thickness}</Table.Cell>
                <Table.Cell>{it.material}</Table.Cell>
                <Table.Cell>{GRAIN[it.grain]}</Table.Cell>
                <Table.Cell>
                  <HStack gap={1}>
                    {it.mitreNumbers.map((n) => (
                      <Badge key={`m${n}`} colorPalette="purple" variant="subtle" size="sm" title="Cantell a inglet (45°)">
                        {n}∠45°
                      </Badge>
                    ))}
                    {it.edgeNumbers.length === 0 ? (
                      it.mitreNumbers.length ? null : <Text color="fg.subtle">—</Text>
                    ) : (
                      it.edgeNumbers.map((n) => (
                        <Badge key={n} colorPalette="wood" variant="subtle" size="sm">
                          {n}
                        </Badge>
                      ))
                    )}
                  </HStack>
                </Table.Cell>
                <Table.Cell textAlign="end">{it.holes}</Table.Cell>
                <Table.Cell fontSize="xs" color={it.processes ? "fg" : "fg.subtle"} maxW="280px" whiteSpace="normal">
                  {it.processes || "—"}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Table.ScrollArea>
      <Text fontSize="xs" color="fg.muted" mt={2}>
        Mides en mm. Cantells: 1 dalt · 2 dreta · 3 baix · 4 esquerra, vist des de la cara mecanitzada. Les peces iguals
        (i les mirall, com els laterals esquerre i dret) van a la mateixa fila. Clica una fila per veure'n el plànol.
      </Text>
      </Box>

      {sel && selPanel && (
        <Card.Root variant="outline" w={{ base: "full", lg: "400px" }} flexShrink={0} position={{ lg: "sticky" }} top={{ lg: "calc(48px + 1.5rem)" }}>
          <Card.Body gap={3}>
            <HStack justify="space-between" gap={2}>
              <Text fontWeight="semibold">{sel.label}</Text>
              <Badge variant="subtle">× {sel.qty}</Badge>
            </HStack>
            <Text fontSize="sm" color="fg.muted">
              {sel.length} × {sel.width} × {sel.thickness} mm · {sel.material} · {selPanel.holes.length} forats per peça
            </Text>
            <Box bg="bg.muted" rounded="md" p={2}>
              <PanelDrawing panel={selPanel} />
            </Box>
            <Text fontSize="xs" color="fg.muted">
              Vist des de la cara mecanitzada, com anirà al DXF. Cercles plens: forats de cara. Cercles discontinus: forats de
              cantell. Línia gruixuda: cantell folrat.
            </Text>
          </Card.Body>
        </Card.Root>
      )}
      </Stack>
    </VStack>
  )
}

function StatBox({ label, value }: { label: string; value: string }) {
  return (
    <Stat.Root borderWidth="1px" rounded="lg" p={3}>
      <Stat.Label>{label}</Stat.Label>
      <Stat.ValueText fontSize={{ base: "lg", md: "2xl" }}>{value}</Stat.ValueText>
    </Stat.Root>
  )
}
