import { Box, Button, HStack, IconButton, Menu, Portal, Stack, Switch, Text } from "@chakra-ui/react"
import { LuArrowUp, LuCopy, LuSettings2, LuEllipsis, LuColumns2, LuRows2, LuPlus, LuRows3, LuSquareSplitHorizontal, LuSquareSplitVertical, LuTrash2, LuUngroup } from "react-icons/lu"
import type { ReactNode } from "react"
import { FoldItem } from "../../components/Fold"
import {
  addChild,
  duplicateZone,
  parentOf,
  removeZone,
  setSplitSize,
  setDrawerHeight,
  setFront,
  setShelves,
  splitZone,
  switchFront,
  unsplitZone,
  updateZone,
  UI_PATHS,
  canHoldAccessories,
  canHoldFront,
  canHoldShelves,
  frontLimitsHelp,
  splitDirsFor,
  findZone,
  KIT_BACKS,
  KIT_CLOSINGS,
  KIT_FINISHES,
  KIT_LEVEL_LABEL,
  fmtMm,
  hardwareSummary,
  isDrawerKit,
  perDrawerSlides,
  isPushClosing,
  kitOptionsOf,
  moduleSlotItem,
  slotOf,
  type Front,
  type FrontHandle,
  type HardwareItem,
  type ModuleHardware,
  type Zone,
  type ZoneAccessory,
  type ZoneBounds,
} from "../../core/model"
import { HardwareSelect } from "../settings/HardwareSelect"
import { useSettings } from "../settings/SettingsContext"
import type { KitOrder } from "../../core/build/buildModule"
import { handleSpec } from "../../core/build/hardware"
import { kitBottomThickness, kitLineText, kitWoodText } from "../../core/build/drawerKit"
import { NumberField, NumRow } from "../../components/NumRow"
import { splitRows } from "./zoneLabel"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { FRONT_ICONS } from "./zoneIcons"
import { HardwarePick } from "./HardwarePick"
import { IconChoice } from "../../components/IconChoice"
import { LuAlignJustify, LuArrowDownToLine, LuArrowUpToLine, LuColumns3, LuDoorClosed, LuDoorOpen, LuFlipHorizontal2, LuGrip, LuMagnet, LuPanelLeft, LuPanelRight, LuSquareDashed } from "react-icons/lu"

const FRONT_LABELS: Record<Front["kind"] | "none", string> = {
  none: "Obert",
  door: "Porta",
  drawers: "Calaixos",
  flap: "Abatible",
  grille: "Reixeta",
  panel: "Front fix",
}

/**
 * Accions de la zona seleccionada (van a la capçalera de l'inspector, com a icones):
 * pujar al pare, duplicar (al costat o a sobre) i eliminar. L'«Interior» (l'arrel) no es duplica ni s'elimina (com amb
 * ⌘D i Suprimir): no hi ha cap acció.
 */
export function ZoneActions({ root, zone, onChange, onSelect }: { root: Zone; zone: Zone; onChange: (root: Zone) => void; onSelect: (id: string) => void }) {
  const parent = parentOf(root, zone.id)
  const duplicate = (dir: "v" | "h") => {
    const r = duplicateZone(root, zone.id, dir)
    onChange(r.root)
    if (r.copyId) onSelect(r.copyId)
  }
  if (!parent) return null
  // Un sol botó ⋯ amb totes les accions: la capçalera queda neta.
  return (
    <Menu.Root positioning={{ placement: "bottom-end" }}>
      <Menu.Trigger asChild>
        <IconButton size="xs" variant="ghost" aria-label="Accions del compartiment">
          <LuEllipsis />
        </IconButton>
      </Menu.Trigger>
      <Portal>
        <Menu.Positioner>
          <Menu.Content>
            <Menu.Item value="parent" onClick={() => onSelect(parent.id)}>
              <LuArrowUp /> Seleccionar el pare
            </Menu.Item>
            <Menu.Item value="v" onClick={() => duplicate("v")}>
              <LuCopy /> Duplicar al costat
            </Menu.Item>
            <Menu.Item value="h" onClick={() => duplicate("h")}>
              <LuCopy /> Duplicar a sobre
            </Menu.Item>
            <Menu.Separator />
            <Menu.Item value="del" color="fg.error" onClick={() => onChange(removeZone(root, zone.id))}>
              <LuTrash2 /> Eliminar
            </Menu.Item>
          </Menu.Content>
        </Menu.Positioner>
      </Portal>
    </Menu.Root>
  )
}

/**
 * El contingut ocupa el compartiment i no deixa res a fer servir darrere: calaixos o un front fix (per decisió de
 * l'usuari). Prestatges i Accessoris no surten (`visibleZone` no els fa; es conserven i tornen si canvia el contingut).
 */
const fillsZone = (f: Front | undefined): boolean => f?.kind === "drawers" || f?.kind === "panel"

