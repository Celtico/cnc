import { Badge, Box, Card, HStack, SimpleGrid, Stack, Table, Text, VStack } from "@chakra-ui/react"
import { StatBox } from "../../components/StatBox"
import { useMemo, useState } from "react"
import { PanelDrawing } from "../../components/PanelDrawing"
import { toCutList } from "../../core/cutlist/toCutList"
import { EDGE_NUMBER, EDGE_SIDES, type Grain, type Panel } from "../../core/model"
import { pieceRefs } from "../../core/export/refs"
import { useCompositionExtras, useCompositionFittings, useCompositionKits, useCompositionLights, useCompositionPanels, useCompositionRead, useProject } from "../useProject"
import { kitGroups, type KitGroup } from "../../core/build/kitOrders"
import { lightGroups } from "../../core/build/lightOrders"
import { fittingGroups } from "../../core/build/fittingOrders"
import { UnreadableAlert } from "../../components/UnreadableAlert"
import { SectionLabel } from "../../components/SectionLabel"

const GRAIN: Record<Grain, string> = { x: "Llarg", y: "Ample", none: "—" }

/** Cantells de la peça: els a inglet (45°) i els folrats, com a etiquetes. */
/** Cantells i inglets reals d'una peça («cantell 3 · inglet 1, 2, 4»). */
function realSides(p: Panel): string {
  const edges = EDGE_SIDES.filter((s) => p.edges[s]).map((s) => EDGE_NUMBER[s]).sort((a, b) => a - b)
  const mitres = (p.mitres ?? []).map((s) => EDGE_NUMBER[s]).sort((a, b) => a - b)
  return [edges.length ? `cantell ${edges.join(", ")}` : "", mitres.length ? `inglet ${mitres.join(", ")}` : ""].filter(Boolean).join(" · ") || "sense cantell"
}

function EdgeBadges({ it }: { it: { mitreNumbers: number[]; edgeNumbers: number[] } }) {
  return (
    <HStack gap={1} wrap="wrap">
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
  )
}

