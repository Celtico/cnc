import { Button, HStack, IconButton, Menu, Portal, Stack, Switch, Text } from "@chakra-ui/react"
import { LuArrowUp, LuCopy, LuEllipsis, LuColumns2, LuRows2, LuPlus, LuRows3, LuRuler, LuSquareSplitHorizontal, LuSquareSplitVertical, LuTrash2, LuUngroup } from "react-icons/lu"
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
  KIT_BACKS,
  KIT_CLOSINGS,
  KIT_FINISHES,
  KIT_LEVEL_LABEL,
  fmtMm,
  isDrawerKit,
  kitOptionsOf,
  type Front,
  type HardwareItem,
  type ModuleHardware,
  type Zone,
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

/** Panell d'edició de la zona seleccionada: dividir, contingut, mida, eliminar. */
export function ZonePanel({
  root,
  zone,
  openRatio,
  onChange,
  hardware,
  noHandles = false,
  kits,
  afterFront,
}: {
  root: Zone
  zone: Zone
  /** % d'àrea oberta si la zona té reixeta. */
  openRatio?: number
  onChange: (root: Zone) => void
  /** Ferratges del mòdul (els fronts en poden triar un altre). */
  hardware: ModuleHardware
  /** El mòdul no porta tiradors (fronts push): el «Tirador» dels fronts no surt. */
  noHandles?: boolean
  /** Calaixos d'aquesta zona fets amb un joc paramètric (del constructor): NL, números i fusta. */
  kits?: KitOrder[]
  /** Seccions de després del Front (a l'«Interior», l'arrel: «Fronts i calaixos» del mòdul). */
  afterFront?: ReactNode
}) {
  const parent = parentOf(root, zone.id)
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
          </FoldItem>
          {/* Portes que tapen tota la zona dividida (armari: penjador i maleter darrere). */}
          <ZoneFrontSection root={root} zone={zone} onChange={onChange} hardware={hardware} noHandles={noHandles} kinds={["none", "door", "panel"]} title="Front de tota la zona" />
          {afterFront}
          {sizeField}
        </>
      ) : (
        <>
          <ZoneFrontSection root={root} zone={zone} openRatio={openRatio} onChange={onChange} hardware={hardware} noHandles={noHandles} kits={kits} />
          {afterFront}

          {zone.front?.kind !== "drawers" && (
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
              {/* Barra de penjar (armaris): no és de CNC, surt a «Elements sense nesting». */}
              {!zone.split && (
                <FormRow label="Penjador" help={zone.rail ? "Tub d'inox Ø25 a 50 mm del sostre, de lateral a lateral. Surt a Peces, a «Elements sense nesting»." : undefined}>
                  <Switch.Root size="sm" pt="6px" checked={!!zone.rail} onCheckedChange={(e) => onChange(updateZone(root, zone.id, (z) => ({ ...z, rail: e.checked || undefined })))}>
                    <Switch.HiddenInput />
                    <Switch.Control />
                    <Switch.Label fontSize="sm">Barra de penjar</Switch.Label>
                  </Switch.Root>
                </FormRow>
              )}
              {/* Llum LED (vitrines, prestatgeries, nínxols): fa llum al render; el perfil surt a Peces sense nesting. */}
              {!zone.split && (
                <FormRow label="Llum" help={zone.led ? "Perfil amb tira LED càlida sota el sostre i sota cada prestatge, a prop del davant. Fa llum al render i surt a Peces, a «Elements sense nesting», amb el llarg per tallar el perfil." : undefined}>
                  <Switch.Root size="sm" pt="6px" checked={!!zone.led} onCheckedChange={(e) => onChange(updateZone(root, zone.id, (z) => ({ ...z, led: e.checked || undefined })))}>
                    <Switch.HiddenInput />
                    <Switch.Control />
                    <Switch.Label fontSize="sm">Tira LED</Switch.Label>
                  </Switch.Root>
                </FormRow>
              )}
            </FoldItem>
          )}

          {sizeField}

          <FoldItem id="zone-divide" title="Dividir" icon={LuSquareSplitHorizontal} defaultOpen={false}>
            <Text textStyle="xs" color="fg.muted">
              Parteix aquest compartiment en dos. El contingut es queda al primer.
            </Text>
            <HStack wrap="wrap">
              <Button size="sm" variant="outline" onClick={() => onChange(splitZone(root, zone.id, "v", 2))}>
                <LuSquareSplitHorizontal /> En vertical
              </Button>
              <Button size="sm" variant="outline" onClick={() => onChange(splitZone(root, zone.id, "h", 2))}>
                <LuSquareSplitVertical /> En horitzontal
              </Button>
            </HStack>
          </FoldItem>
        </>
      )}
    </Stack>
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
      <FormRow label="Fons" help={`El joc demana un fons de calaix de ${TB} mm (catàleg): no es tria. El material és el del fons del moble (o el del cos si fa ${TB} mm).`}>
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

