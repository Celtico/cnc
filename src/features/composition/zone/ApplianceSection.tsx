import { Stack, Switch, Text } from "@chakra-ui/react"
import { LuPanelLeft, LuPanelRight } from "react-icons/lu"
import {
  DEFAULT_APPLIANCE_PLINTH,
  boardChoices,
  DOOR_LABELS,
  doorLikeFront,
  fillsNiche,
  furnitureHinges,
  isAppliance,
  moduleSlotItem,
  rangeText,
  standsOnFloor,
  takesFront,
  updateZone,
  type Appliance,
  type FrontHandle,
  type ModuleHardware,
  type Zone,
  type ZoneAppliance,
  type ZoneBounds,
} from "../../../core/model"
import { NumRow } from "../../../components/NumRow"
import { ChoiceChips, FormRow } from "../../../components/FormRow"
import { HardwarePick } from "../HardwarePick"
import { MaterialSelect } from "../../settings/MaterialSelect"
import { useSettings } from "../../settings/SettingsContext"

/** Com es munta el front, per a l'ajuda de «Front de moble». */
function mountHelp(a: Appliance): string {
  if (a.door === "hinges") return "Penja de les frontisses de l'aparell: es fan les cassoletes de la fitxa del fabricant al darrere del front."
  if (furnitureHinges(a)) return "Penja de frontisses de moble (les del mòdul, tantes com demana l'alçada, amb les plaques al lateral) i s'uneix a la porta de l'aparell amb la guia lliscant, que es cargola amb la plantilla de l'aparell."
  return `Es cargola a la porta de l'aparell${a.door === "sliding" ? " (porta lliscant)" : ""} amb la plantilla que porta l'aparell, sense frontisses de moble.`
}

/** Les dades del catàleg que compten, en una línia per a l'ajuda. */
function dataHelp(a: Appliance): string {
  const parts = [
    a.niche ? `Nínxol ${rangeText(a.niche.w, "")} × ${rangeText(a.niche.h, "")} × ${rangeText(a.niche.d)}` : a.kind === "hob" || a.kind === "hood" ? "" : "Nínxol no publicat",
    a.tallNicheH ? `en columna, ${rangeText(a.tallNicheH)} d'alt` : "",
    a.front?.h ? `front ${rangeText(a.front.h)}${a.front.h.plusBase || a.front.h.plusTop ? " (+ base / part de dalt)" : ""}` : "",
    a.front?.lower && a.front.upper ? `fronts ${rangeText(a.front.lower)} + A i ${rangeText(a.front.upper)} + S` : "",
    a.front?.weightKg ? `pes del front ${rangeText(a.front.weightKg, "kg")}` : "",
    a.plinth ? `sòcol ${rangeText(a.plinth)}` : "",
    a.ventilation?.inletCm2 ? `entrada d'aire ≥ ${a.ventilation.inletCm2} cm²` : "",
    a.ventilation?.outletCm2 ? `sortida ≥ ${a.ventilation.outletCm2} cm²` : "",
    a.cutout ? `retall ${rangeText(a.cutout.w, "")} × ${rangeText(a.cutout.d)} ${a.cutout.at === "top" ? "al taulell" : "a la base"}` : "",
  ].filter(Boolean)
  return `${parts.join(" · ")}. Font: ${a.source.doc}, p. ${a.source.page}.`
}

/**
 * **Electrodomèstic** (v46; per petició de l'usuari: «un moble sense res ha de poder portar una porta, això és per ficar
 * el rentaplats o la nevera»): un aparell de Preferències › Ferratges › Electrodomèstics (`HardwarePick`, una còpia) a
 * `zone.appliance`. **Un sol lloc per decisió** (per decisió de l'usuari, 2026-10-15): d'un mòdul sense dividir, a
 * Mòdul › Electrodomèstic (`module`, sobre l'arrel: el mòdul és l'aparell i l'arbre no ensenya l'«Interior»); d'un mòdul
 * dividit, al compartiment, com un contingut més del Front (per decisió de l'usuari, 2026-10-20). Si l'aparell ocupa el nínxol, el Front, els Prestatges i el Dividir del
 * compartiment no surten (opcions en cascada). A sota, en cascada: el front de moble (si en porta) i, amb el front, el
 * seu material (v47, «Com els fronts» = el dels fronts del mòdul), el costat on obre, el sòcol (aparells de terra sense
 * peça a sota) i el tirador.
 */
interface ApplianceProps {
  root: Zone
  zone: Zone
  onChange: (root: Zone) => void
  hardware: ModuleHardware
  noHandles: boolean
  bounds: ZoneBounds
  /** A l'inspector del mòdul (l'arrel d'un mòdul sense dividir): els textos parlen del mòdul. */
  module?: boolean
}

/**
 * Les opcions de l'electrodomèstic: l'aparell (`picker`) i, en cascada, el front de moble, el material, on obre, el sòcol i
 * el tirador. Sense `picker`, només les opcions: el mòdul Electrodomèstic tria l'aparell a Tipus i les opcions surten a la
 * Caixa (per decisió de l'usuari, 2026-10-15).
 */
