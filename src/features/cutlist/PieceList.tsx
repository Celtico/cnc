import { Badge, Box, HStack, Stack, Table, Text } from "@chakra-ui/react"
import { PanelDrawing } from "../../components/PanelDrawing"
import type { CutListItem } from "../../core/cutlist/toCutList"
import type { Grain, Panel } from "../../core/model"

const GRAIN: Record<Grain, string> = { x: "Llarg", y: "Ample", none: "—" }

/** Cantells de la peça: els a inglet (45°) i els folrats, com a etiquetes. */
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

/** Mòbil: una targeta per peça (la taula no hi cap); la triada mostra el plànol a dins. */
export function PieceCards({ items, selIdx, selPanel, onSelect }: { items: CutListItem[]; selIdx: number; selPanel: Panel | undefined; onSelect: (i: number) => void }) {
  return (
    <Stack gap={2} display={{ base: "flex", md: "none" }}>
      {items.map((it, i) => {
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
            onClick={() => onSelect(i)}
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
  )
}

/** Escriptori: la taula de peces; clicar una fila la tria. */
export function PieceTable({ items, selIdx, onSelect }: { items: CutListItem[]; selIdx: number; onSelect: (i: number) => void }) {
  return (
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
          {items.map((it, i) => (
            <Table.Row
              key={i}
              cursor="pointer"
              onClick={() => onSelect(i)}
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
  )
}

/** Forats d'una fila de peces iguals: el total i, si n'hi ha més d'una, els de cada peça («22 forats en total · 11 per peça»). */
function holesText(total: number, qty: number): string {
  const n = (v: number) => `${v} ${v === 1 ? "forat" : "forats"}`
  if (qty <= 1) return n(total)
  const per = total / qty
  return Number.isInteger(per) ? `${n(total)} en total · ${per} per peça` : `${n(total)} en total`
}
