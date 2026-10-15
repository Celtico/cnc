import { Text } from "@chakra-ui/react"
import type { ReactNode } from "react"
import { FoldItem } from "../../../components/Fold"
import { UI_PATHS, canHoldFront, findZone, frontLimitsHelp, setFront, switchFront, type Front, type ModuleHardware, type Zone, type ZoneBounds } from "../../../core/model"
import type { KitOrder } from "../../../core/build/buildModule"
import { FormRow } from "../../../components/FormRow"
import { FRONT_ICONS } from "../zoneIcons"
import { IconChoice } from "../../../components/IconChoice"
import { FrontFields } from "./FrontFields"

const FRONT_LABELS: Record<Front["kind"] | "none", string> = {
  none: "Obert",
  door: "Porta",
  drawers: "Calaixos",
  flap: "Abatible",
  grille: "Reixeta",
  panel: "Front fix",
}

/** El Front d'un compartiment tapat pel front d'una zona de més amunt: no es fa (opcions en cascada: el de dalt mana). */
export function CoveredFront({ id, title, coveredBy }: { id: string; title: string; coveredBy: string }) {
  return (
    <FoldItem id={id} title={title} badge="Tapat" icon={FRONT_ICONS.none}>
      <Text fontSize="sm" color="fg.muted">
        El tapen les portes de «{coveredBy}» ({UI_PATHS.doors}): aquest compartiment no en porta (el que hi havia es conserva i torna si treus les portes).
      </Text>
    </FoldItem>
  )
}

/** Tipus de front d'un compartiment (botons d'icona) i els seus camps. */
export function ZoneFrontSection({ root, zone, onChange, openRatio, drawerHeights, hardware, noHandles = false, kits, bounds, afterHinge }: { root: Zone; zone: Zone; onChange: (root: Zone) => void; openRatio?: number; drawerHeights?: number[]; hardware: ModuleHardware; noHandles?: boolean; kits?: KitOrder[]; /** Què aguanta el compartiment: els fronts que no s'hi poden fixar no surten (el triat, sí). */ bounds: ZoneBounds; /** Després de la «Frontissa» (la filera System 32 del mòdul). */ afterHinge?: ReactNode }) {
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