/** Panell d'edició de la zona seleccionada: dividir, contingut, mides de les zones (a la divisió), eliminar. */
export function ZonePanel({
  root,
  zone,
  openRatio,
  drawerHeights,
  onChange,
  hardware,
  noHandles = false,
  kits,
  splitExtra,
  coveredBy,
  coveredByFixed = false,
  bounds,
  system32,
  onSelect,
  childSizes,
}: {
  root: Zone
  zone: Zone
  /**
   * Què aguanta el compartiment (laterals, base, tapa o divisors; `zoneBoundsMap`): opcions en cascada, el que no s'hi
   * pot construir no surt (prestatges i accessoris sense una peça a cada costat, dividir sense on unir el divisor, els
   * fronts que no s'hi poden fixar).
   */
  bounds: ZoneBounds
  /** % d'àrea oberta si la zona té reixeta. */
  openRatio?: number
  /** Alçades reals dels fronts dels calaixos (mm), de la construcció: les de les «Auto» i el que sobra. */
  drawerHeights?: number[]
  onChange: (root: Zone) => void
  /** Ferratges del mòdul (els fronts en poden triar un altre). */
  hardware: ModuleHardware
  /** El mòdul no porta tiradors (fronts push): el «Tirador» dels fronts no surt. */
  noHandles?: boolean
  /** Calaixos d'aquesta zona fets amb un joc paramètric (del constructor): NL, números i fusta. */
  kits?: KitOrder[]
  /** Més files de la secció «Divisió» (a l'«Interior»: la folgança de les peces de dins del mòdul). */
  splitExtra?: ReactNode
  /** Nom de la zona de més amunt el front de la qual tapa aquest compartiment: el seu Front no es fa (es conserva). */
  coveredBy?: string
  /** El front que el tapa és un front fix (no portes): darrere no hi ha res a fer servir, ni Prestatges ni Accessoris. */
  coveredByFixed?: boolean
  /**
   * La «Filera System 32» del mòdul (`System32Pick`), si aquest compartiment l'ensenya (`system32RowPlace`): als
   * Prestatges (al costat de «Regulables») o al Front (després de la «Frontissa»). Mai a tots dos.
   */
  system32?: { at: "shelves" | "front"; row: ReactNode }
  /** Seleccionar un compartiment (les files de la «Divisió» hi porten). */
  onSelect?: (id: string) => void
  /**
   * Amb una divisió, les mides reals de cada fill (mm de llum), de la mateixa construcció (`splitChildSizes` sobre el
   * `layout` del mòdul): les de les zones «Auto» i el que sobra a l'última.
   */
  childSizes?: number[]
}) {
  // Hi ha on fer servir prestatges i accessoris: tapat per portes (com obert), o el seu contingut no l'omple.
  const shelvesBehind = coveredBy ? !coveredByFixed : !fillsZone(zone.front)
  // Darrere d'un front fix (el seu o, a les dades d'abans, el de tota la zona que el tapa si es fes) no es divideix: les
  // peces no es veurien ni es farien servir.
  const behindFixed = coveredBy ? !!coveredByFixed : zone.front?.kind === "panel"
  return (
    <Stack gap={0}>

      {zone.split ? (
        <>
          <FoldItem id="zone-split" title={`Divisió ${zone.split.dir === "v" ? "vertical" : "horitzontal"}`} badge={`${zone.split.children.length} zones`} icon={zone.split.dir === "v" ? LuColumns2 : LuRows2}>
            <SplitSizes root={root} zone={zone} onChange={onChange} onSelect={onSelect} childSizes={childSizes} />
            <HStack wrap="wrap">
              <Button size="sm" variant="outline" onClick={() => onChange(addChild(root, zone.id))}>
                <LuPlus /> Afegir zona
              </Button>
              <Button size="sm" variant="outline" onClick={() => onChange(unsplitZone(root, zone.id))}>
                <LuUngroup /> Treure la divisió
              </Button>
            </HStack>
            {splitExtra}
          </FoldItem>
          {/* Cap front a les zones dividides (per decisió de l'usuari): les portes de dalt a baix de tot el mòdul (armari amb
              penjador i maleter darrere) són a Mòdul › Portes (`ModuleDoorsSection`). */}
        </>
      ) : (
        <>
          {coveredBy ? <CoveredFront id="zone-front" title="Front" coveredBy={coveredBy} /> : <ZoneFrontSection root={root} zone={zone} openRatio={openRatio} drawerHeights={drawerHeights} onChange={onChange} hardware={hardware} noHandles={noHandles} kits={kits} bounds={bounds} afterHinge={system32?.at === "front" ? system32.row : undefined} />}

          {/* Tapat: el seu front (es conserva) no es fa i el compartiment és com obert (`visibleZone`). Sense una peça a
              cada costat (lateral o divisor), cap prestatge: no surt (es conserva i torna amb els laterals). Amb calaixos
              o un front fix (darrere no hi ha res a fer servir), tampoc; ni tapat per un front fix de tota la zona. */}
          {shelvesBehind && (canHoldShelves(bounds) || canHoldAccessories(bounds)) && (
            <FoldItem id="zone-shelves" title="Prestatges i accessoris" badge={shelvesBadge(zone)} icon={LuRows3}>
              {canHoldShelves(bounds) && <>
              <NumRow
                label="Quantitat"
                suffix="u"
                value={zone.shelves?.n ?? 0}
                min={0}
                max={20}
                step={1}
                onChange={(n) => onChange(setShelves(root, zone.id, n > 0 || zone.shelves ? { ...zone.shelves, n: Math.max(0, n), adjustable: zone.shelves?.adjustable ?? true } : null))}
              />
              {/* Sense cap prestatge, l'interruptor mostra el valor que fa servir la construcció (sense `shelves`: no regulables). */}
              <FormRow label="Regulació" help={(zone.shelves?.adjustable ?? false) ? "Forats System 32 als laterals per moure'ls." : undefined}>
                <Switch.Root size="sm" pt="6px" checked={zone.shelves?.adjustable ?? false} onCheckedChange={(e) => onChange(setShelves(root, zone.id, { ...zone.shelves, n: zone.shelves?.n ?? 0, adjustable: e.checked }))}>
                  <Switch.HiddenInput />
                  <Switch.Control />
                  <Switch.Label fontSize="sm">Regulables</Switch.Label>
                </Switch.Root>
              </FormRow>
              {/* La filera dels regulables (la de tot el mòdul), només si es fan (`system32RowPlace`). */}
              {system32?.at === "shelves" && system32.row}
              {/* Sense prestatges, «a ras» i el gruix no compten (la construcció tampoc els llegeix): no surten. */}
              {(zone.shelves?.n ?? 0) > 0 && <>
              {/* A ras del davant (a sang): el cantell del prestatge enrasat amb el de la caixa. */}
              <FormRow label="Davant">
                <Switch.Root size="sm" pt="6px" checked={!!zone.shelves?.flush} onCheckedChange={(e) => onChange(setShelves(root, zone.id, { n: zone.shelves?.n ?? 0, adjustable: zone.shelves?.adjustable ?? true, ...(zone.shelves?.thickness ? { thickness: zone.shelves.thickness } : {}), ...(e.checked ? { flush: true } : {}) }))}>
                  <Switch.HiddenInput />
                  <Switch.Control />
                  <Switch.Label fontSize="sm">A ras del davant (a sang)</Switch.Label>
                </Switch.Root>
              </FormRow>
              {/* Prestatges gruixuts (buits): queden més bé a la vista, sense porta. */}
              <FormRow label="Gruix">
                <Switch.Root
                  size="sm"
                  pt="6px"
                  checked={!!zone.shelves?.thickness}
                  onCheckedChange={(e) => onChange(setShelves(root, zone.id, { n: zone.shelves?.n ?? 0, adjustable: zone.shelves?.adjustable ?? true, ...(zone.shelves?.flush ? { flush: true } : {}), ...(e.checked ? { thickness: 50 } : {}) }))}
                >
                  <Switch.HiddenInput />
                  <Switch.Control />
                  <Switch.Label fontSize="sm">Gruixuts (buits)</Switch.Label>
                </Switch.Root>
              </FormRow>
              {zone.shelves?.thickness && (
                <NumRow
                  label="Gruix aparent"
                  value={zone.shelves.thickness}
                  min={20}
                  max={200}
                  step={5}
                  onChange={(thickness) => onChange(setShelves(root, zone.id, { ...zone.shelves!, thickness }))}
                  help={zone.front ? "Dues pells, llistons i una tira al davant. Sense porta es veuen més bé." : "Dues pells, llistons i una tira al davant: fan el prestatge com si fos de fusta gruixuda."}
                />
              )}
              </>}
              </>}
              {/* Accessoris del compartiment: ferratges (barra de penjar, tira LED), no fusta; a sota dels prestatges (la tira
                  LED va sota cada prestatge). */}
              {canHoldAccessories(bounds) && <AccessoryRows root={root} zone={zone} hardware={hardware} onChange={onChange} />}
            </FoldItem>
          )}

          {/* Només les direccions on el divisor té on unir-se (`splitDirsFor`): el vertical, a sota i a sobre; el
              travesser, als dos costats. Sense cap, o darrere d'un front fix, la secció no surt. */}
          {splitDirsFor(bounds).length > 0 && !behindFixed && (
            <FoldItem id="zone-divide" title="Dividir" icon={LuSquareSplitHorizontal} defaultOpen={false}>
              <Text textStyle="xs" color="fg.muted">
                Parteix aquest compartiment en dos. El contingut es queda al primer.
                {splitDirsFor(bounds).length < 2 && (splitDirsFor(bounds)[0] === "v" ? " En horitzontal no: el travesser necessita un lateral o un divisor a cada costat." : " En vertical no: el divisor necessita una peça a sota i una a sobre (base, tapa o travesser).")}
              </Text>
              <HStack wrap="wrap">
                {splitDirsFor(bounds).includes("v") && (
                  <Button size="sm" variant="outline" onClick={() => onChange(splitZone(root, zone.id, "v", 2))}>
                    <LuSquareSplitHorizontal /> En vertical
                  </Button>
                )}
                {splitDirsFor(bounds).includes("h") && (
                  <Button size="sm" variant="outline" onClick={() => onChange(splitZone(root, zone.id, "h", 2))}>
                    <LuSquareSplitVertical /> En horitzontal
                  </Button>
                )}
              </HStack>
            </FoldItem>
          )}
        </>
      )}
    </Stack>
  )
}