/** La comanda d'un joc (calaix o llum): el títol, la taula de components i la nota de sota. */
function KitOrderTable({ group: g }: { group: KitGroup }) {
  return (
    <Stack gap={1}>
      <Text fontSize="sm" fontWeight="medium">
        {g.title}
      </Text>
      <Table.ScrollArea borderWidth="1px" rounded="lg">
        <Table.Root size="sm" variant="line" striped>
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeader>Component</Table.ColumnHeader>
              <Table.ColumnHeader textAlign="end">Qt</Table.ColumnHeader>
              <Table.ColumnHeader>Referència</Table.ColumnHeader>
              <Table.ColumnHeader>Notes</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {g.lines.map((l, i) => (
              <Table.Row key={i}>
                <Table.Cell fontWeight="medium">{l.name}</Table.Cell>
                <Table.Cell textAlign="end">{l.qty}</Table.Cell>
                <Table.Cell fontFamily="mono" fontSize="xs">
                  {l.item ?? "—"}
                </Table.Cell>
                <Table.Cell fontSize="xs" color="fg.muted">
                  {[l.cutLength !== undefined ? `tallar a ${l.cutLength} mm` : "", l.note ?? ""].filter(Boolean).join(" · ")}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Root>
      </Table.ScrollArea>
      {g.wood && (
        <Text fontSize="xs" color="fg.muted">
          {g.wood}
        </Text>
      )}
    </Stack>
  )
}

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
  const fittingRows = useMemo(() => fittingGroups(fittings), [fittings])
  // Elements iguals (material i mides) agrupats. Els components dels jocs de calaix (rol `hardware`) van a la seva taula.
  const extraRows = useMemo(() => {
    const rows = new Map<string, { label: string; material: string; l: number; w: number; t: number; qty: number }>()
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
      <Stack gap={2} display={{ base: "flex", md: "none" }}>
        {list.items.map((it, i) => {
          const on = i === selIdx
          const panel = on ? selPanel : undefined
          return (
            <Box
              key={i}
              as="button"
              textAlign="left"
              borderWidth="1px"
              rounded="lg"
              px={3.5}
              py={3}
              bg={on ? "wood.subtle" : "bg.panel"}
              borderColor={on ? "wood.solid" : undefined}
              onClick={() => setSelected(i)}
              aria-pressed={on}
            >
              <Stack gap={1.5}>
                <HStack justify="space-between" gap={2}>
                  <Text fontWeight="semibold" truncate>
                    {it.label}
                  </Text>
                  <Badge variant="subtle" flexShrink={0}>
                    × {it.qty}
                  </Badge>
                </HStack>
                <Text fontSize="sm">
                  {it.length} × {it.width} × {it.thickness} mm
                </Text>
                <Text fontSize="sm" color="fg.muted" truncate>
                  {it.material}
                  {it.grain !== "none" ? ` · veta ${GRAIN[it.grain].toLowerCase()}` : ""}
                </Text>
                {/* Línia pròpia: el total de la fila i els de cada peça no es tallen amb el material. */}
                <Text fontSize="sm" color="fg.muted">
                  {holesText(it.holes, it.qty)}
                </Text>
                <HStack gap={2} wrap="wrap">
                  <Text fontSize="xs" color="fg.muted">
                    Cantells
                  </Text>
                  <EdgeBadges it={it} />
                </HStack>
                {it.processes && (
                  <Text fontSize="xs" color="fg.muted">
                    {it.processes}
                  </Text>
                )}
                {panel && (
                  <Box bg="bg.muted" rounded="md" p={2} mt={1}>
                    <PanelDrawing panel={panel} />
                  </Box>
                )}
              </Stack>
            </Box>
          )
        })}
      </Stack>
      <Table.ScrollArea borderWidth="1px" rounded="lg" display={{ base: "none", md: "block" }}>
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
              <Table.ColumnHeader textAlign="end" title="Forats de totes les peces de la fila (i de cada peça)">Forats (total)</Table.ColumnHeader>
              <Table.ColumnHeader>Després del nesting</Table.ColumnHeader>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {list.items.map((it, i) => (
              <Table.Row
                key={i}
                cursor="pointer"
                onClick={() => setSelected(i)}
                aria-selected={i === selIdx}
                bg={i === selIdx ? "wood.subtle" : undefined}
                _hover={{ bg: i === selIdx ? "wood.subtle" : "bg.muted" }}
              >
                <Table.Cell fontWeight="medium">{it.label}</Table.Cell>
                <Table.Cell textAlign="end">{it.qty}</Table.Cell>
                <Table.Cell textAlign="end">{it.length}</Table.Cell>
                <Table.Cell textAlign="end">{it.width}</Table.Cell>
                <Table.Cell textAlign="end">{it.thickness}</Table.Cell>
                <Table.Cell>{it.material}</Table.Cell>
                <Table.Cell>{GRAIN[it.grain]}</Table.Cell>
                <Table.Cell>
                  <EdgeBadges it={it} />
                </Table.Cell>
                <Table.Cell textAlign="end">
                  {it.holes}
                  {it.qty > 1 && it.holes > 0 && Number.isInteger(it.holes / it.qty) && (
                    <Text as="span" display="block" fontSize="xs" color="fg.muted" whiteSpace="nowrap">
                      {it.holes / it.qty} per peça
                    </Text>
                  )}
                </Table.Cell>
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
        (i les mirall, com els laterals esquerre i dret) van a la mateixa fila, amb els cantells en l'orientació
        normalitzada; els de cada peça tal com és surten al detall. Clica una peça per veure'n el plànol.
      </Text>
      </Box>

      {sel && selPanel && (
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
      )}
      </Stack>

      {kitRows.length > 0 && (
        <Stack gap={2} data-testid="kit-orders">
          <SectionLabel>Ferratges dels jocs</SectionLabel>
          {kitRows.map((g) => (
            <KitOrderTable key={g.key} group={g} />
          ))}
          <Text fontSize="xs" color="fg.muted">
            Calaixos de doble paret: el joc del fabricant (números d'article del catàleg) i la fusta que demana (el fons i el darrere ja són a la llista de peces; cap lateral de fusta).
          </Text>
        </Stack>
      )}
      {fittingRows.length > 0 && (
        <Stack gap={2} data-testid="fitting-orders">
          <SectionLabel>Ferratges</SectionLabel>
          {fittingRows.map((g) => (
            <KitOrderTable key={g.key} group={g} />
          ))}
          <Text fontSize="xs" color="fg.muted">
            El que cal comprar per mòdul: frontisses, tiradors, pistons de gas i potes, amb el número d'article del catàleg (els forats ja són a les peces).
          </Text>
        </Stack>
      )}
      {lightRows.length > 0 && (
        <Stack gap={2} data-testid="light-orders">
          <SectionLabel>Llums i instal·lació elèctrica</SectionLabel>
          {lightRows.map((g) => (
            <KitOrderTable key={g.key} group={g} />
          ))}
          <Text fontSize="xs" color="fg.muted">
            Per mòdul: les làmpades amb el seu mecanitzat (ja és a les peces: forat o rebaix i forat del cable a la cara de sota) i el que cal per connectar-les a la xarxa (alimentador de 24 V amb cable, distribuïdor si hi ha més de sis làmpades, interruptor i el seu cable).
          </Text>
        </Stack>
      )}
      {extraRows.length > 0 && (
        <Stack gap={2}>
          <SectionLabel>Elements sense nesting</SectionLabel>
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

/** Forats d'una fila de peces iguals: el total i, si n'hi ha més d'una, els de cada peça («22 forats en total · 11 per peça»). */
function holesText(total: number, qty: number): string {
  const n = (v: number) => `${v} ${v === 1 ? "forat" : "forats"}`
  if (qty <= 1) return n(total)
  const per = total / qty
  return Number.isInteger(per) ? `${n(total)} en total · ${per} per peça` : `${n(total)} en total`
}
