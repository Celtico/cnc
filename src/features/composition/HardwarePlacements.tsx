import { Badge, Box, Button, chakra, HStack, IconButton, Stack, Text } from "@chakra-ui/react"
import { useState } from "react"
import type { IconType } from "react-icons"
import { LuCopy, LuPencil, LuPlus, LuTrash2, LuWrench } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { SectionLabel } from "../../components/SectionLabel"
import type { RuleHardwareCount } from "../../core/build/hardwareSummary"
import { HARDWARE_ICONS } from "../settings/hardwareIcons"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { NumberField } from "../../components/NumRow"
import { dimFont, fmtMm, layoutDims } from "../../components/dims"
import { DimLayer } from "../../components/DimLine"
import { HardwareDrawer, HardwareSelect } from "../settings/HardwareSelect"
import { placeableOn } from "../settings/hardwareGroups"
import { UI_PATHS, hardwareSummary, isPendingImport, machiningParts, type Composition, type HardwareItem, type HardwarePlacement, type Panel, type PlacePos } from "../../core/model"
import type { CompositionWarning } from "../../core/build/buildComposition"
import { newPlacement, panelAxes, partLabel, placeableItems, placementAdvanced, placementPreview, placementScope, placementWarnings, placePosValue, roleFor, scopePanels, scopePlacements, simplifyPlacement, updatePlacement, type PlacementScope } from "./placements"

/**
 * **Ferratges col·locats a mà** (millores v1 F4; Editor › mòdul o peça lliure › «Ferratges»): només els **«només 3D»**
 * (sense cap lloc al moble; els d'un lloc els posen les regles). «Afegir ferratge» → un de la biblioteca → la peça del
 * mòdul on va i quin grup de mecanitzats de l'item li toca → on va el punt de referència (des d'un cantell o del mig,
 * amb els eixos del moble, més la distància). Res més: ni repeticions, ni mirall, ni fórmules, ni gir del model (les
 * d'una versió anterior es llegeixen igual i surten com a «Avançat», amb «Simplificar»). Les altres peces de l'item
 * (p. ex. la base d'un perfil de porta corredissa) només si es trien aquí. Es guarda una còpia de l'item (com els
 * mòduls). Tot o res: si no hi cap, cap forat i l'avís surt a «Avisos de fusteria».
 */
const RULE_ICONS: Record<RuleHardwareCount["id"], IconType> = {
  hinge: HARDWARE_ICONS.hinge,
  handle: HARDWARE_ICONS.handle,
  slide: HARDWARE_ICONS.slide,
  kit: HARDWARE_ICONS["drawer-system"],
  flap: HARDWARE_ICONS.lift,
  leg: HARDWARE_ICONS.leg,
  push: HARDWARE_ICONS.push,
  magnet: HARDWARE_ICONS.push,
  dowel: HARDWARE_ICONS.connector,
  rail: HARDWARE_ICONS.wall,
  led: HARDWARE_ICONS.profile,
  glassFrame: HARDWARE_ICONS.profile,
}

/** Les accions d'un col·locat (llista de l'inspector i barra flotant del 3D): el mateix camí i un pas de desfer. */
export interface PlacementActions {
  /** Triar-lo (es ressalta al 3D i l'inspector passa a ell). */
  onSelect: (id: string) => void
  /** Editar-lo: triar-lo i portar l'inspector a la vista (al mòbil, la pestanya Propietats). */
  onEdit: (id: string) => void
  onDuplicate: (id: string) => void
  onRemove: (id: string) => void
}

/**
 * **Ferratges del mòdul o de la peça lliure** (Editor › «Ferratges», com la llista de ferratges d'un configurador de
 * fabricant): els **col·locats a mà** (millores v1 F4), un per fila amb Editar · Duplicar · Eliminar (triar-ne un el
 * ressalta al 3D), «Afegir ferratge» i, a sota, els que posen **les regles** del mòdul (frontisses, tiradors, guies,
 * potes…), comptats. Es guarda una còpia de l'item (com els mòduls). Tot o res: si no hi cap, cap forat i l'avís surt a
 * la seva fila i a «Avisos de fusteria».
 */