/**
 * La mida de cada zona d'una divisió, al pare (per decisió de l'usuari, 2026-10-08: «a les obertures no té sentit
 * l'amplada; ha d'anar a la divisió»). Amb n zones es posen n−1 mides (per decisió de l'usuari: «si només hi ha dos,
 * només pot posar una mida»): les files «Amplada 1»… (vertical) o «Alçada 1»… (horitzontal), «Auto» o els mm (clicar el
 * nom selecciona el compartiment; el nom de l'arbre, a l'ajuda), i l'última no s'edita: diu el que sobra. Al costat de
 * les «Auto», els mm que fan (les reals, `childSizes`).
 */
function SplitSizes({ root, zone, onChange, onSelect, childSizes }: { root: Zone; zone: Zone; onChange: (root: Zone) => void; onSelect?: (id: string) => void; childSizes?: number[] }) {
  if (!zone.split) return null
  const what = zone.split.dir === "v" ? "Amplada" : "Alçada"
  const set = (i: number, size: number | "auto") => onChange(setSplitSize(root, zone.id, i, size, childSizes))
  return (
    <Stack gap={2}>
      <Text textStyle="xs" color="fg.muted">
        {what} de la llum de cada zona. Les «Auto» es reparteixen el que queda; l'última és el que sobra.
      </Text>
      {splitRows(zone).map((row, i) => {
        const real = childSizes?.[i]
        return (
          <FormRow
            key={row.id}
            label={
              onSelect ? (
                <Button variant="plain" size="sm" h="auto" p={0} minW={0} fontWeight="normal" color="fg.muted" textAlign="start" whiteSpace="normal" _hover={{ color: "fg", textDecoration: "underline" }} title={`${row.name} · seleccionar el compartiment`} onClick={() => onSelect(row.id)}>
                  {row.label}
                </Button>
              ) : (
                <span title={row.name}>{row.label}</span>
              )
            }
          >
            {row.rest ? (
              <Text fontSize="sm" color="fg.muted">
                {real !== undefined ? `${fmtMm(real)} mm` : "—"} (el que sobra)
              </Text>
            ) : (
              <HStack gap={3}>
                <Switch.Root size="sm" flexShrink={0} checked={row.size === "auto"} onCheckedChange={(e) => set(i, e.checked ? "auto" : real !== undefined && real > 0 ? Math.round(real) : 400)}>
                  <Switch.HiddenInput />
                  <Switch.Control />
                  <Switch.Label fontSize="sm">Auto</Switch.Label>
                </Switch.Root>
                {row.size !== "auto" ? (
                  <Box flex="1" minW={0} maxW="160px">
                    <NumberField label="" ariaLabel={`${row.label} (${row.name})`} value={row.size} min={50} max={3000} step={10} onChange={(v) => set(i, v)} />
                  </Box>
                ) : real !== undefined ? (
                  <Text fontSize="sm" color="fg.muted">
                    {fmtMm(real)} mm
                  </Text>
                ) : null}
              </HStack>
            )}
          </FormRow>
        )
      })}
    </Stack>
  )
}

/** El Front d'un compartiment tapat pel front d'una zona de més amunt: no es fa (opcions en cascada: el de dalt mana). */
function CoveredFront({ id, title, coveredBy }: { id: string; title: string; coveredBy: string }) {
  return (
    <FoldItem id={id} title={title} badge="Tapat" icon={FRONT_ICONS.none}>
      <Text fontSize="sm" color="fg.muted">
        El tapen les portes de «{coveredBy}» ({UI_PATHS.doors}): aquest compartiment no en porta (el que hi havia es conserva i torna si treus les portes).
      </Text>
    </FoldItem>
  )
}

/**
 * Alçada del front de cada calaix, de baix a dalt, com les mides de la Divisió (`SplitSizes`): «Alçada 1»… amb «Auto» o
 * els mm, l'última no s'edita (el que sobra) i al costat de les «Auto» els mm reals (`real`, de la construcció).
 */
function DrawerHeights({ front, real, onChange }: { front: Extract<Front, { kind: "drawers" }>; real?: number[]; onChange: (f: Front) => void }) {
  const set = (i: number, size: number | "auto") => onChange(setDrawerHeight(front, i, size, real))
  return (
    <Stack gap={2}>
      <Text textStyle="xs" color="fg.muted">
        Alçada de cada front, de baix a dalt. Les «Auto» es reparteixen el que queda; l'última és el que sobra.
      </Text>
      {Array.from({ length: front.n }, (_, i) => {
        const mm = real?.[i]
        const size = front.heights[i] ?? "auto"
        const label = `Alçada ${i + 1}`
        return (
          <FormRow key={i} label={label}>
            {i === front.n - 1 ? (
              <Text fontSize="sm" color="fg.muted">
                {mm !== undefined ? `${fmtMm(mm)} mm` : "—"} (el que sobra)
              </Text>
            ) : (
              <HStack gap={3}>
                <Switch.Root size="sm" flexShrink={0} checked={size === "auto"} onCheckedChange={(e) => set(i, e.checked ? "auto" : mm !== undefined && mm > 0 ? Math.round(mm) : 150)}>
                  <Switch.HiddenInput />
                  <Switch.Control />
                  <Switch.Label fontSize="sm">Auto</Switch.Label>
                </Switch.Root>
                {size !== "auto" ? (
                  <Box flex="1" minW={0} maxW="160px">
                    <NumberField label="" ariaLabel={`${label} del front del calaix`} value={size} min={30} max={2000} step={5} onChange={(v) => set(i, v)} />
                  </Box>
                ) : mm !== undefined ? (
                  <Text fontSize="sm" color="fg.muted">
                    {fmtMm(mm)} mm
                  </Text>
                ) : null}
              </HStack>
            )}
          </FormRow>
        )
      })}
    </Stack>
  )
}

