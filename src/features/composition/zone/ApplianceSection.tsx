import { Stack, Switch, Text } from "@chakra-ui/react"
import { LuPanelLeft, LuPanelRight, LuRefrigerator } from "react-icons/lu"
import { FoldItem } from "../../../components/Fold"
import {
  APPLIANCE_LABELS,
  DEFAULT_APPLIANCE_PLINTH,
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

/** Com es munta el front, per a l'ajuda de «Front de moble». */
function mountHelp(a: Appliance): string {
  if (a.door === "hinges") return "Penja de les frontisses de l'aparell: es fan les cassoletes del catàleg al darrere del front."
  if (furnitureHinges(a)) return "Penja de frontisses de moble (les del mòdul, amb les plaques al lateral) i s'uneix a la porta de l'aparell amb una guia lliscant (la posició de la guia és una hipòtesi: comprova-la amb la plantilla)."
  return `Es cargola a la porta de l'aparell${a.door === "sliding" ? " (porta lliscant)" : ""}, sense frontisses de moble. La plantilla dels cargols ve amb l'aparell: les prebroques del darrere del front són una hipòtesi (comprova-les abans de mecanitzar).`
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
 * **Electrodomèstic** del compartiment (v46; per petició de l'usuari: «un moble sense res ha de poder portar una porta,
 * això és per ficar el rentaplats o la nevera»): un aparell de Preferències › Ferratges › Electrodomèstics (`HardwarePick`,
 * una còpia). És a dalt de tot del compartiment: si l'aparell ocupa el nínxol, el Front, els Prestatges i el Dividir del
 * compartiment no surten (opcions en cascada). A sota, en cascada: el front de moble (si en porta), el costat on obre,
 * el sòcol (aparells de terra sense peça a sota) i el tirador.
 */
export function ApplianceSection({ root, zone, onChange, hardware, noHandles, bounds }: { root: Zone; zone: Zone; onChange: (root: Zone) => void; hardware: ModuleHardware; noHandles: boolean; bounds: ZoneBounds }) {
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
  const setHandle = (h: FrontHandle | undefined) => {
    if (!za) return
    const { handle: _h, ...rest } = za
    set(h ? { ...rest, handle: h } : rest)
  }
  return (
    <FoldItem id="zone-appliance" title="Electrodomèstic" icon={LuRefrigerator} badge={a ? APPLIANCE_LABELS[a.kind] : undefined} defaultOpen={!!za}>
      <Stack gap={3}>
        <HardwarePick
          engine="appliance"
          label="Aparell"
          current={za?.hardware}
          emptyLabel="Cap"
          help={a ? dataHelp(a) : "Rentaplats, frigorífic, rentadora, forn, microones, placa o campana del catàleg: el compartiment en fa el nínxol (es comprova amb les mides del fabricant) i, si en porta, el front de moble."}
          onPick={(item) => set(item ? { ...(za ?? {}), hardware: item } : undefined)}
        />
        {a && !fillsNiche(a) && (
          <Text fontSize="xs" color="fg.muted">
            {a.kind === "hob" ? "La placa va al taulell (el retall, a la peça de sobre): el compartiment conserva el seu contingut (els calaixos de sota)." : "La campana va al moble penjat (el retall, a la base): el compartiment conserva el seu contingut (la porta del moble)."}
          </Text>
        )}
        {a && takesFront(a) && (
          <FormRow label="Front" help={front ? mountHelp(a) : `Sense front de moble: l'aparell queda a la vista (${a.door ? DOOR_LABELS[a.door] : ""}).`}>
            <Switch.Root size="sm" pt="6px" checked={front} onCheckedChange={(e) => set({ ...za!, front: e.checked ? undefined : false })}>
              <Switch.HiddenInput />
              <Switch.Control />
              <Switch.Label fontSize="sm">Front de moble</Switch.Label>
            </Switch.Root>
          </FormRow>
        )}
        {a && front && doorLikeFront(a) && (
          <FormRow label="Obre" help={furnitureHinges(a) ? "Les frontisses de moble van al lateral o al divisor d'aquest costat." : a.door === "hinges" ? "Les frontisses de l'aparell s'hi posen a l'esquerra o a la dreta." : "El costat de les frontisses de l'aparell (el tirador, a l'altre)."}>
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
            label="Sòcol"
            value={za!.plinth ?? DEFAULT_APPLIANCE_PLINTH}
            min={0}
            max={400}
            step={1}
            help={`Del terra al cantell de baix del front${a.plinth ? ` (el fabricant: ${rangeText(a.plinth)})` : ""}. El sòcol de davant no el fa aquest mòdul: és el dels mòduls del costat.`}
            onChange={(plinth) => Number.isFinite(plinth) && set({ ...za!, plinth })}
          />
        )}
        {a && front && (
          <HardwarePick
            slot="handle"
            label="Tirador"
            current={za!.handle && za!.handle !== "none" ? za!.handle : push ? undefined : moduleSlotItem(hardware, "handle")}
            inherited={noHandles ? undefined : moduleSlotItem(hardware, "handle")}
            emptyLabel={noHandles ? "Com el mòdul (cap, push)" : undefined}
            none={{ label: "Cap (push)", help: inheritedNone ? "El mòdul és push: cap forat; tria'n un aquí si aquest front n'ha de portar." : "Sense tirador: cap forat.", selected: push && !inheritedNone, onPick: () => setHandle("none") }}
            onPick={(h) => setHandle(h)}
          />
        )}
      </Stack>
    </FoldItem>
  )
}
