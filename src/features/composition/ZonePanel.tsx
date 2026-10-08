import { Button, HStack, IconButton, Menu, Portal, Stack, Switch, Text } from "@chakra-ui/react"
import { LuArrowUp, LuCopy, LuEllipsis, LuColumns2, LuRows2, LuPlus, LuRows3, LuRuler, LuShirt, LuSquareSplitHorizontal, LuSquareSplitVertical, LuTrash2, LuUngroup } from "react-icons/lu"
import type { ReactNode } from "react"
import { FoldItem } from "../../components/Fold"
import {
  addChild,
  duplicateZone,
  parentOf,
  removeZone,
  setChildSize,
  setFront,
  setShelves,
  splitZone,
  switchFront,
  unsplitZone,
  updateZone,
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
  isDrawerKit,
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
import type { KitOrder } from "../../core/build/buildModule"
import { kitBottomThickness, kitLineText, kitWoodText } from "../../core/build/drawerKit"
import { NumRow } from "../../components/NumRow"
import { ChoiceChips, FormRow } from "../../components/FormRow"
import { FRONT_ICONS } from "./zoneIcons"
import { HardwarePick } from "./HardwarePick"
import { IconChoice } from "../../components/IconChoice"
import { LuAlignJustify, LuArrowDownToLine, LuArrowUpToLine, LuColumns3, LuDoorClosed, LuDoorOpen, LuFlipHorizontal2, LuGrip, LuMagnet, LuPanelLeft, LuPanelRight } from "react-icons/lu"

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

/** Panell d'edició de la zona seleccionada: dividir, contingut, mida, eliminar. */
export function ZonePanel({
  root,
  zone,
  openRatio,
  onChange,
  hardware,
  noHandles = false,
  kits,
  splitExtra,
  coveredBy,
  coveredByFixed = false,
  bounds,
  system32,
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
}) {
  const parent = parentOf(root, zone.id)
  // Hi ha on fer servir prestatges i accessoris: tapat per portes (com obert), o el seu contingut no l'omple.
  const shelvesBehind = coveredBy ? !coveredByFixed : !fillsZone(zone.front)
  const index = parent?.split ? parent.split.children.findIndex((c) => c.id === zone.id) : -1
  const size = parent?.split ? (parent.split.sizes[index] ?? "auto") : undefined

  const sizeField = parent?.split && size !== undefined && (
    <FoldItem id="zone-size" title={parent.split.dir === "v" ? "Amplada" : "Alçada"} icon={LuRuler} badge={size === "auto" ? "Auto" : `${size} mm`}>
      <FormRow label="Mida" help={`${parent.split.dir === "v" ? "Amplada" : "Alçada"} de la llum. Les automàtiques es reparteixen el que queda.`}>
        <Switch.Root size="sm" pt="6px" checked={size === "auto"} onCheckedChange={(e) => onChange(setChildSize(root, parent.id, index, e.checked ? "auto" : 400))}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="sm">Automàtica</Switch.Label>
        </Switch.Root>
      </FormRow>
      {size !== "auto" && <NumRow label={parent.split.dir === "v" ? "Amplada" : "Alçada"} value={size} min={50} max={3000} step={10} onChange={(v) => onChange(setChildSize(root, parent.id, index, v))} />}
    </FoldItem>
  )

  return (
    <Stack gap={0}>

      {zone.split ? (
        <>
          <FoldItem id="zone-split" title={`Divisió ${zone.split.dir === "v" ? "vertical" : "horitzontal"}`} badge={`${zone.split.children.length} zones`} icon={zone.split.dir === "v" ? LuColumns2 : LuRows2}>
            <Text fontSize="sm" color="fg.muted">
              Toca una zona a l'estructura o al dibuix per editar-la.
            </Text>
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
          {/* Portes que tapen tota la zona dividida (armari: penjador i maleter darrere). */}
          {coveredBy ? <CoveredFront id="zone-parent-front" title="Front de tota la zona" coveredBy={coveredBy} /> : <ZoneFrontSection root={root} zone={zone} onChange={onChange} hardware={hardware} noHandles={noHandles} kinds={["none", "door", "panel"]} title="Front de tota la zona" bounds={bounds} afterHinge={system32?.at === "front" ? system32.row : undefined} />}
          {sizeField}
        </>
      ) : (
        <>
          {coveredBy ? <CoveredFront id="zone-front" title="Front" coveredBy={coveredBy} /> : <ZoneFrontSection root={root} zone={zone} openRatio={openRatio} onChange={onChange} hardware={hardware} noHandles={noHandles} kits={kits} bounds={bounds} afterHinge={system32?.at === "front" ? system32.row : undefined} />}

          {/* Tapat: el seu front (es conserva) no es fa i el compartiment és com obert (`visibleZone`). Sense una peça a
              cada costat (lateral o divisor), cap prestatge: no surt (es conserva i torna amb els laterals). Amb calaixos
              o un front fix (darrere no hi ha res a fer servir), tampoc; ni tapat per un front fix de tota la zona. */}
          {shelvesBehind && canHoldShelves(bounds) && (
            <FoldItem id="zone-shelves" title="Prestatges" badge={zone.shelves?.n || undefined} icon={LuRows3}>
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
            </FoldItem>
          )}

          {/* Accessoris del compartiment: ferratges (barra de penjar, tira LED), no fusta. Amb calaixos o un front fix, no. */}
          {shelvesBehind && canHoldAccessories(bounds) && <AccessoriesSection root={root} zone={zone} hardware={hardware} onChange={onChange} />}

          {sizeField}

          {/* Només les direccions on el divisor té on unir-se (`splitDirsFor`): el vertical, a sota i a sobre; el
              travesser, als dos costats. Sense cap, la secció no surt. */}
          {splitDirsFor(bounds).length > 0 && (
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

/** El Front d'un compartiment tapat pel front d'una zona de més amunt: no es fa (opcions en cascada: el de dalt mana). */
function CoveredFront({ id, title, coveredBy }: { id: string; title: string; coveredBy: string }) {
  return (
    <FoldItem id={id} title={title} badge="Tapat" icon={FRONT_ICONS.none}>
      <Text fontSize="sm" color="fg.muted">
        El tapa el front de «{coveredBy}»: aquest compartiment no en porta (el que hi havia es conserva i torna si treus aquell front).
      </Text>
    </FoldItem>
  )
}

/** Resum d'un accessori per a la insígnia. */
const ACCESSORY_LABELS = { rail: "Barra", led: "LED" } as const

/**
 * **Accessoris** d'un compartiment (auditoria B): barra de penjar i tira LED, ferratges de la biblioteca (motors `rail` i
 * `ledProfile`) triats amb el mateix `HardwarePick` que la frontissa; sense còpia pròpia, el del mòdul («Com el mòdul»).
 * Abans eren dos interruptors a Prestatges. No són de CNC: surten a Peces, a «Elements sense nesting».
 */
function AccessoriesSection({ root, zone, hardware, onChange }: { root: Zone; zone: Zone; hardware: ModuleHardware; onChange: (root: Zone) => void }) {
  const on = (["rail", "led"] as const).filter((k) => zone[k]).map((k) => ACCESSORY_LABELS[k])
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
    <FoldItem id="zone-accessories" title="Accessoris" badge={on.length ? on.join(" · ") : undefined} icon={LuShirt}>
      {row("rail", "rail", "Penjar", "Tub de lateral a lateral sota el sostre del compartiment. Surt a Peces, a «Elements sense nesting».")}
      {row("led", "led", "Llum", "Perfil amb tira LED càlida sota el sostre i sota cada prestatge, a prop del davant. Fa llum al render i surt a Peces, a «Elements sense nesting», amb el llarg per tallar el perfil.")}
    </FoldItem>
  )
}

/**
 * Calaixos amb un joc paramètric de doble paret (triat a «Guia» o com a guia del mòdul): les opcions del joc (tancament,
 * darrere i acabat) i el que el constructor n'ha tret per a aquest compartiment (`kits`): la NL triada, els números
 * d'article i les mides del fons A i del darrere B. Cap lateral de fusta; el gruix del fons el demana el joc (16).
 */
function KitFields({ front, kit, kits, onChange }: { front: Extract<Front, { kind: "drawers" }>; kit: HardwareItem & { kit: NonNullable<HardwareItem["kit"]> }; kits?: KitOrder[]; onChange: (f: Front) => void }) {
  const o = kitOptionsOf(kit.kit, front.kit)
  const setKit = (patch: Partial<typeof o>) => onChange({ ...front, kit: { ...o, ...patch } })
  const first = kits?.[0]
  const finishes = kit.kit.options.finish ?? []
  const TB = kitBottomThickness(kit)
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

function FrontFields({ front, openRatio, onChange, hardware, noHandles, kits, bounds, afterHinge }: { front: Front; openRatio?: number; onChange: (f: Front) => void; hardware: ModuleHardware; noHandles: boolean; kits?: KitOrder[]; bounds: ZoneBounds; /** La filera System 32 del mòdul (placa de la frontissa), si surt aquí. */ afterHinge?: ReactNode }) {
  // «Tirador»: el del mòdul (Mòdul › Acabats), un altre de la biblioteca (un d'importat i confirmat fa els
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
    const help = kitPush ? "El joc obre per pressió (push-open): cap tirador ni forats. Canvia el Tancament del joc per posar-n'hi." : inheritedNone ? "El mòdul és push (Mòdul › Acabats): cap forat; tria'n un aquí si aquest front n'ha de portar." : "Obertura per pressió: cap forat. Cal el ferratge push (Tip-On) a aquest front."
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
          <FormRow label="Portes">
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
          </FormRow>
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
          <FormRow label="Vitrina" help={front.glass ? "Marc de perfil d'alumini negre de 20 mm i vidre de 5 mm, amb frontisses de perfil. No és de CNC: surt a Peces, a «Elements sense nesting», amb les mides per demanar-ho." : undefined}>
            <Switch.Root size="sm" pt="6px" checked={!!front.glass} onCheckedChange={(e) => onChange({ ...front, glass: e.checked || undefined })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Porta de vidre amb marc</Switch.Label>
            </Switch.Root>
          </FormRow>
          {/* La de vidre porta el marc d'alumini (ferratge `glassFrame`) i les frontisses del perfil (cap cassoleta): la frontissa i el tirador no surten. */}
          {front.glass && <HardwarePick slot="glassFrame" label="Marc" current={front.frame ?? moduleSlotItem(hardware, "glassFrame")} inherited={moduleSlotItem(hardware, "glassFrame")} onPick={(h) => onChange(h ? { ...front, frame: h } : (({ frame: _f, ...rest }) => rest)(front))} />}
          {!front.glass && <HardwarePick slot="hinge" current={front.hardware ?? hardware.hinge} inherited={hardware.hinge} onPick={(h) => onChange(withHardware(front, h))} />}
          {!front.glass && afterHinge}
          {!front.glass && handlePick(front)}
        </Stack>
      )
    case "drawers":
      return (
        <Stack gap={3}>
          <NumRow label="Calaixos" help={isDrawerKit(front.hardware ?? hardware.slide) ? "Alçades de front: auto (iguals). Calaixos del joc de doble paret (sense laterals de fusta), amb la llargada nominal més gran que hi cap." : "Alçades de front: auto (iguals). Caixa de fusta amb la guia de la llargada més gran que hi cap."} suffix="u" value={front.n} min={1} max={10} step={1} onChange={(n) => {
            if (!Number.isFinite(n)) return
            const k = Math.max(1, Math.min(10, Math.round(n)))
            onChange({ ...front, n: k, heights: Array.from({ length: k }, (_, i) => front.heights[i] ?? "auto") })
          }} />
          <HardwarePick slot="slide" current={front.hardware ?? hardware.slide} inherited={hardware.slide} onPick={(h) => onChange(withHardware(front, h))} />
          {/* Un joc de calaix, triat aquí o com a guia del mòdul: les opcions del joc. */}
          {(() => {
            const slide = front.hardware ?? hardware.slide
            const kit = isDrawerKit(slide) ? slide : undefined
            return (
              <>
                {kit && <KitFields front={front} kit={kit} kits={kits} onChange={onChange} />}
                {handlePick(front, kit)}
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
          <HardwarePick slot="flap" current={front.hardware ?? hardware.flap} inherited={hardware.flap} onPick={(h) => onChange(withHardware(front, h))} />
          {handlePick(front)}
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
 * Tipus de front d'una zona (botons d'icona) i els seus camps. En una zona dividida, només
 * portes o front fix, que tapen tota la zona (les fulles de dins queden darrere).
 */
export function ZoneFrontSection({ root, zone, onChange, openRatio, kinds, title = "Front", id, hardware, noHandles = false, kits, bounds, afterHinge }: { root: Zone; zone: Zone; onChange: (root: Zone) => void; openRatio?: number; hardware: ModuleHardware; noHandles?: boolean; kits?: KitOrder[]; kinds?: (Front["kind"] | "none")[]; title?: string; /** Id de la secció plegable (cada lloc el seu: recorda si és oberta). */ id?: string; /** Què aguanta el compartiment: els fronts que no s'hi poden fixar no surten (el triat, sí). */ bounds: ZoneBounds; /** Després de la «Frontissa» (la filera System 32 del mòdul). */ afterHinge?: ReactNode }) {
  const all = kinds ?? (Object.keys(FRONT_LABELS) as (Front["kind"] | "none")[])
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
          <FoldItem id={id ?? (kinds ? "zone-parent-front" : "zone-front")} title={title} badge={FRONT_LABELS[zone.front?.kind ?? "none"]} icon={FRONT_ICONS[zone.front?.kind ?? "none"]}>
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
            {zone.front && <FrontFields front={zone.front} openRatio={openRatio} hardware={hardware} noHandles={noHandles} kits={kits} bounds={bounds} afterHinge={afterHinge} onChange={(f) => onChange(setFront(root, zone.id, f))} />}
          </FoldItem>
  )
}