/** Resum d'un accessori per a la insígnia. */
const ACCESSORY_LABELS = { rail: "Barra", led: "LED" } as const

/** Insígnia de «Prestatges i accessoris»: el nombre de prestatges i els accessoris que hi ha («3 · Barra · LED»). */
function shelvesBadge(zone: Zone): string | undefined {
  const parts = [...(zone.shelves?.n ? [String(zone.shelves.n)] : []), ...(["rail", "led"] as const).filter((k) => zone[k]).map((k) => ACCESSORY_LABELS[k])]
  return parts.length ? parts.join(" · ") : undefined
}

/**
 * **Accessoris** d'un compartiment (auditoria B): barra de penjar i tira LED, ferratges de la biblioteca (motors `rail` i
 * `ledProfile`) triats amb el mateix `HardwarePick` que la frontissa; sense còpia pròpia, el del mòdul («Com el mòdul»).
 * Van a la secció «Prestatges i accessoris», a sota dels prestatges (per decisió de l'usuari, 2026-10-13). No són de CNC:
 * surten a Peces, a «Elements sense nesting».
 */
function AccessoryRows({ root, zone, hardware, onChange }: { root: Zone; zone: Zone; hardware: ModuleHardware; onChange: (root: Zone) => void }) {
  const setAcc = (key: "rail" | "led", value: ZoneAccessory | undefined) =>
    onChange(updateZone(root, zone.id, (z) => {
      const { [key]: _old, ...rest } = z
      return value ? { ...rest, [key]: value } : rest
    }))
  const row = (key: "rail" | "led", slot: "rail" | "led", label: string, help: string) => (
    <>
      <FormRow label={label} help={zone[key] ? help : undefined}>
        <Switch.Root size="sm" pt="6px" checked={!!zone[key]} onCheckedChange={(e) => setAcc(key, e.checked ? {} : undefined)}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="sm">{slotOf(slot).label}</Switch.Label>
        </Switch.Root>
      </FormRow>
      {zone[key] && <HardwarePick slot={slot} label="Ferratge" current={zone[key]!.hardware ?? moduleSlotItem(hardware, slot)} inherited={moduleSlotItem(hardware, slot)} onPick={(item) => setAcc(key, item ? { hardware: item } : {})} />}
    </>
  )
  return (
    <>
      {row("rail", "rail", "Penjar", "Tub de lateral a lateral sota el sostre del compartiment. Surt a Peces, a «Elements sense nesting».")}
      {row("led", "led", "Llum", "Perfil amb tira LED càlida sota el sostre i sota cada prestatge, a prop del davant. Fa llum al render i surt a Peces, a «Elements sense nesting», amb el llarg per tallar el perfil.")}
    </>
  )
}

/**
 * Calaixos amb un joc paramètric de doble paret (triat a «Guia» o com a guia del mòdul): les opcions del joc (tancament,
 * darrere i acabat) i el que el constructor n'ha tret per a aquest compartiment (`kits`): la NL triada, els números
 * d'article i les mides del fons A i del darrere B. Cap lateral de fusta; el gruix del fons el demana el joc (16).
 */
/**
 * La guia de cada calaix de baix a dalt (per decisió de l'usuari, 2026-10-14: «un selector de guia a cada calaix; si en
 * canvies un, el següent igual que l'anterior»): el primer és la «Guia de calaix»; cada un dels altres, «Com el calaix n»
 * (el de sota) o un joc propi (`front.drawerSlides`). Al costat, el joc que s'ha fet (el més alt de la sèrie que hi cap).
 */
function DrawerSlides({ front, kits, onChange }: { front: Extract<Front, { kind: "drawers" }>; kits?: KitOrder[]; onChange: (f: Front) => void }) {
  const { settings } = useSettings()
  const items = settings.hardwareLibrary.filter((x) => isDrawerKit(x))
  // El que ha fet la construcció, calaix a calaix (només si tots en porten: si no, no se sap quin és quin).
  const built = kits?.length === front.n ? kits : undefined
  const set = (i: number, h: HardwareItem | undefined) => {
    const own = Array.from({ length: front.n }, (_, j) => (j === i ? (h ?? null) : (front.drawerSlides?.[j] ?? null)))
    const { drawerSlides: _old, ...rest } = front
    void _old
    onChange(own.some((x) => x) ? { ...rest, drawerSlides: own } : rest)
  }
  return (
    <>
      {Array.from({ length: front.n - 1 }, (_, j) => {
        const i = j + 1
        const own = front.drawerSlides?.[i] ?? undefined
        const label = `Guia del calaix ${i + 1}`
        const made = built?.[i]
        return (
          <FormRow key={i} label={label} help={`${own ? hardwareSummary(own) : `La mateixa que el calaix ${i}.`}${made ? ` Es fa amb ${made.kit}.` : ""}`}>
            <HardwareSelect label={label} items={items} current={own} emptyLabel={`Com el calaix ${i}`} onPick={(h) => set(i, h)} />
          </FormRow>
        )
      })}
    </>
  )
}

