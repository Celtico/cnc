import { Badge, Box, Button, chakra, HStack, IconButton, Stack, Text } from "@chakra-ui/react"
import type { IconType } from "react-icons"
import { LuCopy, LuPencil, LuPlus, LuTrash2, LuWrench } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { SectionLabel } from "../../components/SectionLabel"
import type { RuleHardwareCount } from "../../core/build/hardwareSummary"
import { HARDWARE_ICONS } from "../settings/hardwareIcons"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { NumberField } from "../../components/NumRow"
import { hardwareSummary, isPendingImport, machiningParts, type Composition, type HardwareItem, type HardwarePlacement, type Panel, type Pos } from "../../core/model"
import type { CompositionWarning } from "../../core/build/buildComposition"
import { newPlacement, panelAxes, partLabel, placeableItems, placementScope, placementWarnings, roleFor, scopePanels, scopePlacements, updatePlacement, type PlacementScope } from "./placements"

/**
 * **Ferratges col·locats a mà** (millores v1 F4; Editor › mòdul o peça lliure › «Ferratges»): «Afegir ferratge» → un de
 * la biblioteca amb mecanitzats (generador de Preferències › Ferratges) → la peça del mòdul on va i quin grup de l'item
 * li toca → on va el punt de referència (des d'un cantell o del mig, amb els eixos del moble) → repetició opcional. Les
 * altres peces de l'item (p. ex. la base d'un perfil de porta corredissa) només si es trien aquí. Es guarda una còpia
 * de l'item (com els mòduls). Tot o res: si no hi cap, cap forat i l'avís surt a «Avisos de fusteria».
 */
const RULE_ICONS: Record<RuleHardwareCount["id"], IconType> = {
  hinge: HARDWARE_ICONS.hinge,
  handle: HARDWARE_ICONS.handle,
  slide: HARDWARE_ICONS.slide,
  flap: HARDWARE_ICONS.lift,
  leg: HARDWARE_ICONS.leg,
  push: HARDWARE_ICONS.push,
  magnet: HARDWARE_ICONS.push,
  dowel: HARDWARE_ICONS.connector,
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
  const items = placeableItems(library)
  const here = scopePanels(scope, panels)
  const list = scopePlacements(comp, scope)
  const add = () => {
    const item = items[0]
    const on = here.find((h) => machiningParts(item?.machining ?? []).includes(h.part)) ?? here[0]
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
                {pl.repeat && pl.repeat.count > 1 ? ` × ${pl.repeat.count}` : ""}
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
      {!items.length ? (
        <Text fontSize="sm" color="fg.muted">
          Cap ferratge amb mecanitzats a la biblioteca: fes-ne un (o importa'l) a Preferències › Ferratges i posa-li els mecanitzats al «Generador de mecanitzats».
        </Text>
      ) : !here.length ? (
        <Text fontSize="sm" color="fg.muted">
          Aquesta peça no és de CNC: no s'hi pot col·locar cap ferratge.
        </Text>
      ) : (
        <Box>
          <Button size="xs" variant="outline" onClick={add} data-testid="placement-add">
            <LuPlus /> Afegir ferratge
          </Button>
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
                    </Text>
                    <Badge size="sm" variant="subtle">
                      {r.count}
                      {r.unit ? ` ${r.unit}` : ""}
                    </Badge>
                  </HStack>
                )
              })}
              <Text fontSize="xs" color="fg.muted">
                Els posa el mòdul (fronts, calaixos, base): es canvien a Fusteria i al Front de cada porta, calaix o abatible.
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
 * Inspector d'un ferratge col·locat (selecció `hardware`: clic al 3D, a la llista o «Editar»): el ferratge, la peça, la
 * posició del punt de referència, la repetició i el gir del model, amb els seus avisos.
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
        <PlacementEditor pl={pl} here={here} items={placeableItems(library)} onChange={(next) => onChange(updatePlacement(comp, next))} />
      </FoldItem>
    </Stack>
  )
}

