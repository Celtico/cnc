import { Switch } from "@chakra-ui/react"
import { LuRows3 } from "react-icons/lu"
import type { ReactNode } from "react"
import { FoldItem } from "../../../components/Fold"
import { canHoldAccessories, canHoldShelves, moduleSlotItem, setShelves, slotOf, updateZone, type ModuleHardware, type Zone, type ZoneAccessory, type ZoneBounds } from "../../../core/model"
import { NumRow } from "../../../components/NumRow"
import { ChoiceChips, FormRow } from "../../../components/FormRow"
import { HardwarePick } from "../HardwarePick"
import { useSettings } from "../../settings/SettingsContext"

/**
 * **«Opcions de l'interior»** d'un compartiment sense dividir (per decisió de l'usuari, 2026-10-16; abans «Prestatges i
 * accessoris»; surt sempre menys amb un front fix o amb calaixos): prestatges (quantitat, regulació, a ras, gruix), els
 * accessoris i, darrere d'una porta, els **calaixos interiors** (`behindDoor`).
 */
export function ZoneShelvesSection({ root, zone, onChange, hardware, bounds, system32, behindDoor = false, bodyThickness = 19, moduleSetback = 20 }: { /** El gruix del cos (el suplement per defecte). */ bodyThickness?: number; /** El retranqueig dels prestatges del mòdul (el que s'hereta). */ moduleSetback?: number; root: Zone; zone: Zone; onChange: (root: Zone) => void; hardware: ModuleHardware; bounds: ZoneBounds; system32?: { at: "shelves" | "front"; row: ReactNode }; /** Hi ha una porta davant (la seva o la d'una zona de més amunt): hi poden anar calaixos interiors. */ behindDoor?: boolean }) {
  const { settings } = useSettings()
  return (
    <FoldItem optionId="zone.shelves" id="zone-shelves" title="Opcions de l'interior" badge={shelvesBadge(zone, behindDoor)} icon={LuRows3}>
      {canHoldShelves(bounds) && <>
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
          label="Retranqueig"
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
      </>}
      {/* Accessoris del compartiment: ferratges (barra de penjar, tira LED), no fusta; a sota dels prestatges (la tira
          LED va sota cada prestatge). */}
      {canHoldAccessories(bounds) && <AccessoryRows root={root} zone={zone} hardware={hardware} onChange={onChange} />}
      {/* Calaixos interiors: darrere d'una porta, a baix de tot (els prestatges es reparteixen per sobre). */}
      {behindDoor && canHoldShelves(bounds) && <InnerDrawerRows root={root} zone={zone} hardware={hardware} setback={settings.gaps.innerDrawerSetback ?? 25} body={bodyThickness} onChange={onChange} />}
    </FoldItem>
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

/** Insígnia d'«Opcions de l'interior»: prestatges, accessoris i calaixos interiors que hi ha («3 · Barra · 2 calaixos»). */
function shelvesBadge(zone: Zone, behindDoor: boolean): string | undefined {
  const parts = [...(zone.shelves?.n ? [String(zone.shelves.n)] : []), ...(["rail", "led"] as const).filter((k) => zone[k]).map((k) => ACCESSORY_LABELS[k]), ...(behindDoor && zone.innerDrawers ? [`${zone.innerDrawers.n} ${zone.innerDrawers.n === 1 ? "calaix" : "calaixos"}`] : [])]
  return parts.length ? parts.join(" · ") : undefined
}

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
 * (o el joc), la retirada del front interior i el suplement al costat de les frontisses. 0 els treu.
 */
function InnerDrawerRows({ root, zone, hardware, setback, body, onChange }: { root: Zone; zone: Zone; hardware: ModuleHardware; setback: number; body: number; onChange: (root: Zone) => void }) {
  const d = zone.innerDrawers
  const set = (next: Zone["innerDrawers"]) =>
    onChange(updateZone(root, zone.id, (z) => {
      const { innerDrawers: _old, ...rest } = z
      return next ? { ...rest, innerDrawers: next } : rest
    }))
  return (
    <>
      <NumRow
        optionId="zone.shelves.innerDrawers"
        label="Calaixos interiors"
        suffix="u"
        value={d?.n ?? 0}
        min={0}
        max={10}
        step={1}
        help={d ? "A baix de tot, darrere de la porta: front interior baix (sense tirador), retirat del davant; els prestatges es reparteixen per sobre." : "Calaixos darrere de la porta, a baix de tot del compartiment."}
        onChange={(n) => Number.isFinite(n) && set(n > 0 ? { ...(d ?? { height: 180, setback }), n: Math.round(n) } : undefined)}
      />
      {d && (
        <>
          <NumRow optionId="zone.shelves.innerDrawers.height" label="Alçada de cada calaix" value={d.height} min={60} max={1000} step={10} onChange={(height) => Number.isFinite(height) && height >= 60 && set({ ...d, height })} />
          <HardwarePick optionId="zone.shelves.innerDrawers.slide" slot="slide" current={d.hardware ?? moduleSlotItem(hardware, "slide")} inherited={moduleSlotItem(hardware, "slide")} onPick={(item) => set(item ? { ...d, hardware: item } : (({ hardware: _h, ...rest }) => rest)(d))} />
          {/* Amb un joc de calaix: el front de fusta o el metàl·lic del fabricant (tot ferratge). */}
          {(d.hardware ?? moduleSlotItem(hardware, "slide"))?.engine === "drawerKit" && (
            <FormRow optionId="zone.shelves.innerDrawers.front" label="Front" help={d.front === "kit" ? "Cap peça de fusta al davant: el front interior metàl·lic del fabricant, a la comanda del joc." : "Front interior de fusta (del cos), baix, entre els laterals del joc."}>
              <ChoiceChips
                label="Front"
                value={d.front ?? "wood"}
                options={[{ id: "wood" as const, label: "De fusta" }, { id: "kit" as const, label: "Metàl·lic (del joc)" }]}
                onChange={(v) => set(v === "kit" ? { ...d, front: "kit" } : (({ front: _f, ...rest }) => rest)(d))}
              />
            </FormRow>
          )}
          <NumRow optionId="zone.shelves.innerDrawers.setback" label="Retirada del front" value={d.setback ?? 25} min={0} max={100} step={1} help="Del davant de la caixa al davant del front interior." onChange={(v) => Number.isFinite(v) && set({ ...d, setback: v })} />
          <NumRow optionId="zone.shelves.innerDrawers.shim" label="Suplement" value={d.shim ?? body} min={0} max={60} step={1} help={d.shim === undefined ? "Com el gruix del cos. Al costat de les frontisses: la guia s'hi cargola perquè el calaix no topi amb la frontissa (0 = sense)." : "Al costat de les frontisses: la guia s'hi cargola perquè el calaix no topi amb la frontissa (0 = sense)."} onChange={(v) => Number.isFinite(v) && v >= 0 && set({ ...d, shim: v })} />
        </>
      )}
    </>
  )
}