function KitFields({ front, kit, kits, onChange }: { front: Extract<Front, { kind: "drawers" }>; kit: HardwareItem & { kit: NonNullable<HardwareItem["kit"]> }; kits?: KitOrder[]; onChange: (f: Front) => void }) {
  const o = kitOptionsOf(kit.kit, front.kit)
  const setKit = (patch: Partial<typeof o>) => onChange({ ...front, kit: { ...o, ...patch } })
  const first = kits?.[0]
  const finishes = kit.kit.options.finish ?? []
  const TB = kitBottomThickness(kit)
  // Van plegades a «Opcions de la guia de calaix» (`FrontFields`).
  return (
    <>
      <FormRow label="Tancament" help="Com tanca el calaix: suau (amortit), push-open (sense tirador, amb barra de sincronització) o les dues coses. Canvia els números d'article i si cal la barra.">
        <ChoiceChips label="Tancament" value={o.closing} options={kit.kit.options.closing.map((c) => ({ id: c, label: KIT_CLOSINGS.find((x) => x.id === c)!.short }))} onChange={(closing) => setKit({ closing })} />
      </FormRow>
      <FormRow label="Darrere" help="De fusta (peça B del tauler del cos, amb els suports de darrere) o metàl·lic del fabricant (per amplada del moble; el fons és 2 mm més llarg).">
        <ChoiceChips label="Darrere" value={o.back} options={kit.kit.options.back.map((b) => ({ id: b, label: KIT_BACKS.find((x) => x.id === b)!.short }))} onChange={(back) => setKit({ back })} />
      </FormRow>
      {finishes.length > 1 && o.finish && (
        <FormRow label="Acabat" help="Color dels laterals de doble paret (només canvia el 3D; els números d'article són els mateixos).">
          <ChoiceChips label="Acabat" value={o.finish} options={finishes.map((f) => ({ id: f, label: KIT_FINISHES.find((x) => x.id === f)!.short }))} onChange={(finish) => setKit({ finish })} />
        </FormRow>
      )}
      <FormRow label="Fons del calaix" help={`El joc demana un fons del calaix de ${TB} mm (catàleg): el gruix no es tria. El material, a Materials › «Fons del calaix» (sense, el del fons del mòdul adaptat al gruix, o el del cos si fa ${TB} mm).`}>
        <Text fontSize="sm" pt="6px" data-testid="kit-bottom">
          {TB} mm · el joc demana {TB} mm
        </Text>
      </FormRow>
      {first ? (
        <FormRow label="Joc" help={`${first.kit}: la llargada nominal més gran que hi cap darrere del front (LT = NL + 3). Sense laterals de fusta: el fons i el darrere surten de les fórmules del catàleg. Els components i els números són a Peces › «Ferratges dels jocs».`}>
          <Stack gap={0.5} pt="6px" fontSize="sm" data-testid="kit-info">
            <Text fontWeight="medium">NL {first.nl} · {kits!.length} {kits!.length === 1 ? "calaix" : "calaixos"}</Text>
            {first.lines.slice(0, 4).map((l) => (
              <Text key={l.component} fontSize="xs" color="fg.muted">
                {kitLineText(l)}
              </Text>
            ))}
            {first.wood.map((w) => (
              <Text key={w.key} fontSize="xs">
                {kitWoodText(w)}
              </Text>
            ))}
            {first.rule && (
              <Text fontSize="xs" color="fg.muted">
                Estabilitzador {KIT_LEVEL_LABEL[first.rule.stabilizer]} · barra {KIT_LEVEL_LABEL[first.rule.syncRod]}{first.syncRod !== undefined ? ` (tallar a ${fmtMm(first.syncRod)})` : ""}
              </Text>
            )}
          </Stack>
        </FormRow>
      ) : (
        <Text fontSize="xs" color="fg.muted">
          El joc no hi cap: mira els avisos del moble (fondària, alçada o laterals).
        </Text>
      )}
    </>
  )
}

/** El front amb el seu ferratge (una còpia) o, sense, amb el del mòdul (el camp fora). */
function withHardware<F extends Extract<Front, { kind: "door" | "drawers" | "flap" }>>(front: F, item: HardwareItem | undefined): F {
  if (item) return { ...front, hardware: item }
  const { hardware: _h, ...rest } = front
  return rest as F
}

/** El tirador propi d'un front: sense (`undefined`), el del mòdul; «Cap (push)» (`"none"`); o una còpia d'un item. */
function withHandle<F extends Extract<Front, { kind: "door" | "drawers" | "flap" }>>(front: F, item: FrontHandle | undefined): F {
  if (item) return { ...front, handle: item }
  const { handle: _h, ...rest } = front
  return rest as F
}

/**
 * Un calaix amb joc: el tancament del joc i el tirador són **una sola dada**. Triar «Cap (push)» posa el joc a push-open
 * (`pushSoft` si el joc el té i el tancament era suau, si no `push`); triar un tirador el torna a suau.
 */
function kitClosingFor(kit: HardwareItem & { kit: NonNullable<HardwareItem["kit"]> }, current: ReturnType<typeof kitOptionsOf>, push: boolean): ReturnType<typeof kitOptionsOf> {
  const opts = kit.kit.options.closing
  if (push) return isPushClosing(current.closing) ? current : { ...current, closing: opts.includes("pushSoft") ? "pushSoft" : opts.includes("push") ? "push" : current.closing }
  return isPushClosing(current.closing) ? { ...current, closing: opts.includes("soft") ? "soft" : current.closing } : current
}