function PlacementEditor({ pl, here, items, onChange }: { pl: HardwarePlacement; here: ReturnType<typeof scopePanels>; items: HardwareItem[]; onChange: (pl: HardwarePlacement) => void }) {
  const main = pl.targets[0]!
  const key = (t: { panel?: string; freePart?: string }) => t.panel ?? t.freePart ?? ""
  const on = here.find((h) => key(h.target) === key(main))
  const parts = machiningParts(pl.item.machining ?? [])
  const lib = items.find((x) => x.id === pl.item.id)
  const axes = on ? panelAxes(on.panel) : null
  const setPos = (k: "p" | "q", pos: Pos) => onChange({ ...pl, [k]: pos })
  // Les altres peces (grups de l'item que no són el de la peça principal): només si es trien.
  const others = parts.filter((p) => p !== main.part)
  return (
    <Stack gap={0} pt={2}>
      <FormRow label="Ferratge" help={hardwareSummary(pl.item) + (isPendingImport(pl.item) ? " — importat sense confirmar: no fa cap forat." : "")}>
        <ChoiceChips
          label="Ferratge"
          value={lib ? pl.item.id : `own:${pl.item.id}`}
          options={[...items.map((x) => ({ id: x.id, label: x.name })), ...(lib ? [] : [{ id: `own:${pl.item.id}`, label: `${pl.item.name} (del moble)` }])]}
          onChange={(id) => {
            const item = items.find((x) => x.id === id)
            if (!item) return
            onChange({ ...pl, item: structuredClone(item), targets: [{ ...main, part: on ? roleFor(item, on.part) : main.part }] })
          }}
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
      {axes &&
        (["p", "q"] as const).map((k) => (
          <FormRow key={k} label={axes[k].name} help={k === "p" ? "On va el punt de referència del ferratge (la creu del generador)." : undefined}>
            <Stack gap={1.5}>
              <ChoiceChips
                label={axes[k].name}
                value={pl[k].from === "ref" ? "min" : pl[k].from}
                options={[
                  { id: "min", label: `Des de ${axes[k].ends[0] === "esquerra" ? "l'esquerra" : axes[k].ends[0]}` },
                  { id: "max", label: `Des de ${axes[k].ends[1] === "dreta" ? "la dreta" : axes[k].ends[1]}` },
                  { id: "center", label: "Mig" },
                ]}
                onChange={(from) => setPos(k, { ...pl[k], from })}
              />
              <Box maxW="160px">
                <NumberField label="" ariaLabel={`${axes[k].name}: distància`} value={pl[k].at} min={-5000} max={5000} step={1} onChange={(at) => Number.isFinite(at) && setPos(k, { ...pl[k], at })} />
              </Box>
            </Stack>
          </FormRow>
        ))}
      {axes && (
        <FormRow label="Repetir" help="Còpies del ferratge (amb tots els seus mecanitzats) separades al llarg d'un eix. 1 = sense repetir.">
          <HStack gap={2} wrap="wrap" align="flex-end">
            <Box w="90px">
              <NumberField label="Quants" ariaLabel="Quantes còpies" suffix="u" value={pl.repeat?.count ?? 1} min={1} max={100} step={1} onChange={(v) => {
                if (!Number.isFinite(v)) return
                const count = Math.max(1, Math.round(v))
                const { repeat: _r, ...rest } = pl
                onChange(count > 1 ? { ...rest, repeat: { axis: pl.repeat?.axis ?? "p", spacing: pl.repeat?.spacing ?? 100, count } } : rest)
              }} />
            </Box>
            {pl.repeat && pl.repeat.count > 1 && (
              <>
                <Box w="110px">
                  <NumberField label="Cada" ariaLabel="Separació" value={pl.repeat.spacing} min={-5000} max={5000} step={1} onChange={(spacing) => Number.isFinite(spacing) && onChange({ ...pl, repeat: { ...pl.repeat!, spacing } })} />
                </Box>
                <ChoiceChips label="Al llarg de" value={pl.repeat.axis} options={[{ id: "p", label: axes.p.name }, { id: "q", label: axes.q.name }]} onChange={(axis) => onChange({ ...pl, repeat: { ...pl.repeat!, axis } })} />
              </>
            )}
          </HStack>
        </FormRow>
      )}
      {(pl.item.imported?.asset || pl.item.imported?.bbox) && (
        <FormRow label="Gir del model" help="Només el model 3D (amb «Ferratges» a Opcions de vista): el gira al pla de la peça. Els mecanitzats no canvien.">
          <ChoiceChips
            label="Gir del model"
            value={String(pl.turn ?? 0)}
            options={(["0", "90", "180", "270"] as const).map((x) => ({ id: x, label: `${x}°` }))}
            onChange={(x) => {
              const { turn: _t, ...rest } = pl
              const turn = Number(x) as 0 | 90 | 180 | 270
              onChange(turn ? { ...rest, turn } : rest)
            }}
          />
        </FormRow>
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
