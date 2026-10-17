import { Badge, Box, Image, Stack, Table, Text } from "@chakra-ui/react"
import { LuBookOpen, LuLayers2, LuListOrdered, LuPackageOpen, LuRoute, LuCircleDot } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { FormRow } from "../../components/FormRow"
import { KIT_BACKS, KIT_CLOSINGS, KIT_LEVEL_LABEL, type HardwareItem, type HardwareKit, type KitItemRef, type KitWhen } from "../../core/model"
import { fmtNum } from "../../lib/format"

/**
 * Seccions de l'editor d'un **joc paramètric** (Preferències › Ferratges › Calaixos de doble paret): el que s'ha llegit
 * del catàleg, **només lectura** (la prebroca dels cargols és una regla del taller, Preferències › Ferratges › «Prebroca
 * dels cargols»; la resta de dades del joc, de moment, només al fitxer `core/model/kits/*.ts`). Taula de variants (NL i números
 * d'article), opcions, regles de tria, components, peces de fusta amb les fórmules i mecanitzats, i les hipòtesis de
 * lectura pendents del taller.
 */
/** Totes les cel·les en una línia i la primera columna (NL) enganxada a l'esquerra mentre es desplaça la taula. */
const STICKY_FIRST = {
  "& th, & td": { whiteSpace: "nowrap" },
  "& th:first-of-type, & td:first-of-type": { position: "sticky", left: 0, zIndex: 1, bg: "bg", borderEndWidth: "1px" },
  "& tbody tr:nth-of-type(odd) td:first-of-type": { bg: "bg.muted" },
}

