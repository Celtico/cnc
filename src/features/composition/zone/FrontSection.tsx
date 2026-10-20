import { Button, HStack } from "@chakra-ui/react"
import { useState, type ReactNode } from "react"
import { LuPlus, LuRefrigerator } from "react-icons/lu"
import { FoldItem } from "../../../components/Fold"
import { APPLIANCE_LABELS, canHoldFront, fillsNiche, findZone, frontLimitsHelp, isAppliance, setFront, switchFront, updateZone, type Front, type ModuleHardware, type Zone, type ZoneBounds } from "../../../core/model"
import type { KitOrder } from "../../../core/build/buildModule"
import { FormRow } from "../../../components/FormRow"
import { FRONT_ICONS } from "../zoneIcons"
import { IconChoice } from "../../../components/IconChoice"
import { FrontFields } from "./FrontFields"
import { ApplianceFields } from "./ApplianceSection"

const FRONT_LABELS: Record<Front["kind"] | "none", string> = {
  none: "Obert",
  door: "Porta",
  drawers: "Calaixos",
  flap: "Abatible",
  grille: "Reixeta",
  panel: "Front fix",
}

/**
 * Les «Opcions de l'interior» (prestatges, accessoris, calaixos interiors) dins del Front, a sota del «Contingut» (per
 * decisió de l'usuari, 2026-10-20): les files i el resum per a la insígnia.
 */
export interface FrontInterior {
  node: ReactNode
  badge?: string
}

/** La insígnia del Front: el contingut i, si n'hi ha, el resum de l'interior («Obert · 3 · Barra»). */
const withInterior = (label: string, interior?: FrontInterior) => (interior?.badge ? `${label} · ${interior.badge}` : label)

/** Una zona tapada pel front d'una zona de més amunt. */
interface CoveredBy {
  /** El nom de la zona que la tapa. */
  by: string
  /** La tapa un front fix: darrere no es fa res. */
  fixed: boolean
  /** Els costats amb frontisses de la porta que la tapa. */
  hinges: readonly ("left" | "right")[]
  /** «Marge a les frontisses»: la zona oberta estreta al costat. */
  onMargin: (side: "left" | "right") => void
}

/** Què es fa del contingut d'una zona tapada (regla 3: tapa, no esborra; regla 6: el que no es fa diu per què). */
function coveredHelp(c: CoveredBy, k: Front["kind"] | "none" | "appliance"): string {
  if (c.fixed) return `La tapa el front fix de «${c.by}»: darrere no es fa res (es conserva).`
  if (k === "drawers" || k === "none") return `Darrere de «${c.by}».`
  return `No es fa: el tapa «${c.by}» (es conserva i torna si treus el front de dalt).`
}

/**
 * Tipus de front d'un compartiment (botons d'icona) i els seus camps. Per decisió de l'usuari, 2026-10-20, l'**Electrodomèstic**
 * és un contingut més (`appliance`): el tria i les seves opcions surten a sota (`ApplianceFields`); la placa i la campana
 * (no ocupen el nínxol) porten a més el front del compartiment, a sota de l'aparell.
 */
