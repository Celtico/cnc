import { Button, HStack, Switch } from "@chakra-ui/react"
import { LuInbox, LuLamp, LuPlus, LuRows3, LuSettings2 } from "react-icons/lu"
import type { ReactNode } from "react"
import { FoldItem } from "../../../components/Fold"
import { KIT_CLOSINGS, addSideMargin, canHoldAccessories, canHoldShelves, innerDrawerHeights, innerPerDrawerSlides, isDrawerKit, kitOptionsOf, moduleSlotItem, setShelves, slotOf, updateZone, type Front, type ModuleHardware, type Zone, type ZoneAccessory, type ZoneBounds } from "../../../core/model"
import type { KitOrder } from "../../../core/build/buildModule"
import { DrawerSlides, KitFields } from "./DrawerFields"
import { NumRow } from "../../../components/NumRow"
import { ChoiceChips, FormRow } from "../../../components/FormRow"
import { HardwarePick } from "../HardwarePick"
import { useSettings } from "../../settings/SettingsContext"

/**
 * **«Opcions de l'interior»** d'un compartiment sense dividir (per decisió de l'usuari, 2026-10-16; abans «Prestatges i
 * accessoris»; surt sempre menys amb un front fix o amb calaixos): prestatges (quantitat, regulació, a ras, gruix), els
 * accessoris i, darrere d'una porta, els **calaixos interiors** (`behindDoor`). Per decisió de l'usuari, 2026-10-20, sense
 * secció pròpia: van dins del Front, a sota del «Contingut» (canvien amb el contingut triat). L'id `zone.shelves` és el
 * grup del registre.
 */
