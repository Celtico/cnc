import { Badge, Box, Button, chakra, HStack, IconButton, Input, Stack, Switch, Text } from "@chakra-ui/react"
import { useState } from "react"
import type { IconType } from "react-icons"
import { LuCopy, LuPencil, LuPlus, LuTrash2, LuWrench } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { SectionLabel } from "../../components/SectionLabel"
import type { RuleHardwareCount } from "../../core/build/hardwareSummary"
import { HARDWARE_ICONS } from "../settings/hardwareIcons"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { NumberField, NumRow } from "../../components/NumRow"
import { StepRuleRows } from "../../components/StepRuleRows"
import { dimFont, fmtMm, layoutDims } from "../../components/dims"
import { DimLayer } from "../../components/DimLine"
import { HardwareDrawer, HardwareSelect } from "../settings/HardwareSelect"
import { placeableOn } from "../settings/hardwareGroups"
import { hardwareSummary, isPendingImport, machiningParts, type Composition, type HardwareItem, type HardwarePlacement, type Panel, type PlacePos, type Repeat, type RepeatLayout } from "../../core/model"
import type { CompositionWarning } from "../../core/build/buildComposition"
import { DEFAULT_REPEAT_RULE, newPlacement, panelAxes, partLabel, placeableItems, placementPreview, placementScope, placementWarnings, placePosError, placePosValue, roleFor, scopePanels, scopePlacements, updatePlacement, type PlacementScope } from "./placements"

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
  const rep = pl.repeat
  const layout = rep?.layout ?? "step"
  // Amb «Repartides» o «Cada X mm», la posició al llarg de l'eix de la repetició la donen els marges.
  const byMargins = !!rep && (layout === "span" || layout === "pitch")
  const setRepeat = (patch: Partial<Repeat> | null) => {
    const { repeat: _r, ...rest } = pl
    if (!patch) return onChange(rest)
    const cur: Repeat = rep ?? { axis: "p", count: 2, spacing: 100 }
    onChange({ ...rest, repeat: { ...cur, ...patch } })
  }
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
      {axes &&
        on &&
        (["p", "q"] as const).map((k) =>
          byMargins && rep!.axis === k ? (
            <FormRow key={k} label={axes[k].name}>
              <Text fontSize="sm" color="fg.muted" pt="6px">
                La donen la repetició i els marges.
              </Text>
            </FormRow>
          ) : (
            <PlacePosRow key={k} axis={k} names={axes[k]} pos={pl[k]} panel={on.panel} onChange={(pos) => setPos(k, pos)} />
          ),
        )}
      {axes && (
        <>
          <FormRow
            label="Repetir"
            help="Còpies del ferratge (amb tots els seus mecanitzats) al llarg d'un eix: des del punt, centrades al punt, repartides entre els marges (la primera i l'última als marges) o cada tants mm entre els marges. Es recalculen quan el moble canvia de mida."
          >
            <ChoiceChips
              label="Repetir"
              value={rep ? layout : "none"}
              options={[
                { id: "none", label: "No" },
                { id: "step", label: "Des del punt" },
                { id: "centred", label: "Centrades" },
                { id: "span", label: "Repartides" },
                { id: "pitch", label: "Cada X mm" },
              ]}
              onChange={(v) => (v === "none" ? setRepeat(null) : setRepeat({ layout: v as RepeatLayout, ...(v === "span" || v === "pitch" ? { margins: rep?.margins ?? [50, 50] } : {}), ...(v === "pitch" && !rep ? { spacing: 32 } : {}) }))}
            />
          </FormRow>
          {rep && (
            <>
              <FormRow label="Al llarg de">
                <ChoiceChips label="Al llarg de" value={rep.axis} options={[{ id: "p", label: axes.p.name }, { id: "q", label: axes.q.name }]} onChange={(axis) => setRepeat({ axis })} />
              </FormRow>
              {layout !== "pitch" && (
                <FormRow label="Quantes" help="Fixa, o per mida: segons la llargada de la peça al llarg de l'eix, com les frontisses (2 fins a 900, 3 fins a 1600…).">
                  <ChoiceChips
                    label="Quantes"
                    value={rep.rule ? "rule" : "fixed"}
                    options={[
                      { id: "fixed", label: "Fixa" },
                      { id: "rule", label: "Per mida" },
                    ]}
                    onChange={(v) => {
                      const { rule: _rule, ...rest } = rep
                      onChange({ ...pl, repeat: v === "rule" ? { ...rest, rule: DEFAULT_REPEAT_RULE } : rest })
                    }}
                  />
                </FormRow>
              )}
              {layout !== "pitch" && !rep.rule && (
                <NumRow label="Còpies" suffix="u" value={rep.count} min={1} max={100} step={1} onChange={(v) => Number.isFinite(v) && setRepeat({ count: Math.max(1, Math.min(100, Math.round(v))) })} />
              )}
              {layout !== "pitch" && rep.rule && (
                <StepRuleRows
                  rule={rep.rule}
                  kind="count"
                  editCount
                  words={{ unit: "còpies", upToHelp: "Fins a aquesta llargada de la peça (mm).", elseLabel: "Més llargues", elseHelp: "Còpies si la peça és més llarga que l'últim graó." }}
                  onChange={(rule) => setRepeat({ rule })}
                />
              )}
              {layout !== "span" && (
                <NumRow label={layout === "pitch" ? "Cada" : "Separació"} value={rep.spacing} min={layout === "pitch" ? 1 : -5000} max={5000} step={1} onChange={(spacing) => Number.isFinite(spacing) && setRepeat({ spacing })} help={layout === "pitch" ? "Tantes còpies com hi caben entre els marges, centrades." : undefined} />
              )}
              {byMargins && (
                <FormRow label="Marges" help={`Dels extrems de la peça: ${axes[rep.axis].ends[0]} · ${axes[rep.axis].ends[1]}.`}>
                  <HStack gap={2}>
                    <Box w="120px">
                      <NumberField label="" ariaLabel={`Marge ${axes[rep.axis].ends[0]}`} value={rep.margins?.[0] ?? 0} min={0} max={5000} step={1} onChange={(m) => Number.isFinite(m) && setRepeat({ margins: [Math.max(0, m), rep.margins?.[1] ?? 0] })} />
                    </Box>
                    <Box w="120px">
                      <NumberField label="" ariaLabel={`Marge ${axes[rep.axis].ends[1]}`} value={rep.margins?.[1] ?? 0} min={0} max={5000} step={1} onChange={(m) => Number.isFinite(m) && setRepeat({ margins: [rep.margins?.[0] ?? 0, Math.max(0, m)] })} />
                    </Box>
                  </HStack>
                </FormRow>
              )}
            </>
          )}
          <FormRow label="Mirall" help="També la còpia simètrica d'esquerra a dreta: al lateral (o lateral de calaix) de l'altre costat, a la mateixa alçada i fondària; a una peça de costat a costat (porta, tapa, base, prestatge, fons), reflectida respecte del seu mig. Tot o res amb l'original.">
            <Switch.Root size="sm" pt="6px" checked={!!pl.mirror} onCheckedChange={(e) => {
              const { mirror: _m, ...rest } = pl
              onChange(e.checked ? { ...rest, mirror: true } : rest)
            }}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Esquerra / dreta</Switch.Label>
            </Switch.Root>
          </FormRow>
        </>
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

/**
 * La posició paramètrica d'un eix (`PlacePos`): l'ancoratge (des de l'inici, des del final, el mig o un %), el
 * desplaçament i, opcional, la fórmula (L · A · G · M, sense `eval`) amb l'error en vermell; a sota, on cau ara.
 */
function PlacePosRow({ axis, names, pos, panel, onChange }: { axis: "p" | "q"; names: { name: string; ends: [string, string] }; pos: PlacePos; panel: Panel; onChange: (p: PlacePos) => void }) {
  const err = placePosError(pos, panel, axis)
  const now = placePosValue(pos, panel, axis)
  const [draft, setDraft] = useState<string | null>(null)
  const from0 = names.ends[0] === "esquerra" ? "l'esquerra" : names.ends[0]
  const from1 = names.ends[1] === "dreta" ? "la dreta" : names.ends[1]
  return (
    <FormRow label={names.name} help={`On va el punt de referència del ferratge (la creu del generador). Fórmula opcional en lloc del número: L, A i G = llarg, ample i gruix de la peça; M = la mida de la peça al llarg d'aquest eix (p. ex. «M/3», «A − 37»). ${now !== null ? `Ara: a ${fmtMm(now)} mm de ${from0}.` : ""}`}>
      <Stack gap={1.5}>
        <ChoiceChips
          label={names.name}
          value={pos.from}
          options={[
            { id: "min", label: `Des de ${from0}` },
            { id: "max", label: `Des de ${from1}` },
            { id: "center", label: "Mig" },
            { id: "ratio", label: "%" },
          ]}
          onChange={(from) => onChange(from === "ratio" ? { ...pos, from, pct: pos.pct ?? 50 } : (({ pct: _p, ...rest }) => ({ ...rest, from }))(pos))}
        />
        <HStack gap={2} wrap="wrap" align="flex-end">
          {pos.from === "ratio" && (
            <Box w="100px">
              <NumberField label="" ariaLabel={`${names.name}: percentatge`} suffix="%" value={pos.pct ?? 50} min={0} max={100} step={1} onChange={(pct) => Number.isFinite(pct) && onChange({ ...pos, pct: Math.max(0, Math.min(100, pct)) })} />
            </Box>
          )}
          {!pos.expr && (
            <Box w="130px">
              <NumberField label="" ariaLabel={`${names.name}: distància`} value={pos.at} min={-5000} max={5000} step={1} onChange={(at) => Number.isFinite(at) && onChange({ ...pos, at })} />
            </Box>
          )}
          <Input
            size="sm"
            flex={1}
            minW="120px"
            maxW="220px"
            fontFamily="mono"
            placeholder="Fórmula (opcional)"
            aria-label={`${names.name}: fórmula`}
            value={draft ?? pos.expr ?? ""}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={() => {
              if (draft === null) return
              const t = draft.trim().slice(0, 200)
              setDraft(null)
              const { expr: _e, ...rest } = pos
              onChange(t ? { ...rest, expr: t } : rest)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
              if (e.key === "Escape") setDraft(null)
            }}
          />
        </HStack>
        {err && (
          <Text fontSize="xs" color="red.fg">
            Fórmula: {err}
          </Text>
        )}
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
