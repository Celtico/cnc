import { Stack, Table, Text } from "@chakra-ui/react"
import { LuBookOpen, LuCircleDot, LuListOrdered, LuPackageOpen } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { FormRow } from "../../components/FormRow"
import { LIGHT_KINDS, fmtMm, lightSystemOf, type HardwareItem, type LightKit } from "../../core/model"

/**
 * Seccions de l'editor d'un **joc de llum** (Preferències › Ferratges › Llums; per decisió de l'usuari, 2026-10-14: «tota la
 * informació del producte, com als calaixos de doble paret»): el que s'ha llegit del catàleg, **només lectura** com
 * `KitSections` —la làmpada, el mecanitzat (i com hi passa el cable al moble), les llargades d'una barra, el sistema
 * elèctric del fabricant (alimentadors, distribuïdor, interruptors, cables, tapa passacables) i les hipòtesis—.
 */
export function LightSections({ item, kit }: { item: HardwareItem; kit: LightKit }) {
  const sys = lightSystemOf(kit.maker)
  const kind = LIGHT_KINDS.find((k) => k.id === kit.kind)?.label ?? kit.kind
  const recess = kit.recess.shape === "round" ? `forat Ø${fmtMm(kit.recess.size)} × ${fmtMm(kit.recess.depth)}` : kit.recess.shape === "square" ? `rebaix de ${fmtMm(kit.recess.size)} × ${fmtMm(kit.recess.size)} × ${fmtMm(kit.recess.depth)}` : `ranura de ${fmtMm(kit.recess.size)} × ${fmtMm(kit.recess.depth)} al llarg`
  return (
    <>
      <FoldItem id="light-catalog" icon={LuBookOpen} title="Del catàleg" badge={`${kit.maker} ${kit.series}`} defaultOpen>
        <FormRow label="Producte">
          <Text fontSize="sm" pt="6px">
            {kit.maker} {kit.series} · {kind.toLowerCase()} · {kit.colour}
            {kit.finish ? ` · ${kit.finish}` : ""}
          </Text>
        </FormRow>
        <FormRow label="Article">
          <Text fontSize="sm" pt="6px" fontFamily="mono">
            {kit.article}
          </Text>
        </FormRow>
        <FormRow label="Potència">
          <Text fontSize="sm" pt="6px">
            {fmtMm(kit.watts)} W{kit.peakWatts ? ` (${fmtMm(kit.peakWatts)} W en encendre)` : ""}
            {kit.lumens ? ` · ${fmtMm(kit.lumens)} lm` : ""}
          </Text>
        </FormRow>
        <FormRow label="Font">
          <Text fontSize="sm" pt="6px">
            {kit.source}
          </Text>
        </FormRow>
        <FormRow label="Al moble" help="Es tria a l'accessori «Llum» del compartiment o a «Llum a sota» del mòdul. Les làmpades es reparteixen al llarg del compartiment, a la distància de «Mides».">
          <Text fontSize="sm" pt="6px">
            {item.name}
          </Text>
        </FormRow>
      </FoldItem>

      <FoldItem id="light-machining" icon={LuCircleDot} title="Mecanitzat" badge={recess}>
        <FormRow label="Làmpada" help="A la cara de sota de la peça de sobre (la tapa, un travesser, un prestatge o, amb «Llum a sota», la base).">
          <Text fontSize="sm" pt="6px">
            {recess} · cos de {fmtMm(kit.body.size)} mm, {fmtMm(kit.body.height)} d'alt
          </Text>
        </FormRow>
        <FormRow label="Cable" help="Al moble, el cable va per dins del tauler (forat de cantell des del darrere, es fa després de la CNC) i per la cambra de darrere del fons fins a l'alimentador; en un tauler massa prim, el passant de la làmpada.">
          <Text fontSize="sm" pt="6px">
            Ø{fmtMm(kit.cableHole)}
            {kit.cableLength ? ` · cable de ${fmtMm(kit.cableLength / 1000)} m` : ""}
          </Text>
        </FormRow>
        {kit.surface && (
          <FormRow label="Si no s'encasta" help="Tauler massa prim o sense lloc: la versió per sobreposar (només el forat del cable).">
            <Text fontSize="sm" pt="6px">
              {kit.surface.name} · <span style={{ fontFamily: "monospace" }}>{kit.surface.article}</span> · {fmtMm(kit.surface.height)} mm
            </Text>
          </FormRow>
        )}
      </FoldItem>

      {kit.bars && (
        <FoldItem id="light-bars" icon={LuListOrdered} title="Llargades i números d'article" badge={`${kit.bars.length}`}>
          <Table.Root size="sm" variant="line" striped my={2}>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader textAlign="end">Llarg</Table.ColumnHeader>
                <Table.ColumnHeader>Article</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">W</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {kit.bars.map((b) => (
                <Table.Row key={b.article}>
                  <Table.Cell textAlign="end">{fmtMm(b.length)}</Table.Cell>
                  <Table.Cell fontFamily="mono" fontSize="xs">
                    {b.article}
                  </Table.Cell>
                  <Table.Cell textAlign="end">{fmtMm(b.watts)}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          {kit.barStep && (
            <Text fontSize="xs" color="fg.muted">
              Es pot tallar cada {fmtMm(kit.barStep)} mm.
            </Text>
          )}
        </FoldItem>
      )}

      {sys && (
        <FoldItem id="light-system" icon={LuPackageOpen} title="Sistema elèctric" badge={sys.name}>
          <Table.Root size="sm" variant="line" striped my={2}>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>Alimentador</Table.ColumnHeader>
                <Table.ColumnHeader>Article</Table.ColumnHeader>
                <Table.ColumnHeader textAlign="end">Ranures</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {sys.drivers.map((d) => (
                <Table.Row key={d.article}>
                  <Table.Cell>
                    {d.watts} W · {d.size} mm
                  </Table.Cell>
                  <Table.Cell fontFamily="mono" fontSize="xs">
                    {d.article}
                  </Table.Cell>
                  <Table.Cell textAlign="end">{d.slots}</Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
          <Stack gap={1} fontSize="sm">
            <Text>
              <b>Distribuïdor</b> {sys.distributor.name} · <code>{sys.distributor.article}</code>
            </Text>
            <Text>
              <b>Interruptor de porta</b> {sys.doorSwitch.name} · <code>{sys.doorSwitch.article}</code> · forat Ø{fmtMm(sys.doorSwitch.bore)} × {fmtMm(sys.doorSwitch.depth)} al cantell del lateral
            </Text>
            <Text>
              <b>Interruptor de proximitat</b> {sys.touchSwitch.name} · <code>{sys.touchSwitch.article}</code>
            </Text>
            <Text>
              <b>Cable de l'interruptor</b> {sys.switchCable.name} · <code>{sys.switchCable.article}</code>
            </Text>
            <Text>
              <b>Cables d'extensió</b> {sys.extensions.map((e) => `${fmtMm(e.length / 1000)} m ${e.article}`).join(" · ")} (com a molt {fmtMm(sys.maxCable / 1000)} m fins a la làmpada)
            </Text>
            {sys.cableCover && (
              <Text>
                <b>Tapa passacables</b> {sys.cableCover.name} · <code>{sys.cableCover.article}</code>
              </Text>
            )}
            {sys.notes.map((n, i) => (
              <Text key={i} fontSize="xs" color="fg.muted">
                {n}
              </Text>
            ))}
            <Text fontSize="xs" color="fg.muted">
              {sys.source}
            </Text>
          </Stack>
        </FoldItem>
      )}

      {kit.hypotheses.length > 0 && (
        <FoldItem id="light-hypotheses" icon={LuBookOpen} title="Hipòtesis" badge={`${kit.hypotheses.length}`}>
          <Stack gap={1} fontSize="sm">
            {kit.hypotheses.map((h, i) => (
              <Text key={i}>{h}</Text>
            ))}
          </Stack>
        </FoldItem>
      )}
    </>
  )
}
