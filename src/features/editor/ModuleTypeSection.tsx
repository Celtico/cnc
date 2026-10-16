import { Text } from "@chakra-ui/react"
import { LuBox, LuMove, LuRefrigerator } from "react-icons/lu"
import type { IconType } from "react-icons"
import { FoldItem } from "../../components/Fold"
import { FormRow } from "../../components/FormRow"
import { IconChoice } from "../../components/IconChoice"
import { APPLIANCE_LABELS, isAppliance, moduleType, mountOf, setModuleAppliance, setModuleKind, type Composition, type Module } from "../../core/model"
import { HardwarePick } from "../composition/HardwarePick"
import { ModulePositionFields } from "./InspectorSections"

type Kind = "moble" | "appliance"
const KIND_ICON: Record<Kind, IconType> = { moble: LuBox, appliance: LuRefrigerator }
const KIND_LABEL: Record<Kind, string> = { moble: "Moble", appliance: "Electrodomèstic" }
const KIND_HINT: Record<Kind, string> = {
  moble: "Moble: un mòdul de fusta (baix, columna o penjat; on va, a Posició)",
  appliance: "Electrodomèstic: rentaplats, frigorífic, forn, placa, campana…; la Caixa és la que demana l'aparell",
}

/**
 * **Tipus** (per decisió de l'usuari, 2026-10-16: «tornar a deixar com abans Posició, i posar com a primera opció Tipus, on
 * només es pot triar si és moble o electrodomèstic»): el primer del mòdul. Moble · Electrodomèstic (`setModuleKind`);
 * l'Electrodomèstic hi tria l'aparell (`setModuleAppliance`) i la Caixa en porta les opcions. On va, a la secció Posició.
 */
export function ModuleTypeSection({ module, moduleX, updateModule }: { module: Module; moduleX: number | undefined; updateModule: (m: Module) => void }) {
  const kind: Kind = moduleType(module) === "appliance" ? "appliance" : "moble"
  const here = Math.round(moduleX ?? 0)
  const za = module.root.appliance
  const a = za && isAppliance(za.hardware) ? za.hardware.appliance : undefined
  const split = !!module.root.split
  const badge = kind === "appliance" && a ? APPLIANCE_LABELS[a.kind] : KIND_LABEL[kind]
  return (
    <FoldItem optionId="module.type" id="mod-type" title="Tipus" icon={KIND_ICON[kind]} badge={badge}>
      <FormRow optionId="module.type.kind" label="Tipus" help={split && kind !== "appliance" ? "Electrodomèstic: un mòdul dividit el porta a cada compartiment (una columna amb el forn i el microones)." : undefined}>
        <IconChoice
          hideLabel
          label="Tipus"
          value={kind}
          options={(Object.keys(KIND_ICON) as Kind[]).map((k) => ({ value: k, label: KIND_LABEL[k], icon: KIND_ICON[k], hint: KIND_HINT[k], disabled: k === "appliance" && split }))}
          onChange={(k) => updateModule(setModuleKind(module, k, here))}
        />
      </FormRow>
      {kind === "appliance" && (
        <HardwarePick
          optionId="module.type.appliance"
          engine="appliance"
          label="Aparell"
          current={za?.hardware}
          emptyLabel="Tria l'aparell"
          help={a ? "La Caixa és la que demana l'aparell; les opcions del front de moble, a la Caixa." : "Rentaplats, rentadora, frigorífic, forn, microones, placa o campana de Preferències › Ferratges › Electrodomèstics: el mòdul en fa el nínxol (es comprova amb les mides del fabricant); la placa va sobre un baix i la campana en un penjat, amb el seu contingut."}
          onPick={(item) => updateModule(setModuleAppliance(module, item, here))}
        />
      )}
    </FoldItem>
  )
}

/** **Posició** (com abans del 2026-10-15): la fila (arrambat, penjat o lliure al terra) i on va. */
export function ModulePositionSection({ comp, module, moduleX, updateModule, islandFront }: { comp: Composition; module: Module; moduleX: number | undefined; updateModule: (m: Module) => void; /** El mòdul és el de darrere d'una illa: el nom del de davant. */ islandFront?: string }) {
  const badge = islandFront ? "Illa · darrere" : module.carcass.base.kind === "wall" ? `Penjat a ${module.carcass.base.height}` : mountOf(module) === "floor" ? `Lliure al terra · ${module.wallGap ?? 0} de la paret` : "Arrambat a la paret"
  return (
    <FoldItem optionId="module.position" id="mod-position" title="Posició" icon={LuMove} badge={badge}>
      {islandFront ? (
        <Text fontSize="sm" color="fg.muted">
          És el mòdul de darrere de l'illa amb «{islandFront}»: es gira 180° i es col·loca sol, enganxat al seu darrere.
        </Text>
      ) : (
        <ModulePositionFields comp={comp} module={module} moduleX={moduleX} updateModule={updateModule} />
      )}
    </FoldItem>
  )
}
