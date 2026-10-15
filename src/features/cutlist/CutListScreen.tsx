import { Box, SimpleGrid, Stack, Text, VStack } from "@chakra-ui/react"
import { StatBox } from "../../components/StatBox"
import { useMemo, useState } from "react"
import { toCutList } from "../../core/cutlist/toCutList"
import { pieceRefs } from "../../core/export/refs"
import { useCompositionExtras, useCompositionFittings, useCompositionKits, useCompositionLights, useCompositionWirings, useCompositionPanels, useCompositionRead, useProject } from "../useProject"
import { kitGroups } from "../../core/build/kitOrders"
import { lightGroups } from "../../core/build/lightOrders"
import { fittingGroups } from "../../core/build/fittingOrders"
import { UnreadableAlert } from "../../components/UnreadableAlert"
import { ExtraElementsTable, OrderSections, type ExtraRow } from "./OrderTables"
import { PieceCards, PieceTable } from "./PieceList"
import { SelectedPieceCard } from "./SelectedPieceCard"

export function CutListScreen({ projectId }: { projectId: number }) {
  const project = useProject(projectId)
  const unreadable = !!useCompositionRead(project)?.unreadable
  const panels = useCompositionPanels(project)
  const list = useMemo(() => toCutList(panels), [panels])
  const extras = useCompositionExtras(project)
  // Calaixos amb joc paramètric: la comanda (components iguals agrupats, amb el número d'article).
  const kits = useCompositionKits(project)
  const kitRows = useMemo(() => kitGroups(kits), [kits])
  // Llums amb joc: les làmpades de cada mòdul i el seu sistema elèctric (alimentador, distribuïdor, interruptor, cables).
  const lights = useCompositionLights(project)
  const lightRows = useMemo(() => lightGroups(lights), [lights])
  // Frontisses, tiradors, pistons i potes: la comanda per mòdul, amb el número d'article.
  const fittings = useCompositionFittings(project)
  const wirings = useCompositionWirings(project)
  const fittingRows = useMemo(() => fittingGroups(fittings), [fittings])
  // Elements iguals (material i mides) agrupats. Els components dels jocs de calaix (rol `hardware`) van a la seva taula.
  const extraRows = useMemo(() => {
    const rows = new Map<string, ExtraRow>()
    for (const p of extras) {
      if (p.role === "hardware") continue
      const key = `${p.material}|${p.length}|${p.width}|${p.thickness}|${p.label}`
      const r = rows.get(key)
      if (r) r.qty += 1
      else rows.set(key, { label: p.label, material: p.material, l: p.length, w: p.width, t: p.thickness, qty: 1 })
    }
    return [...rows.values()]
  }, [extras])
  // Peça seleccionada a la taula: se'n mostra el plànol al costat (com als programes de CAM).
  const [selected, setSelected] = useState(0)
  // Si la llista s'escurça (s'ha editat el moble), queda triada l'última (la mateixa a la taula i al plànol).
  const selIdx = Math.max(0, Math.min(selected, list.items.length - 1))
  const sel = list.items[selIdx]
  const selPanel = sel ? panels.find((p) => p.id === sel.panelIds[0]) : undefined
  const refs = useMemo(() => pieceRefs(panels), [panels])

  if (!project) return null
  if (unreadable) return <UnreadableAlert />

  return (
    <VStack align="stretch" gap={5}>
      <SimpleGrid columns={3} gap={3}>
        <StatBox label="Peces" value={String(list.totalPanels)} />
        <StatBox label="Superfície" value={`${list.totalArea.toFixed(2).replace(".", ",")} m²`} />
        <StatBox label="Cantell" value={`${list.totalEdgeLength.toFixed(1).replace(".", ",")} m`} />
      </SimpleGrid>

      <Stack direction={{ base: "column", lg: "row" }} gap={4} align="flex-start">
      <Box flex={1} minW={0} w="full">
      {/* Mòbil: una targeta per peça (la taula no hi cap); la triada mostra el plànol a dins. */}
      <PieceCards items={list.items} selIdx={selIdx} selPanel={selPanel} onSelect={setSelected} />
      <PieceTable items={list.items} selIdx={selIdx} onSelect={setSelected} />
      <Text fontSize="xs" color="fg.muted" mt={2}>
        Mides en mm. Cantells: 1 dalt · 2 dreta · 3 baix · 4 esquerra, vist des de la cara mecanitzada. Les peces iguals
        (i les mirall, com els laterals esquerre i dret) van a la mateixa fila, amb els cantells en l'orientació
        normalitzada; els de cada peça tal com és surten al detall. Clica una peça per veure'n el plànol.
      </Text>
      </Box>

      {sel && selPanel && <SelectedPieceCard sel={sel} selPanel={selPanel} panels={panels} refs={refs} />}
      </Stack>

      <OrderSections kitRows={kitRows} fittingRows={fittingRows} lightRows={lightRows} wirings={wirings} />
      {extraRows.length > 0 && <ExtraElementsTable rows={extraRows} />}
    </VStack>
  )
}