export function KitSections({ item, kit }: { item: HardwareItem; kit: HardwareKit }) {
  const closings = kit.options.closing
  const nls = kit.variants.map((v) => v.nl)
  return (
    <>
      <FoldItem id="kit-catalog" icon={LuBookOpen} title="Del catàleg" badge={`${kit.maker} ${kit.heightClass.code}`} defaultOpen>
        {kit.photo && (
          <FormRow label="Producte">
            <Image src={kit.photo} alt={item.name} rounded="md" maxW="240px" w="full" borderWidth="1px" />
          </FormRow>
        )}
        <FormRow label="Sistema">
          <Text fontSize="sm" pt="6px">
            {kit.maker} {kit.series} · calaix de doble paret, classe <strong>{kit.heightClass.code}</strong>: lateral de {fmtNum(kit.heightClass.boxSideHeight)} mm, darrere de fusta de {fmtNum(kit.heightClass.backHeight)} mm.
          </Text>
        </FormRow>
        {kit.source && (
          <FormRow label="Font">
            <Text fontSize="sm" pt="6px">
              {kit.source}
            </Text>
          </FormRow>
        )}
        <FormRow label="Al moble" help="El joc es tria al calaix (Front › Guia). El calaix no porta laterals de fusta: el fons i el darrere surten de les fórmules del joc, i els cargols de la guia, dels suports del front i del darrere es prebroquen.">
          <Text fontSize="sm" pt="6px">
            NL {nls[0]}–{nls.at(-1)} segons la fondària · {closings.length} {closings.length === 1 ? "tancament" : "tancaments"} · darrere {kit.options.back.map((b) => KIT_BACKS.find((x) => x.id === b)!.short.toLowerCase()).join(" o ")}
          </Text>
        </FormRow>
      </FoldItem>

      <FoldItem id="kit-variants" icon={LuListOrdered} title="Llargades i números d'article" badge={`${kit.variants.length} NL`}>
        {/* Desplaçament horitzontal (també al mòbil): la taula fa l'amplada que cal i la columna NL es queda fixa. */}
        <Box overflowX="auto" maxW="full" my={2} borderWidth="1px" borderColor="border.muted" rounded="md" css={{ scrollbarWidth: "thin", scrollbarGutter: "stable" }} data-testid="kit-variants-table">
          <Table.Root size="sm" variant="line" striped minW="max-content" css={STICKY_FIRST}>
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeader>NL</Table.ColumnHeader>
                {closings.map((c) => (
                  <Table.ColumnHeader key={c}>Joc {KIT_CLOSINGS.find((x) => x.id === c)!.short.toLowerCase()}</Table.ColumnHeader>
                ))}
                {closings.map((c) => (
                  <Table.ColumnHeader key={`s-${c}`}>Guies {KIT_CLOSINGS.find((x) => x.id === c)!.short.toLowerCase()}</Table.ColumnHeader>
                ))}
                <Table.ColumnHeader>Laterals</Table.ColumnHeader>
                <Table.ColumnHeader>Cargols (z)</Table.ColumnHeader>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {kit.variants.map((v) => (
                <Table.Row key={v.nl}>
                  <Table.Cell fontWeight="medium">{v.nl}</Table.Cell>
                  {closings.map((c) => (
                    <Table.Cell key={c} fontFamily="mono" fontSize="xs">
                      {v.kit[c] ?? "—"}
                    </Table.Cell>
                  ))}
                  {closings.map((c) => (
                    <Table.Cell key={`s-${c}`} fontFamily="mono" fontSize="xs">
                      {v.slides[c] ?? "—"}
                    </Table.Cell>
                  ))}
                  <Table.Cell fontFamily="mono" fontSize="xs">
                    {v.sideKit ?? "—"}
                  </Table.Cell>
                  <Table.Cell fontSize="xs" color="fg.muted">
                    {v.screws.both.join(" · ")} (2 fileres) · {v.screws.top.join(" · ")} (dalt)
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table.Root>
        </Box>
        <Text fontSize="xs" color="fg.muted" pb={2}>
          Cargols: columnes en mm des del cantell de davant del lateral del moble (el «tercer forat» del catàleg és a 37).
        </Text>
      </FoldItem>

      <FoldItem id="kit-rules" icon={LuRoute} title="Regles de tria" badge={`LT = NL + ${kit.rules.depthMargin}`}>
        <FormRow label="Llargada" help="La llargada nominal més gran que hi cap darrere del front (la fondària interior LT ha de ser almenys NL + marge) i que es vengui amb el tancament triat.">
          <Text fontSize="sm" pt="6px">
            LT = NL + {kit.rules.depthMargin} · guia a {fmtNum(kit.rules.slideSetback)} del cantell de davant · vora inferior de la guia a {fmtNum(kit.rules.baseAboveFront)} del cantell de baix del front
          </Text>
        </FormRow>
        <FormRow label="Amplada (KB)" help="Taula del catàleg per amplada del moble (KB = llum + 2 × 16): si cal estabilitzador (tancament suau) o barra de sincronització (push-open).">
          <Stack gap={0.5} pt="6px">
            {kit.rules.widths.map((w, i) => (
              <Text key={w.upTo} fontSize="sm">
                {i === 0 ? "fins a" : `${kit.rules.widths[i - 1]!.upTo + 1}–`}{w.upTo}: estabilitzador {KIT_LEVEL_LABEL[w.stabilizer]} · barra {KIT_LEVEL_LABEL[w.syncRod]}
              </Text>
            ))}
          </Stack>
        </FormRow>
        <FormRow label="Barra" help="Llargada de tall de la barra de sincronització (es ven de 1100).">
          <Stack gap={0.5} pt="6px">
            {Object.entries(kit.rules.syncRodCut).map(([c, e]) => (
              <Text key={c} fontSize="sm" fontFamily="mono">
                {KIT_CLOSINGS.find((x) => x.id === c)?.label}: {String(e)}
              </Text>
            ))}
          </Stack>
        </FormRow>
      </FoldItem>

      <FoldItem id="kit-components" icon={LuPackageOpen} title="Components" badge={`${kit.components.length}`}>
        <Stack gap={1} py={2}>
          {kit.components.map((c) => (
            <Box key={c.id} fontSize="sm">
              <Text as="span" fontWeight="medium">
                {c.name}
              </Text>
              <Text as="span" color="fg.muted">
                {" "}· {c.side === "both" ? "esquerre i dret" : c.side === "center" ? "un al mig" : c.side === "left" ? "esquerre" : "dret"} · {itemRefText(c.item)}
                {whenText(c.when) ? ` · ${whenText(c.when)}` : ""}
              </Text>
              {c.note && (
                <Text fontSize="xs" color="fg.muted">
                  {c.note}
                </Text>
              )}
            </Box>
          ))}
        </Stack>
      </FoldItem>

      <FoldItem id="kit-wood" icon={LuLayers2} title="Peces de fusta" badge={`${kit.wood.length} fórmules`}>
        <Stack gap={1} py={2}>
          {kit.wood.map((w, i) => (
            <Box key={i} fontSize="sm">
              <Text as="span" fontWeight="medium">
                {w.name}
              </Text>
              <Text as="span" fontFamily="mono">
                {" "}{String(w.width)} × {String(w.depth ?? w.height ?? "")} × {w.thickness === "bottom" ? "TB" : "G"}
              </Text>
              <Text as="span" color="fg.muted">
                {whenText(w.when) ? ` · ${whenText(w.when)}` : ""}
                {w.note ? ` · ${w.note}` : ""}
              </Text>
            </Box>
          ))}
          <Text fontSize="xs" color="fg.muted">
            LW llum interior · NL llargada nominal · KB amplada del moble · G gruix del tauler · TB gruix del fons del calaix · H alçada del lateral · BH alçada del darrere. Cap lateral de fusta.
          </Text>
        </Stack>
      </FoldItem>

      <FoldItem id="kit-machining" icon={LuCircleDot} title="Mecanitzats del joc" badge="prebroques">
        <FormRow label="Lateral" help="Cargols de la guia: a les columnes de cada NL i a aquestes alçades per sobre de la vora inferior de la guia (mirall al lateral dret).">
          <Text fontSize="sm" pt="6px">
            fileres a {kit.machining.side.rows.map((v) => fmtNum(v)).join(" i ")} mm
          </Text>
        </FormRow>
        <FormRow label="Front" help="Suports de davant, al darrere del front: a aquesta distància de la cara interior de cada lateral del moble i a aquestes alçades del joc; el de baix a almenys la distància mínima del cantell de baix del front.">
          <Text fontSize="sm" pt="6px">
            a {fmtNum(kit.machining.front.x)} de cada lateral · alçades {kit.machining.front.ys.map((v) => fmtNum(v)).join(" · ")} · mín. {fmtNum(kit.machining.front.minFromBottom)} de baix
          </Text>
        </FormRow>
        {kit.machining.back && (
          <FormRow label="Darrere" help="Suports de darrere, a la cara de darrere del darrere de fusta.">
            <Text fontSize="sm" pt="6px">
              a {fmtNum(kit.machining.back.xFromEdge)} de cada cantell · alçades {kit.machining.back.ys.map((v) => fmtNum(v)).join(" · ")} des de baix
            </Text>
          </FormRow>
        )}
        <Text fontSize="xs" color="fg.muted" pb={2}>
          Totes són prebroques del Ø i la fondària de «Mides» (regla del taller: Ø2 × 10). Amb Ø 0, cap forat.
        </Text>
      </FoldItem>

      {kit.hypotheses?.length ? (
        <FoldItem id="kit-hypotheses" icon={LuBookOpen} title="Hipòtesis de lectura" badge={<Badge size="xs" colorPalette="orange" variant="subtle">{kit.hypotheses.length}</Badge>}>
          <Stack gap={1} py={2}>
            {kit.hypotheses.map((h, i) => (
              <Text key={i} fontSize="sm">
                • {h}
              </Text>
            ))}
            <Text fontSize="xs" color="fg.muted">
              El dibuix del catàleg no ho acota tot: comprovar-ho amb la guia a la mà abans de mecanitzar.
            </Text>
          </Stack>
        </FoldItem>
      ) : null}
    </>
  )
}

function itemRefText(ref: KitItemRef): string {
  switch (ref.kind) {
    case "fixed":
      return ref.item
    case "variant":
      return ref.field === "slides" ? "número de les guies de la NL" : "número del joc de laterals de la NL"
    case "byWidth":
      return `${ref.prefix}<KB> (${ref.widths[0]}–${ref.widths.at(-1)})`
    case "none":
      return "sense número al catàleg"
  }
}

function whenText(when: KitWhen | undefined): string {
  if (!when) return ""
  const parts: string[] = []
  if (when.closing) parts.push(when.closing.map((c) => KIT_CLOSINGS.find((x) => x.id === c)!.short.toLowerCase()).join(" / "))
  if (when.back) parts.push(`darrere ${when.back.map((b) => KIT_BACKS.find((x) => x.id === b)!.short.toLowerCase()).join(" / ")}`)
  if (when.rule) parts.push(when.rule === "syncRod" ? "si la taula d'amplades ho recomana" : "si la taula d'amplades ho recomana")
  return parts.join(" · ")
}
