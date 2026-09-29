import { Badge, Box, Card, HStack, SimpleGrid, Stack, Stat, Table, Text, VStack } from "@chakra-ui/react"
import { useMemo, useState } from "react"
import { PanelDrawing } from "../../components/PanelDrawing"
import { toCutList } from "../../core/cutlist/toCutList"
import type { Grain } from "../../core/model"
import { useCompositionExtras, useCompositionPanels, useProject } from "../useProject"

const GRAIN: Record<Grain, string> = { x: "Llarg", y: "Ample", none: "—" }

export function CutListScreen({ projectId }: { projectId: number }) {
  const project = useProject(projectId)
  const panels = useCompositionPanels(project)
  const list = useMemo(() => toCutList(panels), [panels])
  const extras = useCompositionExtras(project)
  // Elements iguals (material i mides) agrupats.
  const extraRows = useMemo(() => {
    const rows = new Map<string, { label: string; material: string; l: number; w: number; t: number; qty: number }>()
    for (const p of extras) {
      const key = `${p.material}|${p.length}|${p.width}|${p.thickness}|${p.label}`
      const r = rows.get(key)
      if (r) r.qty += 1
      else rows.set(key, { label: p.label, material: p.material, l: p.length, w: p.width, t: p.thickness, qty: 1 })
    }
    return [...rows.values()]
  }, [extras])
  // Peça seleccionada a la taula: se'n mostra el plànol al costat (com als programes de CAM).
  const [selected, setSelected] = useState(0)
  const sel = list.items[Math.min(selected, list.items.length - 1)]
  const selPanel = sel ? panels.find((p) => p.id === sel.panelIds[0]) : undefined

  if (!project) return null

  return (
    <VStack align="stretch" gap={5}>
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

      {extraRows.length > 0 && (
        <Stack gap={2}>
          <Text fontWeight="semibold">Elements sense nesting</Text>
          <Table.ScrollArea borderWidth="1px" rounded="lg">
            <Table.Root size="sm" variant="line" striped>
              <Table.Header>
                <Table.Row>
                  <Table.ColumnHeader>Element</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Qt</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Llarg</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Ample</Table.ColumnHeader>
                  <Table.ColumnHeader textAlign="end">Gruix</Table.ColumnHeader>
                  <Table.ColumnHeader>Material</Table.ColumnHeader>
                </Table.Row>
              </Table.Header>
              <Table.Body>
                {extraRows.map((r, i) => (
                  <Table.Row key={i}>
                    <Table.Cell fontWeight="medium">{r.label}</Table.Cell>
                    <Table.Cell textAlign="end">{r.qty}</Table.Cell>
                    <Table.Cell textAlign="end">{r.l}</Table.Cell>
                    <Table.Cell textAlign="end">{r.w}</Table.Cell>
                    <Table.Cell textAlign="end">{r.t}</Table.Cell>
                    <Table.Cell>{r.material}</Table.Cell>
                  </Table.Row>
                ))}
              </Table.Body>
            </Table.Root>
          </Table.ScrollArea>
          <Text fontSize="xs" color="fg.muted">
            Peces d'un material que no es talla a la CNC (ferro, pedra, vidre…): es fan a part. No van al nesting ni als fitxers del taller.
          </Text>
        </Stack>
      )}
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