export function ZoneFrontSection({ root, zone, onChange, openRatio, drawerHeights, hardware, noHandles = false, kits, bounds, afterHinge, interior, appliance = false, moduleFronts, covered }: { root: Zone; zone: Zone; onChange: (root: Zone) => void; openRatio?: number; drawerHeights?: number[]; hardware: ModuleHardware; noHandles?: boolean; kits?: KitOrder[]; /** Què aguanta el compartiment: els fronts que no s'hi poden fixar no surten (el triat, sí). */ bounds: ZoneBounds; /** Després de la «Frontissa» (la filera System 32 del mòdul). */ afterHinge?: ReactNode; /** Les opcions de l'interior, a sota del contingut (no n'hi ha amb calaixos ni un front fix). */ interior?: FrontInterior; /** Hi pot anar un electrodomèstic (el d'un mòdul sense dividir es tria a Mòdul › Tipus). */ appliance?: boolean; /** «Fronts del mòdul» (estil i folgances de tots els fronts), a sota de les opcions del front si n'hi ha. */ moduleFronts?: ReactNode; /** Tapat pel front d'una zona de més amunt (regla 3 del model únic): el Contingut es tria igual i es fa per dins. */ covered?: CoveredBy }) {
  const all = Object.keys(FRONT_LABELS) as (Front["kind"] | "none")[]
  const current = zone.front?.kind ?? "none"
  const options = all.filter((k) => k === current || canHoldFront(bounds, k))
  // Els fronts només es fan amb el compartiment aguantat pels quatre costats (`frontHeld`): els altres no surten, el triat
  // sí (es conserva) i l'ajuda diu per què no es fa.
  const limits = frontLimitsHelp(bounds, all, current)
  // «Electrodomèstic» triat sense cap aparell encara: el selector de l'aparell (només per a aquest compartiment).
  const [pickingFor, setPickingFor] = useState<string | null>(null)
  const za = zone.appliance
  const app = za && isAppliance(za.hardware) ? za.hardware.appliance : undefined
  const applianceMode = appliance && (!!za || pickingFor === zone.id)
  /** Una porta nova va amb les frontisses a un costat on hi ha on posar-les. */
  const choose = (k: Front["kind"] | "none", base: Zone = root) => {
    const next = switchFront(base, zone.id, k)
    const f = findZone(next, zone.id)?.front
    if (f?.kind === "door" && f.mode === "single" && !bounds[f.hinge] && bounds[f.hinge === "left" ? "right" : "left"]) onChange(setFront(next, zone.id, { ...f, hinge: f.hinge === "left" ? "right" : "left" }))
    else onChange(next)
  }
  /** Un altre contingut treu l'electrodomèstic (el front que hi havia es conserva a `fronts`). */
  const chooseContent = (k: Front["kind"] | "none" | "appliance") => {
    if (k === "appliance") return setPickingFor(zone.id)
    setPickingFor(null)
    choose(k, za ? updateZone(root, zone.id, ({ appliance: _a, ...rest }) => rest) : root)
  }
  const frontFields = (
    <>
      {zone.front && <FrontFields front={zone.front} openRatio={openRatio} drawerHeights={drawerHeights} hardware={hardware} noHandles={noHandles} kits={kits} bounds={bounds} afterHinge={afterHinge} onChange={(f) => onChange(setFront(root, zone.id, f))} />}
      {zone.front && !covered && moduleFronts}
      {/* Drecera (regla 4): una zona oberta estreta al costat de la frontissa, perquè el braç no topi amb els calaixos. */}
      {covered && !covered.fixed && zone.front?.kind === "drawers" && covered.hinges.length > 0 && (
        <FormRow optionId="zone.front.drawers.margin" label="Marge a les frontisses" help="Divideix la zona amb una zona oberta de 50 mm al costat de la frontissa: el braç i la placa no topen amb els calaixos. Després és una zona com les altres.">
          <HStack gap={2} wrap="wrap" pt="2px">
            {covered.hinges.map((side) => (
              <Button key={side} size="xs" variant="outline" onClick={() => covered.onMargin(side)}>
                <LuPlus /> {side === "left" ? "A l'esquerra" : "A la dreta"}
              </Button>
            ))}
          </HStack>
        </FormRow>
      )}
      {/* Les opcions de l'interior, a sota del contingut i de les seves opcions: canvien amb el contingut triat. */}
      {interior?.node}
    </>
  )
  // La placa i la campana no ocupen el compartiment: a sota de l'aparell, el seu front (els calaixos, la porta...).
  const withFront = !!app && !fillsNiche(app)
  const badge = applianceMode
    ? [app ? APPLIANCE_LABELS[app.kind] : "Electrodomèstic", ...(withFront ? [withInterior(FRONT_LABELS[current], interior)] : [])].join(" · ")
    : withInterior(FRONT_LABELS[current], interior)
  return (
          <FoldItem optionId="zone.front" id="zone-front" title="Front" badge={badge} icon={applianceMode ? LuRefrigerator : FRONT_ICONS[current]}>
            {/* Tipus de front: un botó amb la icona de cada tipus (el nom, al tooltip, a sota i a la insígnia). */}
            <FormRow optionId="zone.front.kind" label="Contingut" help={covered ? coveredHelp(covered, applianceMode ? "appliance" : current) : applianceMode ? undefined : limits}>
              <IconChoice<Front["kind"] | "none" | "appliance">
                hideLabel
                label="Contingut"
                value={applianceMode ? "appliance" : current}
                options={[...options.map((k) => ({ value: k, label: FRONT_LABELS[k], icon: FRONT_ICONS[k] })), ...(appliance ? [{ value: "appliance" as const, label: "Electrodomèstic", icon: LuRefrigerator }] : [])]}
                onChange={chooseContent}
              />
            </FormRow>
            {applianceMode ? (
              <>
                <ApplianceFields root={root} zone={zone} onChange={onChange} hardware={hardware} noHandles={noHandles} bounds={bounds} picker />
                {withFront && (
                  <>
                    <FormRow optionId="zone.front.kind" label={app.kind === "hob" ? "A sota" : "Front"} help={limits}>
                      <IconChoice hideLabel label="Front" value={current} options={options.map((k) => ({ value: k, label: FRONT_LABELS[k], icon: FRONT_ICONS[k] }))} onChange={(k) => choose(k)} />
                    </FormRow>
                    {frontFields}
                  </>
                )}
              </>
            ) : frontFields}
          </FoldItem>
  )
}
