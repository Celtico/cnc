import { Badge, Button, HStack, Heading, SimpleGrid, Stat, Table, Text, VStack } from "@chakra-ui/react"
import { useMemo } from "react"
import { LuDownload } from "react-icons/lu"
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

  if (!project) return null

  const exportCsv = () => {
    downloadText(cutListToCsv(list), `${slugify(project.name)}-peces.csv`, "text/csv")
  }

  return (
    <VStack align="stretch" gap={5}>
      <HStack justify="space-between" wrap="wrap" gap={3}>
        <Heading size="xl">Llista de peces</Heading>
        <Button colorPalette="wood" onClick={exportCsv}>
          <LuDownload /> Exportar CSV
        </Button>
      </HStack>

      <SimpleGrid columns={3} gap={3}>
        <StatBox label="Peces" value={String(list.totalPanels)} />
        <StatBox label="Superfície" value={`${list.totalArea.toFixed(2)} m²`} />
        <StatBox label="Cantell" value={`${list.totalEdgeLength.toFixed(1)} m`} />
      </SimpleGrid>

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
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {list.items.map((it, i) => (
              <Table.Row key={i}>
                <Table.Cell fontWeight="medium">{it.label}</Table.Cell>
                <Table.Cell textAlign="end">{it.qty}</Table.Cell>
                <Table.Cell textAlign="end">{it.length}</Table.Cell>
                <Table.Cell textAlign="end">{it.width}</Table.Cell>
                <Table.Cell textAlign="end">{it.thickness}</Table.Cell>
                <Table.Cell>{it.material}</Table.Cell>
                <Table.Cell>{GRAIN[it.grain]}</Table.Cell>
                <Table.Cell>
                  <HStack gap={1}>
                    {it.edgeNumbers.length === 0 ? (
                      <Text color="fg.subtle">—</Text>
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
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Table.ScrollArea>
      <Text fontSize="xs" color="fg.muted">
        Mides en mm. Cantells: 1 dalt · 2 dreta · 3 baix · 4 esquerra, vist des de la cara mecanitzada.
        Les peces mirall (lateral esquerre i dret) es compten a la mateixa fila.
      </Text>
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