/** El tirador propi d'un front: sense (`undefined`), el del mòdul. */
function withHandle<F extends Extract<Front, { kind: "door" | "drawers" | "flap" }>>(front: F, item: HardwareItem | undefined): F {
  if (item) return { ...front, handle: item }
  const { handle: _h, ...rest } = front
  return rest as F
}

function FrontFields({ front, openRatio, onChange, hardware, noHandles, kits }: { front: Front; openRatio?: number; onChange: (f: Front) => void; hardware: ModuleHardware; noHandles: boolean; kits?: KitOrder[] }) {
  // «Tirador»: el del mòdul (Fusteria) o un altre de la biblioteca (un d'importat i confirmat fa els forats a la seva distància).
  const handlePick = (f: Extract<Front, { kind: "door" | "drawers" | "flap" }>) =>
    noHandles ? null : <HardwarePick slot="handle" label="Tirador" current={f.handle ?? hardware.handle} inherited={hardware.handle} onPick={(h) => onChange(withHandle(f, h))} />
  switch (front.kind) {
    case "door":
      // Un camp per fila: dos grups de botons no hi caben de costat a l'inspector.
      return (
        <Stack gap={3}>
          <FormRow label="Portes">
            <ChoiceChips
              label="Portes"
              value={front.mode}
              options={[
                { id: "single", label: <><LuDoorClosed /> Una</> },
                { id: "double", label: <><LuFlipHorizontal2 /> Dues</> },
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
                options={[
                  { id: "left", label: <><LuPanelLeft /> Esquerra</> },
                  { id: "right", label: <><LuPanelRight /> Dreta</> },
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
          {/* La de vidre porta les frontisses del perfil (cap cassoleta): no surt. */}
          {!front.glass && <HardwarePick slot="hinge" current={front.hardware ?? hardware.hinge} inherited={hardware.hinge} onPick={(h) => onChange(withHardware(front, h))} />}
          {!front.glass && handlePick(front)}
        </Stack>
      )
    case "drawers":
      return (
        <Stack gap={3}>
          <NumRow label="Calaixos" help="Alçades de front: auto (iguals). Caixa amb guia genèrica de la llargada més gran que hi cap." suffix="u" value={front.n} min={1} max={10} step={1} onChange={(n) => {
            if (!Number.isFinite(n)) return
            const k = Math.max(1, Math.min(10, Math.round(n)))
            onChange({ ...front, n: k, heights: Array.from({ length: k }, (_, i) => front.heights[i] ?? "auto") })
          }} />
          <HardwarePick slot="slide" current={front.hardware ?? hardware.slide} inherited={hardware.slide} onPick={(h) => onChange(withHardware(front, h))} />
          {/* Un joc de calaix, triat aquí o com a guia del mòdul: les opcions del joc. */}
          {(() => {
            const slide = front.hardware ?? hardware.slide
            return isDrawerKit(slide) ? <KitFields front={front} kit={slide} kits={kits} onChange={onChange} /> : null
          })()}
          {handlePick(front)}
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
              options={[
                { id: "removable", label: <><LuMagnet /> Imants</> },
                { id: "hinged", label: <><LuDoorOpen /> Frontisses</> },
              ]}
              onChange={(mount) => onChange({ ...front, mount })}
            />
          </FormRow>

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
export function ZoneFrontSection({ root, zone, onChange, openRatio, kinds, title = "Front", id, hardware, noHandles = false, kits }: { root: Zone; zone: Zone; onChange: (root: Zone) => void; openRatio?: number; hardware: ModuleHardware; noHandles?: boolean; kits?: KitOrder[]; kinds?: (Front["kind"] | "none")[]; title?: string; /** Id de la secció plegable (cada lloc el seu: recorda si és oberta). */ id?: string }) {
  const options = kinds ?? (Object.keys(FRONT_LABELS) as (Front["kind"] | "none")[])
  return (
          <FoldItem id={id ?? (kinds ? "zone-parent-front" : "zone-front")} title={title} badge={FRONT_LABELS[zone.front?.kind ?? "none"]} icon={FRONT_ICONS[zone.front?.kind ?? "none"]}>
            {/* Tipus de front: un botó amb la icona de cada tipus (el nom, al tooltip, a sota i a la insígnia). */}
            <FormRow label="Contingut">
              <IconChoice
                hideLabel
                label="Tipus de front"
                value={zone.front?.kind ?? "none"}
                options={options.map((k) => ({ value: k, label: FRONT_LABELS[k], icon: FRONT_ICONS[k] }))}
                onChange={(k) => onChange(switchFront(root, zone.id, k))}
              />
            </FormRow>
            {zone.front && <FrontFields front={zone.front} openRatio={openRatio} hardware={hardware} noHandles={noHandles} kits={kits} onChange={(f) => onChange(setFront(root, zone.id, f))} />}
          </FoldItem>
  )
}
