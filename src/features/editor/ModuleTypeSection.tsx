import { Text } from "@chakra-ui/react"
import { LuPanelBottom, LuPanelTop, LuRectangleVertical, LuRefrigerator } from "react-icons/lu"
import type { IconType } from "react-icons"
import { FoldItem } from "../../components/Fold"
import { FormRow } from "../../components/FormRow"
import { IconChoice } from "../../components/IconChoice"
import { APPLIANCE_LABELS, MODULE_TYPE_LABELS, isAppliance, moduleType, setModuleAppliance, setModuleType, type Composition, type Module, type ModuleType } from "../../core/model"
import { HardwarePick } from "../composition/HardwarePick"
import { ModulePositionFields } from "./InspectorSections"

const TYPE_ICON: Record<ModuleType, IconType> = { base: LuPanelBottom, wall: LuPanelTop, tall: LuRectangleVertical, appliance: LuRefrigerator }
const TYPE_HINT: Record<ModuleType, string> = {
  base: "Baix: a terra, sobre el suport del moble (sòcol, potes o directe a terra)",
  wall: "Penjat a la paret, amb penjadors",
  tall: "Columna: a terra, de dalt a baix",
  appliance: "Electrodomèstic: rentaplats, frigorífic, forn, placa, campana…; la Caixa és la que demana l'aparell",
}

/**
 * **Tipus** (per decisió de l'usuari, 2026-10-15: «canviem Posició per tipus de moble, i allà seleccionem electrodomèstic,
 * i a dins la Caixa les opcions de l'electrodomèstic»): el primer del mòdul. Baix · Penjat · Columna · Electrodomèstic
 * (`setModuleType`); l'Electrodomèstic hi tria l'aparell (`setModuleAppliance`; el Baix i el Penjat no en porten) i la Caixa en
 * porta les opcions. A sota, on va: arrambat o lliure al terra, l'alçada del penjat i les separacions. El de darrere d'una
 * illa es col·loca sol: només el diu.
 */
export function ModuleTypeSection({ comp, module, moduleX, updateModule, islandFront }: { comp: Composition; module: Module; moduleX: number | undefined; updateModule: (m: Module) => void; /** El mòdul és el de darrere d'una illa: el nom del de davant. */ islandFront?: string }) {
  const type = moduleType(module)
  const here = Math.round(moduleX ?? 0)
  const za = module.root.appliance
  const a = za && isAppliance(za.hardware) ? za.hardware.appliance : undefined
  const split = !!module.root.split
  const badge = type === "appliance" && a ? APPLIANCE_LABELS[a.kind] : type === "wall" && module.carcass.base.kind === "wall" ? `Penjat a ${module.carcass.base.height}` : MODULE_TYPE_LABELS[type]
  return (
    <FoldItem optionId="module.type" id="mod-type" title="Tipus" icon={TYPE_ICON[type]} badge={badge}>
      <FormRow optionId="module.type.kind" label="Tipus" help={split && type !== "appliance" ? "Electrodomèstic: un mòdul dividit el porta a cada compartiment (una columna amb el forn i el microones)." : undefined}>
        <IconChoice
          hideLabel
          label="Tipus"
          value={type}
          options={(Object.keys(TYPE_ICON) as ModuleType[]).map((t) => ({ value: t, label: MODULE_TYPE_LABELS[t], icon: TYPE_ICON[t], hint: TYPE_HINT[t], disabled: t === "appliance" && split }))}
          onChange={(t) => updateModule(setModuleType(module, t, here))}
        />
      </FormRow>
      {type === "appliance" && (
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
