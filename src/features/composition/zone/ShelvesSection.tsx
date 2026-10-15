import { Switch } from "@chakra-ui/react"
import { LuRows3 } from "react-icons/lu"
import type { ReactNode } from "react"
import { FoldItem } from "../../../components/Fold"
import { canHoldAccessories, canHoldShelves, moduleSlotItem, setShelves, slotOf, updateZone, type ModuleHardware, type Zone, type ZoneAccessory, type ZoneBounds } from "../../../core/model"
import { NumRow } from "../../../components/NumRow"
import { FormRow } from "../../../components/FormRow"
import { HardwarePick } from "../HardwarePick"

/** «Prestatges i accessoris» d'un compartiment sense dividir: quantitat, regulació, a ras, gruix i els accessoris. */
export function ZoneShelvesSection({ root, zone, onChange, hardware, bounds, system32 }: { root: Zone; zone: Zone; onChange: (root: Zone) => void; hardware: ModuleHardware; bounds: ZoneBounds; system32?: { at: "shelves" | "front"; row: ReactNode } }) {
  return (
    <FoldItem optionId="zone.shelves" id="zone-shelves" title="Prestatges i accessoris" badge={shelvesBadge(zone)} icon={LuRows3}>
      {canHoldShelves(bounds) && <>
      <NumRow
        optionId="zone.shelves.count"
        label="Quantitat"
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
        <Switch.Root size="sm" pt="6px" checked={!!zone.shelves?.flush} onCheckedChange={(e) => onChange(setShelves(root, zone.id, { n: zone.shelves?.n ?? 0, adjustable: zone.shelves?.adjustable ?? true, ...(zone.shelves?.thickness ? { thickness: zone.shelves.thickness } : {}), ...(e.checked ? { flush: true } : {}) }))}>
          <Switch.HiddenInput />
          <Switch.Control />
          <Switch.Label fontSize="sm">A ras del davant (a sang)</Switch.Label>
        </Switch.Root>
      </FormRow>
      {/* Prestatges gruixuts (buits): queden més bé a la vista, sense porta. */}
      <FormRow optionId="zone.shelves.thick" label="Gruix">
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
      </>}
      {/* Accessoris del compartiment: ferratges (barra de penjar, tira LED), no fusta; a sota dels prestatges (la tira
          LED va sota cada prestatge). */}
      {canHoldAccessories(bounds) && <AccessoryRows root={root} zone={zone} hardware={hardware} onChange={onChange} />}
    </FoldItem>
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