export function ApplianceFields({ root, zone, onChange, hardware, noHandles, bounds, module = false, picker = false, supportHeight }: ApplianceProps & { picker?: boolean; /** L'alçada de les potes del moble (sòcol o potes vistes): el sòcol per defecte de l'aparell de terra. */ supportHeight?: number }) {
  const { settings } = useSettings()
  const za = zone.appliance
  const a = za && isAppliance(za.hardware) ? za.hardware.appliance : undefined
  const set = (next: ZoneAppliance | undefined) =>
    onChange(updateZone(root, zone.id, (z) => {
      const { appliance: _old, ...rest } = z
      return next ? { ...rest, appliance: next } : rest
    }))
  const front = !!a && takesFront(a) && za!.front !== false
  const push = za?.handle === "none" || (!za?.handle && noHandles)
  const inheritedNone = !za?.handle && noHandles
  // On és el contingut que conserven la placa i la campana: el del compartiment o, al mòdul, el de l'«Interior».
  const keeps = module ? "l'Interior conserva el seu contingut" : "el compartiment conserva el seu contingut"
  const setHandle = (h: FrontHandle | undefined) => {
    if (!za) return
    const { handle: _h, ...rest } = za
    set(h ? { ...rest, handle: h } : rest)
  }
  return (
      <Stack gap={3}>
        {picker && <HardwarePick
          optionId="zone.appliance.hardware"
          engine="appliance"
          label="Aparell"
          current={za?.hardware}
          emptyLabel="Cap"
          help={a ? dataHelp(a) : "Rentaplats, frigorífic, rentadora, forn, microones, placa o campana del catàleg: el compartiment en fa el nínxol (es comprova amb les mides del fabricant) i, si en porta, el front de moble."}
          onPick={(item) => set(item ? { ...(za ?? {}), hardware: item } : undefined)}
        />}
        {a && !fillsNiche(a) && (
          <Text fontSize="xs" color="fg.muted">
            {a.kind === "hob" ? `La placa va al taulell (el retall, a la peça de sobre): ${keeps} (els calaixos de sota).` : `La campana va al moble penjat (el retall, a la base): ${keeps} (la porta del moble).`}
          </Text>
        )}
        {a && takesFront(a) && (
          <FormRow optionId={module ? "module.appliance.front" : "zone.appliance.front"} label="Front" help={front ? mountHelp(a) : `Sense front de moble: l'aparell queda a la vista (${a.door ? DOOR_LABELS[a.door] : ""}).`}>
            <Switch.Root size="sm" pt="6px" checked={front} onCheckedChange={(e) => set({ ...za!, front: e.checked ? undefined : false })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Front de moble</Switch.Label>
            </Switch.Root>
          </FormRow>
        )}
        {a && front && (
          <FormRow optionId={module ? "module.appliance.panelMaterial" : "zone.appliance.panelMaterial"} label="Material del front" help="El tauler del front de moble (el panell que tapa l'aparell): es talla, es canteja i va al nesting com qualsevol front, amb el gruix de tots els fronts. Sense triar-ne cap, el dels fronts del mòdul (Mòdul › Materials)." maxW="280px">
            <MaterialSelect label="Material del front" hideLabel materials={boardChoices(settings.materials)} value={za!.panelMaterial ?? ""} emptyLabel="Com els fronts" onChange={(v) => {
              const { panelMaterial: _p, ...rest } = za!
              set(v ? { ...rest, panelMaterial: v } : rest)
            }} />
          </FormRow>
        )}
        {a && front && doorLikeFront(a) && (
          <FormRow optionId={module ? "module.appliance.hingeSide" : "zone.appliance.hingeSide"} label="Obre" help={furnitureHinges(a) ? "Les frontisses de moble van al lateral o al divisor d'aquest costat." : a.door === "hinges" ? "Les frontisses de l'aparell s'hi posen a l'esquerra o a la dreta." : "El costat de les frontisses de l'aparell (el tirador, a l'altre)."}>
            <ChoiceChips
              label="Obre"
              value={za!.hinge ?? "left"}
              options={[
                { id: "left" as const, label: <><LuPanelLeft /> Esquerra</> },
                { id: "right" as const, label: <><LuPanelRight /> Dreta</> },
              ]}
              onChange={(hinge) => set({ ...za!, hinge })}
            />
          </FormRow>
        )}
        {a && front && standsOnFloor(a) && !bounds.bottom && (
          <NumRow
            optionId={module ? "module.appliance.plinth" : "zone.appliance.plinth"}
            label="Sòcol"
            value={za!.plinth ?? supportHeight ?? DEFAULT_APPLIANCE_PLINTH}
            min={0}
            max={400}
            step={1}
            help={`Del terra al cantell de baix del front${a.plinth ? ` (el fabricant: ${rangeText(a.plinth)})` : ""}.${supportHeight !== undefined ? ` Per defecte, l'alçada de les potes del moble (${supportHeight} mm): el front comença on comencen els del costat i el sòcol del tram passa per davant.` : ""}`}
            onChange={(plinth) => Number.isFinite(plinth) && set({ ...za!, plinth })}
          />
        )}
        {a && front && (
          <HardwarePick
            optionId={module ? "module.appliance.handle" : "zone.appliance.handle"}
            slot="handle"
            label="Tirador"
            // El front de moble és de fusta: cap tirador de marc d'alumini de vitrina (no farien cap forat).
            glass={false}
            current={za!.handle && za!.handle !== "none" ? za!.handle : push ? undefined : moduleSlotItem(hardware, "handle")}
            inherited={noHandles ? undefined : moduleSlotItem(hardware, "handle")}
            emptyLabel={noHandles ? "Com el mòdul (cap, push)" : undefined}
            none={{ label: "Cap (push)", help: inheritedNone ? "El mòdul és push: cap forat; tria'n un aquí si aquest front n'ha de portar." : "Sense tirador: cap forat.", selected: push && !inheritedNone, onPick: () => setHandle("none") }}
            onPick={(h) => setHandle(h)}
          />
        )}
      </Stack>
  )
}
