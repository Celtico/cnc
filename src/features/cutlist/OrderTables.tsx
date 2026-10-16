import { Stack, Table, Text } from "@chakra-ui/react"
import { SectionLabel } from "../../components/SectionLabel"
import type { CompositionBuild } from "../../core/build/buildComposition"
import type { KitGroup } from "../../core/build/kitOrders"
import { KitOrderCard } from "./KitOrderCard"
import { WiringPlan } from "./WiringPlan"

/** Les comandes de ferratges: jocs de calaix, ferratges per mòdul, ferratges per metres i llums (amb el pla de cablejat). */
export function OrderSections({ kitRows, fittingRows, linearRows, lightRows, wirings }: { kitRows: KitGroup[]; fittingRows: KitGroup[]; linearRows: KitGroup[]; lightRows: KitGroup[]; wirings: CompositionBuild["wirings"] }) {
  return (
    <>
    {kitRows.length > 0 && (
      <Stack gap={3} data-testid="kit-orders">
        <SectionLabel>Ferratges dels jocs</SectionLabel>
        {kitRows.map((g) => (
          <KitOrderCard key={g.key} group={g} />
        ))}
        <Text fontSize="xs" color="fg.muted">
          Calaixos de doble paret: el joc del fabricant (números d'article del catàleg) i la fusta que demana (el fons i el darrere ja són a la llista de peces; cap lateral de fusta).
        </Text>
      </Stack>
    )}
    {fittingRows.length > 0 && (
      <Stack gap={3} data-testid="fitting-orders">
        <SectionLabel>Ferratges</SectionLabel>
        {fittingRows.map((g) => (
          <KitOrderCard key={g.key} group={g} />
        ))}
        <Text fontSize="xs" color="fg.muted">
          El que cal comprar per mòdul: frontisses, tiradors, pistons de gas i potes, amb el número d'article del catàleg (els forats ja són a les peces).
        </Text>
      </Stack>
    )}
    {linearRows.length > 0 && (
      <Stack gap={3} data-testid="linear-orders">
        <SectionLabel>Ferratges per metres</SectionLabel>
        {linearRows.map((g) => (
          <KitOrderCard key={g.key} group={g} />
        ))}
        <Text fontSize="xs" color="fg.muted">
          Perfils que es compren en barres (o per metres) i es tallen a mida: la regleta de paret dels penjadors (la dels mòduls penjats seguits, d'un sol tros) i els sòcols d'alumini, amb els clips i les cantoneres.
        </Text>
      </Stack>
    )}
    {lightRows.length > 0 && (
      <Stack gap={3} data-testid="light-orders">
        <SectionLabel>Llums i instal·lació elèctrica</SectionLabel>
        {lightRows.map((g) => (
          <KitOrderCard key={g.key} group={g} />
        ))}
        {wirings.map((w) => (
          <WiringPlan key={w.moduleId} item={w} />
        ))}
        <Text fontSize="xs" color="fg.muted">
          Per mòdul: les làmpades amb el seu mecanitzat (ja és a les peces: forat o rebaix i forat del cable a la cara de sota) i el que cal per connectar-les a la xarxa (alimentador de 24 V amb cable, distribuïdor si hi ha més de sis làmpades, interruptor i el seu cable).
        </Text>
      </Stack>
    )}
    </>
  )
}

export interface ExtraRow {
  label: string
  material: string
  l: number
  w: number
  t: number
  qty: number
}

/** Elements sense nesting (ferro, pedra, vidre…): iguals agrupats. */
export function ExtraElementsTable({ rows: extraRows }: { rows: ExtraRow[] }) {
  return (
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
  )
}