function FrontFields({ front, openRatio, drawerHeights, onChange, hardware, noHandles, kits, bounds, afterHinge, noMode = false }: { front: Front; openRatio?: number; drawerHeights?: number[]; onChange: (f: Front) => void; hardware: ModuleHardware; noHandles: boolean; kits?: KitOrder[]; bounds: ZoneBounds; /** La filera System 32 del mòdul (placa de la frontissa), si surt aquí. */ afterHinge?: ReactNode; /** Una o dues portes ja es tria a dalt (Mòdul › Portes): la fila «Portes» no surt. */ noMode?: boolean }) {
  // «Tirador»: el del mòdul («Com el mòdul»), un altre de la biblioteca (un d'importat i confirmat fa els
  // forats a la seva distància) o «Cap (push)». Als calaixos amb joc, el tancament del joc mana (`kitClosingFor`).
  const handlePick = (f: Extract<Front, { kind: "door" | "drawers" | "flap" }>, kit?: HardwareItem & { kit: NonNullable<HardwareItem["kit"]> }) => {
    const kitOpts = kit && f.kind === "drawers" ? kitOptionsOf(kit.kit, f.kit) : undefined
    const kitPush = !!kitOpts && isPushClosing(kitOpts.closing)
    const push = kitPush || f.handle === "none" || (!f.handle && noHandles)
    const inheritedNone = !f.handle && noHandles && !kitPush
    const setHandle = (h: FrontHandle | undefined) => {
      const next = withHandle(f, h)
      // Amb joc: el tancament segueix la tria (push ⇔ cap tirador) i el front no guarda «none» (el joc ja ho diu).
      if (kit && kitOpts && next.kind === "drawers") onChange({ ...withHandle(next, h === "none" ? undefined : h), kit: kitClosingFor(kit, kitOpts, h === "none") })
      else onChange(next)
    }
    const help = kitPush ? "La guia de calaix ja porta el sistema push (push-open): no cal cap Tip-On, ni tirador ni forats. Per posar-hi un tirador, canvia el Tancament a les Opcions de la guia de calaix." : inheritedNone ? "El mòdul és push: cap forat; tria'n un aquí si aquest front n'ha de portar." : "Obertura per pressió: cap forat. Cal el ferratge push (Tip-On) a aquest front."
    return (
      <HardwarePick
        slot="handle"
        label="Tirador"
        current={f.handle && f.handle !== "none" ? f.handle : push ? undefined : moduleSlotItem(hardware, "handle")}
        inherited={noHandles ? undefined : moduleSlotItem(hardware, "handle")}
        emptyLabel={noHandles ? "Com el mòdul (cap, push)" : undefined}
        none={{ label: "Cap (push)", help, selected: push && !inheritedNone, onPick: () => setHandle("none") }}
        onPick={(h) => setHandle(h)}
      />
    )
  }
  switch (front.kind) {
    case "door":
      // Un camp per fila: dos grups de botons no hi caben de costat a l'inspector.
      return (
        <Stack gap={3}>
          {!noMode && <FormRow label="Portes">
            <ChoiceChips
              label="Portes"
              value={front.mode}
              // Dues portes: frontisses als dos costats (cal un lateral o un divisor a cada un).
              options={[
                { id: "single", label: <><LuDoorClosed /> Una</> },
                ...(bounds.left && bounds.right || front.mode === "double" ? [{ id: "double" as const, label: <><LuFlipHorizontal2 /> Dues</> }] : []),
              ]}
              onChange={(mode) => onChange({ ...front, mode })}
            />
          </FormRow>}
          {front.mode === "single" && (
            <FormRow label="Frontisses">
              {/* Pastilles: «Esquerra» amb icona no cap en mig control segmentat. */}
              <ChoiceChips
                label="Frontisses"
                value={front.hinge}
                // Només els costats on hi ha un lateral o un divisor per a les plaques (i el triat, si ja no n'hi ha).
                options={[
                  ...(bounds.left || front.hinge === "left" ? [{ id: "left" as const, label: <><LuPanelLeft /> Esquerra</> }] : []),
                  ...(bounds.right || front.hinge === "right" ? [{ id: "right" as const, label: <><LuPanelRight /> Dreta</> }] : []),
                ]}
                onChange={(hinge) => onChange({ ...front, hinge })}
              />
            </FormRow>
          )}
          <FormRow label="Vitrina" help={front.glass ? "Marc de perfil d'alumini (el triat a «Marc») i vidre; la frontissa i el tirador es trien a sota. No és de CNC: surt a Peces, a «Elements sense nesting», amb les mides per demanar-ho." : undefined}>
            <Switch.Root size="sm" pt="6px" checked={!!front.glass} onCheckedChange={(e) => onChange({ ...front, glass: e.checked || undefined })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Porta de vidre amb marc</Switch.Label>
            </Switch.Root>
          </FormRow>
          {/* La de vidre porta el marc d'alumini (ferratge `glassFrame`); la frontissa i el tirador es trien igual que a les
              de fusta (per decisió de l'usuari): al perfil no es mecanitza res, la placa de la frontissa sí, al lateral. */}
          {front.glass && <HardwarePick slot="glassFrame" label="Marc" current={front.frame ?? moduleSlotItem(hardware, "glassFrame")} inherited={moduleSlotItem(hardware, "glassFrame")} onPick={(h) => onChange(h ? { ...front, frame: h } : (({ frame: _f, ...rest }) => rest)(front))} />}
          <HardwarePick slot="hinge" current={front.hardware ?? hardware.hinge} inherited={hardware.hinge} help={front.glass ? "A la porta de vidre, la frontissa de perfil (com la Metallamat A) es clava al marc: només es mecanitza la seva placa al lateral, a la filera System 32." : undefined} onPick={(h) => onChange(withHardware(front, h))} />
          {!front.glass && afterHinge}
          {handlePick(front)}
        </Stack>
      )
    case "drawers":
      return (
        <Stack gap={3}>
          <NumRow label="Calaixos" help={isDrawerKit(front.hardware ?? hardware.slide) ? "Calaixos del joc de doble paret (sense laterals de fusta), amb la llargada nominal més gran que hi cap." : "Caixa de fusta amb la guia de la llargada més gran que hi cap."} suffix="u" value={front.n} min={1} max={10} step={1} onChange={(n) => {
            if (!Number.isFinite(n)) return
            const k = Math.max(1, Math.min(10, Math.round(n)))
            // L'última sempre és el que sobra («auto»), com a la Divisió.
            onChange({ ...front, n: k, heights: Array.from({ length: k }, (_, i) => (i === k - 1 ? "auto" : (front.heights[i] ?? "auto"))) })
          }} />
          {/* Cada tria amb les seves opcions plegades a sota (per decisió de l'usuari, 2026-10-13: «cada un té les seves
              opcions, no les ajuntis»): Calaixos › alçades, Guia › joc, Tirador › posició. */}
          {front.n > 1 && (
            <FoldItem id="zone-drawer-heights" title="Alçada dels calaixos" icon={LuSettings2} size="sm" badge={front.heights.slice(0, front.n - 1).some((h) => h !== "auto") ? "Alçades a mida" : "Alçades iguals"}>
              <DrawerHeights front={front} real={drawerHeights} onChange={onChange} />
            </FoldItem>
          )}
          <HardwarePick slot="slide" label={perDrawerSlides(front, front.hardware ?? hardware.slide) ? "Guia del calaix 1" : undefined} current={front.hardware ?? hardware.slide} inherited={hardware.slide} onPick={(h) => onChange(withHardware(front, h))} />
          {/* Amb un joc de calaix, la guia de cada un dels altres calaixos (els de sobre segueixen el de sota). */}
          {perDrawerSlides(front, front.hardware ?? hardware.slide) && <DrawerSlides front={front} kits={kits} onChange={onChange} />}
          {/* Un joc de calaix, triat aquí o com a guia del mòdul: les opcions del joc. */}
          {(() => {
            const slide = front.hardware ?? hardware.slide
            const kit = isDrawerKit(slide) ? slide : undefined
            // On va el tirador: només si n'hi ha (push: cap forat, no surt).
            const hasHandle = !((kit && isPushClosing(kitOptionsOf(kit.kit, front.kit).closing)) || front.handle === "none" || (!front.handle && noHandles))
            return (
              <>
                {kit && (
                  <FoldItem id="zone-kit" title="Opcions de la guia de calaix" icon={LuSettings2} size="sm" badge={KIT_CLOSINGS.find((x) => x.id === kitOptionsOf(kit.kit, front.kit).closing)?.short}>
                    <KitFields front={front} kit={kit} kits={kits} onChange={onChange} />
                  </FoldItem>
                )}
                {handlePick(front, kit)}
                {hasHandle && (
                  <FoldItem id="zone-handle" title="Opcions del tirador" icon={LuSettings2} size="sm" badge={front.handleTop !== undefined ? `A dalt · ${front.handleTop} mm` : "Centrat"}>
                    <FormRow label="Posició del tirador">
                      <ChoiceChips
                        label="Posició del tirador"
                        value={front.handleTop !== undefined ? "top" : "center"}
                        options={[
                          { id: "center", label: "Centrat" },
                          { id: "top", label: "A dalt" },
                        ]}
                        onChange={(v) => onChange(v === "top" ? { ...front, handleTop: 40 } : (({ handleTop: _t, ...rest }) => rest)(front))}
                      />
                    </FormRow>
                    {front.handleTop !== undefined && (
                      <NumRow label="Des de dalt" value={front.handleTop} min={0} max={1000} step={5} onChange={(handleTop) => Number.isFinite(handleTop) && onChange({ ...front, handleTop })} help="Del cantell de dalt del front a l'eix del tirador. Com a molt, el mig del front." />
                    )}
                  </FoldItem>
                )}
              </>
            )
          })()}
        </Stack>
      )
    case "flap":
      return (
        <Stack gap={3}>
          <FormRow label="Obre cap a">
            <ChoiceChips
              label="Obre cap a"
              value={front.dir}
              options={[
                { id: "down", label: <><LuArrowDownToLine /> Avall</> },
                { id: "up", label: <><LuArrowUpToLine /> Amunt</> },
              ]}
              onChange={(dir) => onChange({ ...front, dir })}
            />
          </FormRow>
          <FormRow label="Vitrina" help={front.glass ? "Marc de perfil d'alumini i vidre, com la porta de vidre; el braç i el tirador es trien a sota. No és de CNC: surt a Peces, a «Elements sense nesting»." : undefined}>
            <Switch.Root size="sm" pt="6px" checked={!!front.glass} onCheckedChange={(e) => onChange({ ...front, glass: e.checked || undefined })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Abatible de vidre amb marc</Switch.Label>
            </Switch.Root>
          </FormRow>
          {front.glass && <HardwarePick slot="glassFrame" label="Marc" current={front.frame ?? moduleSlotItem(hardware, "glassFrame")} inherited={moduleSlotItem(hardware, "glassFrame")} onPick={(h) => onChange(h ? { ...front, frame: h } : (({ frame: _f, ...rest }) => rest)(front))} />}
          <HardwarePick slot="flap" current={front.hardware ?? hardware.flap} inherited={hardware.flap} help={front.glass ? "A l'abatible de vidre, el braç es fixa al perfil amb l'adaptador (Häfele 563.25.960): cap forat al tauler." : undefined} onPick={(h) => onChange(withHardware(front, h))} />
          {handlePick(front)}
          {/* Només la distància al cantell que obre (el tirador va centrat de costat a costat). Push: no surt. */}
          {!front.glass && !(front.handle === "none" || (!front.handle && noHandles)) && (() => {
            const item = typeof front.handle === "object" ? front.handle : moduleSlotItem(hardware, "handle")
            const own = (() => {
              try {
                return handleSpec(item).inset
              } catch {
                return undefined
              }
            })()
            const value = front.handleInset ?? own ?? 0
            return (
              <FoldItem id="zone-flap-handle" title="Opcions del tirador" icon={LuSettings2} size="sm" badge={`${fmtMm(value)} mm del cantell`}>
                <NumRow
                  label="Des del cantell"
                  value={value}
                  min={0}
                  max={1000}
                  step={5}
                  onChange={(v) => Number.isFinite(v) && onChange(v === own ? (({ handleInset: _i, ...rest }) => rest)(front) : { ...front, handleInset: v })}
                  help={`Del cantell que obre a l'eix del tirador. ${own !== undefined ? `La del tirador: ${fmtMm(own)} mm.` : ""} Com a molt, el mig de l'abatible.`}
                />
              </FoldItem>
            )
          })()}
        </Stack>
      )
    case "grille": {
      const p = front.pattern
      const setP = (patch: Partial<typeof p>) => onChange({ ...front, pattern: { ...p, ...patch } })
      return (
        <Stack gap={3}>
          {/* Una fila per camp: el panell és estret i les opcions són llargues. */}
          <FormRow label="Patró">
            <IconChoice
              hideLabel
              label="Patró"
              value={p.kind}
              options={[
                { value: "slotsV", label: "Ranures verticals", icon: LuColumns3 },
                { value: "slotsH", label: "Ranures horitzontals", icon: LuAlignJustify },
                { value: "holes", label: "Forats al tresbolillo", icon: LuGrip },
              ]}
              onChange={(kind) => setP({ kind })}
            />
          </FormRow>
          <FormRow label="Muntatge">
            {/* Pastilles: «Frontisses» amb icona no cap en mig control segmentat. */}
            <ChoiceChips
              label="Muntatge"
              value={front.mount}
              // Amb frontisses, a un lateral o a un divisor (i la triada, si ja no n'hi ha).
              options={[
                { id: "removable", label: <><LuMagnet /> Imants</> },
                ...(bounds.left || bounds.right || front.mount === "hinged" ? [{ id: "hinged" as const, label: <><LuDoorOpen /> Frontisses</> }] : []),
              ]}
              onChange={(mount) => onChange({ ...front, mount })}
            />
          </FormRow>
          {/* Amb frontisses (les del mòdul): la filera de la placa. */}
          {front.mount !== "removable" && afterHinge}
          {p.kind === "holes" ? (
            <>
              <NumRow label="Diàmetre forat" value={p.holeDiameter} min={3} max={60} step={1} onChange={(holeDiameter) => setP({ holeDiameter })} />
              <NumRow label="Pas" value={p.holePitch} min={4} max={120} step={1} onChange={(holePitch) => setP({ holePitch })} />
            </>
          ) : (
            <>
              <NumRow label="Ranura" value={p.slotWidth} min={3} max={60} step={1} onChange={(slotWidth) => setP({ slotWidth })} />
              <NumRow label="Separació" value={p.slotGap} min={3} max={100} step={1} onChange={(slotGap) => setP({ slotGap })} />
            </>
          )}
          <NumRow label="Marge" value={p.margin} min={10} max={200} step={5} onChange={(margin) => setP({ margin })} />
          {openRatio !== undefined && (
            <Text fontSize="sm" color={openRatio < 0.4 ? "fg.error" : "fg.muted"}>
              Àrea oberta: {Math.round(openRatio * 100)} % {openRatio < 0.4 ? "(per sota del 40 % recomanat)" : ""}
            </Text>
          )}
          <FormRow label="Trapa">
            <Switch.Root
              size="sm"
              pt="6px"
              checked={!!front.hatch}
              onCheckedChange={(e) => onChange({ ...front, hatch: e.checked ? { x: 100, y: 100, w: 150, h: 150 } : undefined })}
            >
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Trapa petita (clau del radiador)</Switch.Label>
            </Switch.Root>
          </FormRow>
          {front.hatch && (
            <>
              <NumRow label="Trapa X" value={front.hatch.x} min={0} max={3000} step={10} onChange={(x) => onChange({ ...front, hatch: { ...front.hatch!, x } })} />
              <NumRow label="Trapa Y" value={front.hatch.y} min={0} max={3000} step={10} onChange={(y) => onChange({ ...front, hatch: { ...front.hatch!, y } })} />
              <NumRow label="Ample" value={front.hatch.w} min={50} max={600} step={10} onChange={(w) => onChange({ ...front, hatch: { ...front.hatch!, w } })} />
              <NumRow label="Alt" value={front.hatch.h} min={50} max={600} step={10} onChange={(h) => onChange({ ...front, hatch: { ...front.hatch!, h } })} />
            </>
          )}
          {/* Després de Muntatge i Trapa (en depèn: opcions en cascada). */}
          {/* L'imant (reixeta desmuntable i trapa): el del mòdul o un altre de la biblioteca. */}
          {(front.mount === "removable" || front.hatch) && <HardwarePick slot="magnet" current={front.hardware ?? hardware.magnet} inherited={hardware.magnet} onPick={(h) => onChange(h ? { ...front, hardware: h } : (({ hardware: _h, ...rest }) => rest)(front))} />}
        </Stack>
      )
    }
    case "panel":
      return null
  }
}

/**
 * Mòdul › Portes (per decisió de l'usuari: «el Front de tota la zona no té sentit que surti a totes les divisions»): les
 * portes de dalt a baix de l'arrel dividida (armari amb penjador i maleter darrere), que tapen tots els compartiments.
 * Només Cap · Una · Dues i les opcions de la porta (`FrontFields`). Un mòdul sense dividir fa servir el Front del
 * compartiment. Un altre front de l'arrel dividida (el front fix d'abans) no es fa i surt com a «Cap» (es conserva).
 */
export function ModuleDoorsSection({ root, onChange, hardware, noHandles, bounds, afterHinge }: { root: Zone; onChange: (root: Zone) => void; hardware: ModuleHardware; noHandles: boolean; /** Què aguanta l'arrel (`canHoldFront`: pels quatre costats). */ bounds: ZoneBounds; /** Després de la «Frontissa» (la filera System 32 del mòdul). */ afterHinge?: ReactNode }) {
  const door = root.front?.kind === "door" ? root.front : undefined
  const value = door?.mode ?? "none"
  const canDoor = canHoldFront(bounds, "door")
  const choose = (mode: "none" | "single" | "double") => {
    if (mode === "none") return onChange(switchFront(root, root.id, "none"))
    const base = door ? root : switchFront(root, root.id, "door")
    const f = findZone(base, root.id)?.front
    if (f?.kind !== "door") return
    // Una porta nova va amb les frontisses a un costat on hi ha on posar-les.
    const hinge = mode === "single" && !bounds[f.hinge] && bounds[f.hinge === "left" ? "right" : "left"] ? (f.hinge === "left" ? "right" : "left") : f.hinge
    onChange(setFront(base, root.id, { ...f, mode, hinge }))
  }
  return (
    <FoldItem id="mod-doors" title="Portes" icon={LuDoorClosed} badge={door ? (door.mode === "double" ? "Dues portes" : "Una porta") : undefined}>
      <FormRow label="Portes" help={frontLimitsHelp(bounds, ["none", "door"], door ? "door" : "none") ?? "De dalt a baix: tapen tots els compartiments (armari amb penjador i maleter darrere)."}>
        <ChoiceChips
          label="Portes"
          value={value}
          // Dues portes: frontisses als dos costats (cal un lateral o un divisor a cada un). El triat surt sempre.
          options={[
            { id: "none" as const, label: <><LuSquareDashed /> Cap</> },
            ...(canDoor || value === "single" ? [{ id: "single" as const, label: <><LuDoorClosed /> Una</> }] : []),
            ...((canDoor && bounds.left && bounds.right) || value === "double" ? [{ id: "double" as const, label: <><LuFlipHorizontal2 /> Dues</> }] : []),
          ]}
          onChange={choose}
        />
      </FormRow>
      {door && <FrontFields front={door} noMode hardware={hardware} noHandles={noHandles} bounds={bounds} afterHinge={afterHinge} onChange={(f) => onChange(setFront(root, root.id, f))} />}
    </FoldItem>
  )
}

/** Tipus de front d'un compartiment (botons d'icona) i els seus camps. */
function ZoneFrontSection({ root, zone, onChange, openRatio, drawerHeights, hardware, noHandles = false, kits, bounds, afterHinge }: { root: Zone; zone: Zone; onChange: (root: Zone) => void; openRatio?: number; drawerHeights?: number[]; hardware: ModuleHardware; noHandles?: boolean; kits?: KitOrder[]; /** Què aguanta el compartiment: els fronts que no s'hi poden fixar no surten (el triat, sí). */ bounds: ZoneBounds; /** Després de la «Frontissa» (la filera System 32 del mòdul). */ afterHinge?: ReactNode }) {
  const all = Object.keys(FRONT_LABELS) as (Front["kind"] | "none")[]
  const current = zone.front?.kind ?? "none"
  const options = all.filter((k) => k === current || canHoldFront(bounds, k))
  // Els fronts només es fan amb el compartiment aguantat pels quatre costats (`frontHeld`): els altres no surten, el triat
  // sí (es conserva) i l'ajuda diu per què no es fa.
  const limits = frontLimitsHelp(bounds, all, current)
  /** Una porta nova va amb les frontisses a un costat on hi ha on posar-les. */
  const choose = (k: Front["kind"] | "none") => {
    const next = switchFront(root, zone.id, k)
    const f = findZone(next, zone.id)?.front
    if (f?.kind === "door" && f.mode === "single" && !bounds[f.hinge] && bounds[f.hinge === "left" ? "right" : "left"]) onChange(setFront(next, zone.id, { ...f, hinge: f.hinge === "left" ? "right" : "left" }))
    else onChange(next)
  }
  return (
          <FoldItem id="zone-front" title="Front" badge={FRONT_LABELS[zone.front?.kind ?? "none"]} icon={FRONT_ICONS[zone.front?.kind ?? "none"]}>
            {/* Tipus de front: un botó amb la icona de cada tipus (el nom, al tooltip, a sota i a la insígnia). */}
            <FormRow label="Contingut" help={limits}>
              <IconChoice
                hideLabel
                label="Tipus de front"
                value={current}
                options={options.map((k) => ({ value: k, label: FRONT_LABELS[k], icon: FRONT_ICONS[k] }))}
                onChange={choose}
              />
            </FormRow>
            {zone.front && <FrontFields front={zone.front} openRatio={openRatio} drawerHeights={drawerHeights} hardware={hardware} noHandles={noHandles} kits={kits} bounds={bounds} afterHinge={afterHinge} onChange={(f) => onChange(setFront(root, zone.id, f))} />}
          </FoldItem>
  )
}
