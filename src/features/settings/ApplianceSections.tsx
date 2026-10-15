import { Text } from "@chakra-ui/react"
import { LuBookOpen } from "react-icons/lu"
import { FoldItem } from "../../components/Fold"
import { FormRow } from "../../components/FormRow"
import { APPLIANCE_LABELS, DOOR_LABELS, furnitureHinges, rangeText, type Appliance, type FrontRange, type HardwareItem } from "../../core/model"

/** «1041–1065 mm + S» (una alçada de front que depèn del moble). */
const frontText = (r: FrontRange) => `${rangeText(r)}${r.plusBase ? " + A" : ""}${r.plusTop ? " + S" : ""}`

/** Com es munta el front, en una frase (el que fa l'app al moble). */
function mountText(a: Appliance): string {
  if (!a.door) return "Sense front de moble: l'aparell queda a la vista. Al moble només es comprova el nínxol (i el retall, si el catàleg el dona)."
  if (a.door === "hinges") return "El front de moble penja de les frontisses de l'aparell: les cassoletes de la fitxa del fabricant al darrere del front."
  if (furnitureHinges(a)) return "El front de moble penja de frontisses de moble (les del mòdul) i s'uneix a la porta de l'aparell amb una guia lliscant, cargolada amb la plantilla de l'aparell (prebroques de l'app: opcionals, «Prebroques» = 1)."
  return `${DOOR_LABELS[a.door][0]!.toUpperCase()}${DOOR_LABELS[a.door].slice(1)}: el front de moble es cargola a la porta de l'aparell amb la plantilla que porta l'aparell, sense frontisses de moble (prebroques de l'app: opcionals, «Prebroques» = 1).`
}

/**
 * Seccions de l'editor d'un **electrodomèstic** (Preferències › Ferratges › Electrodomèstics, v46): les dades del
 * catàleg del fabricant, **només lectura** (les dades són a `core/model/appliances/applianceRows.ts`, generades de
 * `docs/electrodomestic/appliances.json`; la foto i el material del cos, a «Aspecte»: `ApplianceLook`). El que l'app mecanitza al front són els paràmetres de «Mides».
 */
export function ApplianceSections({ item, appliance: a }: { item: HardwareItem; appliance: Appliance }) {
  const f = a.front
  return (
    <FoldItem id="appliance-catalog" icon={LuBookOpen} title="Del catàleg" badge={`${item.maker ?? ""} ${item.ref ?? ""}`.trim() || undefined} defaultOpen>
      <FormRow label="Tipus">
        <Text fontSize="sm" pt="6px">
          {APPLIANCE_LABELS[a.kind]} ({a.family}) · aparell {a.size.w} × {a.size.h} × {a.size.d} mm
        </Text>
      </FormRow>
      <FormRow label="Front de moble" help="Es tria a cada compartiment (Electrodomèstic › Front de moble); el material, per defecte el dels fronts del mòdul, també («Material del front»).">
        <Text fontSize="sm" pt="6px">
          {mountText(a)}
        </Text>
      </FormRow>
      {a.niche && (
        <FormRow label="Nínxol" help="La llum del compartiment (ample × alt × fons). Si no hi cap, el moble avisa.">
          <Text fontSize="sm" pt="6px">
            {rangeText(a.niche.w, "")} × {rangeText(a.niche.h, "")} × {rangeText(a.niche.d)}
            {a.tallNicheH ? ` · en columna, ${rangeText(a.tallNicheH)} d'alt` : ""}
            {a.wallNiche ? ` · penjat, ${rangeText(a.wallNiche.h)} d'alt i ${rangeText(a.wallNiche.d)} de fons` : ""}
          </Text>
        </FormRow>
      )}
      {a.cabinet && (
        <FormRow label="Moble">
          <Text fontSize="sm" pt="6px">
            {rangeText(a.cabinet.w)} d'ample · fons {rangeText(a.cabinet.d)} · alçada interior {rangeText(a.cabinet.h)}
          </Text>
        </FormRow>
      )}
      {f && (f.h || f.lower || f.weightKg || f.thickness) && (
        <FormRow label="Front" help="A = gruix de la base on seu l'aparell; S = gruix de la peça de sobre (el catàleg BSH).">
          <Text fontSize="sm" pt="6px">
            {[f.h ? `alçada ${frontText(f.h)}` : "", f.lower && f.upper ? `de baix ${frontText(f.lower)}, de dalt ${frontText(f.upper)}, junta ${f.joint ?? 0} mm` : "", f.weightKg ? `pes ${rangeText(f.weightKg, "kg")}` : "", f.thickness ? `gruix ${rangeText(f.thickness)}` : ""].filter(Boolean).join(" · ")}
          </Text>
        </FormRow>
      )}
      {a.plinth && (
        <FormRow label="Sòcol">
          <Text fontSize="sm" pt="6px">
            {rangeText(a.plinth)}
          </Text>
        </FormRow>
      )}
      {a.ventilation && (
        <FormRow label="Ventilació">
          <Text fontSize="sm" pt="6px">
            {[a.ventilation.inletCm2 ? `entrada ≥ ${a.ventilation.inletCm2} cm² pel sòcol` : "", a.ventilation.outletCm2 ? `sortida ≥ ${a.ventilation.outletCm2} cm² per dalt al darrere (retall a la peça de sobre)` : ""].filter(Boolean).join(" · ")}
          </Text>
        </FormRow>
      )}
      {a.cutout && (
        <FormRow label="Retall">
          <Text fontSize="sm" pt="6px">
            {rangeText(a.cutout.w, "")} × {rangeText(a.cutout.d)} {a.cutout.at === "top" ? "al taulell" : "a la base del moble"}
            {a.cutout.fromFront !== undefined ? `, a ${a.cutout.fromFront} mm o més del cantell de davant` : ""}
            {a.cutout.board ? ` · tauler ${rangeText(a.cutout.board)}` : ""}
          </Text>
        </FormRow>
      )}
      {a.notes?.map((n, i) => (
        <FormRow key={i} label={i === 0 ? "Notes" : ""}>
          <Text fontSize="sm" pt="6px" color="fg.muted">
            {n}
          </Text>
        </FormRow>
      ))}
      <FormRow label="Font">
        <Text fontSize="sm" pt="6px">
          Catàleg {a.source.doc}, p. {a.source.page}
        </Text>
      </FormRow>
    </FoldItem>
  )
}