export function HardwarePlacements({
  comp,
  scope,
  panels,
  library,
  warnings,
  onChange,
  selectedId,
  actions,
  rules,
}: {
  comp: Composition
  scope: PlacementScope
  panels: readonly Panel[]
  library: readonly HardwareItem[]
  warnings: readonly CompositionWarning[]
  onChange: (c: Composition) => void
  selectedId?: string | null
  actions: PlacementActions
  /** Els de les regles del mòdul (`ruleHardwareCounts`). */
  rules?: readonly RuleHardwareCount[]
}) {
  const here = scopePanels(scope, panels)
  // Només els que es poden col·locar en alguna peça d'aquí (amb mecanitzats per a una d'elles, o «només 3D»).
  const items = placeableItems(library).filter((x) => placeableOn(x, here.map((h) => h.part)))
  const list = scopePlacements(comp, scope)
  const [picking, setPicking] = useState(false)
  const add = (item: HardwareItem | undefined) => {
    const on = item && (here.find((h) => machiningParts(item.machining ?? []).includes(h.part)) ?? here[0])
    if (!item || !on) return
    const pl = newPlacement(item, on)
    onChange({ ...comp, hardwarePlacements: [...(comp.hardwarePlacements ?? []), pl] })
    actions.onEdit(pl.id)
  }
  return (
    // `inline-size`: les files llargues es tallen amb «…» en lloc d'eixamplar la secció (i tapar-ne les accions).
    <Stack gap={2} data-testid="hardware-placements" css={{ containerType: "inline-size" }}>
      <SectionLabel>Col·locats a mà</SectionLabel>
      {list.map((pl) => {
        const main = here.find((h) => (h.target.panel ?? h.target.freePart) === (pl.targets[0]!.panel ?? pl.targets[0]!.freePart))
        const mine = placementWarnings(warnings, pl)
        const on = selectedId === pl.id
        return (
          <Box key={pl.id} minW={0} borderWidth="1px" borderColor={on ? "wood.solid" : "border.muted"} bg={on ? "wood.subtle" : undefined} rounded="md" px={2} py={1} data-testid="placement-row">
            <HStack justify="space-between" gap={1}>
              {/* Un botó que es pot encongir (el `Button` de Chakra no: la fila sortia del panell i tapava les accions). */}
              <chakra.button type="button" flex={1} minW={0} textAlign="start" fontSize="sm" fontWeight="medium" py={1} truncate onClick={() => actions.onSelect(pl.id)} aria-pressed={on} title={`${pl.item.name} · ${main?.label ?? "peça que ja no hi és"} — triar-lo (es ressalta al 3D)`}>
                {pl.item.name} · {main?.label ?? "peça que ja no hi és"}
                {main && pl.repeat ? ` × ${placementPreview(pl, main.panel).refs.length}` : ""}
                {pl.mirror ? " · mirall" : ""}
              </chakra.button>
              <PlacementButtons id={pl.id} name={pl.item.name} actions={actions} />
            </HStack>
            {mine.map((w, i) => (
              <Text key={i} fontSize="xs" color="orange.fg">
                {w.message}
              </Text>
            ))}
          </Box>
        )
      })}
      {!placeableItems(library).length ? (
        <Text fontSize="sm" color="fg.muted">
          Cap ferratge amb mecanitzats a la biblioteca: fes-ne un (o importa'l) a Preferències › Ferratges i posa-li els mecanitzats al «Generador de mecanitzats».
        </Text>
      ) : !here.length ? (
        <Text fontSize="sm" color="fg.muted">
          Aquesta peça no és de CNC: no s'hi pot col·locar cap ferratge.
        </Text>
      ) : (
        <Box>
          <Button size="xs" variant="outline" onClick={() => setPicking(true)} data-testid="placement-add">
            <LuPlus /> Afegir ferratge
          </Button>
          <HardwareDrawer
            open={picking}
            onOpenChange={setPicking}
            label="Afegir ferratge"
            items={items}
            note="Els ferratges amb mecanitzats del generador (o «només 3D») que es poden posar a les peces d'aquí. En triar-ne un es col·loca al mig de la peça i se n'obre la col·locació."
            onPick={add}
          />
        </Box>
      )}
      {rules && (
        <>
          <SectionLabel pt={2}>De les regles del mòdul</SectionLabel>
          {rules.length ? (
            <Stack gap={1} data-testid="rule-hardware">
              {rules.map((r) => {
                const Icon = RULE_ICONS[r.id]
                return (
                  <HStack key={r.id} gap={2} fontSize="sm">
                    <Box color="fg.muted" flexShrink={0}>
                      <Icon />
                    </Box>
                    <Text flex={1} truncate>
                      {r.label}
                      {r.detail ? <Text as="span" color="fg.muted"> · {r.detail}</Text> : null}
                    </Text>
                    <Badge size="sm" variant="subtle">
                      {r.count}
                      {r.unit ? ` ${r.unit}` : ""}
                    </Badge>
                  </HStack>
                )
              })}
              <Text fontSize="xs" color="fg.muted">
                Els posa el mòdul. Quins són: a {UI_PATHS.frontsAndDrawers} (frontissa, guia o joc, braç, imant, tirador), a {UI_PATHS.joinery} (espiga, System 32), a la base «Potes» i al Front o als Accessoris de cada compartiment.
              </Text>
            </Stack>
          ) : (
            <Text fontSize="sm" color="fg.muted">
              Cap (sense portes, calaixos, abatibles ni potes).
            </Text>
          )}
        </>
      )}
    </Stack>
  )
}

/** Editar · Duplicar · Eliminar (icones del catàleg) d'un col·locat. */
export function PlacementButtons({ id, name, actions, edit = true }: { id: string; name: string; actions: Pick<PlacementActions, "onEdit" | "onDuplicate" | "onRemove">; edit?: boolean }) {
  return (
    <HStack gap={0} flexShrink={0}>
      {edit && (
        <IconButton aria-label={`Editar «${name}»`} title="Editar" size="2xs" variant="ghost" onClick={() => actions.onEdit(id)}>
          <LuPencil />
        </IconButton>
      )}
      <IconButton aria-label={`Duplicar «${name}»`} title="Duplicar" size="2xs" variant="ghost" onClick={() => actions.onDuplicate(id)}>
        <LuCopy />
      </IconButton>
      <IconButton aria-label={`Eliminar «${name}»`} title="Eliminar" size="2xs" variant="ghost" colorPalette="red" onClick={() => actions.onRemove(id)}>
        <LuTrash2 />
      </IconButton>
    </HStack>
  )
}

/**
 * Inspector d'un ferratge col·locat (selecció `hardware`: clic al 3D, a la llista o «Editar»): el ferratge, la peça i la
 * posició del punt de referència, amb els seus avisos.
 */
export function PlacementInspector({ comp, id, panels, library, warnings, onChange }: { comp: Composition; id: string; panels: readonly Panel[]; library: readonly HardwareItem[]; warnings: readonly CompositionWarning[]; onChange: (c: Composition) => void }) {
  const pl = comp.hardwarePlacements?.find((h) => h.id === id)
  const scope = pl && placementScope(pl)
  if (!pl || !scope) return null
  const here = scopePanels(scope, panels)
  const mine = placementWarnings(warnings, pl)
  const main = here.find((h) => (h.target.panel ?? h.target.freePart) === (pl.targets[0]!.panel ?? pl.targets[0]!.freePart))
  return (
    <Stack gap={0}>
      {mine.length > 0 && (
        <Stack gap={1} py={2}>
          {mine.map((w, i) => (
            <Text key={i} fontSize="xs" color="orange.fg">
              {w.message}
            </Text>
          ))}
        </Stack>
      )}
      <FoldItem id="hw-place" icon={LuWrench} title="Col·locació" badge={main?.label} defaultOpen>
        <PlacementEditor pl={pl} here={here} items={placeableItems(library).filter((x) => placeableOn(x, here.map((h) => h.part)))} onChange={(next) => onChange(updatePlacement(comp, next))} />
      </FoldItem>
    </Stack>
  )
}

function PlacementEditor({ pl, here, items, onChange }: { pl: HardwarePlacement; here: ReturnType<typeof scopePanels>; items: HardwareItem[]; onChange: (pl: HardwarePlacement) => void }) {
  const main = pl.targets[0]!
  const key = (t: { panel?: string; freePart?: string }) => t.panel ?? t.freePart ?? ""
  const on = here.find((h) => key(h.target) === key(main))
  const parts = machiningParts(pl.item.machining ?? [])
  const axes = on ? panelAxes(on.panel) : null
  const setPos = (k: "p" | "q", pos: PlacePos) => onChange({ ...pl, [k]: pos })
  // Les altres peces (grups de l'item que no són el de la peça principal): només si es trien.
  const others = parts.filter((p) => p !== main.part)
  // Opcions d'una versió anterior (repetició, mirall, gir, fórmula): es mostren i es poden simplificar; no s'editen.
  const advanced = placementAdvanced(pl)
  return (
    <Stack gap={0} pt={2}>
      <FormRow label="Ferratge" help={hardwareSummary(pl.item) + (isPendingImport(pl.item) ? " — importat sense confirmar: no fa cap forat." : "")}>
        <HardwareSelect
          label="Ferratge"
          items={items}
          current={pl.item}
          onPick={(item) => item && onChange({ ...pl, item, targets: [{ ...main, part: on ? roleFor(item, on.part) : main.part }] })}
        />
      </FormRow>
      {here.length > 1 && (
        <FormRow label="Peça" help="La peça del mòdul on va el punt de referència del ferratge.">
          <ChoiceChips
            label="Peça"
            value={on?.key ?? ""}
            options={here.map((h) => ({ id: h.key, label: h.label }))}
            onChange={(k) => {
              const h = here.find((x) => x.key === k)!
              onChange({ ...pl, targets: [{ part: roleFor(pl.item, h.part), ...h.target }, ...pl.targets.slice(1).filter((t) => key(t) !== key(h.target))] })
            }}
          />
        </FormRow>
      )}
      {parts.length > 1 && (
        <FormRow label="Mecanitzats de" help="Quin grup de mecanitzats de l'item es fa a aquesta peça.">
          <ChoiceChips label="Mecanitzats de" value={main.part} options={parts.map((p) => ({ id: p, label: partLabel(p) }))} onChange={(part) => onChange({ ...pl, targets: [{ ...main, part }, ...pl.targets.slice(1).filter((t) => t.part !== part)] })} />
        </FormRow>
      )}
      {on && <PlacementPreview pl={pl} panel={on.panel} />}
      {advanced.length > 0 ? (
        <FormRow label="Avançat" help="Opcions d'una versió anterior de l'app. Es continuen fabricant igual; per canviar la posició, simplifica-ho (una sola posició, la de la primera còpia d'ara).">
          <Stack gap={1.5} pt="6px" data-testid="placement-advanced">
            <Text fontSize="sm">{advanced.join(" · ")}</Text>
            <Box>
              <Button size="xs" variant="outline" onClick={() => onChange(simplifyPlacement(pl, on?.panel))}>
                Simplificar
              </Button>
            </Box>
          </Stack>
        </FormRow>
      ) : (
        axes && on && (["p", "q"] as const).map((k) => <PlacePosRow key={k} axis={k} names={axes[k]} pos={pl[k]} panel={on.panel} onChange={(pos) => setPos(k, pos)} />)
      )}
      {others.map((part) => {
        const choices = here.filter((h) => h.part === part || part === "part")
        const cur = pl.targets.find((t, i) => i > 0 && t.part === part)
        return (
          <FormRow key={part} label={`També: ${partLabel(part)}`} help={`L'item també té mecanitzats per a ${partLabel(part).toLowerCase()}: només es fan si tries la peça (amb la mateixa posició).`}>
            <ChoiceChips
              label={`També: ${partLabel(part)}`}
              value={cur ? key(cur) : "none"}
              options={[{ id: "none", label: "No" }, ...choices.map((h) => ({ id: key(h.target), label: h.label }))]}
              onChange={(k) => {
                const rest = pl.targets.filter((t, i) => i === 0 || t.part !== part)
                const h = choices.find((x) => key(x.target) === k)
                onChange({ ...pl, targets: h ? [...rest, { part, ...h.target }] : rest })
              }}
            />
          </FormRow>
        )
      })}
    </Stack>
  )
}

/**
 * La posició d'un eix (`PlacePos`): des d'un cantell o del mig, més la distància (mm). A sota, on cau ara. (Les
 * fórmules i el percentatge d'abans es llegeixen igual, però ja no s'editen: «Avançat».)
 */
function PlacePosRow({ axis, names, pos, panel, onChange }: { axis: "p" | "q"; names: { name: string; ends: [string, string] }; pos: PlacePos; panel: Panel; onChange: (p: PlacePos) => void }) {
  const now = placePosValue(pos, panel, axis)
  const from0 = names.ends[0] === "esquerra" ? "l'esquerra" : names.ends[0]
  const from1 = names.ends[1] === "dreta" ? "la dreta" : names.ends[1]
  return (
    <FormRow label={names.name} help={`On va el punt de referència del ferratge (la creu del generador): des d'un cantell o del mig de la peça, més la distància. ${now !== null ? `Ara: a ${fmtMm(now)} mm de ${from0}.` : ""}`}>
      <Stack gap={1.5}>
        <ChoiceChips
          label={names.name}
          value={pos.from === "ratio" ? "center" : pos.from}
          options={[
            { id: "min", label: `Des de ${from0}` },
            { id: "max", label: `Des de ${from1}` },
            { id: "center", label: "Mig" },
          ]}
          onChange={(from) => onChange({ from: from as PlacePos["from"], at: pos.at })}
        />
        <Box w="130px">
          <NumberField label="" ariaLabel={`${names.name}: distància`} value={pos.at} min={-5000} max={5000} step={1} onChange={(at) => Number.isFinite(at) && onChange({ ...pos, at })} />
        </Box>
      </Stack>
    </FormRow>
  )
}

/**
 * Previsualització en viu de la col·locació a la peça (el mateix càlcul que el moble): la peça en P × Q, les còpies (i el
 * mirall) amb les seves operacions i les cotes (total, encadenades des dels cantells i entre còpies).
 */
function PlacementPreview({ pl, panel }: { pl: HardwarePlacement; panel: Panel }) {
  const pv = placementPreview(pl, panel)
  const axes = panelAxes(panel)
  const [W, H] = pv.size
  const box = { x0: 0, y0: 0, x1: W, y1: H }
  // Una mica més gran que als plànols de Preferències: la columna de l'inspector és estreta.
  const fs = dimFont(box) * 1.35
  // y cap avall: Q amunt a la peça.
  const all = [...pv.refs, ...pv.mirrored]
  const feats = all.map(([p, q]) => ({ x: p, y: H - q, hx: fs * 0.3, hy: fs * 0.3 }))
  const layout = layoutDims(box, feats, fs, { title: panel.label })
  const vb = layout.extent
  const stroke = Math.max(vb.w, vb.h) / 500
  const cross = fs * 0.55
  return (
    <Stack gap={1} py={2} data-testid="placement-preview">
      <Box asChild w="full" maxH="300px" style={{ aspectRatio: `${vb.w} / ${vb.h}` }} rounded="md" borderWidth="1px" bg="bg.subtle">
        <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-label={`Col·locació a ${panel.label}`}>
          <rect x={0} y={0} width={W} height={H} fill="var(--chakra-colors-wood-subtle)" stroke="currentColor" strokeWidth={stroke * 1.5} />
          {pv.marks.map((m, i) =>
            m.round ? (
              <circle key={i} cx={(m.x0 + m.x1) / 2} cy={H - (m.y0 + m.y1) / 2} r={Math.max((m.x1 - m.x0) / 2, fs * 0.18)} fill="var(--chakra-colors-wood-fg)" fillOpacity={m.mirror ? 0.5 : 0.85} stroke="none" />
            ) : (
              <rect key={i} x={m.x0} y={H - m.y1} width={Math.max(m.x1 - m.x0, stroke)} height={Math.max(m.y1 - m.y0, stroke)} fill="var(--chakra-colors-wood-emphasized)" fillOpacity={m.mirror ? 0.5 : 0.9} stroke="currentColor" strokeWidth={stroke} />
            ),
          )}
          {all.map(([p, q], i) => (
            <g key={`r${i}`} stroke={i >= pv.refs.length ? "var(--chakra-colors-fg-muted)" : "var(--chakra-colors-wood-solid)"} strokeWidth={stroke * 1.6}>
              <line x1={p - cross} y1={H - q} x2={p + cross} y2={H - q} />
              <line x1={p} y1={H - q - cross} x2={p} y2={H - q + cross} />
            </g>
          ))}
          <DimLayer layout={layout} stroke={stroke} fs={fs} />
          <g fill="var(--chakra-colors-fg-subtle)">
            <text x={fs * 0.4} y={fs * 1.1} style={{ fontSize: fs * 0.75 }}>
              {axes.q.ends[1]} ↑
            </text>
            <text x={W - fs * 0.4} y={H - fs * 0.4} textAnchor="end" style={{ fontSize: fs * 0.75 }}>
              {axes.p.ends[1]} →
            </text>
          </g>
        </svg>
      </Box>
      <Text fontSize="xs" color={pv.error ? "orange.fg" : "fg.muted"}>
        {pv.error
          ? `No hi cap: ${pv.error}. No es fa cap mecanitzat del ferratge.`
          : `${panel.label} de ${fmtMm(W)} × ${fmtMm(H)} mm (${axes.p.name.toLowerCase()} × ${axes.q.name.toLowerCase()}): ${pv.refs.length === 1 ? "1 ferratge" : `${pv.refs.length} còpies`}${pv.mirrored.length ? ` i ${pv.mirrored.length} al mirall` : ""}${pv.otherSide ? " (i les mateixes a la peça de l'altre costat)" : ""}. Segueix la peça si el moble canvia de mida.`}
      </Text>
    </Stack>
  )
}