export function ZoneShelvesSection({ root, zone, onChange, hardware, bounds, system32, behindDoor = false, moduleSetback = 20, kits, hingeSides = [] }: { /** Els costats amb frontisses de la porta de davant (el «Marge a les frontisses» dels calaixos interiors). */ hingeSides?: readonly ("left" | "right")[]; /** Els jocs de calaix que ha fet la construcció en aquest compartiment (els dels calaixos interiors). */ kits?: KitOrder[]; /** El retirada dels prestatges del mòdul (el que s'hereta). */ moduleSetback?: number; root: Zone; zone: Zone; onChange: (root: Zone) => void; hardware: ModuleHardware; bounds: ZoneBounds; system32?: { at: "shelves" | "front"; row: ReactNode }; /** Hi ha una porta davant (la seva o la d'una zona de més amunt): hi poden anar calaixos interiors. */ behindDoor?: boolean }) {
  const { settings } = useSettings()
  return (
    <>
      {/* Per grups (per decisió de l'usuari, 2026-10-17), com les subseccions de la Caixa: Prestatges, Accessoris i Calaixos
          interiors, cada un plegable amb el seu resum. */}
      {canHoldShelves(bounds) && <FoldItem optionId="zone.shelves.shelvesGroup" id="zone-shelves-shelves" title="Prestatges" icon={LuRows3} size="sm" badge={zone.shelves?.n ? String(zone.shelves.n) : undefined}>
      <NumRow
        optionId="zone.shelves.count"
        label="Prestatges"
        suffix="u"
        value={zone.shelves?.n ?? 0}
        min={0}
        max={20}
        step={1}
        onChange={(n) => onChange(setShelves(root, zone.id, n > 0 || zone.shelves ? { ...zone.shelves, n: Math.max(0, n), adjustable: zone.shelves?.adjustable ?? true } : null))}
      />
      {/* Sense cap prestatge, l'interruptor mostra el valor que fa servir la construcció (sense `shelves`: no regulables). */}
      <FormRow optionId="zone.shelves.adjustable" label="Regulació" help={(zone.shelves?.adjustable ?? false) ? "Forats System 32 als laterals per moure'ls." : undefined}>
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
      <FormRow optionId="zone.shelves.flush" label="Davant">
        <Switch.Root size="sm" pt="6px" checked={!!zone.shelves?.flush} onCheckedChange={(e) => onChange(setShelves(root, zone.id, patchShelves(zone, { flush: e.checked ? true : undefined })))}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="sm">A ras del davant (a sang)</Switch.Label>
        </Switch.Root>
      </FormRow>
      {/* Retirats: quant (el del compartiment o el del mòdul). Per decisió de l'usuari, 2026-10-17: amb portes de vidre i
          pistons d'abatible els prestatges hi topaven i no es podia escurçar la fondària. */}
      {!zone.shelves?.flush && (
        <NumRow
          optionId="zone.shelves.setback"
          label="Retirada"
          value={zone.shelves?.setback ?? moduleSetback}
          min={0}
          max={300}
          step={1}
          help={`Del davant de la caixa al cantell dels prestatges. ${zone.shelves?.setback === undefined ? `Com el mòdul (${moduleSetback} mm).` : `El mòdul: ${moduleSetback} mm.`} Amb un pistó d'abatible, es retiren sols el que calgui.`}
          onChange={(v) => Number.isFinite(v) && v >= 0 && onChange(setShelves(root, zone.id, patchShelves(zone, { setback: v === moduleSetback ? undefined : v })))}
        />
      )}
      {/* Prestatges gruixuts (buits): queden més bé a la vista, sense porta. */}
      <FormRow optionId="zone.shelves.thick" label="Gruix">
        <Switch.Root
          size="sm"
          pt="6px"
          checked={!!zone.shelves?.thickness}
          onCheckedChange={(e) => onChange(setShelves(root, zone.id, patchShelves(zone, { thickness: e.checked ? 50 : undefined })))}
        >
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="sm">Gruixuts (buits)</Switch.Label>
        </Switch.Root>
      </FormRow>
      {zone.shelves?.thickness && (
        <NumRow
          optionId="zone.shelves.thickness"
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
      </FoldItem>}
      {/* Accessoris del compartiment: ferratges (barra de penjar, tira LED), no fusta; a sota dels prestatges (la tira
          LED va sota cada prestatge). */}
      {canHoldAccessories(bounds) && (
        <FoldItem optionId="zone.shelves.accessoriesGroup" id="zone-shelves-accessories" title="Accessoris" icon={LuLamp} size="sm" badge={(["rail", "led"] as const).filter((k) => zone[k]).map((k) => ACCESSORY_LABELS[k]).join(" · ") || undefined}>
          <AccessoryRows root={root} zone={zone} hardware={hardware} onChange={onChange} />
        </FoldItem>
      )}
      {/* Calaixos interiors: darrere d'una porta, a baix de tot (els prestatges es reparteixen per sobre). */}
      {behindDoor && canHoldShelves(bounds) && (
        <FoldItem optionId="zone.shelves.innerDrawersGroup" id="zone-shelves-drawers" title="Calaixos interiors" icon={LuInbox} size="sm" badge={zone.innerDrawers ? String(zone.innerDrawers.n) : undefined}>
          <InnerDrawerRows root={root} zone={zone} hardware={hardware} setback={settings.gaps.innerDrawerSetback ?? 25} kits={kits} hinges={hingeSides} onChange={onChange} />
        </FoldItem>
      )}
    </>
  )
}

/** Els prestatges del compartiment amb uns camps canviats (`undefined` el treu); la resta es queda (res amagat compta). */
function patchShelves(zone: Zone, patch: Partial<NonNullable<Zone["shelves"]>>): NonNullable<Zone["shelves"]> {
  const out: NonNullable<Zone["shelves"]> = { ...zone.shelves, n: zone.shelves?.n ?? 0, adjustable: zone.shelves?.adjustable ?? true }
  for (const [k, v] of Object.entries(patch) as [keyof NonNullable<Zone["shelves"]>, unknown][]) {
    if (v === undefined) delete out[k]
    else (out as Record<string, unknown>)[k] = v
  }
  return out
}

/** Resum d'un accessori per a la insígnia. */
const ACCESSORY_LABELS = { rail: "Barra", led: "LED" } as const

/**
 * **Accessoris** d'un compartiment (auditoria B): barra de penjar i tira LED, ferratges de la biblioteca (motors `rail` i
 * `ledProfile`) triats amb el mateix `HardwarePick` que la frontissa; sense còpia pròpia, el del mòdul («Com el mòdul»).
 * Van a la secció «Opcions de l'interior», a sota dels prestatges (per decisió de l'usuari, 2026-10-13). No són de CNC:
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
      <FormRow optionId={key === "rail" ? "zone.shelves.rail" : "zone.shelves.led"} label={label} help={zone[key] ? help : undefined}>
        <Switch.Root size="sm" pt="6px" checked={!!zone[key]} onCheckedChange={(e) => setAcc(key, e.checked ? {} : undefined)}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="sm">{slotOf(slot).label}</Switch.Label>
        </Switch.Root>
      </FormRow>
      {zone[key] && <HardwarePick optionId={key === "rail" ? "zone.shelves.railHardware" : "zone.shelves.ledHardware"} slot={slot} label="Ferratge" current={zone[key]!.hardware ?? moduleSlotItem(hardware, slot)} inherited={moduleSlotItem(hardware, slot)} onPick={(item) => setAcc(key, item ? { hardware: item } : {})} />}
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
 * **Calaixos interiors** (`Zone.innerDrawers`, per decisió de l'usuari, 2026-10-16): quants, l'alçada de cada un, la guia
 * (o el joc), la retirada del front interior i el marge a les frontisses (una zona). 0 els treu. Per decisió de
 * l'usuari, 2026-10-20, amb les mateixes opcions que Front › Calaixos (els mateixos components, `DrawerSlides` i
 * `KitFields`): l'alçada de cada calaix, la guia de cada calaix i les opcions del joc. Sense tirador (front interior).
 */
function InnerDrawerRows({ root, zone, hardware, setback, kits, hinges, onChange }: { root: Zone; zone: Zone; hardware: ModuleHardware; setback: number; kits?: KitOrder[]; /** Els costats amb frontisses (de la porta que hi ha davant). */ hinges: readonly ("left" | "right")[]; onChange: (root: Zone) => void }) {
  const d = zone.innerDrawers
  const set = (next: Zone["innerDrawers"]) =>
    onChange(updateZone(root, zone.id, (z) => {
      const { innerDrawers: _old, ...rest } = z
      return next ? { ...rest, innerDrawers: next } : rest
    }))
  if (!d) return (
    <NumRow
      optionId="zone.shelves.innerDrawers"
      label="Calaixos"
      suffix="u"
      value={0}
      min={0}
      max={10}
      step={1}
      help="Calaixos darrere de la porta, a baix de tot del compartiment."
      onChange={(n) => Number.isFinite(n) && n > 0 && set({ height: 180, setback, n: Math.round(n) })}
    />
  )
  const hs = innerDrawerHeights(d)
  // Una alçada canviada: totes iguals tornen a ser la comuna (`height`), si no, les de cada calaix (`heights`).
  const setHeight = (i: number, v: number) => {
    const next = hs.map((h, j) => (j === i ? v : h))
    const { heights: _h, ...rest } = d
    set(new Set(next).size > 1 ? { ...rest, heights: next } : { ...rest, height: v })
  }
  const slide = d.hardware ?? moduleSlotItem(hardware, "slide")
  const kit = isDrawerKit(slide) ? slide : undefined
  const perDrawer = innerPerDrawerSlides(d, slide)
  // Els components de Front › Calaixos treballen amb un front de calaixos: el mateix que fa la construcció.
  const asFront: Extract<Front, { kind: "drawers" }> = { kind: "drawers", n: d.n, heights: [...hs.slice(0, d.n - 1), "auto"], ...(d.hardware ? { hardware: d.hardware } : {}), ...(d.kit ? { kit: d.kit } : {}), ...(d.drawerSlides ? { drawerSlides: d.drawerSlides } : {}) }
  const fromFront = (f: Front) => {
    if (f.kind !== "drawers") return
    const { kit: _k, drawerSlides: _s, ...rest } = d
    set({ ...rest, ...(f.kit ? { kit: f.kit } : {}), ...(f.drawerSlides ? { drawerSlides: f.drawerSlides } : {}) })
  }
  return (
    <>
      <NumRow
        optionId="zone.shelves.innerDrawers"
        label="Calaixos"
        suffix="u"
        value={d.n}
        min={0}
        max={10}
        step={1}
        help={kit ? "A baix de tot, darrere de la porta: calaixos del joc de doble paret amb front interior baix (sense tirador), retirat del davant; els prestatges es reparteixen per sobre." : "A baix de tot, darrere de la porta: front interior baix (sense tirador), retirat del davant; els prestatges es reparteixen per sobre."}
        onChange={(n) => Number.isFinite(n) && set(n > 0 ? { ...d, n: Math.round(n) } : undefined)}
      />
      {/* Com a Front › Calaixos: cada tria amb les seves opcions plegades a sota (Calaixos › alçades, Guia › joc). */}
      {d.n > 1 ? (
        <FoldItem optionId="zone.shelves.innerDrawers.heights" id="zone-inner-drawer-heights" title="Alçada dels calaixos" icon={LuSettings2} size="sm" badge={new Set(hs).size > 1 ? "Alçades a mida" : `Alçades iguals · ${hs[0]} mm`}>
          {hs.map((h, i) => (
            <NumRow key={i} optionId="zone.shelves.innerDrawers.height" label={`Alçada ${i + 1}`} value={h} min={60} max={1000} step={10} help={i === 0 ? "Alçada de cada calaix, de baix a dalt (el lloc que ocupa). Totes iguals de sortida." : undefined} onChange={(v) => Number.isFinite(v) && v >= 60 && setHeight(i, v)} />
          ))}
        </FoldItem>
      ) : (
        <NumRow optionId="zone.shelves.innerDrawers.height" label="Alçada" value={d.height} min={60} max={1000} step={10} onChange={(v) => Number.isFinite(v) && v >= 60 && setHeight(0, v)} />
      )}
      <HardwarePick optionId="zone.shelves.innerDrawers.slide" slot="slide" label={perDrawer ? "Guia del calaix 1" : undefined} current={slide} inherited={moduleSlotItem(hardware, "slide")} onPick={(item) => set(item ? { ...d, hardware: item } : (({ hardware: _h, ...rest }) => rest)(d))} />
      {/* Amb un joc de calaix i alçades diferents, la guia de cada un dels altres calaixos (els de sobre segueixen el de sota). */}
      {perDrawer && <DrawerSlides front={asFront} kits={kits} optionId="zone.shelves.innerDrawers.slides" onChange={fromFront} />}
      {kit && (
        <FoldItem optionId="zone.shelves.innerDrawers.kit" id="zone-inner-kit" title="Opcions de la guia de calaix" icon={LuSettings2} size="sm" badge={KIT_CLOSINGS.find((x) => x.id === kitOptionsOf(kit.kit, d.kit).closing)?.short}>
          {/* El front de fusta o el metàl·lic del fabricant (tot ferratge). */}
          <FormRow optionId="zone.shelves.innerDrawers.front" label="Front" help={d.front === "kit" ? "Cap peça de fusta al davant: el front interior metàl·lic del fabricant, a la comanda del joc." : "Front interior de fusta (del cos), baix, entre els laterals del joc."}>
            <ChoiceChips
              label="Front"
              value={d.front ?? "wood"}
              options={[{ id: "wood" as const, label: "De fusta" }, { id: "kit" as const, label: "Metàl·lic (del joc)" }]}
              onChange={(v) => set(v === "kit" ? { ...d, front: "kit" } : (({ front: _f, ...rest }) => rest)(d))}
            />
          </FormRow>
          <KitFields
            front={asFront}
            kit={kit}
            kits={kits}
            onChange={fromFront}
            ids={{ closing: "zone.shelves.innerDrawers.kit.closing", back: "zone.shelves.innerDrawers.kit.back", finish: "zone.shelves.innerDrawers.kit.finish", bottom: "zone.shelves.innerDrawers.kit.bottom", info: "zone.shelves.innerDrawers.kit.info" }}
          />
        </FoldItem>
      )}
      {d.front !== "kit" && (
        <FormRow optionId="zone.shelves.innerDrawers.glass" label="Vidre" help={d.glass ? "Marc d'una peça de fusta amb la finestra calada i un vidre de 4 mm al galze de darrere." : undefined}>
          <Switch.Root size="sm" pt="6px" checked={!!d.glass} onCheckedChange={(e) => set(e.checked ? { ...d, glass: true } : (({ glass: _g, ...rest }) => rest)(d))}>
            <Switch.HiddenInput />
            <Switch.Control />
            <Switch.Label fontSize="sm">Front de vidre</Switch.Label>
          </Switch.Root>
        </FormRow>
      )}
      <NumRow optionId="zone.shelves.innerDrawers.setback" label="Retirada del front" value={d.setback ?? 25} min={0} max={100} step={1} help="Del davant de la caixa al davant del front interior." onChange={(v) => Number.isFinite(v) && set({ ...d, setback: v })} />
      {/* Sense suplements (per decisió de l'usuari, 2026-10-20: «0 casos especials»): el marge per a les frontisses és una
          zona estreta oberta al costat, una divisió normal (`addSideMargin`). */}
      {hinges.length > 0 && (
        <FormRow optionId="zone.shelves.innerDrawers.margin" label="Marge a les frontisses" help="Divideix el compartiment amb una zona oberta de 50 mm al costat de les frontisses: el braç i la placa no topen amb els calaixos, i la guia va al divisor. Després la pots fer més ampla o posar-hi prestatges, com qualsevol zona.">
          <HStack gap={2} wrap="wrap" pt="2px">
            {hinges.map((side) => (
              <Button key={side} size="xs" variant="outline" onClick={() => onChange(addSideMargin(root, zone.id, side))}>
                <LuPlus /> {side === "left" ? "A l'esquerra" : "A la dreta"}
              </Button>
            ))}
          </HStack>
        </FormRow>
      )}
    </>
  )
}
